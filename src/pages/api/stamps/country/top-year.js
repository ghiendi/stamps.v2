// Top countries theo năm hiện tại (số tem phát hành trong năm)

import { get_dbr_pool } from '@/lib/db_read';
import { get_cache } from '@/lib/cache';

const TTL = Number(process.env.TOP_CACHE_TTL || 300);

const handler = async (req, res) => {
  try {
    const pool = get_dbr_pool();

    const year = Number(req.query.year || new Date().getFullYear());
    const limit = Number(req.query.limit || 6);
    const cache_key = `top_year:${year}:${limit}`;
    const payload = await get_cache(cache_key, TTL, async () => {
      const sql = `
        SELECT
          ia.slug,
          ia.name_base,
          ia.type,
          COUNT(DISTINCT s.id) AS stamp_count
        FROM issuing_authority AS ia
        JOIN issue AS i ON i.issuing_authority_id = ia.id
        JOIN stamps AS s ON s.issue_id = i.id
        WHERE YEAR(i.release_date) = ?
          AND ia.type IN ('sovereign_state','intl_org')
        GROUP BY ia.id
        ORDER BY stamp_count DESC, ia.name_base ASC
        LIMIT ?
      `;
      let conn;
      try {
        conn = await pool.getConnection();
        const rows = await conn.query(sql, [year, limit]);
        const base_url = process.env.NEXT_PUBLIC_ASSETS_URL;
        const result = (Array.isArray(rows) ? rows : []).map(r => ({
          slug: r.slug,
          name_base: r.name_base,
          type: r.type,
          stamp_count: Number(r.stamp_count || 0),
          flag_image_url: `${base_url}/flags/${r.slug}.svg`,
        }));
        return result;
      } finally {
        if (conn) conn.release();
      }
    });
    return res.status(200).json(payload);
  } catch (err) {
    console.error('API top-year error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export default handler;
