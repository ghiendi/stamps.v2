// Băm/kiểm tra mật khẩu với argon2id
import argon2 from 'argon2';

export async function hash_password(plain) {
  // (vi) Tham số hợp lý cho web app
  return argon2.hash(plain, { type: argon2.argon2id, timeCost: 3, memoryCost: 64 * 1024, parallelism: 1 });
}

export async function verify_password(hash, plain) {
  return argon2.verify(hash, plain);
}
