PROJECT_STRUCTURE.md
1) Tech stack & nguyên tắc
Next.js 19 (Page Routes), React, Ant Design 5.
MariaDB (mysql2/promise), Redis (ioredis).
Email: Nodemailer SMTP, template tách header/body/footer.
Validation: Zod, trả lỗi cấu trúc { ok:false, errors:{...} }.
Mặc định code: JavaScript, biến snake_case, hỗ trợ globalThis.

2) Cấu trúc thư mục (rút gọn)
src/
  components/
    header.jsx
    turnstile_client.jsx
  emails/
    _header.html
    _footer.html
    activation.html
    activation.txt
    welcome.html
    welcome.txt
    reset.html
    reset.txt
    reset_success.html
    reset_success.txt
  lib/
    argon.js               # hash/verify mật khẩu (argon2id)
    cookies.js             # build_cookie_string, parse
    db_read.js             # DBR_xxx (pool read)
    db_write.js            # DBW_xxx (pool write)
    email.js               # gửi mail: activation, welcome, password reset
    global_singleton.js    # cache singleton (redis, pools)
    logger.js              # log_member_activity(...)
    oauth_helpers.js       # state/PKCE lưu Redis, RL OAuth
    oauth_login.js         # process_oauth_login(provider…)
    rate_limit.js          # parse_rate_env, assert_rate_limit, build_rate_key
    redis.js               # get_redis(), get_ns_prefix()
    route_guards.js        # require_auth(), require_anonymous()
    session.js             # create_session(), touch_session(), list_sessions(), destroy_session(), destroy_all_sessions()
    telegram.js            # send_telegram_message (proxy SOCKS5 optional)
    validators.js          # zod schemas (register/login/profile/password/forgot/reset)
  pages/
    member/
      register.jsx
      login.jsx
      profile.jsx
      forgot.jsx
      reset/[token].jsx
    api/
      member/
        register.js
        login.js
        profile/index.js
        profile/password.js (nếu tách)
        change-password.js   # hoặc chung trong profile API
        forgot.js
        reset.js
        logout-current.js
        logout-all.js
        logout-session.js
        sessions.js          # (nếu tách)
      auth/
        oauth/google/start.js
        oauth/google/callback.js
        oauth/facebook/start.js (pending)
        oauth/facebook/callback.js (pending)
      v/[token].js           # kích hoạt tài khoản
  
Lưu ý: Page Routes được dùng cố định; không trộn App Router.

3) Quy ước & chuẩn code
Biến, hàm: snake_case.
API JSON: luôn trả { ok: true } hoặc { ok:false, errors:{ field: 'msg', _global: '...' } }.
Không lộ enumeration: các flow email (register/forgot) trả thông điệp chung.
Prepared statements: mọi query đều dùng ? params.
Duplicate key: map về lỗi chung (không lộ ER_DUP_ENTRY chi tiết).
Zod: check input ở API; validate UI lặp lại để UX tốt.
Turnstile: reset khi invalid/429/re-submit.

4) Biến môi trường chính (đều trong .env.development)
# DB Read
DBR_HOST=
DBR_PORT=
DBR_USER=
DBR_PASS=
DBR_NAME=
DBR_CONN_LIMIT=

# DB Write
DBW_HOST=
DBW_PORT=
DBW_USER=
DBW_PASS=
DBW_NAME=
DBW_CONN_LIMIT=

# SMTP
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM='Stamps.Gallery <no-reply@stamps.gallery>'

# App
APP_BASE_URL=https://stamps.gallery:8090
NEXT_PUBLIC_ASSETS_URL=https://assets.stamps.gallery

# Cloudflare Turnstile
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=

# Redis (rate-limit) - namespace yêu cầu
REDIS_URL=redis://:OAU9V@127.0.0.1:6379
REDIS_NAMESPACE=sg_
RATE_REGISTER_IP=5:15m
RATE_REGISTER_EMAIL=3:15m
RATE_RESEND_EMAIL=5:24h
RATE_ACTIVATE_IP=20:10m

# Token TTL (hours)
TOKEN_ACTIVATION_TTL_HOURS=24

# Telegram (optional)
TELEGRAM_BOT_TOKEN=7607258169:AAE0
TELEGRAM_CHAT_ID=-10030292
TELEGRAM_ENABLE=true

# SOCKS5 Proxy (optional cho Telegram)
SOCKS5_ENABLE=true
SOCKS5_HOST=139.
SOCKS5_PORT=1234
SOCKS5_USERNAME=ghi
SOCKS5_PASSWORD=Ghie

# OAuth state TTL
OAUTH_STATE_TTL_SECONDS=600

# Rate limit cho OAuth
RATE_OAUTH_START_IP=30:10m
RATE_OAUTH_CB_IP=60:10m

# Rate limit cho profile
RATE_PROFILE_GET=120:10m
RATE_PROFILE_UPDATE=30:10m
RATE_PASSWORD_CHANGE=10:10m

# Google
GOOGLE_CLIENT_ID=7327249
GOOGLE_CLIENT_SECRET=GOC
GOOGLE_REDIRECT_URI=https://sta


5) Redis keys & index

Session: sg_sess:{session_id} → JSON { member_id, ip_address, user_agent, created_at, last_seen_at, geo, ... }
Session index by member: sg_sess_idx:{member_id} (SET of session_id)
Geo cache: sg_geo:{ip} (TTL 7 ngày)
OAuth state/PKCE: sg_oauth_state:{state}
Rate limit: sg_rl:{scope}:{id} (vd: sg_rl:login:ip:1.2.3.4)
Email activation token (DB, không Redis).
Password reset token (DB, không Redis).


6) Email templates (đồng nhất)
Dùng src/lib/email.js để:
Activation: activation.html/txt (+ _header.html/_footer.html)
Welcome: welcome.html/txt
Password reset: reset.html/txt
Reset success: reset_success.html/txt
Tham số thay thế: {{fullname}}, {{activation_url}} hoặc {{reset_url}}, {{expires_hours}}.

8) Các page & API chính (luồng người dùng)
Đăng ký
GET /member/register → form + Turnstile
POST /api/member/register
Email activation: /v/[token] → kích hoạt; success → email welcome + Telegram + rate-limit GET

Đăng nhập
GET /member/login (Remember me, Turnstile)
POST /api/member/login → create_session
OAuth Google: /api/auth/oauth/google/start → /callback
Sau login: /member/login redirect nếu đã có session

Hồ sơ
GET /member/profile (SSR guard require_auth)
Cập nhật tên/biệt danh, đổi mật khẩu hoặc đặt lần đầu (nếu OAuth-only)
Liệt kê Active sessions (UA parse, location IP via ipwho.is + cache), logout current/all/one
Quên mật khẩu
GET /member/forgot (Email + Turnstile)
POST /api/member/forgot → lưu token hash + email reset
GET /member/reset/[token] (SSR validate)
POST /api/member/reset → đặt mật khẩu + logout all + email success

9) Bảo mật & kiểm thử

Không lộ enumeration trên /register, /forgot.
Token chỉ lưu hash (SHA-256), TTL theo ENV (đơn vị hours).
Token là 1 lần, set used_at sau khi dùng.
Argon2id cho mật khẩu.
Rate limit mọi endpoint nhạy cảm (đặc biệt OAuth start/callback).
Captcha: register, login, forgot (reset không cần để giảm friction).
Telegram: có thể bật khi activate thành công (qua SOCKS5).
Kiểm thử đường cong: captcha fail, RL hit, duplicate email, SMTP error, token expired/used.

10) UI/UX conventions

AntD5 components tối đa, toast gọn/đúng chỗ, không redirect gây choáng.
Thành công → chỉ hiện toast tại chỗ, reset form (không reload).
Tables mobile-friendly: scroll ngang, giảm padding, gợi ý “Swipe →”.
Date/time hiển thị bằng dayjs theo timezone client.

11) Ghi chú triển khai
Dev chạy HTTPS local (ví dụ https://stamps.gallery:8090) — cần set đúng NEXT_PUBLIC_SITE_URL & OAuth redirect.
Khi thay ENV → restart dev server.
Kiểm tra Turnstile: phải có NEXT_PUBLIC_TURNSTILE_SITE_KEY (client) & TURNSTILE_SECRET_KEY (server).

12) Backlog / TODO
Thông báo email/Telegram khi có đăng nhập lạ (IP mới/UA mới).
Tùy chọn bật/tắt GEO lookup (GEO_LOOKUP_ENABLE).
Thêm NEXT_PUBLIC_DATETIME_FORMAT để đổi format dayjs.