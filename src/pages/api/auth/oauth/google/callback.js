// /api/auth/oauth/google/callback.js
// Xử lý callback OAuth từ Google: verify state, exchange code, lấy userinfo, tạo session
import { pop_state, assert_oauth_rl } from '@/lib/oauth_helpers';
import { process_oauth_login } from '@/lib/oauth_login';
import { build_cookie_string } from '@/lib/cookies';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  // Rate limit
  const rl = await assert_oauth_rl(req, 'callback');
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retry_after_sec));
    res.status(429).send('Too many requests');
    return;
  }

  const { code, state } = req.query || {};
  if (!code || !state) {
    res.redirect('/member/login?err=oauth_bad_request');
    return;
  }

  const saved = await pop_state(String(state));
  if (!saved || saved.provider !== 'google') {
    res.redirect('/member/login?err=oauth_state_invalid');
    return;
  }

  const client_id = process.env.GOOGLE_CLIENT_ID;
  const client_secret = process.env.GOOGLE_CLIENT_SECRET;
  const redirect_uri = process.env.GOOGLE_REDIRECT_URI;
  if (!client_id || !client_secret || !redirect_uri) {
    res.redirect('/member/login?err=oauth_misconfig');
    return;
  }

  // 1️⃣ Exchange code → token
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
    res.redirect('/member/login?err=oauth_exchange_failed');
    return;
  }

  // 2️⃣ Lấy userinfo từ Google
  let profile = null;
  try {
    const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token_json.access_token}` },
    });
    profile = await r.json();
    if (!r.ok || !profile?.sub) throw new Error('userinfo_failed');
  } catch (e) {
    console.error('google_userinfo_error', e, profile);
    res.redirect('/member/login?err=oauth_profile_failed');
    return;
  }

  // 3️⃣ Tạo/ghép user & session
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
  const ua = req.headers['user-agent'] || '';
  const result = await process_oauth_login({
    provider: 'google',
    provider_user_id: String(profile.sub),
    email: profile.email || null,
    email_verified: !!profile.email_verified,
    fullname: profile.name || null,
    ip,
    ua,
  });

  if (!result.ok) {
    res.redirect(result.redirect || '/member/login?err=oauth_denied');
    return;
  }

  // 4️⃣ Set session cookie và redirect về /
  const cookie_name = process.env.SESSION_COOKIE_NAME || 'SESSION_ID';
  res.setHeader(
    'Set-Cookie',
    build_cookie_string(cookie_name, result.session_id, { max_age_sec: result.ttl_sec })
  );

  res.redirect('/member/profile');
  return;
}
