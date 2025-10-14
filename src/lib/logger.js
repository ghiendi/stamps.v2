// Ghi nhật ký hoạt động vào member_activity_log
export async function log_member_activity(conn, member_id, action, ip_address) {
  const sql = `
    INSERT INTO member_activity_log (member_id, action, ip_address, created_at)
    VALUES (?, ?, ?, NOW())
  `;
  await conn.query(sql, [member_id, action, ip_address || null]);
}
