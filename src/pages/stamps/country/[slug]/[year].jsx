// Trang liệt kê tem theo quốc gia + năm
// - SSR gọi API qua NEXT_PUBLIC_API_URL
// - Breadcrumbs dùng API base env ở client
// - Sort đơn giản; Quickview trắng
import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Empty, Spin } from 'antd';
import dayjs from 'dayjs';
import CountryYearBreadcrumbs from '@/components/country_year_breadcrumbs';
import QuickviewDialog from '@/components/quickview/quickview_dialog';
import StampTile from '@/components/stamp_tile';
import FiltersBar from '@/components/filters_bar';
import IssueGroup from '@/components/issue_group';
import SeriesGroup from '@/components/series_group';
import { group_by_issue, group_by_series_then_issue } from '@/lib/grouping';

const format_release_short = (d, t) => {
  if (!d) return '';
  if (t === 'year') return dayjs(d).format('YYYY');
  if (t === 'month') return dayjs(d).format('MMM YYYY');
  return dayjs(d).format('YYYY-MM-DD');
};

const sort_client = (items, key) => {
  const list = [...items];
  if (key === 'release_desc') {
    list.sort((a, b) => (b.release_date || '').localeCompare(a.release_date || ''));
  } else if (key === 'release_asc') {
    list.sort((a, b) => (a.release_date || '').localeCompare(b.release_date || ''));
  } else if (key === 'caption_az') {
    list.sort((a, b) => (a.caption_base || '').localeCompare(b.caption_base || ''));
  }
  return list;
};

const CountryYearPage = ({ country, year, years_available, stamps }) => {
  const router = useRouter();
  const [sort_key, set_sort_key] = React.useState('release_desc');
  const [is_qv_open, set_is_qv_open] = React.useState(false);
  const [current_stamp, set_current_stamp] = React.useState(null);

  // lấy view từ query (?view=issue|series|all), mặc định 'issue'
  const initial_view = React.useMemo(() => {
    const v = (router.query?.view || '').toString();
    return ['issue', 'series', 'all'].includes(v) ? v : 'issue';
  }, [router.query?.view]);

  const [view_mode, set_view_mode] = React.useState(initial_view);

  React.useEffect(() => {
    set_view_mode(initial_view);
  }, [initial_view]);

  const open_quickview = (stamp) => { set_current_stamp(stamp || null); set_is_qv_open(true); };
  const close_quickview = () => set_is_qv_open(false);
  const navigate_country_year = (next_slug, next_year) => {
    router.push({
      pathname: '/stamps/country/[slug]/[year]',
      query: { slug: next_slug, year: next_year, view: view_mode },
    });
  };
  const page_title = country?.slug && year ? `Stamps - ${country.slug} - ${year}` : 'Stamps';

  // Chuẩn hoá date label cho tile + sort client (chung cho 'all')
  const tiles = React.useMemo(() => {
    const mapped = (stamps || []).map(s => {
      const d = s.stamp_release_date || s.issue_release_date;
      const dt = s.stamp_release_date_type || s.issue_release_date_type || 'exact';
      return {
        ...s,
        caption_base: s.caption_base || '',
        release_date: d,            // giữ field chung cho sort
        release_date_type: dt,
        caption_date: format_release_short(d, dt),
      };
    });
    return sort_client(mapped, sort_key);
  }, [stamps, sort_key]);

  // Grouped data
  const issues = React.useMemo(() => {
    // sort trong issue sẽ thực hiện ở tile theo thứ tự mảng gốc (đã sort_client)
    return group_by_issue(tiles);
  }, [tiles]);

  const series_groups = React.useMemo(() => {
    return group_by_series_then_issue(tiles);
  }, [tiles]);

  const on_change_view = (next_view) => {
    set_view_mode(next_view);
    const { slug } = router.query;
    router.replace({
      pathname: '/stamps/country/[slug]/[year]',
      query: { slug, year, view: next_view },
    }, undefined, { shallow: true });
  };

  return (
    <>
      <Head><title>{page_title}</title></Head>
      <div style={{ margin: '12px 0' }}>
        <CountryYearBreadcrumbs
          current_country={country}
          current_year={year}
          years_available={years_available}
          on_navigate={navigate_country_year}
        />
      </div>
      <FiltersBar
        sort_key={sort_key}
        on_change_sort={set_sort_key}
        view_mode={view_mode}
        on_change_view={on_change_view}
      />
      {/* Render theo view */}
      <div style={{ minHeight: 320 }}>
        {!Array.isArray(stamps) ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
            <Spin size='large' />
          </div>
        ) : tiles.length === 0 ? (
          <Empty description={`No stamps found for ${country?.name} in ${year}.`} />
        ) : view_mode === 'all' ? (
          // ALL: lưới phẳng
          <div className='wrap1440'>
            <div className='grid'>
              {tiles.map((s) => (
                <StampTile key={s.id} stamp={s} on_open_quickview={() => open_quickview(s)} />
              ))}
            </div>
          </div>
        ) : view_mode === 'issue' ? (
          // ISSUE: nhóm theo Issue, sub-group theo date
          <div>
            {issues.map(ig => (
              <IssueGroup
                key={ig.issue_id || ig.issue_name}
                issue_name={ig.issue_name}
                series_name={ig.series_name}
                series_slug={ig.series_slug}
                issue_release_date={ig.issue_release_date}
                issue_release_date_type={ig.issue_release_date_type}
                issue_type={ig.issue_type}
                stamps={ig.stamps}
                on_open_quickview={open_quickview}
                initial_limit={24}
                sort_key={sort_key}
              />
            ))}
          </div>
        ) : (
          // SERIES: nhóm theo Series -> Issues
          <div>
            {series_groups.map(sg => (
              <SeriesGroup
                key={sg.series_id || sg.series_name}
                series_name={sg.series_name}
                series_slug={sg.series_slug}
                issues={sg.issues}
                on_open_quickview={open_quickview}
                initial_limit={24}
              />
            ))}
          </div>
        )}
      </div>

      {/* Quickview trắng */}
      <QuickviewDialog open={is_qv_open} on_close={close_quickview} stamp={current_stamp} />

      {/* Grid base for 'All' */}
      <style jsx>{`
        /* Left-packed grid: cột có chiều rộng tiệm cận kích thước tile (180–210px) */
        .grid {
          --gap: 12px;
          --track: 210px;                           /* cột mục tiêu 210px */
          display: grid;
          grid-auto-rows: auto;
          grid-template-columns: repeat(auto-fill, minmax(180px, var(--track)));
          gap: var(--gap);
          justify-content: start;                   /* dồn trái, phần dư ở bên phải */
        }

        /* Đảm bảo tile không stretch khi track rộng hơn kích thước tile */
        .grid :global(.tile) {
          justify-self: start;
        }

        /* Tablet điều chỉnh nhẹ (nếu muốn) */
        @media (max-width: 1280px) {
          .grid { --track: 210px; }
        }

        /* Mobile: 2 cột đều nhau để đầy bề ngang */
        @media (max-width: 768px) {
          .grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .grid :global(.tile) {
            width: 100%;
            max-width: none;
          }
        }
      `}</style>
    </>
  );
};

export default CountryYearPage;

export async function getServerSideProps(ctx) {
  const { slug, year } = ctx.params || {};
  const base_api = process.env.NEXT_PUBLIC_API_URL;
  const url = `${base_api}/stamps/country/${slug}/${year}`;

  try {
    const resp = await fetch(url, {
      headers: { cookie: ctx.req.headers.cookie || '' },
    });
    const data = await resp.json();

    if (!data?.ok && data?.error === 'Authority not found') {
      return { notFound: true };
    }

    const years_available = Array.isArray(data?.years_available) ? data.years_available : [];

    if (years_available.length > 0 && !years_available.includes(Number(year))) {
      const latest = years_available[0];
      return {
        redirect: { destination: `/stamps/country/${slug}/${latest}`, permanent: false },
      };
    }

    return {
      props: {
        country: data?.country || { slug, name: slug },
        year: data?.year || Number(year) || null,
        years_available,
        stamps: Array.isArray(data?.stamps) ? data.stamps : [],
      },
    };
  } catch (_e) {
    return {
      props: {
        country: { slug, name: slug },
        year: Number(year) || null,
        years_available: [],
        stamps: [],
      },
    };
  }
}