// Pool MariaDB READ (DBR_*) cho các truy vấn chỉ đọc
import mariadb from 'mariadb';
import { get_global_singleton } from './global_singleton';

export function get_dbr_pool() {
  return get_global_singleton('dbr_pool', () =>
    mariadb.createPool({
      host: process.env.DBR_HOST,
      port: Number(process.env.DBR_PORT || '3306'),
      user: process.env.DBR_USER,
      password: process.env.DBR_PASS,
      database: process.env.DBR_NAME,
      connectionLimit: Number(process.env.DBR_CONN_LIMIT || '10'),
      multipleStatements: false,
    })
  );
}
