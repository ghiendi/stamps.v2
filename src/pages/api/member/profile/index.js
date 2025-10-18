// pages/api/member/profile/index.js
// GET: lấy thông tin member
// POST: cập nhật fullname, nickname
import { get_dbr_pool } from '@/lib/db_read';
import { get_dbw_pool } from '@/lib/db_write';
import { profile_update_schema } from '@/lib/validators';
import { get_session, touch_session } from '@/lib/session';
import { assert_rate_limit, parse_rate_env, build_rate_key } from '@/lib/rate_limit';
import { log_member_activity } from '@/lib/logger';

export default async function handler(req, res) {
  const cookie_name = process.env.SESSION_COOKIE_NAME || 'SESSION_ID';
  const sid = req.cookies?.[cookie_name];
  const sess = sid ? await get_session(sid) : null;
  if (!sess?.member_id) {
    return res.status(401).json({ ok: false, errors: { _global: 'Unauthorized' } });
  }

  // (vi) rate-limit theo session
  const kind = req.method === 'GET' ? 'profile:get' : 'profile:update';
  const { limit, window_sec } = parse_rate_env(
    req.method === 'GET' ? process.env.RATE_PROFILE_GET : process.env.RATE_PROFILE_UPDATE,
    req.method === 'GET' ? '120:10m' : '30:10m'
  );
  const rl_key = build_rate_key(kind, sid);
  const rl = await assert_rate_limit(require('@/lib/redis').get_redis(), { key: rl_key, limit, window_sec });
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retry_after_sec));
    return res.status(429).json({ ok: false, errors: { _global: 'Too many requests. Please wait a moment and try again.' } });
  }

  if (req.method === 'GET') {
    const dbr = get_dbr_pool();
    const rows = await dbr.query(
      `SELECT email, fullname, nickname, created_at,
          password_hash IS NOT NULL AS has_password
      FROM members WHERE id=? LIMIT 1`,
      [sess.member_id]
    );
    const row = rows[0] || null;
    await touch_session(sid);
    return res.status(200).json({ ok: true, data: row });
  }

  if (req.method === 'POST') {
    const parsed = profile_update_schema.safeParse(req.body || {});
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const field_errors = {};
      for (const k in flat) field_errors[k] = flat[k]?.[0] || 'Invalid';
      return res.status(200).json({ ok: false, errors: field_errors });
    }
    const { fullname, nickname } = parsed.data;
    const dbw = get_dbw_pool();
    await dbw.query(
      `UPDATE members SET fullname=?, nickname=?, updated_at=NOW() WHERE id=?`,
      [fullname, nickname || null, sess.member_id]
    );
    await log_member_activity(dbw, sess.member_id, 'PROFILE_UPDATED', req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '');
    await touch_session(sid);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
