import { useRouter } from 'next/router';
import Link from 'next/link';
import { Menu, message } from 'antd';
import { useEffect, useState, useMemo } from 'react';
import css from './header.module.css';

// (vi) Helper tính tên hiển thị: ưu tiên nickname, sau đó fullname
function get_display_name(profile) {
  if (!profile) return 'Member';
  return profile.nickname?.trim() || profile.fullname?.trim() || 'Member';
}

// (vi) Logout gọi API rồi chuyển về trang login
async function do_logout_current() {
  try {
    const r = await fetch('/api/member/logout-current', { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    if (j?.ok) {
      window.location.href = '/member/login';
    } else {
      message.error(j?.errors?._global || 'Failed to logout.');
    }
  } catch {
    message.error('Failed to logout.');
  }
}

export default function Header() {
  const router = useRouter();
  const [profile, set_profile] = useState(null);
  const [loading_me, set_loading_me] = useState(true);

  // (vi) Tải nhanh thông tin user (nếu đã đăng nhập)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await fetch('/api/member/profile', { method: 'GET' });
        if (r.status === 200) {
          const j = await r.json();
          if (mounted && j?.ok) set_profile(j.data || null);
        }
      } catch {
        /* bỏ qua: xem như chưa login */
      } finally {
        if (mounted) set_loading_me(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // ✅ Xác định key đang active dựa vào URL
  const selected_key = useMemo(() => {
    const p = router.pathname || '/';
    if (p.startsWith('/stamp')) return 'stamps';
    if (p.startsWith('/collection')) return 'collections';
    if (p.startsWith('/discovery')) return 'discovery';
    if (p.startsWith('/member')) return 'member';
    return '';
  }, [router.pathname]);

  // (vi) Xây menu động theo trạng thái đăng nhập
  const items = useMemo(() => {
    const base = [
      { label: <Link href="/stamp">Stamps</Link>, key: 'stamps' },
      { label: <Link href="/collection">Collections</Link>, key: 'collections' },
      { label: <Link href="/discovery">Discovery</Link>, key: 'discovery' },
    ];

    // Chưa biết trạng thái (đang load) -> tạm hiện "Member"
    if (loading_me) {
      base.push({
        label: 'Member',
        key: 'member',
        children: [
          { label: <Link href="/member/register">Register</Link>, key: 'register' },
          { label: <Link href="/member/login">Login</Link>, key: 'login' },
        ],
      });
      return base;
    }

    // Đã đăng nhập
    if (profile) {
      const name = get_display_name(profile);
      base.push({
        label: name,
        key: 'member',
        children: [
          { label: <Link href="/member/profile">Profile</Link>, key: 'profile' },
          { label: <a onClick={do_logout_current}>Logout</a>, key: 'logout' },
        ],
      });
      return base;
    }

    // Chưa đăng nhập
    base.push({
      label: 'Member',
      key: 'member',
      children: [
        { label: <Link href="/member/register">Register</Link>, key: 'register' },
        { label: <Link href="/member/login">Login</Link>, key: 'login' },
      ],
    });
    return base;
  }, [profile, loading_me]);

  return (
    <div className={css.main}>
      <div className={css.navbar1}>
        <Link href='/stamp'>
          <img className={css.logo} src={`/images/logo_v2.svg`} alt='Logo' />
        </Link>
      </div>
      <Menu
        mode='horizontal' // Menu ngang trên desktop
        defaultSelectedKeys={[selected_key]}
        items={items}
        style={{ flex: 1, minWidth: 0, borderBottom: 'none' }}
        popupClassName={css.menu_popup1}
      />
    </div>
  )
}