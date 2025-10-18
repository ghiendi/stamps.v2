// pages/api/member/register.js
// Đăng ký tài khoản: Zod validate, rate-limit, verify Turnstile, TX ghi DB, gửi email kích hoạt
import { get_dbw_pool } from '@/lib/db_write';
import { get_redis } from '@/lib/redis';
import { register_schema } from '@/lib/validators';
import { hash_password } from '@/lib/argon';
import { verify_turnstile } from '@/lib/turnstile';
import { generate_activation_token } from '@/lib/tokens';
import { build_activation_url } from '@/lib/urls';
import { send_activation_email } from '@/lib/email';
import { log_member_activity } from '@/lib/logger';
import { assert_rate_limit, parse_rate_env, build_rate_key, sha256_hex } from '@/lib/rate_limit';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
  const redis = get_redis();

  // 1) Rate-limit per-IP cho register
  const { limit: rl_ip_limit, window_sec: rl_ip_win } = parse_rate_env(process.env.RATE_REGISTER_IP, '5:15m');
  const rl_ip_key = build_rate_key('register:ip', ip || 'unknown');
  {
    const rl = await assert_rate_limit(redis, { key: rl_ip_key, limit: rl_ip_limit, window_sec: rl_ip_win });
    if (!rl.ok) {
      res.setHeader('Retry-After', String(rl.retry_after_sec));
      return res.status(429).json({ ok: false, errors: { _global: 'Too many requests. Please wait a moment and try again.' } });
    }
  }

  // 2) Validate body (Zod)
  const parsed = register_schema.safeParse(req.body || {});
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const field_errors = {};
    for (const k in flat) field_errors[k] = flat[k]?.[0] || 'Invalid';
    return res.status(200).json({ ok: false, errors: field_errors });
  }
  const { email, fullname, nickname, password, turnstile_token } = parsed.data;

  // 3) Verify Turnstile
  const ok_captcha = await verify_turnstile(turnstile_token, ip);
  if (!ok_captcha) {
    return res.status(200).json({ ok: false, errors: { _global: 'Captcha verification failed. Please try again.' } });
  }

  // 4) Rate-limit per-email
  const { limit: rl_em_limit, window_sec: rl_em_win } = parse_rate_env(process.env.RATE_REGISTER_EMAIL, '3:15m');
  const email_hash = sha256_hex(String(email || '').toLowerCase());
  const rl_em_key = build_rate_key('register:email', email_hash);
  {
    const rl = await assert_rate_limit(redis, { key: rl_em_key, limit: rl_em_limit, window_sec: rl_em_win });
    if (!rl.ok) {
      res.setHeader('Retry-After', String(rl.retry_after_sec));
      return res.status(429).json({ ok: false, errors: { _global: 'Too many requests. Please wait a moment and try again.' } });
    }
  }

  // 5) Transaction ghi DB
  const dbw = get_dbw_pool();
  let conn = null;
  try {
    conn = await dbw.getConnection();
    await conn.beginTransaction();

    const password_hash = await hash_password(password);

    const insert_member_sql = `
      INSERT INTO members (email, fullname, nickname, password_hash, status, created_at)
      VALUES (?, ?, ?, ?, 'INACTIVE', NOW())
    `;
    const result_member = await conn.query(insert_member_sql, [email, fullname, nickname || null, password_hash]);
    const member_id = result_member?.insertId;

    const { raw_token, token_hash, expires_at } = generate_activation_token();
    const insert_token_sql = `
      INSERT INTO member_tokens (member_id, token_type, token_value, is_used, expires_at, created_at)
      VALUES (?, 'ACTIVATION', ?, 0, ?, NOW())
    `;
    await conn.query(insert_token_sql, [member_id, token_hash, expires_at]);

    await log_member_activity(conn, member_id, 'REGISTERED', ip);

    await conn.commit();

    // 6) Gửi email kích hoạt (ngoài TX)
    const activation_url = build_activation_url(raw_token);
    await send_activation_email(email, fullname, activation_url);

    return res.status(200).json({ ok: true });
  } catch (e) {
    try { await conn?.rollback(); } catch { }
    const is_dup = e?.code === 'ER_DUP_ENTRY' || e?.errno === 1062;
    if (is_dup) {
      return res.status(200).json({ ok: false, errors: { _global: 'We couldn’t create your account. Please review your information and try again.' } });
    }
    console.error('register_error', e);
    return res.status(200).json({ ok: false, errors: { _global: 'We couldn’t create your account. Please try again later.' } });
  } finally {
    try { await conn?.release(); } catch { }
  }
}
