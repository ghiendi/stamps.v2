// Xác thực Cloudflare Turnstile phía server
export async function verify_turnstile(response_token, ip) {
  try {
    const body = new URLSearchParams();
    body.append('secret', process.env.TURNSTILE_SECRET_KEY || '');
    body.append('response', response_token || '');
    if (ip) body.append('remoteip', ip);

    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    });
    const data = await r.json();
    return !!data?.success;
  } catch {
    return false;
  }
}
