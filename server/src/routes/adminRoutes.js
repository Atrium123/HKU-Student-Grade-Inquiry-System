const express = require('express');
const { z } = require('zod');
const { requireAuth } = require('../middleware/auth');
const { requireRoles } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/api');
const AppError = require('../utils/appError');
const User = require('../models/User');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const { normalizeEmail, assertAllowedDomain } = require('../services/otpService');

const router = express.Router();

router.use(requireAuth, requireRoles('admin'));

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

const createUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(['student', 'teacher', 'admin']).default('student'),
  displayName: z.string().trim().min(2).max(80),
  locale: z.enum(['zh-CN', 'en']).optional().default('zh-CN'),
  isActive: z.boolean().optional().default(true)
});

const updateUserSchema = z
  .object({
    role: z.enum(['student', 'teacher', 'admin']).optional(),
    displayName: z.string().trim().min(2).max(80).optional(),
    locale: z.enum(['zh-CN', 'en']).optional(),
    isActive: z.boolean().optional()
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field must be provided'
  });

const createCourseSchema = z.object({
  courseCode: z.string().trim().min(3).max(20),
  courseName: z.string().trim().min(2).max(120),
  semester: z.string().trim().min(3).max(40),
  teacherIds: z.array(objectIdSchema).optional().default([])
});

const updateCourseSchema = z
  .object({
    courseCode: z.string().trim().min(3).max(20).optional(),
    courseName: z.string().trim().min(2).max(120).optional(),
    semester: z.string().trim().min(3).max(40).optional(),
    teacherIds: z.array(objectIdSchema).optional()
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field must be provided'
  });

const createEnrollmentSchema = z.object({
  studentId: objectIdSchema,
  courseId: objectIdSchema,
  semester: z.string().trim().min(3).max(40).optional(),
  status: z.enum(['active', 'dropped']).optional().default('active')
});

async function assertTeachers(teacherIds) {
  if (!teacherIds || teacherIds.length === 0) {
    return;
  }

  const teacherCount = await User.countDocuments({
    _id: { $in: teacherIds },
    role: 'teacher',
    isActive: true
  });

  if (teacherCount !== teacherIds.length) {
    throw new AppError(400, 'INVALID_TEACHERS', 'teacherIds must reference active teacher users');
  }
}

router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const page = Math.max(Number.parseInt(req.query.page || '1', 10), 1);
    const pageSize = Math.min(Math.max(Number.parseInt(req.query.pageSize || '10', 10), 1), 100);

    const filter = {};

    if (req.query.role) {
      filter.role = req.query.role;
    }

    if (req.query.search) {
      const search = String(req.query.search).trim();
      filter.$or = [
        { email: new RegExp(search, 'i') },
        { displayName: new RegExp(search, 'i') }
      ];
    }

    const [items, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize),
      User.countDocuments(filter)
    ]);

    sendSuccess(res, {
      status: 200,
      code: 'USERS_FETCHED',
      message: 'Users fetched',
      data: {
        items,
        pagination: {
          page,
          pageSize,
          total
        }
      }
    });
  })
);

router.post(
  '/users',
  validate(createUserSchema),
  asyncHandler(async (req, res) => {
    const payload = req.body;
    const email = normalizeEmail(payload.email);

    assertAllowedDomain(email);

    const exists = await User.findOne({ email });

    if (exists) {
      throw new AppError(409, 'USER_EXISTS', 'User with this email already exists');
    }

    const user = await User.create({
      ...payload,
      email
    });

    sendSuccess(res, {
      status: 201,
      code: 'USER_CREATED',
      message: 'User created',
      data: user
    });
  })
);

router.patch(
  '/users/:userId',
  validate(z.object({ userId: objectIdSchema }), 'params'),
  validate(updateUserSchema),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const payload = req.body;

    const user = await User.findById(userId);

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User does not exist');
    }

    if (String(user._id) === String(req.user._id) && payload.isActive === false) {
      throw new AppError(400, 'SELF_DISABLE_NOT_ALLOWED', 'You cannot disable your own account');
    }

    Object.assign(user, payload);
    await user.save();

    sendSuccess(res, {
      status: 200,
      code: 'USER_UPDATED',
      message: 'User updated',
      data: user
    });
  })
);

router.get(
  '/courses',
  asyncHandler(async (req, res) => {
    const filter = {};

    if (req.query.semester) {
      filter.semester = req.query.semester;
    }

    if (req.query.courseCode) {
      filter.courseCode = req.query.courseCode;
    }

    const courses = await Course.find(filter)
      .populate('teacherIds', 'email displayName role')
      .sort({ semester: -1, courseCode: 1 });

    sendSuccess(res, {
      status: 200,
      code: 'COURSES_FETCHED',
      message: 'Courses fetched',
      data: courses
    });
  })
);

router.post(
  '/courses',
  validate(createCourseSchema),
  asyncHandler(async (req, res) => {
    const payload = req.body;

    await assertTeachers(payload.teacherIds);

    const course = await Course.create({
      ...payload,
      courseCode: payload.courseCode.toUpperCase()
    });

    sendSuccess(res, {
      status: 201,
      code: 'COURSE_CREATED',
      message: 'Course created',
      data: course
    });
  })
);

router.patch(
  '/courses/:courseId',
  validate(z.object({ courseId: objectIdSchema }), 'params'),
  validate(updateCourseSchema),
  asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    const payload = { ...req.body };

    if (payload.teacherIds) {
      await assertTeachers(payload.teacherIds);
    }

    if (payload.courseCode) {
      payload.courseCode = payload.courseCode.toUpperCase();
    }

    const course = await Course.findByIdAndUpdate(courseId, payload, {
      new: true,
      runValidators: true
    });

    if (!course) {
      throw new AppError(404, 'COURSE_NOT_FOUND', 'Course does not exist');
    }

    sendSuccess(res, {
      status: 200,
      code: 'COURSE_UPDATED',
      message: 'Course updated',
      data: course
    });
  })
);

router.get(
  '/enrollments',
  asyncHandler(async (req, res) => {
    const filter = {};

    if (req.query.semester) {
      filter.semester = req.query.semester;
    }

    if (req.query.courseId) {
      filter.courseId = req.query.courseId;
    }

    if (req.query.studentId) {
      filter.studentId = req.query.studentId;
    }

    const enrollments = await Enrollment.find(filter)
      .populate('studentId', 'email displayName role')
      .populate('courseId', 'courseCode courseName semester')
      .sort({ createdAt: -1 });

    sendSuccess(res, {
      status: 200,
      code: 'ENROLLMENTS_FETCHED',
      message: 'Enrollments fetched',
      data: enrollments
    });
  })
);

router.post(
  '/enrollments',
  validate(createEnrollmentSchema),
  asyncHandler(async (req, res) => {
    const payload = req.body;

    const student = await User.findOne({
      _id: payload.studentId,
      role: 'student'
    });

    if (!student) {
      throw new AppError(400, 'INVALID_STUDENT', 'studentId must reference a student user');
    }

    const course = await Course.findById(payload.courseId);

    if (!course) {
      throw new AppError(404, 'COURSE_NOT_FOUND', 'Course does not exist');
    }

    const enrollment = await Enrollment.create({
      studentId: payload.studentId,
      courseId: payload.courseId,
      semester: payload.semester || course.semester,
      status: payload.status
    });

    sendSuccess(res, {
      status: 201,
      code: 'ENROLLMENT_CREATED',
      message: 'Enrollment created',
      data: enrollment
    });
  })
);

router.delete(
  '/enrollments/:enrollmentId',
  validate(z.object({ enrollmentId: objectIdSchema }), 'params'),
  asyncHandler(async (req, res) => {
    const { enrollmentId } = req.params;

    const enrollment = await Enrollment.findByIdAndDelete(enrollmentId);

    if (!enrollment) {
      throw new AppError(404, 'ENROLLMENT_NOT_FOUND', 'Enrollment does not exist');
    }

    sendSuccess(res, {
      status: 200,
      code: 'ENROLLMENT_DELETED',
      message: 'Enrollment deleted',
      data: null
    });
  })
);

module.exports = router;