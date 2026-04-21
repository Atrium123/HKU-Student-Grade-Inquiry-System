function sendSuccess(res, {
  status = 200,
  code = 'OK',
  message = 'Success',
  data = null
} = {}) {
  res.status(status).json({
    success: true,
    code,
    message,
    data,
    requestId: res.locals.requestId
  });
}

function sendError(res, {
  status = 500,
  code = 'INTERNAL_SERVER_ERROR',
  message = 'Unexpected server error',
  details = null
} = {}) {
  const payload = {
    success: false,
    code,
    message,
    requestId: res.locals.requestId
  };

  if (details) {
    payload.details = details;
  }

  res.status(status).json(payload);
}

module.exports = {
  sendSuccess,
  sendError
};