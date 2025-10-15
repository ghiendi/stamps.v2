import { get_dbr_pool } from '@/lib/db_read';
import { get_dbw_pool } from '@/lib/db_write';
import { password_change_schema, password_set_schema } from '@/lib/validators';
import { get_session, touch_session } from '@/lib/session';
import { verify_password, hash_password } from '@/lib/argon';
import { assert_rate_limit, parse_rate_env, build_rate_key } from '@/lib/rate_limit';
import { log_member_activity } from '@/lib/logger';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const cookie_name = process.env.SESSION_COOKIE_NAME || 'SESSION_ID';
  const sid = req.cookies?.[cookie_name];
  const sess = sid ? await get_session(sid) : null;
  if (!sess?.member_id) {
    return res.status(401).json({ ok: false, errors: { _global: 'Unauthorized' } });
  }

  // rate-limit theo session
  const { limit, window_sec } = parse_rate_env(process.env.RATE_PASSWORD_CHANGE, '10:10m');
  const rl_key = build_rate_key('password:change', sid);
  const rl = await assert_rate_limit(require('@/lib/redis').get_redis(), { key: rl_key, limit, window_sec });
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retry_after_sec));
    return res.status(429).json({ ok: false, errors: { _global: 'Too many requests. Please wait a moment and try again.' } });
  }

  const dbr = get_dbr_pool();
  const rows = await dbr.query(`SELECT password_hash FROM members WHERE id=? LIMIT 1`, [sess.member_id]);
  const row = rows[0];
  if (!row) {
    return res.status(404).json({ ok: false, errors: { _global: 'Account not found.' } });
  }

  const has_password = !!row.password_hash;

  // ✅ Chọn schema theo trạng thái mật khẩu
  const schema = has_password ? password_change_schema : password_set_schema;
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const field_errors = {};
    for (const k in flat) field_errors[k] = flat[k]?.[0] || 'Invalid';
    return res.status(200).json({ ok: false, errors: field_errors });
  }

  const dbw = get_dbw_pool();

  // 🔁 Flow “Set password lần đầu”
  if (!has_password) {
    const { new_password } = parsed.data;
    const new_hash = await hash_password(new_password);
    await dbw.query(`UPDATE members SET password_hash=?, password_changed_at=NOW() WHERE id=?`, [new_hash, sess.member_id]);
    await log_member_activity(dbw, sess.member_id, 'PASSWORD_SET_FIRST', req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '');
    await touch_session(sid);
    return res.status(200).json({ ok: true, first_time: true });
  }

  // 🔐 Flow đổi mật khẩu bình thường
  const { current_password, new_password } = parsed.data;
  const ok = await verify_password(row.password_hash, current_password);
  if (!ok) {
    return res.status(200).json({ ok: false, errors: { _global: 'Invalid credentials. Please try again.' } });
  }

  const new_hash = await hash_password(new_password);
  await dbw.query(`UPDATE members SET password_hash=?, password_changed_at=NOW() WHERE id=?`, [new_hash, sess.member_id]);
  await log_member_activity(dbw, sess.member_id, 'PASSWORD_CHANGED', req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '');
  await touch_session(sid);

  return res.status(200).json({ ok: true });
}
