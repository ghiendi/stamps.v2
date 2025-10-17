// Callback Facebook: verify state, exchange code, lấy profile (id,name,email), xử lý login
import { pop_state, assert_oauth_rl } from '@/lib/oauth_helpers';
import { process_oauth_login } from '@/lib/oauth_login';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const rl = await assert_oauth_rl(req, 'callback');
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retry_after_sec));
    return res.status(429).send('Too many requests');
  }

  const { code, state } = req.query || {};
  if (!code || !state) return res.redirect('/member/login?err=oauth_bad_request');

  const saved = await pop_state(String(state));
  if (!saved || saved.provider !== 'facebook') {
    return res.redirect('/member/login?err=oauth_state_invalid');
  }

  const client_id = process.env.FACEBOOK_CLIENT_ID;
  const client_secret = process.env.FACEBOOK_CLIENT_SECRET;
  const redirect_uri = process.env.FACEBOOK_REDIRECT_URI;
  if (!client_id || !client_secret || !redirect_uri) return res.redirect('/member/login?err=oauth_misconfig');

  // 1) Exchange code → access_token
  let token_json = null;
  try {
    const url = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
    url.searchParams.set('client_id', client_id);
    url.searchParams.set('client_secret', client_secret);
    url.searchParams.set('code', String(code));
    url.searchParams.set('redirect_uri', redirect_uri);

    const r = await fetch(url.toString(), { method: 'GET' });
    token_json = await r.json();
    if (!r.ok || !token_json?.access_token) throw new Error('token_exchange_failed');
  } catch (e) {
    console.error('facebook_token_exchange_error', e, token_json);
    return res.redirect('/member/login?err=oauth_exchange_failed');
  }

  // 2) Lấy profile
  let profile = null;
  try {
    const url = new URL('https://graph.facebook.com/me');
    url.searchParams.set('fields', 'id,name,email');
    url.searchParams.set('access_token', token_json.access_token);

    const r = await fetch(url.toString(), { method: 'GET' });
    profile = await r.json();
    if (!r.ok || !profile?.id) throw new Error('userinfo_failed');
  } catch (e) {
    console.error('facebook_userinfo_error', e, profile);
    return res.redirect('/member/login?err=oauth_profile_failed');
  }

  const email = profile.email || null; // FB có thể không trả email
  const email_verified = !!email;      // FB không có cờ verified; coi như có email thì chấp nhận
  const fullname = profile.name || null;

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
  const ua = req.headers['user-agent'] || '';
  const result = await process_oauth_login({
    provider: 'facebook',
    provider_user_id: String(profile.id),
    email, email_verified, fullname, ip, ua,
  });

  if (!result.ok) {
    return res.redirect(result.redirect || '/member/login?err=oauth_denied');
  }

  const cookie_name = process.env.SESSION_COOKIE_NAME || 'SESSION_ID';
  res.setHeader('Set-Cookie', [
    `${cookie_name}=${result.session_id}; Path=/; Max-Age=${result.ttl_sec}; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
  ]);

  return res.redirect('/');
}
