// Xử lý nghiệp vụ sau khi có profile từ provider
import { get_dbr_pool } from './db_read';
import { get_dbw_pool } from './db_write';
import { create_session } from './session';
import { log_member_activity } from './logger';

export async function process_oauth_login({
  provider,              // 'google' | 'facebook'
  provider_user_id,      // string
  email,                 // string | null
  email_verified,        // boolean
  fullname,              // string | null
  ip, ua,                // client info
}) {
  const dbr = get_dbr_pool();
  const dbw = get_dbw_pool();

  // 1) Nếu identity đã tồn tại → đăng nhập
  const got = await dbr.query(
    `SELECT mi.member_id, m.status
     FROM member_identities mi
     JOIN members m ON m.id = mi.member_id
     WHERE mi.provider=? AND mi.provider_user_id=?
     LIMIT 1`,
    [provider, provider_user_id]
  );
  if (got.length > 0) {
    const member_id = got[0].member_id;
    if (got[0].status !== 'ACTIVE') {
      // Không lộ enumeration → yêu cầu login bằng password / kích hoạt
      return { ok: false, redirect: '/member/login?err=inactive' };
    }
    const { session_id, ttl_sec } = await create_session(member_id, ip, ua, true);
    return { ok: true, session_id, ttl_sec };
  }

  // 2) Identity chưa tồn tại
  // - Nếu provider có email VERIFIED và chưa có member → tạo member mới (ACTIVE) + identity
  // - Nếu email trùng member đã có → KHÔNG auto-merge, yêu cầu user login bằng password rồi link
  // - Nếu không có email → yêu cầu user hoàn tất (tạm thời redirect về login với err)
  if (!email) {
    return { ok: false, redirect: '/member/login?err=oauth_email_missing' };
  }

  const by_email = await dbr.query(`SELECT id, status FROM members WHERE email=? LIMIT 1`, [email]);
  if (by_email.length > 0) {
    // Không auto-merge để an toàn
    return { ok: false, redirect: '/member/login?err=oauth_email_exists' };
  }

  if (!email_verified) {
    // Không verified → không auto-activate
    return { ok: false, redirect: '/member/login?err=oauth_email_unverified' };
  }

  // 3) Tạo mới member + identity
  let conn = null;
  try {
    conn = await dbw.getConnection();
    await conn.beginTransaction();

    const ins_member = await conn.query(
      `INSERT INTO members (email, fullname, nickname, password_hash, status, created_at)
       VALUES (?, ?, NULL, NULL, 'ACTIVE', NOW())`,
      [email, fullname || null]
    );
    const member_id = Number(ins_member.insertId);

    await conn.query(
      `INSERT INTO member_identities (member_id, provider, provider_user_id, provider_profile_json, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [member_id, provider, provider_user_id, JSON.stringify({ email, email_verified, fullname })]
    );

    await log_member_activity(conn, member_id, `OAUTH_${provider.toUpperCase()}_LINKED`, ip);

    await conn.commit();

    const { session_id, ttl_sec } = await create_session(member_id, ip, ua, true);
    return { ok: true, session_id, ttl_sec };
  } catch (e) {
    try { await conn?.rollback(); } catch { }
    console.error('oauth_create_member_error', e);
    return { ok: false, redirect: '/member/login?err=oauth_internal' };
  } finally {
    try { await conn?.release(); } catch { }
  }
}
