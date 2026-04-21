const nodemailer = require('nodemailer');
const env = require('./env');

let transporter;

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS
      }
    });
  } else {
    transporter = nodemailer.createTransport({
      jsonTransport: true
    });
  }

  return transporter;
}

function buildOtpEmail({ otp, locale = 'zh-CN' }) {
  if (locale === 'en') {
    return {
      subject: 'HKU Grade Portal verification code',
      text: `Your verification code is ${otp}. It expires in 5 minutes.`,
      html: `<p>Your verification code is <b>${otp}</b>.</p><p>It expires in 5 minutes.</p>`
    };
  }

  return {
    subject: 'HKU 成绩系统验证码',
    text: `您的验证码是 ${otp}，5 分钟内有效。`,
    html: `<p>您的验证码是 <b>${otp}</b>。</p><p>请在 5 分钟内完成验证。</p>`
  };
}

async function sendOtpMail({ to, otp, locale }) {
  const emailContent = buildOtpEmail({ otp, locale });

  await getTransporter().sendMail({
    from: env.SMTP_FROM,
    to,
    ...emailContent
  });
}

module.exports = {
  sendOtpMail
};