const env = require('../config/env');
const { sendOtpMail } = require('../config/mailer');
const AppError = require('../utils/appError');
const { generateOtpCode, hashOtp, hashIp, secureEqual } = require('../utils/crypto');
const OtpChallenge = require('../models/OtpChallenge');
const OtpThrottle = require('../models/OtpThrottle');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function getEmailDomain(email) {
  return email.split('@')[1] || '';
}

function assertAllowedDomain(email) {
  const domain = getEmailDomain(email);

  if (!env.ALLOWED_EMAIL_DOMAINS.includes(domain)) {
    throw new AppError(
      400,
      'EMAIL_DOMAIN_NOT_ALLOWED',
      `Only ${env.ALLOWED_EMAIL_DOMAINS.join(', ')} emails are allowed`
    );
  }
}

async function incrementThrottle({ key, scope, minuteLimit, hourLimit, now }) {
  const current = now || new Date();
  let throttle = await OtpThrottle.findOne({ key });

  if (!throttle) {
    throttle = new OtpThrottle({
      key,
      scope,
      minuteWindowStart: current,
      minuteCount: 0,
      hourWindowStart: current,
      hourCount: 0
    });
  }

  const minuteMs = 60 * 1000;
  const hourMs = 60 * 60 * 1000;

  if (current.getTime() - throttle.minuteWindowStart.getTime() >= minuteMs) {
    throttle.minuteWindowStart = current;
    throttle.minuteCount = 0;
  }

  if (current.getTime() - throttle.hourWindowStart.getTime() >= hourMs) {
    throttle.hourWindowStart = current;
    throttle.hourCount = 0;
  }

  if (throttle.minuteCount >= minuteLimit || throttle.hourCount >= hourLimit) {
    throw new AppError(429, 'OTP_RATE_LIMITED', 'Too many OTP requests, try later');
  }

  throttle.minuteCount += 1;
  throttle.hourCount += 1;

  await throttle.save();

  return {
    minute: throttle.minuteCount,
    hour: throttle.hourCount
  };
}

async function createOtpChallenge({ email, locale, ip, purpose = 'auth' }) {
  const normalizedEmail = normalizeEmail(email);
  assertAllowedDomain(normalizedEmail);

  const ipHash = hashIp(ip || 'unknown');

  const emailCounters = await incrementThrottle({
    key: `email:${normalizedEmail}`,
    scope: 'email',
    minuteLimit: env.OTP_EMAIL_MINUTE_LIMIT,
    hourLimit: env.OTP_EMAIL_HOUR_LIMIT
  });

  const ipCounters = await incrementThrottle({
    key: `ip:${ipHash}`,
    scope: 'ip',
    minuteLimit: env.OTP_IP_MINUTE_LIMIT,
    hourLimit: env.OTP_IP_HOUR_LIMIT
  });

  const otp = generateOtpCode();
  const challenge = await OtpChallenge.create({
    email: normalizedEmail,
    purpose,
    otpHash: hashOtp(otp),
    expiresAt: new Date(Date.now() + env.OTP_TTL_MS),
    maxAttempts: env.OTP_MAX_ATTEMPTS,
    requestCounters: {
      emailMinute: emailCounters.minute,
      emailHour: emailCounters.hour,
      ipMinute: ipCounters.minute,
      ipHour: ipCounters.hour,
      ipHash
    }
  });

  await sendOtpMail({
    to: normalizedEmail,
    otp,
    locale
  });

  return {
    challenge,
    otp
  };
}

async function verifyOtpChallenge({ email, otp, purpose = 'auth' }) {
  const normalizedEmail = normalizeEmail(email);

  const challenge = await OtpChallenge.findOne({
    email: normalizedEmail,
    purpose,
    consumedAt: null
  })
    .sort({ createdAt: -1 })
    .exec();

  if (!challenge) {
    throw new AppError(400, 'OTP_NOT_FOUND', 'OTP challenge does not exist or has been consumed');
  }

  if (challenge.expiresAt.getTime() < Date.now()) {
    throw new AppError(400, 'OTP_EXPIRED', 'OTP code has expired');
  }

  if (challenge.attempts >= challenge.maxAttempts) {
    throw new AppError(429, 'OTP_MAX_ATTEMPTS', 'Maximum OTP attempts exceeded');
  }

  const candidateHash = hashOtp(String(otp));

  if (!secureEqual(candidateHash, challenge.otpHash)) {
    challenge.attempts += 1;
    await challenge.save();

    if (challenge.attempts >= challenge.maxAttempts) {
      throw new AppError(429, 'OTP_MAX_ATTEMPTS', 'Maximum OTP attempts exceeded');
    }

    throw new AppError(400, 'OTP_INVALID', 'OTP code is invalid');
  }

  challenge.consumedAt = new Date();
  await challenge.save();

  return challenge;
}

module.exports = {
  normalizeEmail,
  assertAllowedDomain,
  createOtpChallenge,
  verifyOtpChallenge
};
