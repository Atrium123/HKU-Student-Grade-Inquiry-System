const request = require('supertest');
const app = require('../src/app');
const OtpChallenge = require('../src/models/OtpChallenge');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('./testDb');

describe('Auth & OTP integration', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  async function loginByOtp(email) {
    const requestOtp = await request(app)
      .post('/api/v1/auth/otp/request')
      .send({ email, locale: 'en' });

    const otp = requestOtp.body.data.debugOtp;

    const verifyOtp = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send({ email, otp, locale: 'en' });

    return verifyOtp.body.data;
  }

  test('should restrict registration to HKU domains', async () => {
    const response = await request(app)
      .post('/api/v1/auth/otp/request')
      .send({ email: 'user@gmail.com' });

    expect(response.statusCode).toBe(400);
    expect(response.body.code).toBe('EMAIL_DOMAIN_NOT_ALLOWED');
  });

  test('should send and verify OTP for valid domain', async () => {
    const email = 'student@hku.hk';

    const requestOtp = await request(app)
      .post('/api/v1/auth/otp/request')
      .send({ email, locale: 'en' });

    expect(requestOtp.statusCode).toBe(200);
    expect(requestOtp.body.code).toBe('OTP_SENT');
    expect(requestOtp.body.data.debugOtp).toMatch(/^\d{6}$/);

    const verifyOtp = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send({ email, otp: requestOtp.body.data.debugOtp, locale: 'en' });

    expect(verifyOtp.statusCode).toBe(200);
    expect(verifyOtp.body.code).toBe('LOGIN_SUCCESS');
    expect(verifyOtp.body.data.user.role).toBe('student');
    expect(verifyOtp.body.data.accessToken).toBeTruthy();
    expect(verifyOtp.body.data.refreshToken).toBeTruthy();
  });

  test('should reject expired OTP challenge', async () => {
    const email = 'expired@hku.hk';

    const requestOtp = await request(app)
      .post('/api/v1/auth/otp/request')
      .send({ email, locale: 'en' });

    const challenge = await OtpChallenge.findOne({ email }).sort({ createdAt: -1 });
    challenge.expiresAt = new Date(Date.now() - 1000);
    await challenge.save();

    const verifyOtp = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send({ email, otp: requestOtp.body.data.debugOtp, locale: 'en' });

    expect(verifyOtp.statusCode).toBe(400);
    expect(verifyOtp.body.code).toBe('OTP_EXPIRED');
  });

  test('should enforce OTP max attempts limit', async () => {
    const email = 'retry@connect.hku.hk';

    await request(app)
      .post('/api/v1/auth/otp/request')
      .send({ email, locale: 'en' });

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await request(app)
        .post('/api/v1/auth/otp/verify')
        .send({ email, otp: '000000', locale: 'en' });

      expect(response.statusCode).toBe(400);
      expect(response.body.code).toBe('OTP_INVALID');
    }

    const finalTry = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send({ email, otp: '000000', locale: 'en' });

    expect(finalTry.statusCode).toBe(429);
    expect(finalTry.body.code).toBe('OTP_MAX_ATTEMPTS');
  });

  test('should rotate refresh token and invalidate old one', async () => {
    const session = await loginByOtp('rotate@hku.hk');

    const refreshResponse = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: session.refreshToken });

    expect(refreshResponse.statusCode).toBe(200);
    expect(refreshResponse.body.data.refreshToken).toBeTruthy();
    expect(refreshResponse.body.data.refreshToken).not.toEqual(session.refreshToken);

    const reuseOldToken = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: session.refreshToken });

    expect(reuseOldToken.statusCode).toBe(401);
    expect(reuseOldToken.body.code).toBe('REFRESH_INVALID');
  });

  test('logout should revoke refresh session', async () => {
    const session = await loginByOtp('logout@hku.hk');

    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: session.refreshToken });

    expect(logout.statusCode).toBe(200);

    const refreshAfterLogout = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: session.refreshToken });

    expect(refreshAfterLogout.statusCode).toBe(401);
    expect(refreshAfterLogout.body.code).toBe('REFRESH_INVALID');
  });
});