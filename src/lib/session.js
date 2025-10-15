// /src/lib/session.js
import https from 'https';
import crypto from 'crypto';
import { get_redis, get_ns_prefix } from './redis';

const GEO_TTL_SECONDS = 7 * 24 * 3600;

function build_sess_key(session_id) {
  const ns = get_ns_prefix();
  return `${ns}sess:${session_id}`;
}
function build_idx_key(member_id) {
  const ns = get_ns_prefix();
  return `${ns}sess_idx:${member_id}`;
}

function geo_cache_key(ip) {
  const ns = get_ns_prefix();
  return `${ns}geo:${ip}`;
}

function is_private_ip(ip) {
  return (
    !ip ||
    /^127\./.test(ip) || /^10\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) ||
    ip === '::1'
  );
}

function get_json_https(url, timeout_ms = 1800) {
  return new Promise((resolve) => {
    const req = https.get(url, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (raw += c));
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } });
    });
    req.on('timeout', () => { try { req.destroy(); } catch { } resolve(null); });
    req.on('error', () => resolve(null));
    req.setTimeout(timeout_ms);
  });
}

function normalize_geo(obj, source) {
  if (!obj) return null;
  if (source === 'ipapi') {
    const country = obj.country_name || null;
    const code = obj.country_code || obj.country || null;
    const city = obj.city || null;
    if (!country && !code) return null;
    return { city, country, code };
  }
  if (source === 'ipwhois') {
    if (obj.success === false) return null;
    const country = obj.country || null;
    const code = obj.country_code || null;
    const city = obj.city || null;
    if (!country && !code) return null;
    return { city, country, code };
  }
  if (source === 'ipinfo') {
    const country = obj.country || null; // ISO code
    const city = obj.city || null;
    // ipinfo (free) chỉ trả code, ta không có country name → vẫn dùng code để hiển thị cờ
    if (!country && !city) return null;
    return { city, country: null, code: country };
  }
  return null;
}

async function lookup_geo(ip) {
  if (is_private_ip(ip)) return null;
  const redis = get_redis();
  const ck = geo_cache_key(ip);

  // cache hit
  const cached = await redis.get(ck).catch(() => null);
  if (cached) { try { return JSON.parse(cached); } catch { } }

  // query ipwho.is (gọn, nhanh)
  const j = await get_json_https(`https://ipwho.is/${ip}`, 1800);
  if (!j || j.success === false) return null;

  const out = {
    city: j.city || null,
    country: j.country || null,
    code: j.country_code || null,
  };
  if (!out.city && !out.country && !out.code) return null;

  await redis.setex(ck, GEO_TTL_SECONDS, JSON.stringify(out)).catch(() => { });
  return out;
}

// (vi) Tạo session mới + thêm vào index theo member_id
export async function create_session(member_id, ip, ua, remember_me) {
  const redis = get_redis();
  const session_id = crypto.randomBytes(16).toString('hex');
  const ttl_sec = remember_me
    ? Number(process.env.SESSION_REMEMBER_TTL_DAYS || 14) * 24 * 3600
    : Number(process.env.SESSION_TTL_HOURS || 24) * 3600;

  console.log('create_session_start', { ip, ua });

  const key = build_sess_key(session_id);
  const mid = typeof member_id === 'bigint' ? Number(member_id) : member_id;

  // 1) Ghi session ngay (geo null) để không chặn login
  const base = {
    member_id: mid,
    ip_address: ip || null,
    user_agent: ua || null,
    remember_me: !!remember_me,
    created_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    geo: null,
  };
  await redis.setex(key, ttl_sec, JSON.stringify(base));

  // Index theo member_id
  const idx_key = build_idx_key(mid);
  await redis.sadd(idx_key, session_id);

  // 2️⃣ Tra cứu geo hoàn toàn tách khỏi luồng callback
  setTimeout(async () => {
    try {
      const geo = await Promise.race([
        lookup_geo(ip),
        new Promise((resolve) => setTimeout(() => resolve(null), 1200)), // chặn tối đa 1.2s
      ]);
      if (geo) {
        const cur = await redis.get(key);
        if (cur) {
          const obj = JSON.parse(cur);
          obj.geo = geo;
          const ttl = await redis.ttl(key);
          await redis.setex(key, ttl > 0 ? ttl : 60, JSON.stringify(obj));
        }
      }
      console.log('lookup_geo_done', geo);
    } catch (e) {
      console.warn('lookup_geo_bg_error', e?.message || e);
    }
  }, 10);
  return { session_id, ttl_sec };
}

export async function touch_session(session_id) {
  if (!session_id) return;
  const redis = get_redis();
  const key = build_sess_key(session_id);
  const json = await redis.get(key);
  if (!json) return;
  try {
    const obj = JSON.parse(json);
    obj.last_seen_at = new Date().toISOString();
    const ttl = await redis.ttl(key);
    await redis.setex(key, ttl > 0 ? ttl : 60, JSON.stringify(obj));

    // (vi) đảm bảo index tồn tại
    const member_id = obj?.member_id;
    if (member_id != null) {
      const idx_key = build_idx_key(member_id);
      await redis.sadd(idx_key, session_id);
    }
  } catch { }
}

export async function destroy_session(session_id) {
  if (!session_id) return;
  const redis = get_redis();
  const key = build_sess_key(session_id);
  const json = await redis.get(key);
  await redis.del(key);

  try {
    if (json) {
      const obj = JSON.parse(json);
      const member_id = obj?.member_id;
      if (member_id != null) {
        const idx_key = build_idx_key(member_id);
        await redis.srem(idx_key, session_id);
      }
    }
  } catch { }
}

export async function destroy_all_sessions(member_id) {
  const redis = get_redis();
  const mid = typeof member_id === 'bigint' ? Number(member_id) : member_id;
  const idx_key = build_idx_key(mid);
  const ids = await redis.smembers(idx_key);
  if (ids && ids.length) {
    const pipeline = redis.multi();
    for (const sid of ids) pipeline.del(build_sess_key(sid));
    pipeline.del(idx_key);
    await pipeline.exec();
  } else {
    await redis.del(idx_key).catch(() => { });
  }
}

export async function get_session(session_id) {
  if (!session_id) return null;
  const redis = get_redis();
  const json = await redis.get(build_sess_key(session_id));
  if (!json) return null;
  try { return JSON.parse(json); } catch { return null; }
}

export async function list_sessions(member_id, current_session_id = '') {
  const redis = get_redis();
  const mid = typeof member_id === 'bigint' ? Number(member_id) : member_id;
  const idx_key = build_idx_key(mid);
  let ids = await redis.smembers(idx_key);

  if ((!ids || !ids.length) && current_session_id) {
    const cur_json = await redis.get(build_sess_key(current_session_id));
    if (cur_json) {
      try {
        await redis.sadd(idx_key, current_session_id);
        ids = [current_session_id];
      } catch { }
    }
  }

  const out = [];
  if (!ids || !ids.length) return out;

  for (const sid of ids) {
    const json = await redis.get(build_sess_key(sid));
    if (!json) {
      await redis.srem(idx_key, sid);
      continue;
    }
    try {
      const obj = JSON.parse(json);
      out.push({
        session_id: sid,
        ip_address: obj.ip_address || null,
        user_agent: obj.user_agent || null,
        created_at: obj.created_at || null,
        last_seen_at: obj.last_seen_at || null,
        geo: obj.geo || null, // (vi) thêm geo ra API
        current: sid === current_session_id,
      });
    } catch { }
  }

  out.sort((a, b) => new Date(b.last_seen_at || b.created_at) - new Date(a.last_seen_at || a.created_at));
  return out;
}
