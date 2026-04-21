const AppError = require('../utils/appError');
const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');

function extractBearerToken(authorizationHeader) {
  if (!authorizationHeader || typeof authorizationHeader !== 'string') {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}

async function requireAuth(req, res, next) {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Missing bearer access token'));
  }

  let payload;

  try {
    payload = verifyAccessToken(token);
  } catch (error) {
    return next(error);
  }

  const user = await User.findById(payload.sub);

  if (!user || !user.isActive) {
    return next(new AppError(401, 'UNAUTHORIZED', 'User not found or inactive'));
  }

  req.user = user;
  req.auth = {
    userId: String(user._id),
    role: user.role,
    email: user.email
  };

  return next();
}

module.exports = {
  requireAuth,
  extractBearerToken
};