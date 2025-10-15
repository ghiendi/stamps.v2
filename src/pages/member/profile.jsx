// Trang hồ sơ thành viên: xem/cập nhật thông tin, đổi mật khẩu, xem phiên, logout
// - SSR guard: require_auth (import động để tránh bundle ioredis vào client)
import { useEffect, useState } from 'react';
import { Card, Typography, Form, Input, Button, message, Space, Table, Tag, Popconfirm, Row, Col } from 'antd';
import { UAParser } from 'ua-parser-js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import styles from './profile.module.css';
import css from 'styled-jsx/css';

dayjs.extend(utc);
dayjs.extend(timezone);

function to_flag_emoji(cc) {
  if (!cc || typeof cc !== 'string') return '';
  const up = cc.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(up)) return '';
  return String.fromCodePoint(up.charCodeAt(0) + 127397) +
    String.fromCodePoint(up.charCodeAt(1) + 127397);
}

// (vi) Format ngày giờ theo timezone của client
function format_client_dt(iso) {
  if (!iso) return '—';
  try {
    // Lấy timezone client
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    // Format kiểu: 2025-10-15 10:23 ICT
    return dayjs.utc(iso).tz(tz).format('YYYY-MM-DD HH:mm');
    // return dayjs.utc(iso).tz(tz).format('YYYY-MM-DD HH:mm:ss [GMT]Z');
  } catch {
    return iso;
  }
}

export default function Member_profile_page() {
  const [loading_profile, set_loading_profile] = useState(true);
  const [profile, set_profile] = useState(null);
  const [form_info] = Form.useForm();
  const [saving_info, set_saving_info] = useState(false);
  const [form_pw] = Form.useForm();
  const [saving_pw, set_saving_pw] = useState(false);
  const [sess_loading, set_sess_loading] = useState(true);
  const [sessions, set_sessions] = useState([]);

  // (vi) Tải thông tin profile
  async function load_profile() {
    try {
      set_loading_profile(true);
      const r = await fetch('/api/member/profile');
      const j = await r.json();
      if (j?.ok) {
        set_profile(j.data);
        form_info.setFieldsValue({
          fullname: j.data?.fullname || '',
          nickname: j.data?.nickname || '',
        });
      } else {
        message.error(j?.errors?._global || 'Failed to load profile.');
      }
    } catch {
      message.error('Failed to load profile.');
    } finally {
      set_loading_profile(false);
    }
  }

  // (vi) Lưu thông tin chung
  async function save_profile(values) {
    set_saving_info(true);
    try {
      const r = await fetch('/api/member/profile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      });
      const j = await r.json();
      if (j?.ok) {
        message.success('Profile updated.');
        await load_profile();
      } else if (j?.errors) {
        form_info.setFields(Object.entries(j.errors).map(([k, v]) => ({ name: k, errors: [v] })));
      } else {
        message.error('We could not update your profile. Please try again.');
      }
    } catch {
      message.error('We could not update your profile. Please try again.');
    } finally {
      set_saving_info(false);
    }
  }

  // (vi) Đổi mật khẩu
  async function change_password(values) {
    set_saving_pw(true);
    try {
      const r = await fetch('/api/member/change-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      });
      const j = await r.json();
      if (j?.ok) {
        message.success('Password changed successfully.');
        form_pw.resetFields();
      } else if (j?.errors) {
        if (j.errors._global) message.error(j.errors._global);
        form_pw.setFields(Object.entries(j.errors).filter(([k]) => k !== '_global').map(([k, v]) => ({ name: k, errors: [v] })));
      } else {
        message.error('We could not change your password. Please try again.');
      }
    } catch {
      message.error('We could not change your password. Please try again.');
    } finally {
      set_saving_pw(false);
    }
  }

  // (vi) Tải danh sách phiên
  async function load_sessions() {
    set_sess_loading(true);
    try {
      const r = await fetch('/api/member/sessions');
      const j = await r.json();
      if (j?.ok) set_sessions(j.data || []);
      else message.error(j?.errors?._global || 'Failed to load sessions.');
    } catch {
      message.error('Failed to load sessions.');
    } finally {
      set_sess_loading(false);
    }
  }

  // (vi) Logout hiện tại
  async function logout_current() {
    try {
      const r = await fetch('/api/member/logout-current', { method: 'POST' });
      const j = await r.json();
      if (j?.ok) {
        window.location.href = '/member/login';
      } else {
        message.error(j?.errors?._global || 'Failed to logout.');
      }
    } catch {
      message.error('Failed to logout.');
    }
  }

  // (vi) Logout tất cả
  async function logout_all() {
    try {
      const r = await fetch('/api/member/logout-all', { method: 'POST' });
      const j = await r.json();
      if (j?.ok) {
        window.location.href = '/member/login';
      } else {
        message.error(j?.errors?._global || 'Failed to logout all.');
      }
    } catch {
      message.error('Failed to logout all.');
    }
  }

  async function logout_one(session_id) {
    try {
      const r = await fetch('/api/member/logout-session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ session_id }),
      });
      const j = await r.json();
      if (j?.ok) {
        message.success('Session terminated.');
        load_sessions();
      } else {
        message.error(j?.errors?._global || 'Failed to logout this device.');
      }
    } catch {
      message.error('Failed to logout this device.');
    }
  }

  useEffect(() => {
    load_profile();
    load_sessions();
  }, []);

  const columns = [
    {
      title: 'Device',
      dataIndex: 'user_agent',
      render: (ua) => {
        if (!ua) return '—';
        const r = new UAParser(ua).getResult();
        const browser = r.browser?.name || 'Unknown';
        const os = r.os?.name || '';
        return `${browser}${os ? ' on ' + os : ''}`;
      },
    },
    { title: 'IP', dataIndex: 'ip_address' },
    {
      title: 'Location',
      dataIndex: 'geo',
      render: (g) => {
        if (!g || (!g.city && !g.country && !g.code)) return '—';
        const flag = to_flag_emoji(g.code);
        const parts = [];
        if (g.city) parts.push(g.city);
        if (g.country) parts.push(g.country);
        if (!g.country && g.code) parts.push(g.code); // fallback hiển thị code

        // Nếu emoji không render (một số font), vẫn có chuỗi parts
        return (
          <span>
            {flag ? <span style={{ marginRight: 6 }}>{flag}</span> : null}
            {parts.join(', ')}
          </span>
        );
      },
    },
    {
      title: 'Created', dataIndex: 'created_at',
      render: (v) => <span title={v || ''}>{format_client_dt(v)}</span>
    },
    {
      title: 'Last seen', dataIndex: 'last_seen_at',
      render: (v) => <span title={v || ''}>{format_client_dt(v)}</span>
    },
    {
      title: 'Current',
      dataIndex: 'current',
      render: (v) => (v ? <Tag color='green'>Current</Tag> : <Tag>Other</Tag>),
    },
    {
      title: 'Actions',
      render: (_, record) =>
        record.current ? null : (
          <Popconfirm title="Logout this device?" onConfirm={() => logout_one(record.session_id)} okText="Yes" cancelText="No">
            <Button size="small">Logout</Button>
          </Popconfirm>
        ),
    },
  ];

  return (
    <div className={styles.profile}>
      <Typography.Title level={3} style={{ marginBottom: 8 }}>Your Profile</Typography.Title>
      <Row gutter={[8, 8]}>
        {/* Left: Profile info (md>=768px => 50%) */}
        <Col xs={24} md={12}>
          <Card className={styles.profile_card} loading={loading_profile} title="Profile information">
            <Form form={form_info} layout='vertical' onFinish={save_profile}>
              <Form.Item label='Email'>
                <Input value={profile?.email || ''} disabled />
              </Form.Item>
              <Form.Item label='Full name' name='fullname' rules={[{ required: true, message: 'Enter your full name' }]}>
                <Input />
              </Form.Item>
              <Form.Item label='Nickname' name='nickname'>
                <Input />
              </Form.Item>
              <Button type='primary' htmlType='submit' loading={saving_info}>
                Save changes
              </Button>
            </Form>
          </Card>
        </Col>
        {/* Right: Change/Set password (md>=768px => 50%) */}
        <Col xs={24} md={12}>
          {profile?.has_password ? (
            <Card className={styles.change_password_card} title="Change password">
              <Form form={form_pw} layout='vertical' onFinish={change_password}>
                <Form.Item label='Current password' name='current_password' rules={[{ required: true, message: 'Enter your current password' }]}>
                  <Input.Password autoComplete='current-password' />
                </Form.Item>
                <Form.Item label='New password' name='new_password' rules={[{ required: true, message: 'Enter a new password' }]}>
                  <Input.Password autoComplete='new-password' />
                </Form.Item>
                <Form.Item label='Confirm new password' name='confirm_password' rules={[{ required: true, message: 'Confirm your new password' }]}>
                  <Input.Password autoComplete='new-password' />
                </Form.Item>
                <Button type='primary' htmlType='submit' loading={saving_pw}>
                  Change password
                </Button>
              </Form>
            </Card>
          ) : (
            <Card style={{ height: '100%' }} title="Set your password">
              <Typography.Paragraph type='secondary' style={{ marginBottom: 12 }}>
                You signed in with Google and haven’t set a password yet. You can create one now to sign in directly via email later.
              </Typography.Paragraph>
              <Form form={form_pw} layout='vertical' onFinish={change_password}>
                <Form.Item label='New password' name='new_password' rules={[{ required: true, message: 'Enter a new password' }]}>
                  <Input.Password autoComplete='new-password' />
                </Form.Item>
                <Form.Item label='Confirm new password' name='confirm_password' rules={[{ required: true, message: 'Confirm your new password' }]}>
                  <Input.Password autoComplete='new-password' />
                </Form.Item>
                <Button type='primary' htmlType='submit' loading={saving_pw}>
                  Set password
                </Button>
              </Form>
            </Card>
          )}
        </Col>
        {/* Bottom row: Active sessions (full width) */}
        <Col xs={24}>
          <Card
            className={styles.session_card}
            title="Active sessions"
            extra={
              <Space size={12} align="center">
                <Typography.Text type="secondary">
                  {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
                </Typography.Text>
                <Popconfirm title="Logout from all devices?" onConfirm={logout_all} okText="Yes" cancelText="No">
                  <Button danger>Logout all</Button>
                </Popconfirm>
                <Popconfirm title="Logout current session?" onConfirm={logout_current} okText="Yes" cancelText="No">
                  <Button>Logout current</Button>
                </Popconfirm>
              </Space>
            }
          >
            {/* ✅ Container scroll ngang */}
            <div
              style={{
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
                paddingBottom: 8,
                position: 'relative',
              }}
            >
              <Table
                rowKey="session_id"
                loading={sess_loading}
                dataSource={sessions}
                columns={columns}
                pagination={false}
                scroll={{ x: 'max-content' }}
                className="sessions-table"
              />

              {/* ✅ Gợi ý vuốt ngang (mobile only) */}
              <div className="swipe-hint">← Swipe to see more →</div>
            </div>

            {/* ✅ CSS inline */}
            <style jsx>{`
              /* Giao diện mobile */
              @media (max-width: 768px) {
                :global(.sessions-table .ant-table-thead > tr > th),
                :global(.sessions-table .ant-table-tbody > tr > td) {
                  white-space: nowrap;
                  padding: 6px 8px !important;
                  font-size: 13px !important;
                }
                :global(.sessions-table .ant-tag) {
                  font-size: 12px;
                  padding: 0 6px;
                }
                :global(.sessions-table .ant-btn) {
                  font-size: 12px;
                  padding: 2px 6px;
                  height: auto;
                }

                /* Thanh gợi ý Swipe */
                .swipe-hint {
                  text-align: center;
                  color: #999;
                  font-size: 12px;
                  padding-top: 4px;
                  animation: hint-blink 3s infinite;
                }
                @keyframes hint-blink {
                  0%, 90%, 100% { opacity: 0.3; }
                  45% { opacity: 1; }
                }
              }

              /* Ẩn gợi ý trên desktop */
              @media (min-width: 769px) {
                .swipe-hint { display: none; }
              }
            `}</style>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

// ✅ SSR guard (server-only dynamic import để tránh bundle redis vào client)
export async function getServerSideProps(ctx) {
  const { require_auth } = await import('@/lib/route_guards');
  return require_auth(ctx, '/member/login');
}
