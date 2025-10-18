// Trả danh sách quốc gia có ít nhất 1 tem gốc (dùng cho breadcrumbs)

import { db_read } from '@/lib/db_read';

export default async function handler(_req, res) {
  try {
    const sql = `
      SELECT ia.id, ia.slug, ia.name_base
      FROM issuing_authority ia
      WHERE EXISTS (
        SELECT 1
        FROM issue i
        JOIN stamps s ON s.issue_id = i.id
        WHERE i.issuing_authority_id = ia.id
          AND s.variant_of IS NULL
          AND (s.release_date IS NOT NULL OR i.release_date IS NOT NULL)
      )
      ORDER BY ia.name_base ASC
    `;
    const rows = await db_read(sql, []);
    const countries = rows.map(r => ({
      id: r.id,
      slug: r.slug,
      name: r.name_base,
      flag_url: `${process.env.NEXT_PUBLIC_ASSETS_URL || ''}/flags/${r.slug}.svg`,
    }));
    res.status(200).json({ ok: true, countries });
  } catch (_e) {
    res.status(500).json({ ok: false, error: 'Server error' });
  }
}