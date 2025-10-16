// API autocomplete: Redis cache -> MariaDB (prefix trước, infix fallback)
import { get_dbr_pool } from '@/lib/db_read';
import { get_redis, get_ns_prefix } from '@/lib/redis';
import { normalize_query } from '@/lib/normalize';

const LIMIT = 10;                                   // số item tối đa trả về trong dropdown
const TTL = Number(process.env.SEARCH_CACHE_TTL || 120);

const handler = async (req, res) => {
  try {
    const raw = String(req.query.q || '');
    const q = normalize_query(raw);
    if (q.length < 2) return res.status(200).json([]); // yêu cầu tối thiểu 2 ký tự

    // Tạo key Redis theo namespace dự án
    const redis = get_redis();
    const ns = get_ns_prefix();
    const cache_key = `${ns}search:q:${q}`;

    // 1) Đọc cache Redis trước để tối ưu độ trễ khi gõ liên tục
    try {
      const cached = await redis.get(cache_key);
      if (cached) return res.status(200).send(cached);
    } catch (err) {
      console.warn('Redis unavailable:', err?.message);
    }

    // 2) Query DB: ưu tiên prefix (LIKE 'q%') để tận dụng index name_base
    let rows = await search_db(q, true);

    // 3) Nếu chưa đủ LIMIT, fallback thêm infix (LIKE '%q%') để bù danh sách
    if (rows.length < LIMIT) {
      const infix_rows = await search_db(q, false);
      const seen = new Set(rows.map((r) => r.slug));
      for (const r of infix_rows) {
        if (!seen.has(r.slug)) rows.push(r);
        if (rows.length >= LIMIT) break;
      }
    }

    // 4) Chuẩn payload gọn cho dropdown (đủ để render: flag + name + count)
    const payload = rows.map((r) => ({
      slug: r.slug,
      name_base: r.name_base,
      type: r.type,                                  // để gắn tag 'Organization' nếu cần
      flag_image_url: r.flag_image_url || null,      // nếu có thì UI hiển thị cờ
      stamp_count: Number(r.stamp_count || 0),       // số tem (đọc từ authority_counts nếu có)
    }));

    // 5) Ghi lại cache Redis (TTL ngắn)
    try {
      await redis.setex(cache_key, TTL, JSON.stringify(payload));
    } catch (err) {
      console.warn('Redis setex failed:', err?.message);
    }

    return res.status(200).json(payload);
  } catch (err) {
    console.error('API search error:', err);
    // Thông báo lỗi tiếng Anh (UI-facing)
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const search_db = async (q, is_prefix) => {
  // Truy vấn MariaDB:
  // - Đã normalize q ở tầng ứng dụng: LOWER(name_base) LIKE ...
  // - Nếu DB dùng collation accent-insensitive (UCA ai_ci), có thể thêm COLLATE vào LIKE để nâng match.
  // - Đọc count từ authority_counts nếu có; fallback subquery COUNT(stamp) dành cho tối đa 10 rows.

  const pool = get_dbr_pool();
  const like_value = is_prefix ? `${q}%` : `%${q}%`;

  const sql = `
    SELECT
      ia.slug,
      ia.name_base,
      ia.type,
      CONCAT('${process.env.NEXT_PUBLIC_ASSETS_URL}', '/flags/', ia.slug, '.svg') AS flag_image_url,
      COALESCE(ac.stamp_count, sc.stamp_count, 0) AS stamp_count
    FROM issuing_authority ia
    LEFT JOIN authority_counts ac ON ac.authority_id = ia.id
    LEFT JOIN (
      /* Fallback đếm nhanh khi chưa có bảng authority_counts:
         issue (-> authority) -> stamp */
      SELECT i.issuing_authority_id, COUNT(s.id) AS stamp_count
      FROM issue i
      LEFT JOIN stamp s ON s.issue_id = i.id
      GROUP BY i.issuing_authority_id
    ) sc ON sc.issuing_authority_id = ia.id
    WHERE ia.type IN ('sovereign_state','intl_org')  -- lọc loại authority hiện hành
      AND LOWER(ia.name_base) LIKE ?
    ORDER BY
      (LOWER(ia.name_base) LIKE ?) DESC,             -- ưu tiên prefix match
      ia.name_base ASC
    LIMIT ?
  `;

  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(sql, [like_value, `${q}%`, LIMIT]);
    return Array.isArray(rows) ? rows : [];
  } finally {
    if (conn) conn.release();
  }
};

export default handler;
