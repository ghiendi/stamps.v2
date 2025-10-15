// Callback Google: verify state, exchange code (PKCE), lấy userinfo, xử lý login
import { pop_state, assert_oauth_rl } from '@/lib/oauth_helpers';
import { process_oauth_login } from '@/lib/oauth_login';
// import { build_cookie_string } from '@/lib/cookies';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  // Rate limit
  const rl = await assert_oauth_rl(req, 'callback');
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retry_after_sec));
    return res.status(429).send('Too many requests');
  }

  const { code, state } = req.query || {};
  if (!code || !state) return res.redirect('/member/login?err=oauth_bad_request');

  const saved = await pop_state(String(state));
  if (!saved || saved.provider !== 'google') {
    return res.redirect('/member/login?err=oauth_state_invalid');
  }

  const client_id = process.env.GOOGLE_CLIENT_ID;
  const client_secret = process.env.GOOGLE_CLIENT_SECRET;
  const redirect_uri = process.env.GOOGLE_REDIRECT_URI;
  if (!client_id || !client_secret || !redirect_uri) return res.redirect('/member/login?err=oauth_misconfig');

  // 1) Exchange code → token
  let token_json = null;
  try {
    const body = new URLSearchParams();
    body.set('client_id', client_id);
    body.set('client_secret', client_secret);
    body.set('code', String(code));
    body.set('grant_type', 'authorization_code');
    body.set('redirect_uri', redirect_uri);
    body.set('code_verifier', saved.pkce_verifier || '');

    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    token_json = await r.json();
    if (!r.ok || !token_json?.access_token) throw new Error('token_exchange_failed');
  } catch (e) {
    console.error('google_token_exchange_error', e, token_json);
    return res.redirect('/member/login?err=oauth_exchange_failed');
  }

  // 2) Lấy userinfo
  let profile = null;
  try {
    const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token_json.access_token}` },
    });
    profile = await r.json();
    if (!r.ok || !profile?.sub) throw new Error('userinfo_failed');
  } catch (e) {
    console.error('google_userinfo_error', e, profile);
    return res.redirect('/member/login?err=oauth_profile_failed');
  }

  // 3) Nghiệp vụ xử lý login theo policy
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
  const ua = req.headers['user-agent'] || '';
  const result = await process_oauth_login({
    provider: 'google',
    provider_user_id: String(profile.sub),
    email: profile.email || null,
    email_verified: !!profile.email_verified,
    fullname: profile.name || null,
    ip, ua,
  });

  if (!result.ok) {
    return res.redirect(result.redirect || '/member/login?err=oauth_denied');
  }

  // 4) Set session cookie (HttpOnly)
  const cookie_name = process.env.SESSION_COOKIE_NAME || 'SESSION_ID';
  res.setHeader('Set-Cookie', [
    // dùng helper cookies.js bạn đã có
    `${cookie_name}=${result.session_id}; Path=/; Max-Age=${result.ttl_sec}; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
  ]);

  return res.redirect('/');
}
