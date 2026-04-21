const jwt = require('jsonwebtoken');
const env = require('../config/env');
const AppError = require('./appError');

function generateAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      email: user.email,
      role: user.role,
      type: 'access'
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
  );
}

function generateRefreshToken(user, jti) {
  return jwt.sign(
    {
      sub: String(user._id),
      type: 'refresh',
      jti
    },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
  );
}

function verifyAccessToken(token) {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);

    if (payload.type !== 'access') {
      throw new AppError(401, 'TOKEN_INVALID', 'Invalid access token type');
    }

    return payload;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(401, 'TOKEN_INVALID', 'Access token is invalid or expired');
  }
}

function verifyRefreshToken(token) {
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET);

    if (payload.type !== 'refresh' || !payload.jti) {
      throw new AppError(401, 'TOKEN_INVALID', 'Invalid refresh token type');
    }

    return payload;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(401, 'TOKEN_INVALID', 'Refresh token is invalid or expired');
  }
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
};