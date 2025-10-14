
import React from 'react';
// import { GoogleAnalytics } from '@next/third-parties/google';
import Head from 'next/head';
import Header from '@/components/header';
import Footer from '@/components/footer';
import css from './base.layout.module.css';

export default class BaseLayout extends React.Component {
  render() {
    const { children } = this.props;
    return (
      <>
        <Head>
          <title>Stamps Gallery</title>
          <link rel='shortcut icon' href={`${process.env.NEXT_PUBLIC_ASSETS_URL}/images/square_logo.png`} />
          <meta property='og:site_name' content='Stamps Gallery' />
          <meta property='description' key='description' content='Stamps Gallery - Stamp Collecting Software' />
        </Head>
        <div>
          <div className={css.container}>
            <Header />
          </div>
          <div className={css.container}>
            {children}
          </div>
          <div className={css.container}>
            <Footer />
          </div>
          {/* {process.env.NODE_ENV == 'production' ? <GoogleAnalytics gaId='	G-BC12E85NFN' /> : null} */}
        </div>
      </>
    );
  }
}