// Redis singleton (server-only). Không import ioredis ở top-level để tránh bị bundle vào client.
let _redis = null;
let _ns = null;

function ensure_server_env() {
  if (typeof window !== 'undefined') {
    throw new Error('Redis client is server-only. Do not import/use it on the client.');
  }
}

export function get_ns_prefix() {
  if (_ns) return _ns;
  const ns = process.env.REDIS_NAMESPACE || 'sg_';
  _ns = ns;
  return _ns;
}

export function get_redis() {
  ensure_server_env();

  if (_redis) return _redis;

  // 👇 Chỉ require khi đang ở server
  const IORedis = require('ioredis');
  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  const opt = {
    // (vi) thêm các option khác nếu cần
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: false,
  };
  _redis = new IORedis(url, opt);
  return _redis;
}
