// Nhóm theo Issue
// - Grid auto-fit min 180px để tile ~200px, hiển thị nhiều hơn trên desktop
// - Gộp header khi Issue ≡ Series
// - Single Issues: không show Release date, show Year; bên trong có thể nhóm theo tháng

import React from 'react';
import { Button, Divider } from 'antd';
import StampTile from './stamp_tile';
import {
  is_single_issue,
  issue_header_date,
  subgroup_by_date_label,
  subgroup_by_month,
} from '@/lib/grouping';

const IssueGroup = ({
  issue_name = 'Untitled Issue',
  series_name = null,
  series_slug = null,
  issue_release_date = null,
  issue_release_date_type = 'year',
  issue_type = 'standard',
  page_year = null,
  stamps = [],
  initial_limit = 24,
  on_open_quickview,
}) => {
  const [expanded, set_expanded] = React.useState(false);
  const all = stamps || [];
  const shown = expanded ? all : all.slice(0, initial_limit);

  const is_single = is_single_issue(issue_type, series_slug, series_name);
  const names_equal = !!series_name && series_name === issue_name;

  const header_date = is_single ? null
    : issue_header_date(all, issue_release_date, issue_release_date_type);

  const groups = is_single
    ? subgroup_by_month(shown)
    : subgroup_by_date_label(shown);

  const has_more = all.length > initial_limit;

  return (
    <div className='issue_block'>
      <div className='hdr'>
        {!names_equal ? (
          <>
            <div className='ttl'>
              <span className='lbl'>Issue:</span> <strong>{issue_name}</strong>
              <span className='count'> · {all.length} {all.length > 1 ? 'stamps' : 'stamp'}</span>
            </div>
            {series_name ? <div className='subttl'>Series: {series_name}</div> : null}
          </>
        ) : (
          <div className='ttl'>
            <span className='lbl'>Issue / Series:</span> <strong>{issue_name}</strong>
            <span className='count'> · {all.length} {all.length > 1 ? 'stamps' : 'stamp'}</span>
          </div>
        )}

        {!is_single && header_date ? (
          <div className='subhdr'>Release date: {header_date}</div>
        ) : null}
        {is_single && page_year ? (
          <div className='note'>Year: {page_year}</div>
        ) : null}
      </div>

      {groups.length > 0 ? (
        groups.map((g, idx) => (
          <div key={idx} className='subgrp'>
            <div className='subhdr'>{is_single ? g.label : `Release date: ${g.label}`}</div>
            <div className='grid'>
              {g.stamps.map(s => (
                <StampTile key={s.id} stamp={s} on_open_quickview={() => on_open_quickview(s)} />
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className='grid'>
          {shown.map(s => (
            <StampTile key={s.id} stamp={s} on_open_quickview={() => on_open_quickview(s)} />
          ))}
        </div>
      )}

      {has_more && (
        <div className='more'>
          <Button size='small' onClick={() => set_expanded(v => !v)}>
            {expanded ? 'Show less' : 'Show all in this issue'}
          </Button>
        </div>
      )}

      <Divider />

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
    </div>
  );
};

export default IssueGroup;