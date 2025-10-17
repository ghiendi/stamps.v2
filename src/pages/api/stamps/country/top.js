// API trả danh sách 'top countries' theo stamp_count (Quick Picks / theo region)
// - Hỗ trợ filter theo ?region=Asia|Europe|Africa|Americas|Oceania
// - Có Redis cache TTL ngắn để tối ưu

import { get_dbr_pool } from '@/lib/db_read';
import { get_cache } from '@/lib/cache';

const LIMIT_DEFAULT = 9; // 3x3 trên desktop, 2xN trên mobile
const TTL = Number(process.env.TOP_CACHE_TTL || 300); // TTL cache 2 phút

const handler = async (req, res) => {
  try {
    const pool = get_dbr_pool();

    // Đọc tham số: region (tuỳ chọn) & limit
    const raw_region = String(req.query.region || '').trim();
    const region = raw_region.length ? raw_region : null;
    const limit = Number(req.query.limit || LIMIT_DEFAULT);

    // Tạo cache key: có region thì kèm region, không thì 'all'
    const cache_key = `top:${region || 'all'}:${limit}`;
    // 1️⃣ Lấy dữ liệu qua get_cache — nếu chưa có thì fetch_fn sẽ chạy query
    const payload = await get_cache(cache_key, TTL, async () => {
      const where_region = region ? 'AND ia.region = ?' : '';
      const sql = `
        SELECT
          ia.slug,
          ia.name_base,
          ia.type,
          COALESCE(ac.stamp_count, 0) AS stamp_count
        FROM issuing_authority AS ia
        LEFT JOIN authority_counts AS ac ON ac.authority_id = ia.id
        WHERE ia.type IN ('sovereign_state','intl_org')
          ${where_region}
        ORDER BY ac.stamp_count DESC, ia.name_base ASC
        LIMIT ?
      `;
      let conn;
      try {
        conn = await pool.getConnection();
        const params = region ? [region, limit] : [limit];
        const rows = await conn.query(sql, params);
        // Ghép URL cờ dựa trên slug và NEXT_PUBLIC_ASSETS_URL
        const base_url = process.env.NEXT_PUBLIC_ASSETS_URL;
        const payload = (Array.isArray(rows) ? rows : []).map((r) => ({
          slug: r.slug,
          name_base: r.name_base,
          type: r.type,
          stamp_count: Number(r.stamp_count || 0),
          flag_image_url: `${base_url}/flags/${r.slug}.svg`,
        }));
        return payload;
      } finally {
        if (conn) conn.release();
      }
    });
    return res.status(200).json(payload);
  } catch (err) {
    console.error('API top countries error:', err);
    // Thông báo lỗi tiếng Anh (UI-facing)
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export default handler;
