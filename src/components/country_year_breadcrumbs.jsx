// src/components/country_year_breadcrumbs.jsx
// UI tiếng Anh, comment code tiếng Việt, dùng ' theo quy ước

import React from 'react';
import { Select } from 'antd';
import Image from 'next/image';

// Hook phát hiện mobile bằng matchMedia
const useIsMobile = (bp = 820) => {
  const [is_mobile, set_is_mobile] = React.useState(null); // null = SSR chưa xác định
  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${bp}px)`);
    const handler = e => set_is_mobile(e.matches);
    handler(mql); // chạy ngay lần đầu
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [bp]);
  return is_mobile;
};

const CountryYearBreadcrumbs = ({
  current_country,
  current_year,
  years_available = [],
  on_navigate,
  country_options = [], // danh sách quốc gia (nếu có)
}) => {
  const is_mobile = useIsMobile(820);

  const year_options = (years_available || []).map(y => ({
    label: String(y),
    value: String(y),
  }));

  const on_change_country = val => on_navigate?.(val, String(current_year));
  const on_change_year = val => on_navigate?.(current_country?.slug, String(val));

  // Fallback nếu chưa truyền country_options
  const fallback_country_options = [
    {
      label: (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            maxWidth: '100%',
          }}
        >
          {current_country?.flag_url ? (
            <Image
              src={current_country.flag_url}
              alt=''
              width={16}
              height={12}
              style={{ borderRadius: 2 }}
            />
          ) : null}
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {current_country?.name || current_country?.slug}
          </span>
        </span>
      ),
      value: current_country?.slug,
    },
  ];

  const countries =
    country_options.length > 0 ? country_options : fallback_country_options;

  // Trong SSR (is_mobile === null) → tạm render desktop để tránh nháy layout
  const render_mobile = is_mobile === true;

  // ===== MOBILE =====
  if (render_mobile) {
    return (
      <div className='crumbs_m'>
        <div className='country_m'>
          <Select
            className='country_sel'
            value={current_country?.slug}
            onChange={on_change_country}
            options={countries}
            size='middle'
            dropdownMatchSelectWidth  // ✅ dropdown bám theo độ rộng Select
            getPopupContainer={t => t.parentElement} // ✅ bám theo container
          />
        </div>
        <div className='year_m'>
          <Select
            className='year_sel'
            value={String(current_year)}
            onChange={on_change_year}
            options={year_options}
            size='middle'
            dropdownMatchSelectWidth
            getPopupContainer={t => t.parentElement}
          />
        </div>

        <style jsx>{`
          .crumbs_m {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 88px;
            column-gap: 8px;
            align-items: center;
            white-space: nowrap;
          }
          .country_m {
            min-width: 0;
          }
          .year_m {
            width: 88px;
          }
          :global(.country_sel),
          :global(.country_sel .ant-select-selector),
          :global(.year_sel),
          :global(.year_sel .ant-select-selector) {
            width: 100%;
          }
          :global(.ant-select-selector) {
            height: 32px;
            display: flex;
            align-items: center;
            padding-left: 8px;
            padding-right: 28px;
            box-sizing: border-box;
          }
        `}</style>
      </div>
    );
  }

  // ===== DESKTOP =====
  return (
    <div className='crumbs_d'>
      <span className='root'>Stamps</span>
      <span className='sep'>/</span>

      <div className='country_wrap'>
        <Select
          className='country_sel'
          value={current_country?.slug}
          onChange={on_change_country}
          options={countries}
          size='middle'
          dropdownMatchSelectWidth  // ✅ dropdown theo đúng Select
          getPopupContainer={t => t.parentElement} // ✅ tránh lệch body
        />
      </div>

      <span className='sep'>/</span>

      <div className='year_wrap'>
        <Select
          className='year_sel'
          value={String(current_year)}
          onChange={on_change_year}
          options={year_options}
          size='middle'
          dropdownMatchSelectWidth
          getPopupContainer={t => t.parentElement}
        />
      </div>

      <style jsx>{`
        .crumbs_d {
          display: flex;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
          flex-wrap: nowrap;
        }
        .sep {
          color: #9ca3af;
        }

        .country_wrap {
          flex: 0 0 auto;
        }
        :global(.country_sel) {
          width: auto;
        }
        :global(.country_sel .ant-select-selector) {
          min-width: 360px;
          max-width: 360px;
        }
        :global(.country_sel .ant-select-selection-item) {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          max-width: 100%;
        }
        :global(.country_sel .ant-select-selection-item > span:last-child) {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 100%;
        }

        .year_wrap {
          flex: 0 0 auto;
          width: 120px;
        }
        :global(.year_sel),
        :global(.year_sel .ant-select-selector) {
          width: 100%;
        }
      `}</style>
    </div>
  );
};

export default CountryYearBreadcrumbs;