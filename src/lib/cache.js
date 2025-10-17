import { get_redis, get_ns_prefix } from '@/lib/redis'

export const get_cache = async (key, ttl, fetch_fn) => {
  const redis = get_redis()
  const ns = get_ns_prefix()
  const cache_key = `${ns}${key}`
  try {
    const cached = await redis.get(cache_key)
    if (cached) return JSON.parse(cached)
  } catch { }
  const data = await fetch_fn()
  try { await redis.setex(cache_key, ttl, JSON.stringify(data)) } catch { }
  return data
}
