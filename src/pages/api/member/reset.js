// POST /api/member/reset
// Nhận token + mật khẩu mới -> đặt lại mật khẩu, xóa session, gửi email
import crypto from 'crypto';
import { reset_schema } from '@/lib/validators';
import { get_dbr_pool } from '@/lib/db_read';
import { get_dbw_pool } from '@/lib/db_write';
import { hash_password } from '@/lib/argon';
import { destroy_all_sessions } from '@/lib/session';
import { log_member_activity } from '@/lib/logger';
import { send_password_reset_success_email } from '@/lib/email';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const parsed = reset_schema.safeParse(req.body || {});
  if (!parsed.success) {
    const errs = parsed.error.flatten().fieldErrors;
    const field_errors = {};
    for (const k in errs) field_errors[k] = errs[k][0];
    return res.status(200).json({ ok: false, errors: field_errors });
  }

  const { token, new_password } = parsed.data;
  const token_hash = crypto.createHash('sha256').update(token).digest('hex');

  const dbr = get_dbr_pool();
  const [rows] = await dbr.query(
    `SELECT r.*, m.email, m.fullname
     FROM member_password_resets r
     JOIN members m ON r.member_id = m.id
     WHERE r.token_hash=? LIMIT 1`, [token_hash]
  );
  if (!rows) return res.status(200).json({ ok: false, errors: { _global: 'Invalid or expired token.' } });

  const rec = rows;
  const now = new Date();
  if (rec.used_at || now > new Date(rec.expires_at)) {
    return res.status(200).json({ ok: false, errors: { _global: 'Invalid or expired token.' } });
  }

  // ✅ Đổi mật khẩu trong transaction
  const dbw = get_dbw_pool();
  const conn = await dbw.getConnection();
  try {
    await conn.beginTransaction();
    const new_hash = await hash_password(new_password);
    await conn.query(`UPDATE members SET password_hash=?, password_changed_at=NOW() WHERE id=?`, [new_hash, rec.member_id]);
    await conn.query(`UPDATE member_password_resets SET used_at=NOW() WHERE id=?`, [rec.id]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    console.error('reset_tx_error', e);
    return res.status(500).json({ ok: false, errors: { _global: 'Internal error.' } });
  } finally {
    conn.release();
  }

  // ✅ Xoá session, gửi mail
  await destroy_all_sessions(rec.member_id).catch(() => { });
  send_password_reset_success_email(rec.email, rec.fullname).catch(e => console.error('reset_success_email_failed', e));
  await log_member_activity(dbw, rec.member_id, 'PASSWORD_RESET', rec.created_ip);

  return res.status(200).json({ ok: true });
}
