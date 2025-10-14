// Kích hoạt tài khoản qua token. Có rate-limit GET per-IP. Sau commit: gửi welcome email + Telegram.
import { get_dbw_pool } from '@/lib/db_write';
import { get_redis } from '@/lib/redis';
import crypto from 'crypto';
import { assert_rate_limit, parse_rate_env, build_rate_key } from '@/lib/rate_limit';
import { send_welcome_email } from '@/lib/email';
import { send_telegram_message } from '@/lib/telegram';
import { log_member_activity } from '@/lib/logger';
import { Result, Button } from 'antd';
import Link from 'next/link';

export async function getServerSideProps(context) {
  const token_raw = String(context.params?.token || '');
  const ip = context.req.headers['x-forwarded-for']?.split(',')[0]?.trim() || context.req.socket.remoteAddress || '';
  const redis = get_redis();

  // 1) Rate-limit GET /v/[token] per-IP
  const { limit: rl_act_limit, window_sec: rl_act_win } = parse_rate_env(process.env.RATE_ACTIVATE_IP, '20:10m');
  const rl_key = build_rate_key('activate:ip', ip || 'unknown');
  {
    const rl = await assert_rate_limit(redis, { key: rl_key, limit: rl_act_limit, window_sec: rl_act_win });
    if (!rl.ok) {
      context.res.statusCode = 429;
      return {
        props: { state: 'RL' },
      };
    }
  }

  // 2) Hash token → tra DB
  const token_hash = crypto.createHash('sha256').update(token_raw).digest('hex');

  const dbw = get_dbw_pool();
  let conn = null;
  try {
    conn = await dbw.getConnection();

    // Tìm token hợp lệ (chưa dùng + còn hạn)
    const rows = await conn.query(
      `SELECT t.id AS token_id, t.member_id, m.email, m.fullname
       FROM member_tokens t
       JOIN members m ON m.id = t.member_id
       WHERE t.token_type='ACTIVATION' AND t.token_value=? AND t.is_used=0 AND t.expires_at > NOW()
       LIMIT 1`,
      [token_hash]
    );
    if (rows.length === 0) {
      return { props: { state: 'INVALID' } };
    }
    const rec = rows[0];

    // 3) TX: ACTIVE + mark token used + log
    await conn.beginTransaction();
    await conn.query(`UPDATE members SET status='ACTIVE' WHERE id=?`, [rec.member_id]);
    await conn.query(`UPDATE member_tokens SET is_used=1 WHERE id=?`, [rec.token_id]);
    await log_member_activity(conn, rec.member_id, 'ACTIVATED', ip);
    await conn.commit();

    // 4) Hậu xử lý: email chào mừng + Telegram (không chặn UX nếu lỗi)
    try {
      await send_welcome_email(rec.email, rec.fullname || '');
      const lines = [
        '[Stamps.Gallery] New account activated',
        `Email: ${rec.email}`,
        `Name: ${rec.fullname || ''}`,
        `Time: ${new Date().toISOString()}`,
      ];
      await send_telegram_message(lines.join('\n'));
    } catch (e) {
      console.error('post_activation_hook_error', e);
    }

    return { props: { state: 'OK' } };
  } catch (e) {
    console.error('activate_error', e);
    return { props: { state: 'INVALID' } };
  } finally {
    try { await conn?.release(); } catch { }
  }
}

export default function Activate_page({ state }) {
  if (state === 'RL') {
    return (
      <Result
        status='warning'
        title='Too many requests'
        subTitle='Please wait a moment and try again.'
        extra={<Link href='/'><Button type='primary'>Go Home</Button></Link>}
      />
    );
  }
  if (state === 'OK') {
    return (
      <Result
        status='success'
        title='Your account has been activated. You can now sign in.'
        extra={<Link href='/'><Button type='primary'>OK</Button></Link>}
      />
    );
  }
  return (
    <Result
      status='error'
      title='This activation link is no longer valid.'
      subTitle='Please request a new activation email.'
      extra={<Link href='/member/activation-error'><Button>Resend activation</Button></Link>}
    />
  );
}
