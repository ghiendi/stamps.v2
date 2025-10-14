import '@ant-design/v5-patch-for-react-19';
import { ConfigProvider } from 'antd';
import BaseLayout from '@/components/base.layout';
import { default_theme } from '@/themes/default';
import '@/styles/globals.antd.css';
import '@/styles/globals.css';

export default function StampsApp({ Component, pageProps }) {
  return (
    <ConfigProvider theme={default_theme}>
      <BaseLayout>
        <Component {...pageProps} />
      </BaseLayout>
    </ConfigProvider>
  )
}