// Trả tem gốc của 1 quốc gia trong 1 năm + years_available
// - Ảnh: FE sẽ build full URL từ NEXT_PUBLIC_ASSETS_URL, nên API trả file name + thêm authority_slug, year
import { db_read } from '@/lib/db_read';

const get_authority = async (slug) => {
  const rows = await db_read(
    'SELECT id, slug, name_base FROM issuing_authority WHERE slug = ? LIMIT 1',
    [slug]
  );
  return rows?.[0] || null;
};

const get_years_available = async (authority_id) => {
  const sql = `
    SELECT DISTINCT YEAR(i.release_date) AS y
    FROM issue i
    JOIN stamps s ON s.issue_id = i.id
    WHERE i.issuing_authority_id = ?
      AND s.variant_of IS NULL
      AND i.release_date IS NOT NULL
    ORDER BY y DESC
  `;
  const rows = await db_read(sql, [authority_id]);
  return rows.map(r => r.y);
};

const get_stamps = async (authority_id, year) => {
  const sql = `
    SELECT
      s.id,
      s.slug,
      s.caption_base,
      s.image_url,
      s.orientation,
      s.release_date AS stamp_release_date,
      s.release_date_type AS stamp_release_date_type,
      i.release_date AS issue_release_date,
      i.release_date_type AS issue_release_date_type,
      i.id AS issue_id,
      i.slug AS issue_slug,
      i.name_base AS issue_name,
      i.release_type AS issue_type,
      se.id AS series_id,
      se.slug AS series_slug,
      se.name_base AS series_name
    FROM stamps s
    JOIN issue i ON i.id = s.issue_id
    LEFT JOIN series se ON se.id = i.series_id
    WHERE i.issuing_authority_id = ?
      AND s.variant_of IS NULL
      AND i.release_date IS NOT NULL
      AND YEAR(i.release_date) = ?
    ORDER BY i.release_date ASC, s.id ASC
  `;
  const rows = await db_read(sql, [authority_id, year]);
  return rows || [];
};

export default async function handler(req, res) {
  const { slug, year } = req.query;
  const year_num = Number(year);
  if (!year_num || String(year_num).length !== 4) {
    return res.status(400).json({ ok: false, error: 'Invalid year' });
  }

  try {
    const authority = await get_authority(slug);
    if (!authority) return res.status(404).json({ ok: false, error: 'Authority not found' });

    const years_available = await get_years_available(authority.id);
    const raw = await get_stamps(authority.id, year_num);

    // Thêm authority_slug + year cho mỗi tem để FE build URL ảnh
    const stamps = raw.map(r => ({
      ...r,
      authority_slug: authority.slug,
      year: year_num,
    }));

    res.status(200).json({
      ok: true,
      country: {
        id: authority.id,
        slug: authority.slug,
        name: authority.name_base,
        flag_url: `${process.env.NEXT_PUBLIC_ASSETS_URL || ''}/flags/${authority.slug}.svg`,
      },
      year: year_num,
      years_available,
      stamps,
    });
  } catch (_e) {
    res.status(500).json({ ok: false, error: 'Server error' });
  }
}