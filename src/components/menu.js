import React, { useState, useEffect } from 'react';
import { Menu, Button, Drawer } from 'antd';
import { MenuOutlined } from '@ant-design/icons';

// Dữ liệu Menu bạn đã định nghĩa
const menuItems = [
  { label: 'Home', key: 'home' },
  { label: 'Collection', key: 'collection' },
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



const ResponsiveMenu = () => {
    const showDrawer = () => setOpen(true);
  const onClose = () => setOpen(false);

  const handleMenuClick = (e) => {
    // Thêm logic chuyển hướng ở đây
    console.log('Clicked item key:', e.key);
    onClose(); // Đóng Drawer sau khi chọn (chỉ trên mobile)
  };

  // ----------------------------------------------------
  // 1. Menu hiển thị cho MOBILE (Ẩn, dùng trong Drawer)
  // ----------------------------------------------------
  const MobileMenu = (
    <Menu
      mode="inline" // Menu dọc cho Drawer
      onClick={handleMenuClick}
      items={menuItems}
      style={{ borderRight: 0 }}
    />
  );

  // ----------------------------------------------------
  // 2. Menu hiển thị cho DESKTOP
  // ----------------------------------------------------
  const DesktopMenu = (
    <Menu
      mode="horizontal" // Menu ngang trên desktop
      onClick={handleMenuClick}
      defaultSelectedKeys={['home']}
      items={menuItems}
      style={{ flex: 1, minWidth: 0, borderBottom: 'none' }}
    />
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', height: 64, padding: '0 20px' }}>
      <DesktopMenu />
    </div>
  );
};

export default ResponsiveMenu; 