// Trang đăng ký
// - Dùng useCallback để on_token ổn định (không đổi tham chiếu mỗi render)
// - Reset Turnstile sau mọi submit (success/fail)
// - Toast tại chỗ + xóa form khi thành công
import { useCallback, useRef, useState } from 'react';
import { Form, Input, Button, Card, Typography, Grid, Checkbox, message } from 'antd';
import Link from 'next/link';
import Turnstile_client from '@/components/turnstile_client';

const { useBreakpoint } = Grid;

export default function Register_page() {
  const [form] = Form.useForm();
  const [submitting, set_submitting] = useState(false);
  const [turnstile_token, set_turnstile_token] = useState('');
  const turnstile_ref = useRef(null);
  const screens = useBreakpoint();

  // (vi) Callback ổn định cho Turnstile token (tránh re-render gây render lại widget)
  const handle_turnstile_token = useCallback((t) => {
    set_turnstile_token(t);
  }, []);

  async function on_finish(values) {
    set_submitting(true);
    try {
      const res = await fetch('/api/member/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: values.email,
          fullname: values.fullname,
          nickname: values.nickname || '',
          password: values.password,
          confirm_password: values.confirm_password,
          accept_terms: values.accept_terms === true,
          turnstile_token,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        // (vi) Lỗi nghiệp vụ: ẩn enumeration, chỉ hiển thị lỗi chung/field-level
        if (data?.errors?._global) {
          message.error(data.errors._global);
        } else if (data?.errors) {
          const fields = Object.entries(data.errors).map(([k, v]) => ({ name: k, errors: [v] }));
          form.setFields(fields);
        } else {
          message.error('We couldn’t create your account. Please review your information and try again.');
        }
        // (vi) Luôn reset Turnstile sau lần submit fail
        turnstile_ref.current?.reset_turnstile?.();
        set_turnstile_token('');
        return;
      }

      // ✅ Thành công: toast + xóa form + reset Turnstile
      message.success('Registration successful. Please check your email to activate your account.');
      form.resetFields();
      turnstile_ref.current?.reset_turnstile?.();
      set_turnstile_token('');
    } catch (e) {
      message.error('Something went wrong. Please try again.');
      turnstile_ref.current?.reset_turnstile?.();
      set_turnstile_token('');
    } finally {
      set_submitting(false);
    }
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', padding: '16px 0px' }}>
      <Card style={{ width: screens.xs ? '100%' : 420, maxWidth: '100%' }}>
        <Typography.Title level={3} style={{ marginBottom: 8 }}>Become a Member - It’s Free!</Typography.Title>
        <Typography.Paragraph type='secondary'>
          Fill the form below to create your account.
        </Typography.Paragraph>
        <Form layout='vertical' form={form} onFinish={on_finish}>
          <Form.Item label='Email' name='email' rules={[{ required: true, message: 'Enter your email' }]}>
            <Input autoComplete='email' />
          </Form.Item>
          <Form.Item label='Full name' name='fullname' rules={[{ required: true, message: 'Enter your full name' }]}>
            <Input autoComplete='name' />
          </Form.Item>
          <Form.Item label='Nickname (optional)' name='nickname'>
            <Input autoComplete='nickname' />
          </Form.Item>
          <Form.Item label='Password' name='password' rules={[{ required: true, message: 'Enter your password' }]}>
            <Input.Password autoComplete='new-password' />
          </Form.Item>
          <Form.Item label='Confirm password' name='confirm_password' rules={[{ required: true, message: 'Confirm your password' }]}>
            <Input.Password autoComplete='new-password' />
          </Form.Item>
          <Form.Item
            name='accept_terms'
            valuePropName='checked'
            rules={[{ validator: async (_, v) => (v ? Promise.resolve() : Promise.reject(new Error('You must accept the Terms to continue'))) }]}
          >
            <Checkbox>
              I agree to the&nbsp;
              <Link href='/docs/terms-of-use' target='_blank' rel='noreferrer'>Terms of Service</Link>
              &nbsp;and&nbsp;
              <Link href='/docs/privacy-policy' target='_blank' rel='noreferrer'>Privacy Policy</Link>.
            </Checkbox>
          </Form.Item>
          <div style={{ marginTop: 16, marginBottom: 8 }}>
            <Turnstile_client
              ref={turnstile_ref}
              site_key={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
              on_token={handle_turnstile_token}
            />
          </div>
          <Button type='primary' htmlType='submit' block loading={submitting} disabled={!turnstile_token}>
            Register
          </Button>
        </Form>
      </Card>
    </div>
  );
}