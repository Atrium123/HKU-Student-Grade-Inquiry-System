const express = require('express');
const { z } = require('zod');
const { requireAuth } = require('../middleware/auth');
const { requireRoles } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/api');
const AppError = require('../utils/appError');
const Course = require('../models/Course');
const User = require('../models/User');
const Enrollment = require('../models/Enrollment');
const Grade = require('../models/Grade');
const { buildGradeResult } = require('../utils/grade');

const router = express.Router();

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

const componentSchema = z.object({
  name: z.string().trim().min(1).max(40),
  score: z.number().min(0).max(100),
  weight: z.number().min(0).max(100)
});

const createGradeSchema = z.object({
  studentId: objectIdSchema,
  courseId: objectIdSchema,
  semester: z.string().trim().min(3).max(40).optional(),
  components: z.array(componentSchema).optional().default([]),
  totalScore: z.number().min(0).max(100).optional()
});

const updateGradeSchema = z
  .object({
    components: z.array(componentSchema).optional(),
    totalScore: z.number().min(0).max(100).optional()
  })
  .refine((payload) => payload.components !== undefined || payload.totalScore !== undefined, {
    message: 'components or totalScore is required'
  });

router.use(requireAuth, requireRoles('teacher', 'admin'));

async function assertCoursePermission(user, courseId) {
  const course = await Course.findById(courseId);

  if (!course) {
    throw new AppError(404, 'COURSE_NOT_FOUND', 'Course does not exist');
  }

  if (user.role === 'admin') {
    return course;
  }

  const hasPermission = course.teacherIds.some((teacherId) => teacherId.equals(user._id));

  if (!hasPermission) {
    throw new AppError(403, 'FORBIDDEN', 'You can only manage grades in your assigned courses');
  }

  return course;
}

router.get(
  '/courses',
  asyncHandler(async (req, res) => {
    const filter = req.user.role === 'admin' ? {} : { teacherIds: req.user._id };

    if (req.query.semester) {
      filter.semester = req.query.semester;
    }

    const courses = await Course.find(filter)
      .populate('teacherIds', 'displayName email')
      .sort({ semester: -1, courseCode: 1 });

    sendSuccess(res, {
      status: 200,
      code: 'TEACHER_COURSES_FETCHED',
      message: 'Course list fetched',
      data: courses
    });
  })
);

router.get(
  '/courses/:courseId/enrollments',
  validate(z.object({ courseId: objectIdSchema }), 'params'),
  asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    const course = await assertCoursePermission(req.user, courseId);

    const enrollments = await Enrollment.find({
      courseId,
      status: 'active'
    }).populate('studentId', 'displayName email role');

    sendSuccess(res, {
      status: 200,
      code: 'COURSE_ENROLLMENTS_FETCHED',
      message: 'Course enrollments fetched',
      data: {
        course,
        enrollments
      }
    });
  })
);

router.get(
  '/grades',
  asyncHandler(async (req, res) => {
    const filter = {};

    if (req.query.courseId) {
      await assertCoursePermission(req.user, req.query.courseId);
      filter.courseId = req.query.courseId;
    } else if (req.user.role !== 'admin') {
      const courses = await Course.find({ teacherIds: req.user._id }).select('_id');
      filter.courseId = { $in: courses.map((course) => course._id) };
    }

    if (req.query.semester) {
      filter.semester = req.query.semester;
    }

    if (req.query.studentId) {
      filter.studentId = req.query.studentId;
    }

    const grades = await Grade.find(filter)
      .populate('studentId', 'displayName email')
      .populate('courseId', 'courseCode courseName semester')
      .sort({ updatedAt: -1 });

    sendSuccess(res, {
      status: 200,
      code: 'TEACHER_GRADES_FETCHED',
      message: 'Grades fetched',
      data: grades
    });
  })
);

router.post(
  '/grades',
  validate(createGradeSchema),
  asyncHandler(async (req, res) => {
    const payload = req.body;
    const course = await assertCoursePermission(req.user, payload.courseId);

    const student = await User.findOne({
      _id: payload.studentId,
      role: 'student',
      isActive: true
    });

    if (!student) {
      throw new AppError(400, 'INVALID_STUDENT', 'studentId must reference an active student');
    }

    const semester = payload.semester || course.semester;

    const enrollment = await Enrollment.findOne({
      studentId: payload.studentId,
      courseId: payload.courseId,
      semester,
      status: 'active'
    });

    if (!enrollment) {
      throw new AppError(400, 'ENROLLMENT_REQUIRED', 'Student is not actively enrolled in this course');
    }

    const gradeResult = buildGradeResult({
      components: payload.components,
      totalScore: payload.totalScore
    });

    const grade = await Grade.create({
      studentId: payload.studentId,
      courseId: payload.courseId,
      semester,
      components: payload.components,
      ...gradeResult,
      enteredBy: req.user._id,
      updatedBy: req.user._id
    });

    sendSuccess(res, {
      status: 201,
      code: 'GRADE_CREATED',
      message: 'Grade created',
      data: grade
    });
  })
);

router.patch(
  '/grades/:gradeId',
  validate(z.object({ gradeId: objectIdSchema }), 'params'),
  validate(updateGradeSchema),
  asyncHandler(async (req, res) => {
    const grade = await Grade.findById(req.params.gradeId);

    if (!grade) {
      throw new AppError(404, 'GRADE_NOT_FOUND', 'Grade does not exist');
    }

    await assertCoursePermission(req.user, grade.courseId);

    const nextComponents = req.body.components !== undefined ? req.body.components : grade.components;
    const nextTotalScore = req.body.totalScore !== undefined ? req.body.totalScore : grade.totalScore;

    const gradeResult = buildGradeResult({
      components: nextComponents,
      totalScore: nextTotalScore
    });

    grade.components = nextComponents;
    grade.totalScore = gradeResult.totalScore;
    grade.letterGrade = gradeResult.letterGrade;
    grade.gpa = gradeResult.gpa;
    grade.updatedBy = req.user._id;

    await grade.save();

    sendSuccess(res, {
      status: 200,
      code: 'GRADE_UPDATED',
      message: 'Grade updated',
      data: grade
    });
  })
);

module.exports = router;