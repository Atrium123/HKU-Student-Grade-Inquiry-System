const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const apiRouter = require('./routes');
const requestId = require('./middleware/requestId');
const errorHandler = require('./middleware/errorHandler');
const { sendError } = require('./utils/api');

const app = express();

app.use(requestId);
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.CORS_ORIGIN.includes(origin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use('/api/v1', apiRouter);

app.use((req, res) => {
  sendError(res, {
    status: 404,
    code: 'NOT_FOUND',
    message: 'Route not found'
  });
});

app.use(errorHandler);

module.exports = app;
