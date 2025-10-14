import React from 'react';
import dayjs from 'dayjs';
import Link from 'next/link';
import pjson from '../../package.json';
import css from './footer.module.css';


export default class Footer extends React.Component {
  render() {
    return (
      <div className={css.main}>
        <div>
          &copy;2024{dayjs().format('YYYY') != '2024' ? ` - ${dayjs().format('YYYY')}` : ''}&nbsp;
          <span className={css.logo}>
            <span className='logo_dark_1'>Stamps</span>
            <span className='logo_dark_2'>.gallery</span>
          </span>, All rights reserved
        </div>
        <div className={css.zones}>
          <div className={css.zone_left}>Stamp Collecting Software, verison {pjson.version}</div>
          <div className={css.items}>
            <Link href={`/docs/terms-of-use`} target='_blank'>Terms</Link>
            <Link href={`/docs/privacy-policy`} target='_blank'>Privacy</Link>
            <Link href={`/docs/dmca`} target='_blank'>DMCA</Link>
          </div>
        </div>
        <div className={css.disclaimer}>
          <div>Disclaimer: Stamp images are for philatelic reference only. Copyright remains with respective postal authorities. This site may contain ads or membership fees, but images are not commercialized.</div>
          <div>DMCA Notice: Content is for educational use. Rights belong to original issuers. Report issues via email <Link href={'mailto:support@stamps.gallery'}>support@stamps.gallery</Link>.</div>
        </div>
      </div>
    );
  }
}