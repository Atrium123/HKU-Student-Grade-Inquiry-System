const crypto = require('crypto');
const env = require('../config/env');
const AppError = require('../utils/appError');
const { hashRefreshToken, secureEqual } = require('../utils/crypto');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const RefreshSession = require('../models/RefreshSession');

function parseDurationToMs(duration, fallbackMs) {
  if (typeof duration !== 'string') {
    return fallbackMs;
  }

  const trimmed = duration.trim();
  const match = trimmed.match(/^(\d+)([smhd])$/i);

  if (!match) {
    return fallbackMs;
  }

  const value = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  if (!Number.isFinite(value)) {
    return fallbackMs;
  }

  const unitToMs = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  return value * unitToMs[unit];
}

const refreshLifetimeMs = parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN, 7 * 24 * 60 * 60 * 1000);

function userPublicProfile(user) {
  return {
    id: String(user._id),
    email: user.email,
    role: user.role,
    displayName: user.displayName,
    locale: user.locale,
    isActive: user.isActive,
    createdAt: user.createdAt
  };
}

async function issueTokenPair({ user, ipAddress }) {
  const jti = crypto.randomUUID();
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user, jti);

  await RefreshSession.create({
    userId: user._id,
    jti,
    refreshHash: hashRefreshToken(refreshToken),
    expiresAt: new Date(Date.now() + refreshLifetimeMs),
    createdByIp: ipAddress || null
  });

  return {
    accessToken,
    refreshToken,
    accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN
  };
}

async function rotateRefreshToken({ refreshToken, user, ipAddress }) {
  const payload = verifyRefreshToken(refreshToken);

  const session = await RefreshSession.findOne({
    userId: payload.sub,
    jti: payload.jti,
    revokedAt: null
  });

  if (!session) {
    throw new AppError(401, 'REFRESH_INVALID', 'Refresh session not found or revoked');
  }

  if (session.expiresAt.getTime() < Date.now()) {
    throw new AppError(401, 'REFRESH_EXPIRED', 'Refresh token session has expired');
  }

  const incomingHash = hashRefreshToken(refreshToken);

  if (!secureEqual(incomingHash, session.refreshHash)) {
    throw new AppError(401, 'REFRESH_INVALID', 'Refresh token hash mismatch');
  }

  const jti = crypto.randomUUID();
  const nextAccessToken = generateAccessToken(user);
  const nextRefreshToken = generateRefreshToken(user, jti);

  session.revokedAt = new Date();
  session.replacedBy = jti;
  await session.save();

  await RefreshSession.create({
    userId: user._id,
    jti,
    refreshHash: hashRefreshToken(nextRefreshToken),
    expiresAt: new Date(Date.now() + refreshLifetimeMs),
    createdByIp: ipAddress || null
  });

  return {
    accessToken: nextAccessToken,
    refreshToken: nextRefreshToken,
    accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN
  };
}

async function revokeRefreshSession(refreshToken) {
  if (!refreshToken) {
    return;
  }

  let payload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (error) {
    return;
  }

  const session = await RefreshSession.findOne({
    userId: payload.sub,
    jti: payload.jti,
    revokedAt: null
  });

  if (!session) {
    return;
  }

  const incomingHash = hashRefreshToken(refreshToken);

  if (!secureEqual(incomingHash, session.refreshHash)) {
    return;
  }

  session.revokedAt = new Date();
  await session.save();
}

module.exports = {
  userPublicProfile,
  issueTokenPair,
  rotateRefreshToken,
  revokeRefreshSession
};
