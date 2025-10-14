// Kết nối Redis (ioredis) dùng cho rate-limit
import Redis from 'ioredis';
import { get_global_singleton } from './global_singleton';

export function get_redis() {
  return get_global_singleton('redis', () => {
    const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    const client = new Redis(url);
    return client;
  });
}

export function get_ns_prefix() {
  // Tiền tố key Redis (theo yêu cầu: REDIS_NAMESPACE=sg_)
  return String(process.env.REDIS_NAMESPACE || 'sg_');
}
