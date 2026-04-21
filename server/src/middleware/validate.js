const AppError = require('../utils/appError');

function validate(schema, source = 'body') {
  return function validator(req, res, next) {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      return next(new AppError(400, 'VALIDATION_ERROR', 'Invalid request payload', result.error.flatten()));
    }

    req[source] = result.data;
    return next();
  };
}

module.exports = validate;