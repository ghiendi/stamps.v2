// src/components/stamp_tile.jsx
import React from 'react';
import Image from 'next/image';
import { Button, Space } from 'antd';

// Stamp Tile 3 lớp: OUTER (vuông, border) -> INNER (nền trạng thái, tỉ lệ theo orientation) -> IMAGE
// Yêu cầu quan trọng: INNER KHÔNG tràn ra OUTER (luôn có khe hở thấy rõ border OUTER)

const StampTile = ({ stamp, on_open_quickview }) => {
  // ----- data hiển thị -----
  const caption_base = stamp?.caption_base || '';
  const caption_date = stamp?.caption_date || '';

  // ----- ảnh -----
  const assets = process.env.NEXT_PUBLIC_ASSETS_URL;
  const country_slug = stamp?.authority_slug || stamp?.country_slug || 'unknown';
  const year = stamp?.year || '';
  const max_width = 200;
  const file = stamp?.image_url;
  const image_full_url =
    assets && country_slug && year && file
      ? `${assets}/stamp/${country_slug}/${year}/${max_width}/${file}`
      : '/images/placeholder-stamp.png';

  // ----- orientation -> class tỉ lệ cho INNER -----
  const ori = (stamp?.orientation || '').toLowerCase();
  const inner_ratio_cls =
    ori === 'landscape' ? 'inner-landscape'
    : ori === 'portrait' ? 'inner-portrait'
    : 'inner-square'; // square/fallback

  // ----- trạng thái (chưa triển khai logic → default) -----
  const state_cls =
    stamp?.state === 'user'   ? 'state-user'
    : stamp?.state === 'system' ? 'state-system'
    : stamp?.state === 'wish'   ? 'state-wish'
    : 'state-default';

  return (
    <div className='tile'>
      {/* nút mở quickview */}
      <button className='thumb_btn' onClick={on_open_quickview} aria-label='Open preview'>
        {/* OUTER: vuông, border 1px, bo 4px, nền trong suốt */}
        <div className='thumb_outer'>
          {/* INNER: không vuông; tỉ lệ theo orientation, căn giữa, KHÔNG tràn ra OUTER */}
          <div className={`thumb_inner ${inner_ratio_cls} ${state_cls}`}>
            {/* khung ảnh (relative) để Image fill; ảnh có padding 4px */}
            <div className='thumb_img'>
              <Image
                src={image_full_url}
                alt={caption_base || 'stamp'}
                fill
                unoptimized
                sizes='(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw'
                style={{ objectFit: 'contain', display: 'block', padding: '4px' }}
              />
            </div>
          </div>
        </div>
      </button>

      {/* meta */}
      <div className='meta'>
        <div className='caption' title={caption_base}>{caption_base}</div>
        {caption_date && <div className='subline'>{caption_date}</div>}
        <Space size={4} className='actions'>
          <Button size='small' onClick={on_open_quickview}>Quickview</Button>
          <Button size='small' type='dashed'>+ Add</Button>
        </Space>
      </div>

      <style jsx>{`
        /* ===== tile container ===== */
        .tile {
          display: flex;
          flex-direction: column;
          gap: 6px;
          width: 100%;
          background: transparent;
        }
        .thumb_btn {
          padding: 0;
          border: 0;
          background: transparent;
          cursor: pointer;
          display: block;
          width: 100%;
          text-align: left;
        }

        /* ===== OUTER (vuông) =====
           - giữ tỉ lệ 1/1
           - border 1px --stamp-border-default
           - bo 4px; nền trong suốt
           - KHÔNG padding; khe hở giữa OUTER và INNER sẽ do kích thước INNER nhỏ hơn OUTER
        */
        .thumb_outer {
          position: relative;
          width: 100%;
          aspect-ratio: 1 / 1;
          background: transparent;
          border: 1px solid var(--stamp-border-default);
          border-radius: 4px;
        }

        /* ===== INNER =====
           - được căn giữa tuyệt đối trong OUTER
           - KHÔNG TRÀN: kích thước bị giới hạn bởi max-width & max-height (trừ khe hở 6px)
           - bo 3px để không che border OUTER ở góc
           - màu mặc định: --stamp-bg-default
           - hover: chỉ đổi nền INNER
        */
        .thumb_inner {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);

          /* khe hở rõ ràng giữa INNER và OUTER */
          max-width: calc(100% - 6px);
          max-height: calc(100% - 6px);

          width: 100%;
          height: auto;

          border-radius: 3px;
          background: var(--stamp-bg-default);
          transition: background-color .15s ease;
        }
        .thumb_btn:hover .thumb_inner { background: var(--stamp-bg-hover-default); }

        /* tỉ lệ INNER theo orientation (KHÔNG vuông nếu là landscape/portrait) */
        .inner-landscape { aspect-ratio: 4 / 3; }
        .inner-portrait  { aspect-ratio: 3 / 4; height: 100%; width: auto; }
        .inner-square    { aspect-ratio: 1 / 1; }

        /* trạng thái (tạm cùng màu default, sẽ đổi sau) */
        .thumb_inner.state-user {}
        .thumb_inner.state-system {}
        .thumb_inner.state-wish {}
        .thumb_inner.state-default {}

        /* khung chứa Image */
        .thumb_img {
          position: relative;
          width: 100%;
          height: 100%;
          line-height: 0;
        }

        /* ===== meta ===== */
        .meta { display: flex; flex-direction: column; gap: 4px; width: 100%; }
        .caption {
          font-size: 14px; line-height: 1.25; color: #111827;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          overflow: hidden; text-overflow: ellipsis; word-break: break-word;
        }
        .subline {
          font-size: 12px; color: #6b7280;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .actions :global(.ant-btn) { box-shadow: none; }
      `}</style>
    </div>
  );
};

export default StampTile;