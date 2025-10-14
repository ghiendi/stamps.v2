// Giữ singleton trong globalThis để tránh tạo lại pool/redis/transporter mỗi request.
export function get_global_singleton(key, create_fn) {
  if (!globalThis.__sg_singletons) {
    globalThis.__sg_singletons = {};
  }
  if (!globalThis.__sg_singletons[key]) {
    globalThis.__sg_singletons[key] = create_fn();
  }
  return globalThis.__sg_singletons[key];
}
