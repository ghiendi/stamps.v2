// components/issue_group.jsx
// Nhóm theo Issue
// - Grid auto-fit min 180px để tile ~200px
// - Gộp header khi Issue ≡ Series
// - Single Issues: không group theo ngày/tháng, hiển thị phẳng toàn bộ
// - Philatelic items: chỉ gợi ý nhẹ, không hiển thị ảnh

import React from 'react';
import { Button, Divider } from 'antd';
import StampTile from './stamp_tile';
import {
  is_single_issue,
  issue_header_date,
  subgroup_by_date_label,
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
  philatelic_items = [],
  initial_limit = 24,
  on_open_quickview,
}) => {
  const [expanded, set_expanded] = React.useState(false);
  const all = stamps || [];
  const shown = expanded ? all : all.slice(0, initial_limit);

  const is_single = is_single_issue(issue_type, series_slug, series_name);
  const names_equal = !!series_name && series_name === issue_name;

  const header_date = is_single
    ? null
    : issue_header_date(all, issue_release_date, issue_release_date_type);

  // Nếu không phải single thì group theo ngày, ngược lại dàn phẳng
  const groups = !is_single ? subgroup_by_date_label(shown) : [];
  const has_more = all.length > initial_limit;

  // Đếm Philatelic items theo loại
  const count_by_type = React.useMemo(() => {
    const counter = {};
    for (const it of philatelic_items || []) {
      counter[it.item_type] = (counter[it.item_type] || 0) + 1;
    }
    return counter;
  }, [philatelic_items]);

  const total_items = philatelic_items?.length || 0;
  const summary_parts = [];
  if (count_by_type.souvenir_sheet) summary_parts.push(`${count_by_type.souvenir_sheet} souvenir sheet`);
  if (count_by_type.fdc) summary_parts.push(`${count_by_type.fdc} FDC`);
  if (count_by_type.block_4) summary_parts.push(`${count_by_type.block_4} block of 4`);
  if (count_by_type.pair) summary_parts.push(`${count_by_type.pair} pair`);

  return (
    <div className='issue_block'>
      <div className='hdr'>
        {!names_equal ? (
          <>
            <div className='ttl'>
              <span className='lbl'>Issue:</span>{' '}
              <strong>{issue_name}</strong>
              <span className='count'>
                {' '}
                · {all.length} {all.length > 1 ? 'stamps' : 'stamp'}
              </span>
            </div>
            {series_name ? (
              <div className='subttl'>Series: {series_name}</div>
            ) : null}
          </>
        ) : (
          <div className='ttl'>
            <span className='lbl'>Issue / Series:</span>{' '}
            <strong>{issue_name}</strong>
            <span className='count'>
              {' '}
              · {all.length} {all.length > 1 ? 'stamps' : 'stamp'}
            </span>
          </div>
        )}

        {!is_single && header_date ? (
          <div className='subhdr'>Release date: {header_date}</div>
        ) : null}
        {is_single && page_year ? (
          <div className='note'>Year: {page_year}</div>
        ) : null}
      </div>

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
              onClick={() => console.log('View details of issue:', issue_name)}
            >
              View details →
            </Button>
          </span>
        </div>
      )}

      <Divider />

      <style jsx>{`
        .grid {
          --gap: 12px;
          --track: 210px;
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
          .grid {
            --track: 210px;
          }
        }
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
