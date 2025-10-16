// Trang /stamps: cột trái = LeftCountryExplorer (mobile-first), cột phải = placeholder vào Drawer khi mobile
import React from 'react';
import Head from 'next/head';
import { Layout, Card, List, Typography, Button, Drawer, Grid, FloatButton } from 'antd';
import dynamic from 'next/dynamic';
const LeftCountryExplorer = dynamic(() => import('@/components/left_country_explorer'), { ssr: false });
const { Content, Sider, Header } = Layout;
const { useBreakpoint } = Grid;
import styles from './index.module.css';

const RightSidebarContent = () => (
  <div className={styles.right_sidebar}>
    <Card title='🌍 Explore the stamp world' size='small' style={{ marginBottom: 8 }}>
      <Typography.Paragraph type='secondary' style={{ marginBottom: 0 }}>
        Use the search box to start.
      </Typography.Paragraph>
    </Card>
    <Card title='🔎 Explore by' size='small' style={{ marginBottom: 8 }}>
      <List
        size='small'
        dataSource={[
          { label: 'Countries (current)', href: '/stamps' },
          { label: 'Release year', href: '/stamps/year' },
          { label: 'Topics', href: '/stamps/topic' },
          { label: 'Special series', href: '/stamps/series' },
        ]}
        renderItem={(it) => (
          <List.Item style={{ paddingLeft: 0 }}>
            <a href={it.href}>{it.label}</a>
          </List.Item>
        )}
      />
    </Card>
    <Card title='🌟 Spotlight' size='small' style={{ marginBottom: 8 }}>
      <List
        size='small'
        dataSource={[
          { label: 'Japan — 12 new issues', href: '/stamps/country/japan' },
          { label: 'Europa 2025 — Peace & Unity', href: '/stamps/series/europa' },
        ]}
        renderItem={(it) => (
          <List.Item style={{ paddingLeft: 0 }}>
            <a href={it.href}>{it.label}</a>
          </List.Item>
        )}
      />
    </Card>
    <Card title='🤝 Community' size='small' style={{ marginBottom: 0 }}>
      <Typography.Paragraph type='secondary'>
        Contribute descriptions, images, or translations.
      </Typography.Paragraph>
      <Button type='primary' href='/member/login?next=/contribute' block>
        Sign in to contribute
      </Button>
    </Card>
  </div>
);

const StampsHome = () => {
  const screens = useBreakpoint();
  const is_mobile = screens.xs; // AntD xs ~ <576px
  const [drawer_open, set_drawer_open] = React.useState(false);

  return (
    <>
      <Head><title>Stamps - Explorer</title></Head>
      <Layout>
        {/* Header chỉ hiện trên mobile: nút mở Drawer bên phải */}
        {is_mobile && (
          <Header
            style={{
              background: '#fff',
              borderBottom: '1px solid #ced4da',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingInline: 0,
              height: 56,
            }}
          >
            <Typography.Title level={5} style={{ margin: 0 }}>Stamps</Typography.Title>
            <Button onClick={() => set_drawer_open(true)}>Explore</Button>
          </Header>
        )}
        <Layout>
          {/* LEFT: Country Explorer */}
          <Content className={styles.left}>
            <LeftCountryExplorer />
          </Content>
          {/* RIGHT: Sidebar (ẩn trên mobile, dùng Drawer thay thế) */}
          {!is_mobile ? (
            <Sider width={360} className={styles.right} theme='light'>
              <RightSidebarContent />
            </Sider>
          ) : (
            <Drawer
              title='Explore'
              placement='right'
              open={drawer_open}
              onClose={() => set_drawer_open(false)}
              width='85%'
            >
              <RightSidebarContent />
            </Drawer>
          )}
        </Layout>
        <FloatButton.BackTop visibilityHeight={200} />
      </Layout>
    </>
  );
};

export default StampsHome;
