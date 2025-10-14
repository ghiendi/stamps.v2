// Rate-limit kiểu fixed-window: INCR + TTL
import crypto from 'crypto';
import { get_ns_prefix } from './redis';

export async function assert_rate_limit(redis, { key, limit, window_sec }) {
  // (vi) Atomic INCR + set TTL nếu lần đầu
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, window_sec);
  }
  if (count > limit) {
    // (vi) Lấy TTL còn lại để set Retry-After
    const ttl = await redis.ttl(key);
    return { ok: false, retry_after_sec: Math.max(ttl, 1) };
  }
  return { ok: true };
}

export function sha256_hex(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

export function parse_rate_env(env_value, fallback) {
  // (vi) parse dạng "5:15m" -> { limit:5, window_sec:900 }
  const val = env_value || fallback;
  const [limit_str, window_str] = String(val).split(':');
  const limit = Number(limit_str || '5');
  const m = /^(\d+)(s|m|h)$/.exec(window_str || '15m');
  let window_sec = 900;
  if (m) {
    const n = Number(m[1]);
    window_sec = m[2] === 's' ? n : m[2] === 'm' ? n * 60 : n * 3600;
  }
  return { limit, window_sec };
}

export function build_rate_key(kind, ip_or_hash) {
  const ns = get_ns_prefix();
  return `${ns}rate:${kind}:${ip_or_hash}`;
}
