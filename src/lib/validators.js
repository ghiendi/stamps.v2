// Validate dữ liệu bằng Zod (server-side)
import { z } from 'zod';

export const register_schema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email'),
  fullname: z.string().trim().min(2, 'Too short').max(100, 'Too long'),
  nickname: z.string().trim().max(50, 'Too long').optional().or(z.literal('').transform(() => undefined)),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .refine(v => /[a-z]/.test(v), 'At least one lowercase letter required')
    .refine(v => /[A-Z]/.test(v), 'At least one uppercase letter required')
    .refine(v => /[\d\W_]/.test(v), 'At least one number or symbol required'),
  confirm_password: z.string(),
  turnstile_token: z.string().min(1, 'Captcha is required'),
  accept_terms: z
    .boolean({ required_error: 'You must accept the Terms to continue' })
    .refine(v => v === true, 'You must accept the Terms to continue'),
}).refine(d => d.password === d.confirm_password, {
  message: 'Password confirmation does not match',
  path: ['confirm_password'],
});

export const resend_schema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email'),
});
