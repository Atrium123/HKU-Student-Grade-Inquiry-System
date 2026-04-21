const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/api');
const User = require('../models/User');
const AppError = require('../utils/appError');
const env = require('../config/env');
const {
  normalizeEmail,
  createOtpChallenge,
  verifyOtpChallenge,
  assertAllowedDomain
} = require('../services/otpService');
const {
  issueTokenPair,
  rotateRefreshToken,
  revokeRefreshSession,
  userPublicProfile
} = require('../services/authService');
const { verifyRefreshToken } = require('../utils/jwt');

const router = express.Router();

function extractIp(req) {
  const forwarded = req.headers['x-forwarded-for'];

  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }

  return req.ip;
}

function defaultDisplayName(email) {
  return email.split('@')[0];
}

const requestOtpSchema = z.object({
  email: z.string().email(),
  purpose: z.string().trim().min(1).max(30).optional().default('auth'),
  locale: z.enum(['zh-CN', 'en']).optional().default('zh-CN')
});

const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().regex(/^\d{6}$/),
  purpose: z.string().trim().min(1).max(30).optional().default('auth'),
  displayName: z.string().trim().min(2).max(80).optional(),
  locale: z.enum(['zh-CN', 'en']).optional().default('zh-CN')
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10).optional()
});

const logoutSchema = z.object({
  refreshToken: z.string().min(10).optional()
});

router.post(
  '/otp/request',
  validate(requestOtpSchema),
  asyncHandler(async (req, res) => {
    const { email, locale, purpose } = req.body;

    const normalizedEmail = normalizeEmail(email);
    assertAllowedDomain(normalizedEmail);

    const { otp, challenge } = await createOtpChallenge({
      email: normalizedEmail,
      locale,
      ip: extractIp(req),
      purpose
    });

    sendSuccess(res, {
      status: 200,
      code: 'OTP_SENT',
      message: 'OTP sent to your mailbox',
      data: {
        email: normalizedEmail,
        expiresAt: challenge.expiresAt,
        ...(env.EXPOSE_DEBUG_OTP ? { debugOtp: otp } : {})
      }
    });
  })
);

router.post(
  '/otp/verify',
  validate(verifyOtpSchema),
  asyncHandler(async (req, res) => {
    const { email, otp, purpose, displayName, locale } = req.body;
    const normalizedEmail = normalizeEmail(email);

    await verifyOtpChallenge({
      email: normalizedEmail,
      otp,
      purpose
    });

    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      user = await User.create({
        email: normalizedEmail,
        role: 'student',
        displayName: displayName || defaultDisplayName(normalizedEmail),
        locale: locale || 'zh-CN',
        isActive: true
      });
    }

    if (!user.isActive) {
      throw new AppError(403, 'USER_INACTIVE', 'User account is disabled');
    }

    const tokens = await issueTokenPair({
      user,
      ipAddress: extractIp(req)
    });

    sendSuccess(res, {
      status: 200,
      code: 'LOGIN_SUCCESS',
      message: 'OTP verified successfully',
      data: {
        user: userPublicProfile(user),
        ...tokens
      }
    });
  })
);

router.post(
  '/refresh',
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
    const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;

    if (!refreshToken) {
      throw new AppError(400, 'REFRESH_TOKEN_REQUIRED', 'refreshToken is required');
    }

    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.sub);

    if (!user || !user.isActive) {
      throw new AppError(401, 'UNAUTHORIZED', 'User not found or inactive');
    }

    const nextTokens = await rotateRefreshToken({
      refreshToken,
      user,
      ipAddress: extractIp(req)
    });

    sendSuccess(res, {
      status: 200,
      code: 'TOKEN_REFRESHED',
      message: 'Token refreshed',
      data: {
        user: userPublicProfile(user),
        ...nextTokens
      }
    });
  })
);

router.post(
  '/logout',
  validate(logoutSchema),
  asyncHandler(async (req, res) => {
    const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;

    await revokeRefreshSession(refreshToken);

    sendSuccess(res, {
      status: 200,
      code: 'LOGOUT_SUCCESS',
      message: 'Session revoked',
      data: null
    });
  })
);

module.exports = router;
