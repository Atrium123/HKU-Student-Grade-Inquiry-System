const crypto = require('crypto');
const env = require('../config/env');

function hashWithHmac(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

function secureEqual(a, b) {
  const first = Buffer.from(a);
  const second = Buffer.from(b);

  if (first.length !== second.length) {
    return false;
  }

  return crypto.timingSafeEqual(first, second);
}

function generateOtpCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashOtp(otp) {
  return hashWithHmac(otp, env.OTP_HMAC_SECRET);
}

function hashRefreshToken(token) {
  return hashWithHmac(token, env.JWT_REFRESH_SECRET);
}

function hashIp(ipAddress) {
  return hashWithHmac(ipAddress || 'unknown', env.OTP_HMAC_SECRET);
}

module.exports = {
  generateOtpCode,
  hashOtp,
  hashRefreshToken,
  hashIp,
  secureEqual
};