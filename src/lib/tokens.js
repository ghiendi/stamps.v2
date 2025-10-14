// Tạo token kích hoạt: raw + hash + expires_at
import crypto from 'crypto';

export function generate_activation_token() {
  // (vi) Raw token hex 64 ký tự
  const raw_token = crypto.randomBytes(32).toString('hex');
  const token_hash = crypto.createHash('sha256').update(raw_token).digest('hex');
  const ttl_hours = parseInt(process.env.TOKEN_ACTIVATION_TTL_HOURS || '24', 10);
  const expires_at = new Date(Date.now() + ttl_hours * 60 * 60 * 1000);
  return { raw_token, token_hash, expires_at };
}
