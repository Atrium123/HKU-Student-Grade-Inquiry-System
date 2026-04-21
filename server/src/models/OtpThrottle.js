const mongoose = require('mongoose');

const otpThrottleSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    scope: {
      type: String,
      enum: ['email', 'ip'],
      required: true
    },
    minuteWindowStart: {
      type: Date,
      required: true
    },
    minuteCount: {
      type: Number,
      default: 0
    },
    hourWindowStart: {
      type: Date,
      required: true
    },
    hourCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

otpThrottleSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

module.exports = mongoose.model('OtpThrottle', otpThrottleSchema);