import React from 'react';
import { Select, Segmented } from 'antd';

const sort_options = [
  { label: 'Release date - Newest', value: 'release_desc' },
  { label: 'Release date - Oldest', value: 'release_asc' },
  { label: 'Caption - [A-Z]', value: 'caption_az' },
];

const view_options = [
  { label: 'Issue', value: 'issue' },
  { label: 'Series', value: 'series' },
  { label: 'All', value: 'all' },
];

const FiltersBar = ({ sort_key, on_change_sort, view_mode, on_change_view }) => {
  return (
    <div className='filters_bar'>
      <div className='group sort'>
        <span className='label'>Sort:</span>
        <div className='ctrl'>
          <Select
            value={sort_key}
            onChange={on_change_sort}
            options={sort_options}
            popupMatchSelectWidth
            style={{ width: '100%' }} // 👈 full width on mobile
          />
        </div>
      </div>
      <div className='group view'>
        <span className='label'>View:</span>
        <div className='ctrl'>
          <Segmented
            value={view_mode}
            onChange={on_change_view}
            options={view_options}
          />
        </div>
      </div>
      <style jsx>{`
        .filters_bar{
          display:flex; align-items:center; justify-content:flex-end;
          gap:12px; margin:8px 0 10px; flex-wrap:wrap;
        }
        .group{display:inline-flex; align-items:center; gap:8px;}
        .label{color:#6b7280; font-size:13px;}
        .ctrl{min-width:240px;} /* desktop/tablet: control đủ rộng */

        /* ===== Mobile: xếp 2 hàng, control full-width ===== */
        @media (max-width:768px){
          .filters_bar{
            flex-direction:column;      /* 👈 mỗi nhóm 1 hàng */
            align-items:stretch;
            gap:8px;
            margin:6px 0 8px;
          }
          .group{
            display:flex;
            justify-content:space-between;
          }
          .ctrl{
            flex:1;
            min-width:0;                /* cho phép co */
          }
          .group :global(.ant-select),
          .group :global(.ant-segmented){
            width:100%;
          }
          .group :global(.ant-segmented){ justify-content:center; }
        }
      `}</style>
    </div>
  );
};

export default FiltersBar;