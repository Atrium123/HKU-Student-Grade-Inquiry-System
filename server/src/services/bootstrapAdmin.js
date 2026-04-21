const env = require('../config/env');
const User = require('../models/User');
const { normalizeEmail, assertAllowedDomain } = require('./otpService');

async function bootstrapAdmin() {
  if (!env.ADMIN_BOOTSTRAP_EMAIL) {
    return null;
  }

  const email = normalizeEmail(env.ADMIN_BOOTSTRAP_EMAIL);
  assertAllowedDomain(email);

  let user = await User.findOne({ email });

  if (!user) {
    user = await User.create({
      email,
      role: 'admin',
      displayName: env.ADMIN_BOOTSTRAP_NAME,
      locale: 'zh-CN',
      isActive: true
    });

    return user;
  }

  let shouldSave = false;

  if (user.role !== 'admin') {
    user.role = 'admin';
    shouldSave = true;
  }

  if (!user.isActive) {
    user.isActive = true;
    shouldSave = true;
  }

  if (shouldSave) {
    await user.save();
  }

  return user;
}

module.exports = bootstrapAdmin;
