// Pool MariaDB WRITE (DBW_*) cho transaction ghi
import mariadb from 'mariadb';
import { get_global_singleton } from './global_singleton';

export function get_dbw_pool() {
  return get_global_singleton('dbw_pool', () =>
    mariadb.createPool({
      host: process.env.DBW_HOST,
      port: Number(process.env.DBW_PORT || '3306'),
      user: process.env.DBW_USER,
      password: process.env.DBW_PASS,
      database: process.env.DBW_NAME,
      connectionLimit: Number(process.env.DBW_CONN_LIMIT || '10'),
      multipleStatements: false,
    })
  );
}
