// components/series_group.jsx
// Nhóm theo Series -> các Issue trong năm
// - Grid auto-fit min 180px tương tự IssueGroup
// - Nếu series chỉ có 1 issue và trùng tên → ẩn header issue, render grid luôn
// - Single Issue: không group theo ngày/tháng, hiển thị phẳng
// - Philatelic items: chỉ gợi ý nhẹ, không hiển thị ảnh (summary + View details)

import React from 'react';
import { Button, Divider } from 'antd';
import StampTile from './stamp_tile';
import { subgroup_by_date_label, is_single_issue } from '@/lib/grouping';

const SeriesGroup = ({
  series_name = 'Untitled Series',
  series_slug = null,
  issues = [], // [{ issue_id, issue_name, issue_type, ... , stamps, philatelic_items? }]
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
        issues.map((it) => (
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

const IssueContent = ({
  it,
  series_slug,
  initial_limit,
  on_open_quickview,
  hide_issue_header = false,
}) => {
  const [expanded, set_expanded] = React.useState(false);
  const all = it.stamps || [];
  const shown = expanded ? all : all.slice(0, initial_limit);
  const is_single = is_single_issue(it.issue_type, series_slug, null);

  // Non-single thì group theo date label; Single Issue dàn phẳng
  const groups = !is_single ? subgroup_by_date_label(shown) : [];
  const has_more = all.length > initial_limit;

  // ===== Summary cho Philatelic items (không render ảnh) =====
  const philatelic_items = it.philatelic_items || [];
  const count_by_type = React.useMemo(() => {
    const m = {};
    for (const x of philatelic_items) {
      m[x.item_type] = (m[x.item_type] || 0) + 1;
    }
    return m;
  }, [philatelic_items]);

  const total_items = philatelic_items.length;
  const summary_parts = [];
  if (count_by_type.souvenir_sheet) summary_parts.push(`${count_by_type.souvenir_sheet} souvenir sheet`);
  if (count_by_type.fdc) summary_parts.push(`${count_by_type.fdc} FDC`);
  if (count_by_type.block_4) summary_parts.push(`${count_by_type.block_4} block of 4`);
  if (count_by_type.pair) summary_parts.push(`${count_by_type.pair} pair`);

  return (
    <div className='issue'>
      {!hide_issue_header && (
        <div className='issue_hdr'>
          <span className='lbl2'>Issue:</span>{' '}
          <strong>{it.issue_name || 'Untitled Issue'}</strong>
          <span className='count'>
            {' '}
            · {all.length} {all.length > 1 ? 'stamps' : 'stamp'}
          </span>
        </div>
      )}

      {/* ======== Grid tem ======== */}
      {is_single ? (
        <div className='grid'>
          {shown.map((s) => (
            <StampTile
              key={s.id}
              stamp={s}
              on_open_quickview={() => on_open_quickview(s)}
            />
          ))}
        </div>
      ) : groups.length > 0 ? (
        groups.map((g, idx) => (
          <div key={idx} className='subgrp'>
            <div className='subhdr'>{`Release date: ${g.label}`}</div>
            <div className='grid'>
              {g.stamps.map((s) => (
                <StampTile
                  key={s.id}
                  stamp={s}
                  on_open_quickview={() => on_open_quickview(s)}
                />
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className='grid'>
          {shown.map((s) => (
            <StampTile
              key={s.id}
              stamp={s}
              on_open_quickview={() => on_open_quickview(s)}
            />
          ))}
        </div>
      )}

      {has_more && (
        <div className='more'>
          <Button size='small' onClick={() => set_expanded((v) => !v)}>
            {expanded ? 'Show less' : 'Show all in this issue'}
          </Button>
        </div>
      )}

      {/* ======== Philatelic items summary ======== */}
      {total_items > 0 && (
        <div className='items_summary'>
          <span className='lbl'>Philatelic items available:</span>{' '}
          <span className='val'>
            {summary_parts.join(', ')}{' '}
            <Button
              type='link'
              size='small'
              onClick={() =>
                console.log('View details of issue:', it.issue_name || it.issue_id)
              }
            >
              View details →
            </Button>
          </span>
        </div>
      )}

      <style jsx>{`
        /* Left-packed grid: cột có chiều rộng tiệm cận kích thước tile (180–210px) */
        .grid {
          --gap: 12px;
          --track: 210px; /* cột mục tiêu 210px */
          display: grid;
          grid-auto-rows: auto;
          grid-template-columns: repeat(auto-fill, minmax(180px, var(--track)));
          gap: var(--gap);
          justify-content: start;
        }

        .grid :global(.tile) {
          justify-self: start;
        }

        .items_summary {
          margin-top: 12px;
          font-size: 14px;
          color: #374151;
        }
        .items_summary .lbl {
          color: #6b7280;
        }

        @media (max-width: 1280px) {
          .grid { --track: 210px; }
        }
        @media (max-width: 768px) {
          .grid { grid-template-columns: repeat(2, 1fr); }
          .grid :global(.tile) { width: 100%; max-width: none; }
        }
      `}</style>
    </div>
  );
};

export default SeriesGroup;