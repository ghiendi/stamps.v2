// API đăng nhập bằng email + password
// - Rate-limit per-IP + per-email
// - Verify Turnstile
// - Argon2id verify mật khẩu
// - Tạo session Redis + cookie HttpOnly
// - Không lộ enumeration

import { get_dbr_pool } from '@/lib/db_read';
import { get_redis } from '@/lib/redis';
import { login_schema } from '@/lib/validators';
import { verify_turnstile } from '@/lib/turnstile';
import { verify_password } from '@/lib/argon';
import { assert_rate_limit, parse_rate_env, build_rate_key, sha256_hex } from '@/lib/rate_limit';
import { create_session } from '@/lib/session';
import { log_member_activity } from '@/lib/logger';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
  const ua = req.headers['user-agent'] || '';
  const redis = get_redis();

  // 1. Rate-limit theo IP
  const { limit: rl_ip_limit, window_sec: rl_ip_win } = parse_rate_env(process.env.RATE_LOGIN_IP, '20:10m');
  const rl_ip_key = build_rate_key('login:ip', ip || 'unknown');
  {
    const rl = await assert_rate_limit(redis, { key: rl_ip_key, limit: rl_ip_limit, window_sec: rl_ip_win });
    if (!rl.ok) {
      res.setHeader('Retry-After', String(rl.retry_after_sec));
      return res.status(429).json({ ok: false, errors: { _global: 'Too many requests. Please wait a moment and try again.' } });
    }
  }

  // 2. Validate input (Zod)
  const parsed = login_schema.safeParse(req.body || {});
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const field_errors = {};
    for (const k in flat) field_errors[k] = flat[k]?.[0] || 'Invalid';
    return res.status(200).json({ ok: false, errors: field_errors });
  }

  const { email, password, turnstile_token, remember_me } = parsed.data;

  // 3. Verify Turnstile
  const ok_captcha = await verify_turnstile(turnstile_token, ip);
  if (!ok_captcha) {
    return res.status(200).json({ ok: false, errors: { _global: 'Captcha verification failed. Please try again.' } });
  }

  // 4. Rate-limit theo email
  const { limit: rl_em_limit, window_sec: rl_em_win } = parse_rate_env(process.env.RATE_LOGIN_EMAIL, '10:10m');
  const email_hash = sha256_hex(String(email || '').toLowerCase());
  const rl_em_key = build_rate_key('login:email', email_hash);
  {
    const rl = await assert_rate_limit(redis, { key: rl_em_key, limit: rl_em_limit, window_sec: rl_em_win });
    if (!rl.ok) {
      res.setHeader('Retry-After', String(rl.retry_after_sec));
      return res.status(429).json({ ok: false, errors: { _global: 'Too many requests. Please wait a moment and try again.' } });
    }
  }

  // 5. Kiểm tra user trong DB
  const dbr = get_dbr_pool();
  const rows = await dbr.query(
    `SELECT id, password_hash, status FROM members WHERE email=? LIMIT 1`,
    [email]
  );

  if (rows.length === 0) {
    // (vi) Giả lập thời gian verify argon2 để tránh timing attack
    await verify_password('$argon2id$v=19$m=65536,t=3,p=1$dummy$dummy', password).catch(() => { });
    await log_member_activity(dbr, 0, 'LOGIN_FAILED', ip);
    return res.status(200).json({ ok: false, errors: { _global: 'Invalid credentials. Please try again.' } });
  }

  const user = rows[0];
  if (user.status !== 'ACTIVE') {
    await log_member_activity(dbr, user.id, 'LOGIN_FAILED', ip);
    return res.status(200).json({ ok: false, errors: { _global: 'Invalid credentials. Please try again.' } });
  }

  const valid_pw = await verify_password(user.password_hash, password);
  if (!valid_pw) {
    await log_member_activity(dbr, user.id, 'LOGIN_FAILED', ip);
    return res.status(200).json({ ok: false, errors: { _global: 'Invalid credentials. Please try again.' } });
  }

  // 6. Tạo session + cookie
  const { session_id, ttl_sec } = await create_session(user.id, ip, ua, remember_me);

  // (vi) Thiết lập cookie HttpOnly
  res.setHeader('Set-Cookie', [
    `${process.env.SESSION_COOKIE_NAME || 'SESSION_ID'}=${session_id}; Path=/; Max-Age=${ttl_sec}; HttpOnly; Secure; SameSite=Lax`,
  ]);

  await log_member_activity(dbr, user.id, 'LOGIN_SUCCESS', ip);
  return res.status(200).json({ ok: true });
}
