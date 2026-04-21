const AppError = require('../utils/appError');

function requireRoles(...roles) {
  return function roleGuard(req, res, next) {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'Insufficient permission'));
    }

    return next();
  };
}

module.exports = {
  requireRoles
};