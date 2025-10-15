// Helper tạo và xoá cookie chuẩn, tự động bỏ Secure khi chạy dev (HTTP hoặc localhost)
// Dùng chung cho login, logout, OAuth callback, v.v.

export function build_cookie_string(name, value, { max_age_sec } = {}) {
  if (!name) throw new Error('Cookie name is required');
  const parts = [`${name}=${value || ''}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];

  // (vi) Bật Secure khi production hoặc URL có https
  const is_secure =
    process.env.NODE_ENV === 'production' ||
    (process.env.NEXT_PUBLIC_SITE_URL || '').startsWith('https://');
  if (is_secure) parts.push('Secure');

  if (max_age_sec != null) parts.push(`Max-Age=${max_age_sec}`);
  return parts.join('; ');
}

export function clear_cookie_string(name) {
  if (!name) throw new Error('Cookie name is required');
  const parts = [`${name}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];

  const is_secure =
    process.env.NODE_ENV === 'production' ||
    (process.env.NEXT_PUBLIC_SITE_URL || '').startsWith('https://');
  if (is_secure) parts.push('Secure');

  return parts.join('; ');
}
