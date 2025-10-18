// Redirect /stamps/country/:slug → /stamps/country/:slug/:latest_year
// - Nếu không tìm thấy quốc gia → 404
// - Nếu quốc gia có tem → redirect đến năm mới nhất có tem

import { db_read } from '@/lib/db_read';

const get_authority = async (slug) => {
  const sql = `
    SELECT id, slug, name_base
    FROM issuing_authority
    WHERE slug = ?
    LIMIT 1
  `;
  const rows = await db_read(sql, [slug]);
  return rows?.[0] || null;
};

const get_latest_year = async (authority_id) => {
  const sql = `
    SELECT COALESCE(YEAR(s.release_date), YEAR(i.release_date)) AS y
    FROM issue i
    JOIN stamps s ON s.issue_id = i.id
    WHERE i.issuing_authority_id = ?
      AND s.variant_of IS NULL
      AND COALESCE(YEAR(s.release_date), YEAR(i.release_date)) IS NOT NULL
    ORDER BY y DESC
    LIMIT 1
  `;
  const rows = await db_read(sql, [authority_id]);
  return rows?.[0]?.y || null;
};

export async function getServerSideProps(ctx) {
  const { slug } = ctx.params || {};

  try {
    const authority = await get_authority(slug);
    if (!authority) {
      return { notFound: true };
    }

    const latest_year = await get_latest_year(authority.id);
    if (!latest_year) {
      // Quốc gia hợp lệ nhưng chưa có tem
      return {
        props: {
          message: `No stamps found for ${authority.name_base}`,
        },
      };
    }

    // Redirect sang /stamps/country/:slug/:latest_year
    return {
      redirect: {
        destination: `/stamps/country/${slug}/${latest_year}`,
        permanent: false,
      },
    };
  } catch (_e) {
    return { notFound: true };
  }
}

export default function CountryRedirectPage() {
  // Không render gì, vì chỉ SSR redirect
  return null;
}
