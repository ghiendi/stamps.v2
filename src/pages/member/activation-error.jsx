// Trang hiển thị khi link kích hoạt không hợp lệ + form gửi lại email
import { useState } from 'react';
import { Form, Input, Button, Card, Result, Grid, message } from 'antd';

const { useBreakpoint } = Grid;

export default function Activation_error_page() {
  const [form] = Form.useForm();
  const [loading, set_loading] = useState(false);
  const screens = useBreakpoint();

  async function on_finish(values) {
    set_loading(true);
    try {
      const res = await fetch('/api/member/resend-activation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: values.email }),
      });
      await res.json();
      message.success('A new activation email has been sent if the account is eligible.');
      form.resetFields();
    } catch {
      message.error('Something went wrong. Please try again.');
    } finally {
      set_loading(false);
    }
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', padding: '16px 0px' }}>
      <Card style={{ width: screens.xs ? '100%' : 420, maxWidth: '100%' }}>
        <Result status='error' title='Activation link invalid' />
        <Form layout='vertical' form={form} onFinish={on_finish}>
          <Form.Item label='Email' name='email' rules={[{ required: true, message: 'Enter your email' }]}>
            <Input autoComplete='email' />
          </Form.Item>
          <Button type='primary' htmlType='submit' block loading={loading}>Resend activation</Button>
        </Form>
      </Card>
    </div>
  );
}
