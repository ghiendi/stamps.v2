// /src/pages/member/forgot.jsx
import { useRef, useState } from 'react';
import { Card, Form, Input, Button, message, Alert } from 'antd';
import Turnstile_client from '@/components/turnstile_client';

export default function Member_forgot_page() {
  const [loading, set_loading] = useState(false);
  const [turnstile_token, set_turnstile_token] = useState('');
  const [form] = Form.useForm();
  const ts_ref = useRef(null);

  const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';

  // (vi) Reset widget + xóa token sau mỗi lần submit/lỗi
  function reset_turnstile() {
    try { ts_ref.current?.reset_turnstile?.(); } catch { }
    set_turnstile_token('');
  }

  async function on_finish(values) {
    if (!turnstile_token) {
      message.error('Please complete the captcha.');
      return;
    }
    set_loading(true);
    try {
      const r = await fetch('/api/member/forgot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...values, turnstile_token }),
      });
      const j = await r.json().catch(() => ({}));

      if (j?.ok) {
        message.success('If that email exists, we have sent a reset link.');
        form.resetFields();           // (vi) xóa form
        reset_turnstile();            // (vi) reset captcha
      } else {
        message.error(j?.errors?._global || 'Validation error.');
        reset_turnstile();
      }
    } catch (_) {
      message.error('Network error.');
      reset_turnstile();
    } finally {
      set_loading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '80px auto', padding: '0 12px' }}>
      <Card title="Forgot your password?">
        <Form form={form} layout="vertical" onFinish={on_finish}>
          <Form.Item
            label="Email"
            name="email"
            rules={[{ required: true, message: 'Enter your email' }]}
          >
            <Input />
          </Form.Item>

          {SITE_KEY ? (
            <Turnstile_client
              ref={ts_ref}
              site_key={SITE_KEY}          // ✅ dùng đúng prop của component
              on_token={set_turnstile_token}
            />
          ) : (
            <Alert
              type="error"
              showIcon
              message="Turnstile misconfigured"
              description="Missing NEXT_PUBLIC_TURNSTILE_SITE_KEY."
              style={{ marginBottom: 12 }}
            />
          )}

          <Form.Item style={{ marginTop: 16 }}>
            <Button type="primary" htmlType="submit" block loading={loading}>
              Send reset link
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'right' }}>
          <a href="/member/login" style={{ fontSize: 13 }}>Back to login</a>
        </div>
      </Card>
    </div>
  );
}
