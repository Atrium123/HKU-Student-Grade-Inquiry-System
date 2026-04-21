const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireRoles } = require('../middleware/rbac');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/api');
const Grade = require('../models/Grade');

const router = express.Router();

router.get(
  '/me',
  requireAuth,
  requireRoles('student'),
  asyncHandler(async (req, res) => {
    const filter = {
      studentId: req.user._id
    };

    if (req.query.semester) {
      filter.semester = req.query.semester;
    }

    if (req.query.courseId) {
      filter.courseId = req.query.courseId;
    }

    const grades = await Grade.find(filter)
      .populate('courseId', 'courseCode courseName semester')
      .sort({ semester: -1, createdAt: -1 });

    const totalCourses = grades.length;
    const averageScore =
      totalCourses > 0
        ? Math.round((grades.reduce((sum, item) => sum + item.totalScore, 0) / totalCourses) * 100) / 100
        : 0;
    const averageGpa =
      totalCourses > 0
        ? Math.round((grades.reduce((sum, item) => sum + item.gpa, 0) / totalCourses) * 100) / 100
        : 0;

    sendSuccess(res, {
      status: 200,
      code: 'MY_GRADES_FETCHED',
      message: 'Student grades fetched',
      data: {
        items: grades,
        stats: {
          totalCourses,
          averageScore,
          averageGpa
        }
      }
    });
  })
);

module.exports = router;