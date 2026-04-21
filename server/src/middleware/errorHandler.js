const { ZodError } = require('zod');
const { sendError } = require('../utils/api');
const AppError = require('../utils/appError');

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof AppError) {
    return sendError(res, {
      status: error.statusCode,
      code: error.code,
      message: error.message,
      details: error.details
    });
  }

  if (error instanceof ZodError) {
    return sendError(res, {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid request payload',
      details: error.flatten()
    });
  }

  if (error?.name === 'CastError') {
    return sendError(res, {
      status: 400,
      code: 'INVALID_ID',
      message: 'Invalid resource id'
    });
  }

  if (error?.code === 11000) {
    return sendError(res, {
      status: 409,
      code: 'RESOURCE_CONFLICT',
      message: 'Duplicate resource detected',
      details: error.keyValue
    });
  }

  return sendError(res, {
    status: 500,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Unexpected server error'
  });
}

module.exports = errorHandler;