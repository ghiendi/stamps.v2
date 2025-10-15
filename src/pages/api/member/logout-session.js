// /src/pages/api/member/logout-session.js
// Logout một phiên cụ thể (không ảnh hưởng cookie hiện tại)
import { get_session, destroy_session } from '@/lib/session';
import { get_redis, get_ns_prefix } from '@/lib/redis';
import { assert_rate_limit, parse_rate_env, build_rate_key } from '@/lib/rate_limit';

function build_idx_key(member_id) {
  const ns = get_ns_prefix();
  return `${ns}sess_idx:${member_id}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const cookie_name = process.env.SESSION_COOKIE_NAME || 'SESSION_ID';
  const sid = req.cookies?.[cookie_name];
  const sess = sid ? await get_session(sid) : null;
  if (!sess?.member_id) {
    return res.status(401).json({ ok: false, errors: { _global: 'Unauthorized' } });
  }

  // rate-limit theo session
  const { limit, window_sec } = parse_rate_env(process.env.RATE_LOGOUT_ONE || '30:10m', '30:10m');
  const rl_key = build_rate_key('logout:one', sid);
  const rl = await assert_rate_limit(get_redis(), { key: rl_key, limit, window_sec });
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retry_after_sec));
    return res.status(429).json({ ok: false, errors: { _global: 'Too many requests. Please wait a moment and try again.' } });
  }

  const body = req.body || {};
  const target_session_id = String(body.session_id || '').trim();
  if (!target_session_id) {
    return res.status(200).json({ ok: false, errors: { _global: 'Session id is required.' } });
  }
  if (target_session_id === sid) {
    // (vi) Không cho xoá phiên hiện tại bằng endpoint này
    return res.status(200).json({ ok: false, errors: { _global: 'Cannot terminate the current session from here.' } });
  }

  // Kiểm tra target session có thuộc user hiện tại không (dựa vào index set)
  const idx_key = build_idx_key(sess.member_id);
  const redis = get_redis();
  const is_member = await redis.sismember(idx_key, target_session_id);
  if (!is_member) {
    return res.status(200).json({ ok: false, errors: { _global: 'Session not found.' } });
  }

  await destroy_session(target_session_id);
  return res.status(200).json({ ok: true });
}
