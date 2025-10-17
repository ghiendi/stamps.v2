// API autocomplete cho Country Picker
// - Dùng get_cache() để cache Redis TTL ngắn theo tham số q
// - Tìm kiếm 2 pha: prefix trước (LIKE 'q%'), thiếu thì bổ sung infix (LIKE '%q%')
// - Đọc stamp_count từ authority_counts (nhanh); fallback subquery COUNT nếu thiếu
// - Flag URL build từ NEXT_PUBLIC_ASSETS_URL và slug

import { get_dbr_pool } from '@/lib/db_read';
import { get_cache } from '@/lib/cache';
import { normalize_query } from '@/lib/normalize';

const LIMIT = 10;
const TTL = Number(process.env.SEARCH_CACHE_TTL || 120); // TTL gõ liên tục → mặc định 60s

const handler = async (req, res) => {
  try {
    const raw = String(req.query.q || '');
    const q = normalize_query(raw);

    // Bảo vệ: yêu cầu tối thiểu 2 ký tự
    if (q.length < 2) return res.status(200).json([]);

    // Khoá cache theo q + LIMIT
    const cache_key = `search:q:${q}:${LIMIT}`;

    // 1) Lấy dữ liệu qua get_cache
    const payload = await get_cache(cache_key, TTL, async () => {
      const pool = get_dbr_pool();
      let conn;

      try {
        conn = await pool.getConnection();

        // 2) Pha 1: prefix
        let rows = await search_db(conn, q, true, LIMIT);

        // 3) Pha 2: nếu chưa đủ LIMIT, bổ sung infix
        if (rows.length < LIMIT) {
          const more = await search_db(conn, q, false, LIMIT);
          const seen = new Set(rows.map(r => r.slug));
          for (const r of more) {
            if (!seen.has(r.slug)) rows.push(r);
            if (rows.length >= LIMIT) break;
          }
        }

        // 4) Chuẩn payload trả về (build flag URL từ slug)
        const base_url = process.env.NEXT_PUBLIC_ASSETS_URL;
        const result = rows.map(r => ({
          slug: r.slug,
          name_base: r.name_base,
          type: r.type,
          flag_image_url: `${base_url}/flags/${r.slug}.svg`,
          stamp_count: Number(r.stamp_count || 0),
        }));

        return result;
      } finally {
        if (conn) conn.release();
      }
    });

    // 5) Trả kết quả
    return res.status(200).json(payload);
  } catch (err) {
    console.error('API search error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Truy vấn DB cho một pha tìm kiếm
// - is_prefix = true  → LIKE 'q%'
// - is_prefix = false → LIKE '%q%'
const search_db = async (conn, q, is_prefix, limit) => {
  // Lưu ý:
  // - Đã normalize q ở tầng ứng dụng (lowercase, bỏ dấu)
  // - So khớp trên LOWER(name_base) để ổn định
  // - COALESCE(ac.stamp_count, sc.stamp_count) → ưu tiên bảng tổng hợp
  const like_value = is_prefix ? `${q}%` : `%${q}%`;

  const sql = `
    SELECT
      ia.slug,
      ia.name_base,
      ia.type,
      COALESCE(ac.stamp_count, sc.stamp_count, 0) AS stamp_count
    FROM issuing_authority AS ia
    LEFT JOIN authority_counts AS ac
      ON ac.authority_id = ia.id
    LEFT JOIN (
      /* Fallback đếm tem khi thiếu dữ liệu tổng hợp */
      SELECT i.issuing_authority_id, COUNT(s.id) AS stamp_count
      FROM issue AS i
      LEFT JOIN stamp AS s ON s.issue_id = i.id
      GROUP BY i.issuing_authority_id
    ) AS sc
      ON sc.issuing_authority_id = ia.id
    WHERE ia.type IN ('sovereign_state','intl_org')
      AND LOWER(ia.name_base) LIKE ?
    ORDER BY
      (LOWER(ia.name_base) LIKE ?) DESC,  /* ưu tiên prefix match */
      ia.name_base ASC
    LIMIT ?
  `;

  const rows = await conn.query(sql, [like_value, `${q}%`, limit]);
  return Array.isArray(rows) ? rows : [];
};

export default handler;