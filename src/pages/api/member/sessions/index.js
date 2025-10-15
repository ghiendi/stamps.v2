// Liệt kê phiên đăng nhập
import { get_session, list_sessions, touch_session } from '@/lib/session';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const cookie_name = process.env.SESSION_COOKIE_NAME || 'SESSION_ID';
  const sid = req.cookies?.[cookie_name];
  const sess = sid ? await get_session(sid) : null;
  if (!sess?.member_id) {
    return res.status(401).json({ ok: false, errors: { _global: 'Unauthorized' } });
  }

  const items = await list_sessions(sess.member_id, sid);
  await touch_session(sid);
  return res.status(200).json({ ok: true, data: items });
}
