// Nhóm theo Series -> các Issue trong năm
// - Grid auto-fit min 180px tương tự IssueGroup
// - Nếu series chỉ có 1 issue và trùng tên → ẩn header issue, render grid luôn

import React from 'react';
import { Button, Divider } from 'antd';
import StampTile from './stamp_tile';
import { subgroup_by_date_label, subgroup_by_month, is_single_issue } from '@/lib/grouping';

const SeriesGroup = ({
  series_name = 'Untitled Series',
  series_slug = null,
  issues = [], // [{ issue_id, issue_name, issue_type, issue_release_date, issue_release_date_type, stamps }]
  initial_limit = 24,
  on_open_quickview,
}) => {
  const single_issue_only = issues.length === 1;
  const first_issue = issues[0];

  return (
    <div className='series_block'>
      <div className='hdr'>
        <div className='ttl'>
          <span className='lbl'>Series:</span> <strong>{series_name}</strong>
        </div>
      </div>

      {/* Nếu chỉ có 1 issue và tên trùng series → ẩn header issue */}
      {single_issue_only && first_issue?.issue_name === series_name ? (
        <IssueContent
          it={first_issue}
          series_slug={series_slug}
          initial_limit={initial_limit}
          on_open_quickview={on_open_quickview}
          hide_issue_header
        />
      ) : (
        issues.map(it => (
          <IssueContent
            key={it.issue_id || it.issue_name}
            it={it}
            series_slug={series_slug}
            initial_limit={initial_limit}
            on_open_quickview={on_open_quickview}
          />
        ))
      )}

      <Divider />

      <style jsx>{`
        .series_block { max-width: 1440px; margin: 0 auto; }
        .hdr { margin: 12px 0 8px; }
        .ttl { font-size: 15px; color: #111827; }
        .lbl { color: #6b7280; margin-right: 6px; }
      `}</style>
    </div>
  );
};

const IssueContent = ({ it, series_slug, initial_limit, on_open_quickview, hide_issue_header = false }) => {
  const [expanded, set_expanded] = React.useState(false);
  const all = it.stamps || [];
  const shown = expanded ? all : all.slice(0, initial_limit);
  const is_single = is_single_issue(it.issue_type, series_slug, null);

  // Single series: có thể nhóm theo tháng; issue thường: nhóm theo date label (nếu >1 mốc)
  const groups = is_single ? subgroup_by_month(shown) : subgroup_by_date_label(shown);
  const has_more = all.length > initial_limit;

  return (
    <div className='issue'>
      {!hide_issue_header && (
        <div className='issue_hdr'>
          <span className='lbl2'>Issue:</span> <strong>{it.issue_name || 'Untitled Issue'}</strong>
          <span className='count'> · {all.length} {all.length > 1 ? 'stamps' : 'stamp'}</span>
        </div>
      )}

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

export default SeriesGroup;