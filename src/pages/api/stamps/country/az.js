// API trả danh sách quốc gia theo ký tự đầu (A–Z) + nhóm '#' cho ngoại lệ
// Có cache Redis TTL ngắn để tối ưu
// UI-facing tiếng Anh; comment tiếng Việt

import { get_dbr_pool } from '@/lib/db_read';
import { get_redis, get_ns_prefix } from '@/lib/redis';

const LIMIT_DEFAULT = 12;
const TTL = Number(process.env.AZ_CACHE_TTL || 600);

const handler = async (req, res) => {
  try {
    const pool = get_dbr_pool();
    const redis = get_redis();
    const ns = get_ns_prefix();

    // Lấy tham số letter & limit
    const raw_letter = String(req.query.letter || '').trim();
    const letter = raw_letter.toUpperCase().slice(0, 1);
    const limit = Number(req.query.limit || LIMIT_DEFAULT);

    // Hợp lệ: A..Z hoặc '#'
    if (!letter || (!/^[A-Z]$/.test(letter) && letter !== '#')) {
      return res.status(400).json({ error: 'Invalid letter' });
    }

    // Tạo key cache riêng cho mỗi letter
    const cache_key = `${ns}az:${letter}:${limit}`;

    // 1️⃣ Kiểm tra cache Redis trước
    try {
      const cached = await redis.get(cache_key);
      if (cached) return res.status(200).send(cached);
    } catch (err) {
      console.warn('Redis unavailable:', err?.message);
    }

    // 2️⃣ Tạo WHERE dynamic:
    // - Với '#': lấy các tên KHÔNG bắt đầu A–Z (sau khi TRIM)
    // - Với A..Z: so khớp prefix theo UPPER(...)
    const where_clause =
      letter === '#'
        ? `
          WHERE ia.type IN ('sovereign_state','intl_org')
            AND LEFT(TRIM(ia.name_base), 1) NOT REGEXP '^[A-Z]'
        `
        : `
          WHERE ia.type IN ('sovereign_state','intl_org')
            AND UPPER(TRIM(ia.name_base)) LIKE CONCAT(?, '%')
        `;

    const sql = `
      SELECT
        ia.slug,
        ia.name_base,
        ia.type,
        COALESCE(ac.stamp_count, 0) AS stamp_count
      FROM issuing_authority AS ia
      LEFT JOIN authority_counts AS ac ON ac.authority_id = ia.id
      ${where_clause}
      ORDER BY ia.name_base ASC
      LIMIT ?
    `;

    let conn;
    try {
      conn = await pool.getConnection();
      const params = letter === '#' ? [limit] : [letter, limit];
      const rows = await conn.query(sql, params);

      // Ghép URL cờ từ NEXT_PUBLIC_ASSETS_URL thay vì lấy từ DB
      const base_url = process.env.NEXT_PUBLIC_ASSETS_URL;
      const payload = (Array.isArray(rows) ? rows : []).map((r) => ({
        slug: r.slug,
        name_base: r.name_base,
        type: r.type,
        stamp_count: Number(r.stamp_count || 0),
        flag_image_url: `${base_url}/flags/${r.slug}.svg`,
      }));

      // 3️⃣ Ghi cache Redis TTL ngắn (2 phút)
      try {
        await redis.setex(cache_key, TTL, JSON.stringify(payload));
      } catch (err) {
        console.warn('Redis setex failed:', err?.message);
      }

      return res.status(200).json(payload);
    } finally {
      if (conn) conn.release();
    }
  } catch (err) {
    console.error('API A-Z error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export default handler;
