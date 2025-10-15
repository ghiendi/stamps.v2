import { useState } from 'react';
import { Card, Form, Input, Button, message } from 'antd';
import { useRouter } from 'next/router';

export default function MemberResetPage({ valid, token }) {
  const [loading, set_loading] = useState(false);
  const router = useRouter();

  async function on_finish(values) {
    set_loading(true);
    try {
      const r = await fetch('/api/member/reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...values, token }),
      });
      const j = await r.json();
      if (j.ok) {
        message.success('Password has been reset. Please sign in.');
        setTimeout(() => router.push('/member/login'), 1500);
      } else if (j.errors?._global) {
        message.error(j.errors._global);
      } else {
        message.error('Failed to reset password.');
      }
    } catch {
      message.error('Network error.');
    } finally {
      set_loading(false);
    }
  }

  if (!valid) {
    return (
      <div style={{ maxWidth: 400, margin: '80px auto' }}>
        <Card>
          <p>The reset link is invalid or expired.</p>
          <a href="/member/forgot">Request a new one</a>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 400, margin: '80px auto' }}>
      <Card title="Reset your password">
        <Form layout='vertical' onFinish={on_finish}>
          <Form.Item label='New password' name='new_password' rules={[{ required: true, message: 'Enter new password' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item label='Confirm new password' name='confirm_password' rules={[{ required: true, message: 'Confirm new password' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item>
            <Button type='primary' htmlType='submit' block loading={loading}>Reset password</Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

// SSR validate token
export async function getServerSideProps(ctx) {
  const token = ctx.params?.token || '';
  const crypto = await import('crypto');
  const hash = crypto.createHash('sha256').update(token).digest('hex');

  const { get_dbr_pool } = await import('@/lib/db_read');
  const dbr = get_dbr_pool();
  const [rows] = await dbr.query(`SELECT 1 FROM member_password_resets WHERE token_hash=? AND used_at IS NULL AND expires_at>NOW() LIMIT 1`, [hash]);
  return {
    props: { valid: !!rows, token },
  };
}
