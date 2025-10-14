// Trang đăng nhập tài khoản (Antd 5)
// - Gồm: email, password, remember_me, Turnstile
// - Toast thông báo tại chỗ, reset captcha sau mỗi submit

import { useCallback, useRef, useState } from 'react';
import { Form, Input, Button, Card, Typography, Checkbox, message } from 'antd';
import Turnstile_client from '@/components/turnstile_client';
import Link from 'next/link';
import { require_anonymous } from '@/lib/route_guards';
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
      // (vi) Sau khi login thành công, có thể redirect về trang chủ
      setTimeout(() => (window.location.href = '/'), 600);
    } catch (e) {
      console.error('login_submit_error', e);
      message.error('Something went wrong. Please try again.');
      turnstile_ref.current?.reset_turnstile?.();
      set_turnstile_token('');
    } finally {
      set_submitting(false);
    }
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', padding: '16px 0px' }}>
      <Card className={styles.card}>
        <Typography.Title level={3} style={{ marginBottom: 8 }}>
          Sign in
        </Typography.Title>
        <Typography.Paragraph type='secondary' style={{ marginBottom: 16 }}>
          Enter your email and password to access your account.
        </Typography.Paragraph>

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

          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <Link href='/member/register'>Create new account</Link>
          </div>
        </Form>
      </Card>
    </div>
  );
}

export async function getServerSideProps(ctx) {
  return require_anonymous(ctx, '/');
}