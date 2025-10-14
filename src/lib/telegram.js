// Gửi tin nhắn Telegram, hỗ trợ SOCKS5 bật/tắt.
// - Nếu SOCKS5_ENABLE=true: dùng https.request + SocksProxyAgent
//   + Thử 2 bước: (1) hostname; (2) nếu AddressNotSupported -> DNS IPv4 + SNI.
// - Nếu tắt proxy: dùng fetch bình thường.
// - Không throw ra ngoài; chỉ log để không phá UX kích hoạt.

import https from 'https';
import dns from 'dns/promises';
import { SocksProxyAgent } from 'socks-proxy-agent';

const TG_HOST = 'api.telegram.org';

function clean(s) {
  return (s || '').toString().trim();
}

function sanitize_host(raw_host) {
  const h = clean(raw_host);
  const idx = h.indexOf('://');
  return idx >= 0 ? h.slice(idx + 3) : h;
}

function make_proxy_agent() {
  const enabled = clean(process.env.SOCKS5_ENABLE || 'false').toLowerCase() === 'true';
  if (!enabled) return null;

  const host = sanitize_host(process.env.SOCKS5_HOST || '127.0.0.1');
  const port = Number(process.env.SOCKS5_PORT || '1080');
  const user = clean(process.env.SOCKS5_USERNAME || '');
  const pass = clean(process.env.SOCKS5_PASSWORD || '');

  if (!host || !Number.isFinite(port) || port <= 0) {
    console.warn('[telegram] SOCKS5 enabled but host/port invalid -> skip proxy');
    return null;
  }

  const url = new URL('socks5://');
  url.hostname = host;
  url.port = String(port);
  if (user) url.username = user;
  if (pass) url.password = pass;

  try {
    return new SocksProxyAgent(url.toString());
  } catch (e) {
    console.warn('[telegram] SOCKS5 URL invalid -> skip proxy', e);
    return null;
  }
}

async function https_post_with_agent({ url_str, json_body, agent, hostname, use_ip }) {
  // hostname: tên server gốc (TG_HOST) để set SNI nếu dùng IP
  const url = new URL(url_str);
  const data = Buffer.from(JSON.stringify(json_body), 'utf8');

  const opts = {
    protocol: url.protocol,
    hostname: use_ip ? use_ip : url.hostname,
    port: url.port || 443,
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'content-length': data.length,
      // (tuỳ chọn) Host header giúp một số proxy vui vẻ hơn
      Host: hostname || url.hostname,
    },
    // Nếu hostname là IP, để TLS ok cần SNI = hostname gốc
    servername: hostname || url.hostname,
    agent,
    timeout: 10000,
  };

  return await new Promise((resolve) => {
    const req = https.request(opts, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (ch) => (body += ch));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ ok: true });
        } else {
          resolve({ ok: false, status: res.statusCode || 0, body });
        }
      });
    });

    req.on('error', (err) => resolve({ ok: false, error: err }));
    req.on('timeout', () => {
      try { req.destroy(new Error('timeout')); } catch (_) { }
      resolve({ ok: false, error: new Error('timeout') });
    });

    req.write(data);
    req.end();
  });
}

export async function send_telegram_message(text) {
  if (clean(process.env.TELEGRAM_ENABLE || 'false').toLowerCase() !== 'true') return;

  const token = clean(process.env.TELEGRAM_BOT_TOKEN);
  const chat_id = clean(process.env.TELEGRAM_CHAT_ID);
  if (!token || !chat_id) {
    console.warn('[telegram] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = { chat_id, text };

  const agent = make_proxy_agent();
  const socks_on = !!agent;

  if (socks_on) {
    // Try #1: gửi với hostname bình thường
    const r1 = await https_post_with_agent({
      url_str: url,
      json_body: body,
      agent,
      hostname: TG_HOST,
      use_ip: null,
    });

    if (r1.ok) return;

    // Nếu lỗi AddressNotSupported → thử #2: resolve IPv4 và gửi bằng IP + SNI
    const maybe_addr_err =
      r1.error?.message?.includes('AddressNotSupported') ||
      (r1.body && /AddressNotSupported/i.test(r1.body));

    if (maybe_addr_err) {
      try {
        // Ưu tiên IPv4 để tránh vài proxy không hỗ trợ IPv6
        const { address } = await dns.lookup(TG_HOST, { family: 4 });
        const r2 = await https_post_with_agent({
          url_str: url,
          json_body: body,
          agent,
          hostname: TG_HOST, // SNI + Host header = api.telegram.org
          use_ip: address,   // Kết nối tới IP
        });
        if (!r2.ok) {
          console.error('telegram_send_failed_proxy_ip', r2.status || 0, r2.body || r2.error);
        }
        return;
      } catch (e) {
        console.error('telegram_dns_lookup_failed', e);
        return;
      }
    }

    // Các lỗi khác
    if (!r1.ok) {
      if (r1.error) console.error('telegram_network_error_proxy', r1.error);
      else console.error('telegram_send_failed_proxy', r1.status, r1.body);
    }
    return;
  }

  // Không proxy → fetch bình thường
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      console.error('telegram_send_failed', r.status, t);
    }
  } catch (e) {
    console.error('telegram_network_error', e);
  }
}
