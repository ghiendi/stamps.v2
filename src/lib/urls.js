// Xây dựng URL cho link kích hoạt
export function build_activation_url(raw_token) {
  const base = process.env.APP_BASE_URL?.replace(/\/+$/, '') || 'http://localhost:3000';
  return `${base}/v/${raw_token}`;
}
