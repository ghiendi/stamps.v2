// src/components/stamp_detail_image.jsx
import React from 'react';
import Image from 'next/image';
import { get_aspect_ratio_class } from '@/lib/orientation_ratio';

const StampDetailImage = ({ stamp, max_width = 1600 }) => {
  const assets = process.env.NEXT_PUBLIC_ASSETS_URL;
  const country_slug = stamp?.authority_slug;
  const year = stamp?.year;
  const file = stamp?.image_url;
  const image_full_url = (assets && country_slug && year && file)
    ? `${assets}/stamp/${country_slug}/${year}/${max_width}/${file}`
    : '/images/placeholder-stamp.png';

  const ratio_cls = get_aspect_ratio_class(stamp?.orientation);

  return (
    <div className={`detail_img ${ratio_cls}`}>
      <Image
        src={image_full_url}
        alt={stamp?.caption_base || 'stamp'}
        fill
        unoptimized
        sizes='100vw'
        style={{ objectFit: 'contain', display: 'block', padding: '12px' }}
      />
      <style jsx>{`
        .detail_img { position: relative; width: 100%; max-width: 960px; margin: 0 auto;
          background: var(--stamp-bg-default); border: 1px solid #dee2e6; }
        .ratio-4-3 { aspect-ratio: 4 / 3; }
        .ratio-3-4 { aspect-ratio: 3 / 4; }
        .ratio-1-1 { aspect-ratio: 1 / 1; }
      `}</style>
    </div>
  );
};

export default StampDetailImage;