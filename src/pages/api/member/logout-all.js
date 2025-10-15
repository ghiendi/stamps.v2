// Logout toàn bộ phiên của user
import { destroy_all_sessions, get_session } from '@/lib/session';
import { clear_cookie_string } from '@/lib/cookies';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const cookie_name = process.env.SESSION_COOKIE_NAME || 'SESSION_ID';
  const sid = req.cookies?.[cookie_name];
  const sess = sid ? await get_session(sid) : null;
  if (!sess?.member_id) {
    return res.status(401).json({ ok: false, errors: { _global: 'Unauthorized' } });
  }

  await destroy_all_sessions(sess.member_id);
  res.setHeader('Set-Cookie', clear_cookie_string(cookie_name));
  return res.status(200).json({ ok: true });
}
