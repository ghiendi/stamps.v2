// Bắt đầu flow Google OAuth (OIDC) với PKCE + state + rate-limit
import { gen_state, gen_pkce_pair, save_state, assert_oauth_rl } from '@/lib/oauth_helpers';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  // Rate limit
  const rl = await assert_oauth_rl(req, 'start');
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retry_after_sec));
    return res.status(429).send('Too many requests');
  }

  const client_id = process.env.GOOGLE_CLIENT_ID;
  const redirect_uri = process.env.GOOGLE_REDIRECT_URI; // e.g., https://stamps.gallery:8090/api/auth/oauth/google/callback
  if (!client_id || !redirect_uri) return res.status(500).send('Provider misconfigured');

  const state = gen_state();
  const { verifier, challenge } = gen_pkce_pair();

  await save_state('google', state, {
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '',
    pkce_verifier: verifier,
  });

  const auth_url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  auth_url.searchParams.set('client_id', client_id);
  auth_url.searchParams.set('redirect_uri', redirect_uri);
  auth_url.searchParams.set('response_type', 'code');
  auth_url.searchParams.set('scope', 'openid email profile');
  auth_url.searchParams.set('state', state);
  auth_url.searchParams.set('code_challenge', challenge);
  auth_url.searchParams.set('code_challenge_method', 'S256');
  auth_url.searchParams.set('prompt', 'select_account'); // UX: chọn tài khoản

  res.redirect(auth_url.toString());
}
