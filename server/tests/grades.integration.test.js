const request = require('supertest');
const app = require('../src/app');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('./testDb');
const User = require('../src/models/User');
const Course = require('../src/models/Course');
const Enrollment = require('../src/models/Enrollment');
const { generateAccessToken } = require('../src/utils/jwt');

describe('Grade management integration', () => {
  let teacher;
  let student;
  let course;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    teacher = await User.create({
      email: 'teacher@hku.hk',
      role: 'teacher',
      displayName: 'Teacher',
      locale: 'en',
      isActive: true
    });

    student = await User.create({
      email: 'student@connect.hku.hk',
      role: 'student',
      displayName: 'Student',
      locale: 'en',
      isActive: true
    });

    course = await Course.create({
      courseCode: 'COMP3003',
      courseName: 'Algorithms',
      semester: '2026-S1',
      teacherIds: [teacher._id]
    });

    await Enrollment.create({
      studentId: student._id,
      courseId: course._id,
      semester: '2026-S1',
      status: 'active'
    });
  });

  test('teacher can create grade with component calculation', async () => {
    const teacherToken = generateAccessToken(teacher);

    const response = await request(app)
      .post('/api/v1/teacher/grades')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        studentId: String(student._id),
        courseId: String(course._id),
        semester: '2026-S1',
        components: [
          { name: 'Assignment', score: 88, weight: 30 },
          { name: 'Midterm', score: 78, weight: 30 },
          { name: 'Final', score: 90, weight: 40 }
        ]
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.code).toBe('GRADE_CREATED');
    expect(response.body.data.totalScore).toBe(85.8);
    expect(response.body.data.letterGrade).toBe('A');
    expect(response.body.data.gpa).toBe(4);
  });

  test('student can query own grades with stats', async () => {
    const teacherToken = generateAccessToken(teacher);

    await request(app)
      .post('/api/v1/teacher/grades')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        studentId: String(student._id),
        courseId: String(course._id),
        semester: '2026-S1',
        totalScore: 92
      });

    const studentToken = generateAccessToken(student);

    const response = await request(app)
      .get('/api/v1/grades/me?semester=2026-S1')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.code).toBe('MY_GRADES_FETCHED');
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.stats.totalCourses).toBe(1);
    expect(response.body.data.stats.averageScore).toBe(92);
    expect(response.body.data.stats.averageGpa).toBe(4.3);
  });
});