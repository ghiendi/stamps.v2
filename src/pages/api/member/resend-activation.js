// Gửi lại email kích hoạt: rate-limit, tạo token mới, đánh dấu token cũ là used
import { get_dbw_pool } from '@/lib/db_write';
import { get_redis } from '@/lib/redis';
import { resend_schema } from '@/lib/validators';
import { generate_activation_token } from '@/lib/tokens';
import { build_activation_url } from '@/lib/urls';
import { send_activation_email } from '@/lib/email';
import { assert_rate_limit, parse_rate_env, build_rate_key, sha256_hex } from '@/lib/rate_limit';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
  const redis = get_redis();

  // Rate-limit per-IP cho resend
  const { limit: rl_ip_limit, window_sec: rl_ip_win } = parse_rate_env(process.env.RATE_RESEND_EMAIL, '5:24h');
  const rl_ip_key = build_rate_key('resend:ip', ip || 'unknown');
  {
    const rl = await assert_rate_limit(redis, { key: rl_ip_key, limit: rl_ip_limit, window_sec: rl_ip_win });
    if (!rl.ok) {
      res.setHeader('Retry-After', String(rl.retry_after_sec));
      return res.status(429).json({ ok: false, errors: { _global: 'Too many requests. Please wait a moment and try again.' } });
    }
  }

  // Validate body
  const parsed = resend_schema.safeParse(req.body || {});
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const field_errors = {};
    for (const k in flat) field_errors[k] = flat[k]?.[0] || 'Invalid';
    return res.status(200).json({ ok: false, errors: field_errors });
  }
  const { email } = parsed.data;

  // Rate-limit per-email
  const email_hash = sha256_hex(String(email || '').toLowerCase());
  const rl_em_key = build_rate_key('resend:email', email_hash);
  {
    const rl = await assert_rate_limit(redis, { key: rl_em_key, limit: rl_ip_limit, window_sec: rl_ip_win });
    if (!rl.ok) {
      res.setHeader('Retry-After', String(rl.retry_after_sec));
      return res.status(429).json({ ok: false, errors: { _global: 'Too many requests. Please wait a moment and try again.' } });
    }
  }

  const dbw = get_dbw_pool();
  let conn = null;
  try {
    conn = await dbw.getConnection();
    await conn.beginTransaction();

    // Tìm user INACTIVE; để tránh enumeration, không lỗi nếu không tìm thấy
    const sel = await conn.query(`SELECT id, fullname FROM members WHERE email=? AND status='INACTIVE' LIMIT 1`, [email]);
    if (sel.length > 0) {
      const member = sel[0];

      // Revoke token cũ
      await conn.query(`UPDATE member_tokens SET is_used=1 WHERE member_id=? AND token_type='ACTIVATION' AND is_used=0`, [member.id]);

      // Tạo token mới
      const { raw_token, token_hash, expires_at } = generate_activation_token();
      await conn.query(
        `INSERT INTO member_tokens (member_id, token_type, token_value, is_used, expires_at, created_at)
         VALUES (?, 'ACTIVATION', ?, 0, ?, NOW())`,
        [member.id, token_hash, expires_at]
      );

      await conn.commit();

      // Gửi email mới
      const activation_url = build_activation_url(raw_token);
      await send_activation_email(email, member.fullname || '', activation_url);
    } else {
      await conn.commit(); // Không có tài khoản phù hợp → vẫn commit cho đơn giản
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    try { await conn?.rollback(); } catch { }
    console.error('resend_error', e);
    return res.status(200).json({ ok: true }); // Không lộ thông tin nhạy cảm
  } finally {
    try { await conn?.release(); } catch { }
  }
}
