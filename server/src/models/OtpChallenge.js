const mongoose = require('mongoose');

const otpChallengeSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      index: true,
      lowercase: true,
      trim: true
    },
    purpose: {
      type: String,
      default: 'auth',
      index: true
    },
    otpHash: {
      type: String,
      required: true
    },
    expiresAt: {
      type: Date,
      required: true
    },
    attempts: {
      type: Number,
      default: 0
    },
    maxAttempts: {
      type: Number,
      default: 5
    },
    consumedAt: {
      type: Date,
      default: null
    },
    requestCounters: {
      emailMinute: { type: Number, default: 0 },
      emailHour: { type: Number, default: 0 },
      ipMinute: { type: Number, default: 0 },
      ipHour: { type: Number, default: 0 },
      ipHash: { type: String }
    }
  },
  {
    timestamps: true
  }
);

otpChallengeSchema.index({ createdAt: -1 });
otpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OtpChallenge', otpChallengeSchema);
