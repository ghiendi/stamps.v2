// components/philatelic_item_tile.jsx
import React from 'react';
import { Card, Tag } from 'antd';
const { Meta } = Card;

const LABEL = {
  fdc: 'FDC',
  pair: 'Pair',
  block_4: 'Block of 4',
  strip: 'Strip',
  souvenir_sheet: 'Souvenir sheet',
  full_sheet: 'Full sheet',
};

export default function PhilatelicItemTile({ item, on_open_quickview }) {
  const {
    name_base,
    item_type,
    image_url,
    layout_rows,
    layout_cols,
    total_stamps,
    cancel_city,
    cancel_date,
    cachet_artist,
  } = item;

  const meta = (() => {
    switch (item_type) {
      case 'fdc':
        return [cancel_city && `Cancel: ${cancel_city}`, cancel_date && `Date: ${cancel_date}`, cachet_artist && `Cachet: ${cachet_artist}`]
          .filter(Boolean)
          .join(' · ');
      default:
        return [
          layout_rows && layout_cols ? `Layout: ${layout_rows}×${layout_cols}` : null,
          total_stamps ? `${total_stamps} stamps` : null,
        ]
          .filter(Boolean)
          .join(' · ');
    }
  })();

  return (
    <Card
      hoverable
      cover={
        <img
          src={image_url || '/images/placeholder-stamp.png'}
          alt={name_base}
          style={{ width: '100%', height: 180, objectFit: 'contain', background: '#fafafa' }}
        />
      }
      onClick={() => on_open_quickview && on_open_quickview(item)}
    >
      <Tag color='blue' style={{ marginBottom: 6 }}>
        {LABEL[item_type] || item_type}
      </Tag>
      <Meta title={name_base} description={meta} />
    </Card>
  );
}
