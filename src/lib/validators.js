// Tập trung toàn bộ schema validation (dùng Zod)
import { z } from 'zod';

/* -------------------- Common password rule -------------------- */
const strong_password = z.string()
  .min(8, 'Password must be at least 8 characters')
  .refine(v => /[a-z]/.test(v), 'At least one lowercase letter required')
  .refine(v => /[A-Z]/.test(v), 'At least one uppercase letter required')
  .refine(v => /[\d\W_]/.test(v), 'At least one number or symbol required');

/* -------------------- Register schema -------------------- */
export const register_schema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email'),
  fullname: z.string().trim().min(2, 'Too short').max(100, 'Too long'),
  nickname: z.string().trim().max(50, 'Too long').optional().or(z.literal('').transform(() => undefined)),
  password: strong_password,
  confirm_password: z.string(),
  turnstile_token: z.string().min(1, 'Captcha is required'),
  accept_terms: z
    .boolean({ required_error: 'You must accept the Terms to continue' })
    .refine(v => v === true, 'You must accept the Terms to continue'),
}).refine(d => d.password === d.confirm_password, {
  message: 'Password confirmation does not match',
  path: ['confirm_password'],
});

/* -------------------- Resend activation -------------------- */
export const resend_schema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email'),
});

/* -------------------- Login -------------------- */
export const login_schema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
  turnstile_token: z.string().min(1, 'Captcha is required'),
  remember_me: z.boolean().optional().default(false),
});

/* -------------------- Profile update -------------------- */
export const profile_update_schema = z.object({
  fullname: z.string().trim().min(2, 'Too short').max(100, 'Too long'),
  nickname: z.string().trim().max(50, 'Too long').optional().or(z.literal('').transform(() => undefined)),
});

/* -------------------- Password change / set -------------------- */
// Đổi mật khẩu (đã có password)
export const password_change_schema = z.object({
  current_password: z.string().min(1, 'Password is required'),
  new_password: strong_password,
  confirm_password: z.string(),
}).refine(d => d.new_password === d.confirm_password, {
  message: 'Password confirmation does not match',
  path: ['confirm_password'],
});

// Đặt mật khẩu lần đầu (chưa có password)
export const password_set_schema = z.object({
  new_password: strong_password,
  confirm_password: z.string(),
}).refine(d => d.new_password === d.confirm_password, {
  message: 'Password confirmation does not match',
  path: ['confirm_password'],
});
