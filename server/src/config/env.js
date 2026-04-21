const dotenv = require('dotenv');

dotenv.config();

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBool(value, fallback = false) {
  if (value === undefined) {
    return fallback;
  }

  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
}

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: toInt(process.env.PORT, 4000),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hku_student_portal',
  CORS_ORIGIN: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'dev_access_secret',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret',
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  OTP_HMAC_SECRET: process.env.OTP_HMAC_SECRET || 'dev_otp_secret',
  OTP_TTL_MS: toInt(process.env.OTP_TTL_MS, 5 * 60 * 1000),
  OTP_MAX_ATTEMPTS: toInt(process.env.OTP_MAX_ATTEMPTS, 5),
  OTP_EMAIL_MINUTE_LIMIT: toInt(process.env.OTP_EMAIL_MINUTE_LIMIT, 3),
  OTP_EMAIL_HOUR_LIMIT: toInt(process.env.OTP_EMAIL_HOUR_LIMIT, 8),
  OTP_IP_MINUTE_LIMIT: toInt(process.env.OTP_IP_MINUTE_LIMIT, 6),
  OTP_IP_HOUR_LIMIT: toInt(process.env.OTP_IP_HOUR_LIMIT, 20),
  EXPOSE_DEBUG_OTP:
    process.env.EXPOSE_DEBUG_OTP !== undefined
      ? toBool(process.env.EXPOSE_DEBUG_OTP)
      : process.env.NODE_ENV !== 'production',
  ALLOWED_EMAIL_DOMAINS: (process.env.ALLOWED_EMAIL_DOMAINS || 'hku.hk,connect.hku.hk')
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean),
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: toInt(process.env.SMTP_PORT, 587),
  SMTP_SECURE: toBool(process.env.SMTP_SECURE),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM || 'HKU Grade Portal <no-reply@hku.hk>',
  ADMIN_BOOTSTRAP_EMAIL: process.env.ADMIN_BOOTSTRAP_EMAIL,
  ADMIN_BOOTSTRAP_NAME: process.env.ADMIN_BOOTSTRAP_NAME || 'System Admin'
};

module.exports = env;
