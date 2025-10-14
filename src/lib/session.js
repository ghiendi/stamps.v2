// Quản lý phiên (session) người dùng bằng Redis
import crypto from 'crypto';
import { get_redis, get_ns_prefix } from './redis';

function build_sess_key(session_id) {
  const ns = get_ns_prefix();
  return `${ns}sess:${session_id}`;
}

// (vi) Tạo session mới trong Redis
export async function create_session(member_id, ip, ua, remember_me) {
  const redis = get_redis();
  const session_id = crypto.randomBytes(16).toString('hex');
  const ttl_sec = remember_me
    ? Number(process.env.SESSION_REMEMBER_TTL_DAYS || 14) * 24 * 3600
    : Number(process.env.SESSION_TTL_HOURS || 24) * 3600;

  const key = build_sess_key(session_id);
  const data = JSON.stringify({
    member_id,
    ip_address: ip || null,
    user_agent: ua || null,
    remember_me: !!remember_me,
    created_at: new Date().toISOString(),
  });

  await redis.setex(key, ttl_sec, data);
  return { session_id, ttl_sec };
}

// (vi) Xóa session trong Redis
export async function destroy_session(session_id) {
  if (!session_id) return;
  const redis = get_redis();
  await redis.del(build_sess_key(session_id));
}

// (vi) Lấy thông tin session
export async function get_session(session_id) {
  if (!session_id) return null;
  const redis = get_redis();
  const json = await redis.get(build_sess_key(session_id));
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
