// SSR guards: parse cookie từ header vì ctx.req.cookies có thể không tồn tại trong GSSP
import { get_session } from './session';

// (vi) Parser cookie đơn giản, tránh phải cài thêm thư viện
function parse_cookie_header(req) {
  const raw = req?.headers?.cookie || '';
  const out = {};
  raw.split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > -1) {
      const k = p.slice(0, i).trim();
      const v = p.slice(i + 1).trim();
      try { out[k] = decodeURIComponent(v); } catch { out[k] = v; }
    }
  });
  return out;
}

export async function require_auth(ctx, dest = '/member/login') {
  const cookie_name = process.env.SESSION_COOKIE_NAME || 'SESSION_ID';
  const cookies = parse_cookie_header(ctx.req);
  const sid = cookies[cookie_name];
  const sess = sid ? await get_session(sid) : null;

  if (!sess?.member_id) {
    return { redirect: { destination: dest, permanent: false } };
  }

  return { props: { user_id: sess.member_id } };
}

export async function require_anonymous(ctx, dest = '/') {
  const cookie_name = process.env.SESSION_COOKIE_NAME || 'SESSION_ID';
  const cookies = parse_cookie_header(ctx.req);
  const sid = cookies[cookie_name];
  const sess = sid ? await get_session(sid) : null;

  if (sess?.member_id) {
    return { redirect: { destination: dest, permanent: false } };
  }

  return { props: {} };
}
