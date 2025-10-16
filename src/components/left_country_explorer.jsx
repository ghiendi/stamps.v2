// Cột trái: Country Picker mở rộng cho desktop + mobile-first
// - Trạng thái initial: Quick Picks, Continue, Explore by Region, A–Z
// - Khi gõ (AutoComplete) -> ưu tiên dropdown kết quả
import React from 'react';
import { Row, Col, Card, List, Typography, Tabs, Tag, Grid, Empty, Skeleton } from 'antd';
import Link from 'next/link';
import CountryPicker from '@/components/country_picker';
import styles from './left_country_explorer.module.css';

const { useBreakpoint } = Grid;

const LeftCountryExplorer = () => {
  // breakpoint để responsive (xs, sm, md, lg...)
  const screens = useBreakpoint();

  // --- state cho quick picks & region ---
  const [quick_picks, set_quick_picks] = React.useState([]);
  const [region_items, set_region_items] = React.useState([]);
  const [loading_quick, set_loading_quick] = React.useState(true);
  const [loading_region, set_loading_region] = React.useState(false);

  // --- state cho A–Z ---
  const [az_letter, set_az_letter] = React.useState(null);
  const [az_items, set_az_items] = React.useState([]);
  const [loading_az, set_loading_az] = React.useState(false);

  // --- state cho continue (localStorage) ---
  const [continue_list, set_continue_list] = React.useState([]);

  // Danh sách region cố định & region mặc định
  const regions = ['Asia', 'Europe', 'Africa', 'Americas', 'Oceania'];
  const default_region = 'Asia'; // ← load mặc định tab Asia
  const [active_region, set_active_region] = React.useState(default_region);

  const [recent_searches, set_recent_searches] = React.useState([])

  // Tải Quick Picks ban đầu (top theo stamp_count)
  React.useEffect(() => {
    const load_quick = async () => {
      set_loading_quick(true);
      try {
        const raw = localStorage.getItem('recent_searches') || '[]';
        const list = JSON.parse(raw);
        set_recent_searches(Array.isArray(list) ? list : []);

        const limit = screens.xs ? 6 : 9; // mobile 2x3, desktop 3x3
        const res = await fetch(`/api/stamps/country/top?limit=${limit}`);
        const data = await res.json();
        set_quick_picks(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Load quick picks error:', err?.message);
        set_quick_picks([]);
      } finally {
        set_loading_quick(false);
      }
    };
    load_quick();
  }, [screens.xs]);

  // Load continue list từ localStorage
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('last_visited_countries') || '[]';
      const list = JSON.parse(raw);
      set_continue_list(Array.isArray(list) ? list.slice(0, 5) : []);
    } catch {
      set_continue_list([]);
    }
  }, []);

  // ⚠️ BUGFIX: gọi fetch cho region mặc định (Asia) ngay khi mount
  // và gọi lại khi thay đổi breakpoint (để số cột phù hợp mobile/desktop)
  React.useEffect(() => {
    const fetch_default_region = async () => {
      set_loading_region(true);
      try {
        const limit = screens.xs ? 6 : 9;
        const res = await fetch(
          `/api/stamps/country/top?region=${encodeURIComponent(default_region)}&limit=${limit}`
        );
        const data = await res.json();
        set_region_items(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Load default region error:', err?.message);
        set_region_items([]);
      } finally {
        set_loading_region(false);
      }
    };
    fetch_default_region();
  }, [screens.xs]);

  // Khi người dùng đổi tab region
  const on_region_change = async (key) => {
    set_active_region(key); // cập nhật active tab để Tabs phản ánh đúng
    if (!key || !regions.includes(key)) {
      set_region_items([]);
      return;
    }
    set_loading_region(true);
    try {
      const limit = screens.xs ? 6 : 9;
      const res = await fetch(
        `/api/stamps/country/top?region=${encodeURIComponent(key)}&limit=${limit}`
      );
      const data = await res.json();
      set_region_items(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Load region items error:', err?.message);
      set_region_items([]);
    } finally {
      set_loading_region(false);
    }
  };

  // Tải A–Z khi bấm chữ cái
  const on_pick_letter = async (letter) => {
    set_az_letter(letter);
    set_loading_az(true);
    try {
      const limit = screens.xs ? 10 : 12;
      const res = await fetch(
        `/api/stamps/country/az?letter=${letter}&limit=${limit}`
      );
      const data = await res.json();
      set_az_items(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Load A-Z error:', err?.message);
      set_az_items([]);
    } finally {
      set_loading_az(false);
    }
  };

  // Render card nhỏ gọn cho mỗi quốc gia
  const render_country_card = (item) => (
    <Card
      className={styles.card}
      key={item.slug}
      hoverable
      onClick={() => (window.location.href = `/stamps/country/${item.slug}`)}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <img
          className={styles.flag}
          src={item.flag_image_url}
          alt={`${item.name_base} flag`}
          width={36}
        />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Typography.Text style={{ lineHeight: 1.1, color: '#1864ab' }}>
            {item.name_base}
          </Typography.Text>
          <Typography.Text type='secondary' style={{ fontSize: 12 }}>
            {item.stamp_count} stamps
            {item.type === 'intl_org' ? ' • Organization' : ''}
          </Typography.Text>
        </div>
      </div>
    </Card>
  );

  // Số cột grid theo thiết bị (mobile 2, desktop 3)
  const grid_cols = screens.xs ? 2 : 3;

  return (
    <div style={{ margin: '0 auto', display: 'flex', flexDirection: 'column', rowGap: 16 }}>
      {/* Ô tìm kiếm */}
      <CountryPicker />
      {recent_searches.length > 0 && (
        <div className={styles.recent_searches}>
          <Typography.Title level={5} style={{ marginBottom: 0 }}>Recent searches</Typography.Title>
          <List
            className={styles.recent_list}
            size='small'
            dataSource={recent_searches}
            renderItem={(it) => (
              <List.Item style={{ paddingLeft: 0 }}>
                <Link href={`/stamps/country/${it.slug}`} style={{ display: 'flex', textAlign: 'center', gap: 4, alignItems: 'center', lineHeight: 1.1 }}>
                  <img className={styles.mini_flag} src={it.flag_image_url} alt='' width={24} />
                  {it.name_base}
                </Link>
              </List.Item>
            )}
          />
        </div>
      )}
      {/* Quick Picks */}
      <div>
        <Typography.Title level={5} style={{ marginBottom: 4 }}>
          Quick Picks
        </Typography.Title>
        {loading_quick ? (
          <Row gutter={[8, 8]}>
            {Array.from({ length: grid_cols * 2 }).map((_, i) => (
              <Col xs={12} sm={12} md={8} key={i}><Skeleton active paragraph={false} /></Col>
            ))}
          </Row>
        ) : quick_picks.length ? (
          <Row gutter={[8, 8]}>
            {quick_picks.map((it) => (
              <Col xs={12} sm={12} md={8} key={it.slug}>{render_country_card(it)}</Col>
            ))}
          </Row>
        ) : (
          <Empty description='No data' />
        )}
      </div>
      {/* Continue where you left off (ẩn nếu trống) */}
      {continue_list.length > 0 && (
        <div>
          <Typography.Title level={5} style={{ marginBottom: 8 }}>
            Continue where you left off
          </Typography.Title>
          <List
            size='small'
            dataSource={continue_list}
            renderItem={(it) => (
              <List.Item style={{ paddingLeft: 0 }}>
                <Link href={`/stamps/country/${it.slug}`} style={{ display: 'flex', textAlign: 'center', gap: 4, alignItems: 'center' }}>
                  {it.flag_image_url ? (
                    <img
                      className={style.mini_flag}
                      src={it.flag_image_url}
                      alt=''
                      width={24}
                    />
                  ) : (
                    <span style={{ marginRight: 8 }}>🏳️</span>
                  )}
                  {it.name_base} - {it.stamp_count} stamps
                </Link>
              </List.Item>
            )}
          />
        </div>
      )}
      {/* Explore by Region */}
      <div>
        <Typography.Title level={5} style={{ marginBottom: 0 }}>
          Explore by Region
        </Typography.Title>
        {/* Tabs: điều khiển bởi state; mặc định Asia */}
        <Tabs
          size='small'
          activeKey={active_region}
          defaultActiveKey={default_region}
          onChange={on_region_change}
          items={[
            { key: 'Asia', label: 'Asia' },
            { key: 'Europe', label: 'Europe' },
            { key: 'Africa', label: 'Africa' },
            { key: 'Americas', label: 'Americas' },
            { key: 'Oceania', label: 'Oceania' },
          ]}
        />
        {loading_region ? (
          <Row gutter={[8, 8]}>
            {Array.from({ length: grid_cols * 2 }).map((_, i) => (
              <Col xs={12} sm={12} md={8} key={i}>
                <Skeleton active paragraph={false} />
              </Col>
            ))}
          </Row>
        ) : region_items.length ? (
          <Row gutter={[8, 8]}>
            {region_items.map((it) => (
              <Col xs={12} sm={12} md={8} key={it.slug}>
                {render_country_card(it)}
              </Col>
            ))}
          </Row>
        ) : (
          // Chỉ hiển thị hint khi đã fetch xong mà không có dữ liệu
          <Typography.Text type='secondary' style={{ fontSize: 12 }}>
            No suggestions for this region.
          </Typography.Text>
        )}
      </div>
      {/* Browse A–Z */}
      <div>
        <Typography.Title level={5} style={{ marginBottom: 4 }}>
          Browse A–Z
        </Typography.Title>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 0' }}>
          {'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('').map((ch) => (
            <Tag
              className={styles.tag}
              key={ch}
              onClick={() => on_pick_letter(ch)}
              style={{ cursor: 'pointer', padding: '3px 7.9px' }}
            >
              {ch}
            </Tag>
          ))}
        </div>
        {/* Kết quả theo letter (render inline, gọn gàng - tránh overlay nặng) */}
        {az_letter && (
          <div style={{ marginTop: 4 }}>
            <Typography.Text strong>
              Results for “{az_letter}”
            </Typography.Text>
            {loading_az ? (
              <div style={{ marginTop: 4 }}>
                <Skeleton active />
              </div>
            ) : az_items.length ? (
              <List
                size='small'
                style={{ marginTop: 0 }}
                dataSource={az_items}
                renderItem={(it) => (
                  <List.Item style={{ paddingLeft: 0 }}>
                    <Link href={`/stamps/country/${it.slug}`} style={{ display: 'flex', textAlign: 'center', gap: 4, alignItems: 'center' }}>
                      <img
                        src={it.flag_image_url}
                        alt=''
                        width={24}
                        className={styles.mini_flag}
                      />
                      {it.name_base} - {it.stamp_count} stamps
                    </Link>
                  </List.Item>
                )}
              />
            ) : (
              <Typography.Text
                type='secondary'
                style={{ marginLeft: 8, display: 'block', marginTop: 8 }}
              >
                No results.
              </Typography.Text>
            )}
          </div>
        )}
      </div>
      {/* Top countries this year */}
      <div>
        <Typography.Title level={5} style={{ marginBottom: 0 }}>
          Top Countries This Year
        </Typography.Title>
        <YearTopBlock />
      </div>
    </div>
  );
};

const YearTopBlock = () => {
  const [items, set_items] = React.useState([])
  const [loading, set_loading] = React.useState(false)

  React.useEffect(() => {
    const load = async () => {
      set_loading(true)
      try {
        const res = await fetch('/api/stamps/country/top-year?limit=6')
        const data = await res.json()
        set_items(Array.isArray(data) ? data : [])
      } catch {
        set_items([])
      } finally {
        set_loading(false)
      }
    }
    load()
  }, [])

  if (loading) return <Skeleton active />
  if (!items.length) return <Typography.Text type='secondary' style={{ paddingLeft: 8 }}>No data.</Typography.Text>

  return (
    <List
      size='small'
      dataSource={items}
      renderItem={(it) => (
        <List.Item style={{ paddingLeft: 0 }}>
          <Link href={`/stamps/country/${it.slug}`}>
            <img src={it.flag_image_url} alt='' width={18} height={12} style={{ marginRight: 8 }} />
            {it.name_base} - {it.stamp_count} stamps
          </Link>
        </List.Item>
      )}
    />
  )
}

export default LeftCountryExplorer;
