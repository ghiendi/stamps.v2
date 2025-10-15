// Trang đăng nhập tài khoản (Antd 5)
// - Gồm: email, password, remember_me, Turnstile
// - Toast thông báo tại chỗ, reset captcha sau mỗi submit

import { useCallback, useRef, useState, useEffect } from 'react';
import { Form, Input, Button, Card, Typography, Checkbox, message } from 'antd';
import { GoogleOutlined } from '@ant-design/icons';
import Turnstile_client from '@/components/turnstile_client';
import Link from 'next/link';
import styles from './register.module.css';

export default function Login_page() {
  const [form] = Form.useForm();
  const [submitting, set_submitting] = useState(false);
  const [turnstile_token, set_turnstile_token] = useState('');
  const turnstile_ref = useRef(null);

  const handle_turnstile_token = useCallback((t) => set_turnstile_token(t), []);

  async function on_finish(values) {
    set_submitting(true);
    try {
      const res = await fetch('/api/member/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          remember_me: values.remember_me || false,
          turnstile_token,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        if (data?.errors?._global) {
          message.error(data.errors._global);
        } else if (data?.errors) {
          const fields = Object.entries(data.errors).map(([k, v]) => ({
            name: k,
            errors: [v],
          }));
          form.setFields(fields);
        } else {
          message.error('Invalid credentials. Please try again.');
        }
        turnstile_ref.current?.reset_turnstile?.();
        set_turnstile_token('');
        return;
      }

      message.success('Signed in successfully.');
      form.resetFields();
      turnstile_ref.current?.reset_turnstile?.();
      set_turnstile_token('');
      // (vi) Sau khi login thành công, có thể redirect về /member/profile
      setTimeout(() => (window.location.href = '/member/profile'), 600);
    } catch (e) {
      console.error('login_submit_error', e);
      message.error('Something went wrong. Please try again.');
      turnstile_ref.current?.reset_turnstile?.();
      set_turnstile_token('');
    } finally {
      set_submitting(false);
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const err = params.get('err');
    if (!err) return;
    const map = {
      oauth_email_exists: 'This email is already associated with an account. Please sign in with your password, then link your social account from settings.',
      oauth_email_missing: 'Your social account did not provide an email. Please sign in with your email and password or register.',
      oauth_email_unverified: 'Your social email is not verified. Please sign in with your password first.',
      oauth_bad_request: 'Invalid OAuth request. Please try again.',
      oauth_state_invalid: 'Your session has expired. Please try again.',
      oauth_exchange_failed: 'We could not complete the sign-in. Please try again.',
      oauth_profile_failed: 'We could not retrieve your profile. Please try again.',
      oauth_misconfig: 'Social login is temporarily unavailable. Please try again later.',
      inactive: 'Your account is not active yet. Please check your email to activate your account.',
      oauth_denied: 'Social sign-in was cancelled or denied.',
      oauth_internal: 'We encountered an unexpected issue. Please try again.',
    };
    const msg = map[err] || 'We could not sign you in with your social account. Please try again.';
    message.error(msg);
  }, []);

  return (
    <div style={{ display: 'grid', placeItems: 'center', padding: '16px 0px' }}>
      <Card className={styles.card}>
        <Typography.Title level={3} style={{ marginBottom: 8 }}>
          Sign in
        </Typography.Title>
        <Typography.Paragraph type='secondary' style={{ marginBottom: 16 }}>
          Enter your email and password to access your account.
        </Typography.Paragraph>
        {/* Nút social login */}
        <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
          <Button
            block
            size='middle'
            onClick={() => (window.location.href = '/api/auth/oauth/google/start')}
            style={{
              fontWeight: 400,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4
            }}
          >
            <GoogleOutlined style={{ fontSize: 18, color: '#4285F4' }} />
            Continue with Google
          </Button>
          {/* <Button block onClick={() => (window.location.href = '/api/auth/oauth/facebook/start')}>
            Continue with Facebook
          </Button> */}
        </div>
        <Form layout='vertical' form={form} onFinish={on_finish} initialValues={{ remember_me: true }}>
          <Form.Item label='Email' name='email' rules={[{ required: true, message: 'Enter your email' }]}>
            <Input autoComplete='email' />
          </Form.Item>
          <Form.Item label='Password' name='password' rules={[{ required: true, message: 'Enter your password' }]}>
            <Input.Password autoComplete='current-password' />
          </Form.Item>
          <Form.Item name='remember_me' valuePropName='checked'>
            <Checkbox>Remember me</Checkbox>
          </Form.Item>
          <div style={{ marginBottom: 16 }}>
            <Turnstile_client
              ref={turnstile_ref}
              site_key={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
              on_token={handle_turnstile_token}
            />
          </div>
          <Button
            type='primary'
            htmlType='submit'
            block
            loading={submitting}
            disabled={!turnstile_token}
          >
            Sign in
          </Button>
          <div style={{ textAlign: 'right', marginTop: -2 }}>
            <a href="/member/forgot" style={{ fontSize: 13 }}>
              Forgot password?
            </a>
          </div>
          <div style={{ marginTop: 4, textAlign: 'center' }}>
            <Link href='/member/register'>Create new account</Link>
          </div>
        </Form>
      </Card>
    </div>
  );
}

export async function getServerSideProps(ctx) {
  const { require_anonymous } = await import('@/lib/route_guards');
  return require_anonymous(ctx, '/');
}