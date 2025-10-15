// POST /api/member/forgot
// Nhận email + captcha, gửi email reset nếu tồn tại
import crypto from 'crypto';
import { forgot_schema } from '@/lib/validators';
import { get_dbr_pool } from '@/lib/db_read';
import { get_dbw_pool } from '@/lib/db_write';
import { get_redis, get_ns_prefix } from '@/lib/redis';
import { parse_rate_env, build_rate_key, assert_rate_limit } from '@/lib/rate_limit';
import { log_member_activity } from '@/lib/logger';
import { send_password_reset_email } from '@/lib/email';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const redis = get_redis();

  const parsed = forgot_schema.safeParse(req.body || {});
  if (!parsed.success) {
    const errs = parsed.error.flatten().fieldErrors;
    const field_errors = {};
    for (const k in errs) field_errors[k] = errs[k][0];
    return res.status(200).json({ ok: false, errors: field_errors });
  }

  const { email, turnstile_token } = parsed.data;
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
  const ua = req.headers['user-agent'] || '';

  // ✅ Verify Turnstile
  const secret = process.env.TURNSTILE_SECRET_KEY;
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: turnstile_token, remoteip: ip }),
    });
    const j = await r.json();
    if (!j.success) {
      return res.status(200).json({ ok: false, errors: { _global: 'Captcha verification failed.' } });
    }
  } catch {
    return res.status(200).json({ ok: false, errors: { _global: 'Captcha verification failed.' } });
  }

  // ✅ Rate limit theo IP và email
  const { limit: limit_ip, window_sec: w_ip } = parse_rate_env(process.env.RATE_FORGOT_PER_IP, '30:15m');
  const { limit: limit_em, window_sec: w_em } = parse_rate_env(process.env.RATE_FORGOT_PER_EMAIL, '5:15m');
  const rl1 = await assert_rate_limit(redis, { key: build_rate_key('forgot:ip', ip), limit: limit_ip, window_sec: w_ip });
  const rl2 = await assert_rate_limit(redis, { key: build_rate_key('forgot:email', email.toLowerCase()), limit: limit_em, window_sec: w_em });
  if (!rl1.ok || !rl2.ok) {
    res.setHeader('Retry-After', String(rl1.retry_after_sec || rl2.retry_after_sec || 60));
    return res.status(429).json({ ok: false, errors: { _global: 'Too many requests. Please try again later.' } });
  }

  // ✅ Tìm member
  const dbr = get_dbr_pool();
  const [member] = await dbr.query(`SELECT id, email, fullname FROM members WHERE email=? LIMIT 1`, [email]);
  if (!member) {
    // Không lộ enumeration
    return res.status(200).json({ ok: true });
  }

  // ✅ Tạo token
  const token_plain = crypto.randomBytes(24).toString('hex');
  const token_hash = crypto.createHash('sha256').update(token_plain).digest('hex');
  const expires_at = new Date(Date.now() + Number(process.env.RESET_TOKEN_TTL_HOURS || 2) * 3600 * 1000);

  const dbw = get_dbw_pool();
  await dbw.query(
    `INSERT INTO member_password_resets (member_id, token_hash, expires_at, created_ip, user_agent)
     VALUES (?, ?, ?, ?, ?)`,
    [member.id, token_hash, expires_at, ip, ua]
  );

  await log_member_activity(dbw, member.id, 'PASSWORD_RESET_REQUESTED', ip);

  // ✅ Gửi email (nếu lỗi vẫn không báo)
  const site = process.env.APP_BASE_URL;
  const reset_url = `${site}/member/reset/${token_plain}`;
  send_password_reset_email(member.email, member.fullname, reset_url).catch(e => {
    console.error('reset_email_failed', e);
  });

  return res.status(200).json({ ok: true });
}
