// Bắt đầu flow Facebook OAuth (không PKCE), state + rate-limit
import { gen_state, save_state, assert_oauth_rl } from '@/lib/oauth_helpers';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const rl = await assert_oauth_rl(req, 'start');
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retry_after_sec));
    return res.status(429).send('Too many requests');
  }

  const client_id = process.env.FACEBOOK_CLIENT_ID;
  const redirect_uri = process.env.FACEBOOK_REDIRECT_URI; // https://stamps.gallery:8090/api/auth/oauth/facebook/callback
  if (!client_id || !redirect_uri) return res.status(500).send('Provider misconfigured');

  const state = gen_state();
  await save_state('facebook', state, {
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '',
  });

  const auth_url = new URL('https://www.facebook.com/v18.0/dialog/oauth');
  auth_url.searchParams.set('client_id', client_id);
  auth_url.searchParams.set('redirect_uri', redirect_uri);
  auth_url.searchParams.set('state', state);
  auth_url.searchParams.set('response_type', 'code');
  auth_url.searchParams.set('scope', 'public_profile,email');

  res.redirect(auth_url.toString());
}
