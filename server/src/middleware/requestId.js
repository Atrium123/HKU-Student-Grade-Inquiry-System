const crypto = require('crypto');

function requestId(req, res, next) {
  res.locals.requestId = crypto.randomUUID();
  next();
}

module.exports = requestId;