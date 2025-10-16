// Country Picker (AutoComplete) — UI tiếng Anh; comment tiếng Việt
// - Hiển thị cờ nếu có flag_image_url
// - Debounce 300ms, min 2 ký tự
// - Chọn item -> điều hướng /stamps/country/[slug]

import React from 'react';
import { AutoComplete, Avatar, Typography, Spin } from 'antd';
import { useRouter } from 'next/router';
import styles from './country_picker.module.css';

const CountryPicker = () => {
  const router = useRouter();
  const [options, set_options] = React.useState([]);
  const [fetching, set_fetching] = React.useState(false);

  const save_recent = (item) => {
    try {
      const raw = localStorage.getItem('recent_searches') || '[]'
      const arr = JSON.parse(raw)
      const next = [item, ...arr.filter(x => x.slug !== item.slug)].slice(0, 6)
      localStorage.setItem('recent_searches', JSON.stringify(next))
    } catch { }
  }

  // Debounce fetch dữ liệu để tránh spam API khi gõ nhanh
  const fetch_data = React.useMemo(() => {
    let timer;
    return (q) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        const text = (q || '').trim();
        if (text.length < 2) { set_options([]); return; }
        set_fetching(true);
        try {
          const res = await fetch(`/api/stamps/country/search?q=${encodeURIComponent(text)}`);
          if (!res.ok) {
            console.error('Search API failed:', res.statusText); // log lỗi
            set_options([]);
            return;
          }
          const data = await res.json();

          // Map dữ liệu -> options cho AutoComplete
          const new_options = (data || []).map((item) => ({
            value: item.slug,
            label: (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {item.flag_image_url
                  ? <Avatar src={item.flag_image_url} size={24} />
                  : <Avatar size={24}>{(item.name_base || '?')[0]}</Avatar>}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography.Text strong>{item.name_base}</Typography.Text>
                  <Typography.Text type='secondary' style={{ fontSize: 12 }}>
                    {item.stamp_count} stamps{item.type === 'intl_org' ? ' • Organization' : ''}
                  </Typography.Text>
                </div>
              </div>
            )
          }));

          set_options(new_options);
        } catch (err) {
          console.error('Search request error:', err?.message);
          set_options([]);
        } finally {
          set_fetching(false);
        }
      }, 300); // 300ms debounce
    };
  }, []);

  const on_select = async (slug, option) => {
    // option.label không chứa đủ dữ liệu → gọi lại API 1 item tối giản hoặc
    // lưu tạm dựa trên value & text hiển thị
    save_recent({
      slug,
      name_base: option?.label?.props?.children?.[1]?.props?.children?.[0]?.props?.children || slug,
      stamp_count: 0,
      flag_image_url: `${process.env.NEXT_PUBLIC_ASSETS_URL}/flags/${slug}.svg`,
    })
    router.push(`/stamps/country/${slug}`)
  }

  return (
    <div>
      <AutoComplete
        className={styles.auto_complete}
        style={{ width: '100%' }}
        options={options}
        onSearch={fetch_data}
        onSelect={on_select}
        placeholder='Search for a country or issuing authority...'
        notFoundContent={fetching ? <Spin size='small' /> : 'No matching country'}
      />
      <div>
        <Typography.Text type='secondary' style={{ fontSize: 12 }}>Use ↑ / ↓ to navigate, Enter to select</Typography.Text>
      </div>
    </div>
  );
};

export default CountryPicker;
