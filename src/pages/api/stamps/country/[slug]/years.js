// pages/api/stamps/country/[slug]/years.js
// Trả danh sách năm có tem gốc (desc) cho 1 quốc gia

import { db_read } from '@/lib/db_read';

const get_authority = async (slug) => {
  const rows = await db_read(
    'SELECT id, slug, name_base FROM issuing_authority WHERE slug = ? LIMIT 1',
    [slug]
  );
  return rows?.[0] || null;
};

export default async function handler(req, res) {
  const { slug } = req.query;
  try {
    const authority = await get_authority(slug);
    if (!authority) return res.status(404).json({ ok: false, error: 'Authority not found' });

    const sql = `
      SELECT DISTINCT YEAR(i.release_date) AS y
      FROM issue i
      JOIN stamp s ON s.issue_id = i.id
      WHERE i.issuing_authority_id = ?
        AND s.variant_of IS NULL
        AND i.release_date IS NOT NULL
      ORDER BY y DESC
    `;
    const rows = await db_read(sql, [authority.id]);
    const years_available = rows.map(r => r.y);

    res.status(200).json({
      ok: true,
      country: {
        id: authority.id,
        slug: authority.slug,
        name: authority.name_base,
        flag_url: `${process.env.NEXT_PUBLIC_ASSETS_URL || ''}/flags/${authority.slug}.svg`,
      },
      years_available,
    });
  } catch (_e) {
    res.status(500).json({ ok: false, error: 'Server error' });
  }
}