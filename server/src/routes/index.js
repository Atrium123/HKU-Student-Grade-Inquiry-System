const express = require('express');
const { sendSuccess } = require('../utils/api');
const authRoutes = require('./authRoutes');
const profileRoutes = require('./profileRoutes');
const adminRoutes = require('./adminRoutes');
const gradeRoutes = require('./gradeRoutes');
const teacherRoutes = require('./teacherRoutes');

const router = express.Router();

router.get('/health', (req, res) => {
  sendSuccess(res, {
    status: 200,
    code: 'HEALTH_OK',
    message: 'Server is healthy',
    data: {
      uptime: process.uptime()
    }
  });
});

router.use('/auth', authRoutes);
router.use('/me', profileRoutes);
router.use('/admin', adminRoutes);
router.use('/grades', gradeRoutes);
router.use('/teacher', teacherRoutes);

module.exports = router;