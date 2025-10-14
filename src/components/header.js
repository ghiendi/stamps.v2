import Link from 'next/link';
import { Menu } from 'antd';
import css from './header.module.css';

const menu_ttems = [
  { label: 'Stamps', key: 'stamps' },
  { label: 'Collections', key: 'collection' },
  { label: 'Discovery', key: 'discovery' },
  {
    label: 'Member',
    key: 'member',
    children: [
      { label: 'Register', key: 'register' },
      { label: 'Login', key: 'login' },
    ],
  },
];

export default function Header() {
  return (
    <div className={css.main}>
      <div className={css.navbar1}>
        <Link href='/stamp'>
          <img className={css.logo} src={`/images/logo_v2.svg`} alt='Logo' />
        </Link>
      </div>
      <Menu
        mode='horizontal' // Menu ngang trên desktop
        defaultSelectedKeys={['stamps']}
        items={menu_ttems}
        style={{ flex: 1, minWidth: 0, borderBottom: 'none' }}
        popupClassName={css.menu_popup1}
      />
    </div>
  )
}