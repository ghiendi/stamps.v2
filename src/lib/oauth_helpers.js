// Helper OAuth (state/PKCE/redirect + rate limit)
import crypto from 'crypto';
import { get_redis } from './redis';
import { assert_rate_limit, parse_rate_env, build_rate_key } from './rate_limit';

const OAUTH_STATE_TTL_SECONDS = Number(process.env.OAUTH_STATE_TTL_SECONDS || 600);

// (vi) Tạo state ngẫu nhiên
export function gen_state() {
  return crypto.randomBytes(16).toString('hex');
}

// (vi) Tạo cặp PKCE cho Google
export function gen_pkce_pair() {
  const verifier = crypto.randomBytes(32).toString('base64url'); // ready for URL
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

// (vi) Lưu state (+optional pkce_verifier) vào Redis
export async function save_state(provider, state, { ip, pkce_verifier }) {
  const redis = get_redis();
  const payload = JSON.stringify({ provider, ip, pkce_verifier, created_at: Date.now() });
  await redis.setex(`oauth_state:${state}`, OAUTH_STATE_TTL_SECONDS, payload);
}

// (vi) Lấy và xoá state (one-time)
export async function pop_state(state) {
  const redis = get_redis();
  const key = `oauth_state:${state}`;
  const raw = await redis.get(key);
  if (!raw) return null;
  await redis.del(key);
  try { return JSON.parse(raw); } catch { return null; }
}

// (vi) Rate-limit cho /start và /callback
export async function assert_oauth_rl(req, kind) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
  const key = build_rate_key(`oauth:${kind}:ip`, ip || 'unknown');
  const env_key = kind === 'start' ? process.env.RATE_OAUTH_START_IP : process.env.RATE_OAUTH_CB_IP;
  const { limit, window_sec } = parse_rate_env(env_key, kind === 'start' ? '30:10m' : '60:10m');
  const redis = get_redis();
  const rl = await assert_rate_limit(redis, { key, limit, window_sec });
  return rl;
}
