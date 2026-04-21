const request = require('supertest');
const app = require('../src/app');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('./testDb');
const User = require('../src/models/User');
const Course = require('../src/models/Course');
const Enrollment = require('../src/models/Enrollment');
const { generateAccessToken } = require('../src/utils/jwt');

describe('RBAC integration', () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  test('student cannot access admin routes', async () => {
    const student = await User.create({
      email: 'student@hku.hk',
      role: 'student',
      displayName: 'Student',
      locale: 'en',
      isActive: true
    });

    const token = generateAccessToken(student);

    const response = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  test('teacher cannot manage grades of unassigned courses', async () => {
    const unauthorizedTeacher = await User.create({
      email: 'teacher1@hku.hk',
      role: 'teacher',
      displayName: 'Teacher 1',
      locale: 'en',
      isActive: true
    });

    const assignedTeacher = await User.create({
      email: 'teacher2@hku.hk',
      role: 'teacher',
      displayName: 'Teacher 2',
      locale: 'en',
      isActive: true
    });

    const student = await User.create({
      email: 'learner@hku.hk',
      role: 'student',
      displayName: 'Learner',
      locale: 'en',
      isActive: true
    });

    const course = await Course.create({
      courseCode: 'COMP1001',
      courseName: 'Intro Comp',
      semester: '2026-S1',
      teacherIds: [assignedTeacher._id]
    });

    await Enrollment.create({
      studentId: student._id,
      courseId: course._id,
      semester: '2026-S1',
      status: 'active'
    });

    const token = generateAccessToken(unauthorizedTeacher);

    const response = await request(app)
      .post('/api/v1/teacher/grades')
      .set('Authorization', `Bearer ${token}`)
      .send({
        studentId: String(student._id),
        courseId: String(course._id),
        semester: '2026-S1',
        totalScore: 80
      });

    expect(response.statusCode).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  test('admin can manage users, courses and enrollments', async () => {
    const admin = await User.create({
      email: 'admin@hku.hk',
      role: 'admin',
      displayName: 'Admin',
      locale: 'en',
      isActive: true
    });

    const token = generateAccessToken(admin);

    const createTeacher = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'newteacher@hku.hk',
        role: 'teacher',
        displayName: 'New Teacher',
        locale: 'en',
        isActive: true
      });

    expect(createTeacher.statusCode).toBe(201);

    const createStudent = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'newstudent@hku.hk',
        role: 'student',
        displayName: 'New Student',
        locale: 'en',
        isActive: true
      });

    expect(createStudent.statusCode).toBe(201);

    const createCourse = await request(app)
      .post('/api/v1/admin/courses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        courseCode: 'COMP2002',
        courseName: 'Data Structures',
        semester: '2026-S1',
        teacherIds: [createTeacher.body.data._id]
      });

    expect(createCourse.statusCode).toBe(201);

    const createEnrollment = await request(app)
      .post('/api/v1/admin/enrollments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        studentId: createStudent.body.data._id,
        courseId: createCourse.body.data._id,
        semester: '2026-S1',
        status: 'active'
      });

    expect(createEnrollment.statusCode).toBe(201);
    expect(createEnrollment.body.code).toBe('ENROLLMENT_CREATED');
  });
});