// API đăng xuất (xóa session Redis + clear cookie)
import { destroy_session } from '@/lib/session';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const cookie_name = process.env.SESSION_COOKIE_NAME || 'SESSION_ID';
  const cookie_val = req.cookies?.[cookie_name];
  if (cookie_val) {
    await destroy_session(cookie_val);
  }

  // Xóa cookie
  res.setHeader('Set-Cookie', [
    `${cookie_name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
  ]);

  return res.status(200).json({ ok: true });
}
