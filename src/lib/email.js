// Gửi email (Nodemailer). Template: header/body/footer tách rời.
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { get_global_singleton } from './global_singleton';

function read_template(rel_path) {
  const abs = path.join(process.cwd(), 'src', 'emails', rel_path);
  return fs.readFileSync(abs, 'utf8');
}

export const transporter = get_global_singleton('smtp_transporter', () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
);

// (vi) Gửi email kích hoạt
export async function send_activation_email(to_email, fullname, activation_url) {
  try {
    const header_html = read_template('_header.html');
    const body_html = read_template('activation.html')
      .replaceAll('{{fullname}}', fullname)
      .replaceAll('{{activation_url}}', activation_url);
    const footer_html = read_template('_footer.html');
    const text_fallback = read_template('activation.txt')
      .replaceAll('{{fullname}}', fullname)
      .replaceAll('{{activation_url}}', activation_url);

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: to_email,
      subject: 'Activate your Stamps.Gallery account',
      html: `${header_html}${body_html}${footer_html}`,
      text: text_fallback,
    });
  } catch (e) {
    // (vi) Không throw để không làm fail quy trình sau commit
    console.error('activation_email_failed', e);
  }
}

// (vi) Gửi email chào mừng sau khi kích hoạt
export async function send_welcome_email(to_email, fullname) {
  try {
    const header_html = read_template('_header.html');
    const body_html = read_template('welcome.html').replaceAll('{{fullname}}', fullname);
    const footer_html = read_template('_footer.html');
    const text_fallback = read_template('welcome.txt').replaceAll('{{fullname}}', fullname);

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: to_email,
      subject: 'Welcome to Stamps.Gallery',
      html: `${header_html}${body_html}${footer_html}`,
      text: text_fallback,
    });
  } catch (e) {
    console.error('welcome_email_failed', e);
  }
}

// (vi) Gửi email chứa link đặt lại mật khẩu
export async function send_password_reset_email(to_email, fullname, reset_url) {
  try {
    const header_html = read_template('_header.html');
    const body_html = read_template('reset.html')
      .replaceAll('{{fullname}}', fullname || 'there')
      .replaceAll('{{reset_url}}', reset_url)
      .replaceAll('{{expires_hours}}', String(process.env.RESET_TOKEN_TTL_HOURS || '2'));
    const footer_html = read_template('_footer.html');
    const text_fallback = read_template('reset.txt')
      .replaceAll('{{fullname}}', fullname || 'there')
      .replaceAll('{{reset_url}}', reset_url)
      .replaceAll('{{expires_hours}}', String(process.env.RESET_TOKEN_TTL_HOURS || '2'));

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: to_email,
      subject: 'Reset your Stamps.Gallery password',
      html: `${header_html}${body_html}${footer_html}`,
      text: text_fallback,
    });
  } catch (e) {
    console.error('password_reset_email_failed', e);
  }
}

// (vi) Gửi email thông báo đã đổi mật khẩu thành công
export async function send_password_reset_success_email(to_email, fullname) {
  try {
    const header_html = read_template('_header.html');
    const body_html = read_template('reset_success.html')
      .replaceAll('{{fullname}}', fullname || 'there');
    const footer_html = read_template('_footer.html');
    const text_fallback = read_template('reset_success.txt')
      .replaceAll('{{fullname}}', fullname || 'there');

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: to_email,
      subject: 'Your Stamps.Gallery password has been reset',
      html: `${header_html}${body_html}${footer_html}`,
      text: text_fallback,
    });
  } catch (e) {
    console.error('password_reset_success_email_failed', e);
  }
}
