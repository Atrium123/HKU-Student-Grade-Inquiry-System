import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from './apiClient';
import { messages } from './messages';

const AUTH_STORAGE_KEY = 'hku_grade_portal_auth';
const LOCALE_STORAGE_KEY = 'hku_grade_portal_locale';

function loadAuth() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function loadLocale() {
  const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
  return raw === 'en' ? 'en' : 'zh-CN';
}

function formatDateTime(value, locale) {
  if (!value) return '-';
  return new Intl.DateTimeFormat(locale === 'zh-CN' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function getErrorMessage(error, fallback) {
  return error?.payload?.message || error?.message || fallback;
}

function createEmptyComponent() {
  return { name: '', score: '', weight: '' };
}

function Header({ user, locale, t, onLocaleChange, onLogout }) {
  return (
    <header className="topbar animate-in">
      <div className="brand-group">
        <h1>{t.appName}</h1>
        <p>{t.appSubtitle}</p>
      </div>

      <div className="toolbar">
        <label className="locale-switch">
          <span>{t.language}</span>
          <select value={locale} onChange={(event) => onLocaleChange(event.target.value)}>
            <option value="zh-CN">中文</option>
            <option value="en">English</option>
          </select>
        </label>

        {user && (
          <div className="user-chip">
            <strong>{user.displayName}</strong>
            <small>{user.role}</small>
          </div>
        )}

        {user && (
          <button type="button" className="ghost-btn" onClick={onLogout}>
            {t.logout}
          </button>
        )}
      </div>
    </header>
  );
}

function AuthPanel({ locale, t, busy, onRequestOtp, onVerifyOtp, onNotice }) {
  const [step, setStep] = useState('request');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [otp, setOtp] = useState('');

  async function handleRequest(event) {
    event.preventDefault();
    const result = await onRequestOtp({ email, locale });
    if (result) {
      setStep('verify');
      onNotice('success', t.otpSent);
    }
  }

  async function handleVerify(event) {
    event.preventDefault();
    const result = await onVerifyOtp({ email, otp, displayName, locale });
    if (result) {
      onNotice('success', t.loginSuccess);
    }
  }

  return (
    <section className="auth-wrap animate-in">
      <article className="auth-card">
        <h2>{t.authTitle}</h2>
        <p>{t.authHint}</p>

        <form className="form-grid" onSubmit={step === 'request' ? handleRequest : handleVerify}>
          <label>
            <span>{t.email}</span>
            <input
              type="email"
              value={email}
              placeholder="name@hku.hk"
              onChange={(event) => setEmail(event.target.value.trim())}
              required
            />
          </label>

          <label>
            <span>{t.displayName}</span>
            <input
              type="text"
              value={displayName}
              placeholder={locale === 'zh-CN' ? '可选，首次登录自动创建' : 'Optional'}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>

          {step === 'verify' && (
            <label>
              <span>{t.otp}</span>
              <input
                type="text"
                value={otp}
                placeholder="6-digit OTP"
                onChange={(event) => setOtp(event.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                required
              />
            </label>
          )}

          <div className="auth-actions">
            {step === 'request' ? (
              <button type="submit" className="primary-btn" disabled={busy}>
                {t.requestOtp}
              </button>
            ) : (
              <>
                <button type="submit" className="primary-btn" disabled={busy}>
                  {t.verifyOtp}
                </button>
                <button type="button" className="ghost-btn" onClick={() => setStep('request')}>
                  {t.resetOtp}
                </button>
              </>
            )}
          </div>
        </form>
      </article>
    </section>
  );
}

function StudentPanel({ t, locale, callApi, onNotice }) {
  const [semester, setSemester] = useState('');
  const [courseId, setCourseId] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ items: [], stats: { totalCourses: 0, averageScore: 0, averageGpa: 0 } });

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (semester) params.set('semester', semester);
    if (courseId) params.set('courseId', courseId);

    try {
      const response = await callApi(`/grades/me${params.toString() ? `?${params.toString()}` : ''}`);
      setData(response.data);
    } catch (error) {
      onNotice('error', getErrorMessage(error, t.apiError));
    } finally {
      setLoading(false);
    }
  }, [callApi, courseId, onNotice, semester, t.apiError]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="panel animate-in">
      <div className="panel-header">
        <h2>{t.studentDashboard}</h2>
        <div className="inline-tools">
          <input value={semester} onChange={(event) => setSemester(event.target.value)} placeholder={t.semester} />
          <input value={courseId} onChange={(event) => setCourseId(event.target.value)} placeholder="Course ID" />
          <button type="button" className="primary-btn" onClick={load}>
            {t.loadData}
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <article className="stat-card">
          <span>{t.totalCourses}</span>
          <strong>{data.stats.totalCourses}</strong>
        </article>
        <article className="stat-card">
          <span>{t.averageScore}</span>
          <strong>{data.stats.averageScore}</strong>
        </article>
        <article className="stat-card">
          <span>{t.averageGpa}</span>
          <strong>{data.stats.averageGpa}</strong>
        </article>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t.courseCode}</th>
              <th>{t.courseName}</th>
              <th>{t.semester}</th>
              <th>{t.score}</th>
              <th>{t.grade}</th>
              <th>{t.gpa}</th>
              <th>{t.updatedAt}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7">{t.loading}</td>
              </tr>
            ) : data.items.length === 0 ? (
              <tr>
                <td colSpan="7">{t.noData}</td>
              </tr>
            ) : (
              data.items.map((item) => (
                <tr key={item._id}>
                  <td>{item.courseId?.courseCode || '-'}</td>
                  <td>{item.courseId?.courseName || '-'}</td>
                  <td>{item.semester}</td>
                  <td>{item.totalScore}</td>
                  <td>{item.letterGrade}</td>
                  <td>{item.gpa}</td>
                  <td>{formatDateTime(item.updatedAt, locale)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TeacherPanel({ t, locale, callApi, onNotice }) {
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [enrollments, setEnrollments] = useState([]);
  const [grades, setGrades] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [components, setComponents] = useState([
    { name: 'Assignment', score: '', weight: '30' },
    { name: 'Midterm', score: '', weight: '30' },
    { name: 'Final', score: '', weight: '40' }
  ]);
  const [manualTotal, setManualTotal] = useState('');
  const [editingGradeId, setEditingGradeId] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedCourse = useMemo(
    () => courses.find((course) => course._id === selectedCourseId),
    [courses, selectedCourseId]
  );

  const computedTotal = useMemo(() => {
    const list = components
      .filter((item) => item.name.trim())
      .map((item) => ({ name: item.name.trim(), score: Number(item.score), weight: Number(item.weight) }))
      .filter((item) => Number.isFinite(item.score) && Number.isFinite(item.weight));

    if (!list.length) return '-';
    const sum = list.reduce((acc, item) => acc + item.weight, 0);
    if (Math.abs(sum - 100) > 0.1) return '-';
    return Math.round(list.reduce((acc, item) => acc + (item.score * item.weight) / 100, 0) * 100) / 100;
  }, [components]);

  const loadCourses = useCallback(async () => {
    try {
      const response = await callApi('/teacher/courses');
      setCourses(response.data);
      if (!selectedCourseId && response.data[0]) setSelectedCourseId(response.data[0]._id);
    } catch (error) {
      onNotice('error', getErrorMessage(error, t.apiError));
    }
  }, [callApi, onNotice, selectedCourseId, t.apiError]);

  const loadCourseData = useCallback(async () => {
    if (!selectedCourseId) {
      setEnrollments([]);
      setGrades([]);
      return;
    }

    try {
      const [enrollmentResponse, gradeResponse] = await Promise.all([
        callApi(`/teacher/courses/${selectedCourseId}/enrollments`),
        callApi(`/teacher/grades?courseId=${selectedCourseId}`)
      ]);
      setEnrollments(enrollmentResponse.data.enrollments);
      setGrades(gradeResponse.data);
    } catch (error) {
      onNotice('error', getErrorMessage(error, t.apiError));
    }
  }, [callApi, onNotice, selectedCourseId, t.apiError]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    loadCourseData();
  }, [loadCourseData]);

  function resetForm() {
    setStudentId('');
    setEditingGradeId('');
    setManualTotal('');
    setComponents([
      { name: 'Assignment', score: '', weight: '30' },
      { name: 'Midterm', score: '', weight: '30' },
      { name: 'Final', score: '', weight: '40' }
    ]);
  }

  function changeComponent(index, field, value) {
    setComponents((previous) => {
      const next = [...previous];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function editGrade(grade) {
    setEditingGradeId(grade._id);
    setStudentId(String(grade.studentId?._id || grade.studentId));
    setManualTotal(String(grade.totalScore));
    if (grade.components?.length) {
      setComponents(
        grade.components.map((item) => ({
          name: item.name,
          score: String(item.score),
          weight: String(item.weight)
        }))
      );
    }
  }

  async function submitGrade(event) {
    event.preventDefault();
    if (!selectedCourseId || !studentId) return;

    const payload = {
      components: components
        .filter((item) => item.name.trim())
        .map((item) => ({
          name: item.name.trim(),
          score: Number(item.score),
          weight: Number(item.weight)
        })),
      totalScore: manualTotal === '' ? undefined : Number(manualTotal),
      studentId,
      courseId: selectedCourseId,
      semester: selectedCourse?.semester
    };

    setSaving(true);

    try {
      if (editingGradeId) {
        await callApi(`/teacher/grades/${editingGradeId}`, {
          method: 'PATCH',
          body: { components: payload.components, totalScore: payload.totalScore }
        });
      } else {
        await callApi('/teacher/grades', { method: 'POST', body: payload });
      }

      onNotice('success', editingGradeId ? t.updateGrade : t.saveGrade);
      resetForm();
      await loadCourseData();
    } catch (error) {
      onNotice('error', getErrorMessage(error, t.apiError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel animate-in">
      <div className="panel-header">
        <h2>{t.teacherDashboard}</h2>
        <div className="inline-tools">
          <select value={selectedCourseId} onChange={(event) => setSelectedCourseId(event.target.value)}>
            <option value="">{t.selectCourse}</option>
            {courses.map((course) => (
              <option key={course._id} value={course._id}>
                {course.courseCode} · {course.semester}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="two-col-grid">
        <article className="sub-card">
          <h3>{t.teacherTools}</h3>
          <form className="form-grid" onSubmit={submitGrade}>
            <input
              disabled
              value={selectedCourse ? `${selectedCourse.courseCode} - ${selectedCourse.courseName}` : ''}
              placeholder={t.selectedCourse}
            />

            <select value={studentId} onChange={(event) => setStudentId(event.target.value)} required>
              <option value="">{t.selectStudent}</option>
              {enrollments.map((entry) => (
                <option key={entry._id} value={entry.studentId._id}>
                  {entry.studentId.displayName} ({entry.studentId.email})
                </option>
              ))}
            </select>

            {components.map((item, index) => (
              <div key={`${item.name}-${index}`} className="component-row">
                <input
                  value={item.name}
                  placeholder={t.componentName}
                  onChange={(event) => changeComponent(index, 'name', event.target.value)}
                  required
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={item.score}
                  placeholder={t.componentScore}
                  onChange={(event) => changeComponent(index, 'score', event.target.value)}
                  required
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={item.weight}
                  placeholder={t.componentWeight}
                  onChange={(event) => changeComponent(index, 'weight', event.target.value)}
                  required
                />
              </div>
            ))}

            <div className="inline-tools">
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setComponents((previous) => [...previous, createEmptyComponent()])}
              >
                {t.addComponent}
              </button>
              <input
                type="number"
                min="0"
                max="100"
                value={manualTotal}
                onChange={(event) => setManualTotal(event.target.value)}
                placeholder="Manual total"
              />
            </div>

            <div className="formula-note">
              Calculated total: <strong>{computedTotal}</strong>
            </div>

            <div className="inline-tools">
              <button type="submit" className="primary-btn" disabled={saving}>
                {editingGradeId ? t.updateGrade : t.saveGrade}
              </button>
              {editingGradeId && (
                <button type="button" className="ghost-btn" onClick={resetForm}>
                  {t.cancel}
                </button>
              )}
            </div>
          </form>
        </article>

        <article className="sub-card">
          <h3>{t.course}</h3>
          <div className="table-wrap slim">
            <table>
              <thead>
                <tr>
                  <th>{t.student}</th>
                  <th>{t.score}</th>
                  <th>{t.grade}</th>
                  <th>{t.gpa}</th>
                  <th>{t.updatedAt}</th>
                  <th>{t.edit}</th>
                </tr>
              </thead>
              <tbody>
                {grades.length === 0 ? (
                  <tr>
                    <td colSpan="6">{t.noData}</td>
                  </tr>
                ) : (
                  grades.map((grade) => (
                    <tr key={grade._id}>
                      <td>{grade.studentId?.displayName || '-'}</td>
                      <td>{grade.totalScore}</td>
                      <td>{grade.letterGrade}</td>
                      <td>{grade.gpa}</td>
                      <td>{formatDateTime(grade.updatedAt, locale)}</td>
                      <td>
                        <button type="button" className="tiny-btn" onClick={() => editGrade(grade)}>
                          {t.edit}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
}

function AdminPanel({ t, callApi, onNotice }) {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [editingCourseId, setEditingCourseId] = useState('');

  const [userForm, setUserForm] = useState({ email: '', displayName: '', role: 'student', locale: 'zh-CN' });
  const [courseForm, setCourseForm] = useState({ courseCode: '', courseName: '', semester: '', teacherIds: [] });
  const [enrollmentForm, setEnrollmentForm] = useState({ studentId: '', courseId: '', semester: '', status: 'active' });

  const teachers = useMemo(() => users.filter((user) => user.role === 'teacher' && user.isActive), [users]);
  const students = useMemo(() => users.filter((user) => user.role === 'student' && user.isActive), [users]);

  const refreshUsers = useCallback(async () => {
    const response = await callApi('/admin/users?page=1&pageSize=100');
    setUsers(response.data.items);
  }, [callApi]);

  const refreshCourses = useCallback(async () => {
    const response = await callApi('/admin/courses');
    setCourses(response.data);
  }, [callApi]);

  const refreshEnrollments = useCallback(async () => {
    const response = await callApi('/admin/enrollments');
    setEnrollments(response.data);
  }, [callApi]);

  useEffect(() => {
    Promise.all([refreshUsers(), refreshCourses(), refreshEnrollments()]).catch((error) =>
      onNotice('error', getErrorMessage(error, t.apiError))
    );
  }, [onNotice, refreshCourses, refreshEnrollments, refreshUsers, t.apiError]);

  async function createUser(event) {
    event.preventDefault();
    try {
      await callApi('/admin/users', {
        method: 'POST',
        body: { ...userForm, email: userForm.email.trim().toLowerCase(), isActive: true }
      });
      setUserForm({ email: '', displayName: '', role: 'student', locale: 'zh-CN' });
      onNotice('success', t.createUser);
      await refreshUsers();
    } catch (error) {
      onNotice('error', getErrorMessage(error, t.apiError));
    }
  }

  async function patchUser(userId, payload) {
    try {
      await callApi(`/admin/users/${userId}`, { method: 'PATCH', body: payload });
      await refreshUsers();
    } catch (error) {
      onNotice('error', getErrorMessage(error, t.apiError));
    }
  }

  function toggleTeacher(teacherId) {
    setCourseForm((previous) => {
      const hasId = previous.teacherIds.includes(teacherId);
      return {
        ...previous,
        teacherIds: hasId
          ? previous.teacherIds.filter((item) => item !== teacherId)
          : [...previous.teacherIds, teacherId]
      };
    });
  }

  async function saveCourse(event) {
    event.preventDefault();
    try {
      if (editingCourseId) {
        await callApi(`/admin/courses/${editingCourseId}`, { method: 'PATCH', body: courseForm });
      } else {
        await callApi('/admin/courses', { method: 'POST', body: courseForm });
      }
      setEditingCourseId('');
      setCourseForm({ courseCode: '', courseName: '', semester: '', teacherIds: [] });
      onNotice('success', t.createCourse);
      await refreshCourses();
    } catch (error) {
      onNotice('error', getErrorMessage(error, t.apiError));
    }
  }

  function editCourse(course) {
    setEditingCourseId(course._id);
    setCourseForm({
      courseCode: course.courseCode,
      courseName: course.courseName,
      semester: course.semester,
      teacherIds: (course.teacherIds || []).map((item) => item._id || item)
    });
  }

  async function createEnrollment(event) {
    event.preventDefault();
    try {
      await callApi('/admin/enrollments', { method: 'POST', body: enrollmentForm });
      setEnrollmentForm({ studentId: '', courseId: '', semester: '', status: 'active' });
      onNotice('success', t.createEnrollment);
      await refreshEnrollments();
    } catch (error) {
      onNotice('error', getErrorMessage(error, t.apiError));
    }
  }

  async function removeEnrollment(id) {
    try {
      await callApi(`/admin/enrollments/${id}`, { method: 'DELETE' });
      await refreshEnrollments();
    } catch (error) {
      onNotice('error', getErrorMessage(error, t.apiError));
    }
  }

  return (
    <section className="panel animate-in">
      <div className="panel-header">
        <h2>{t.adminDashboard}</h2>
        <div className="tab-row">
          {['users', 'courses', 'enrollments'].map((item) => (
            <button
              key={item}
              type="button"
              className={tab === item ? 'tab-btn active' : 'tab-btn'}
              onClick={() => setTab(item)}
            >
              {t[item]}
            </button>
          ))}
        </div>
      </div>

      {tab === 'users' && (
        <div className="two-col-grid">
          <article className="sub-card">
            <h3>{t.createUser}</h3>
            <form className="form-grid" onSubmit={createUser}>
              <input
                type="email"
                value={userForm.email}
                onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder={t.email}
                required
              />
              <input
                value={userForm.displayName}
                onChange={(event) => setUserForm((prev) => ({ ...prev, displayName: event.target.value }))}
                placeholder={t.displayName}
                required
              />
              <select value={userForm.role} onChange={(event) => setUserForm((prev) => ({ ...prev, role: event.target.value }))}>
                <option value="student">student</option>
                <option value="teacher">teacher</option>
                <option value="admin">admin</option>
              </select>
              <select
                value={userForm.locale}
                onChange={(event) => setUserForm((prev) => ({ ...prev, locale: event.target.value }))}
              >
                <option value="zh-CN">zh-CN</option>
                <option value="en">en</option>
              </select>
              <button type="submit" className="primary-btn">
                {t.save}
              </button>
            </form>
          </article>

          <article className="sub-card">
            <h3>{t.users}</h3>
            <div className="table-wrap slim">
              <table>
                <thead>
                  <tr>
                    <th>{t.email}</th>
                    <th>{t.role}</th>
                    <th>{t.status}</th>
                    <th>{t.save}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan="4">{t.noData}</td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user._id}>
                        <td>{user.email}</td>
                        <td>{user.role}</td>
                        <td>{user.isActive ? t.active : t.disabled}</td>
                        <td>
                          <div className="table-actions">
                            <button type="button" className="tiny-btn" onClick={() => patchUser(user._id, { role: 'teacher' })}>
                              {t.makeTeacher}
                            </button>
                            <button type="button" className="tiny-btn" onClick={() => patchUser(user._id, { role: 'student' })}>
                              {t.makeStudent}
                            </button>
                            <button type="button" className="tiny-btn" onClick={() => patchUser(user._id, { role: 'admin' })}>
                              {t.makeAdmin}
                            </button>
                            <button
                              type="button"
                              className="tiny-btn warn"
                              onClick={() => patchUser(user._id, { isActive: !user.isActive })}
                            >
                              {t.toggleStatus}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      )}

      {tab === 'courses' && (
        <div className="two-col-grid">
          <article className="sub-card">
            <h3>{editingCourseId ? `${t.save} Course` : t.createCourse}</h3>
            <form className="form-grid" onSubmit={saveCourse}>
              <input
                value={courseForm.courseCode}
                onChange={(event) => setCourseForm((prev) => ({ ...prev, courseCode: event.target.value.toUpperCase() }))}
                placeholder={t.courseCode}
                required
              />
              <input
                value={courseForm.courseName}
                onChange={(event) => setCourseForm((prev) => ({ ...prev, courseName: event.target.value }))}
                placeholder={t.courseName}
                required
              />
              <input
                value={courseForm.semester}
                onChange={(event) => setCourseForm((prev) => ({ ...prev, semester: event.target.value }))}
                placeholder={t.semester}
                required
              />

              <div className="checkbox-wrap">
                <p>{t.assignTeachers}</p>
                {teachers.map((teacher) => (
                  <label key={teacher._id}>
                    <input
                      type="checkbox"
                      checked={courseForm.teacherIds.includes(teacher._id)}
                      onChange={() => toggleTeacher(teacher._id)}
                    />
                    <span>{teacher.displayName}</span>
                  </label>
                ))}
              </div>

              <div className="inline-tools">
                <button type="submit" className="primary-btn">
                  {t.save}
                </button>
                {editingCourseId && (
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => {
                      setEditingCourseId('');
                      setCourseForm({ courseCode: '', courseName: '', semester: '', teacherIds: [] });
                    }}
                  >
                    {t.cancel}
                  </button>
                )}
              </div>
            </form>
          </article>

          <article className="sub-card">
            <h3>{t.courses}</h3>
            <div className="table-wrap slim">
              <table>
                <thead>
                  <tr>
                    <th>{t.courseCode}</th>
                    <th>{t.courseName}</th>
                    <th>{t.semester}</th>
                    <th>{t.teachersOnly}</th>
                    <th>{t.edit}</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.length === 0 ? (
                    <tr>
                      <td colSpan="5">{t.noData}</td>
                    </tr>
                  ) : (
                    courses.map((course) => (
                      <tr key={course._id}>
                        <td>{course.courseCode}</td>
                        <td>{course.courseName}</td>
                        <td>{course.semester}</td>
                        <td>{(course.teacherIds || []).map((teacher) => teacher.displayName || teacher).join(', ') || '-'}</td>
                        <td>
                          <button type="button" className="tiny-btn" onClick={() => editCourse(course)}>
                            {t.edit}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      )}

      {tab === 'enrollments' && (
        <div className="two-col-grid">
          <article className="sub-card">
            <h3>{t.createEnrollment}</h3>
            <form className="form-grid" onSubmit={createEnrollment}>
              <select
                value={enrollmentForm.studentId}
                onChange={(event) => setEnrollmentForm((prev) => ({ ...prev, studentId: event.target.value }))}
                required
              >
                <option value="">{t.selectStudent}</option>
                {students.map((student) => (
                  <option key={student._id} value={student._id}>
                    {student.displayName} ({student.email})
                  </option>
                ))}
              </select>

              <select
                value={enrollmentForm.courseId}
                onChange={(event) => setEnrollmentForm((prev) => ({ ...prev, courseId: event.target.value }))}
                required
              >
                <option value="">{t.selectCourse}</option>
                {courses.map((course) => (
                  <option key={course._id} value={course._id}>
                    {course.courseCode} · {course.semester}
                  </option>
                ))}
              </select>

              <input
                value={enrollmentForm.semester}
                onChange={(event) => setEnrollmentForm((prev) => ({ ...prev, semester: event.target.value }))}
                placeholder={t.semester}
              />

              <button type="submit" className="primary-btn">
                {t.save}
              </button>
            </form>
          </article>

          <article className="sub-card">
            <h3>{t.enrollments}</h3>
            <div className="table-wrap slim">
              <table>
                <thead>
                  <tr>
                    <th>{t.student}</th>
                    <th>{t.course}</th>
                    <th>{t.semester}</th>
                    <th>{t.status}</th>
                    <th>{t.delete}</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.length === 0 ? (
                    <tr>
                      <td colSpan="5">{t.noData}</td>
                    </tr>
                  ) : (
                    enrollments.map((item) => (
                      <tr key={item._id}>
                        <td>{item.studentId?.displayName || '-'}</td>
                        <td>
                          {item.courseId?.courseCode} {item.courseId?.courseName}
                        </td>
                        <td>{item.semester}</td>
                        <td>{item.status}</td>
                        <td>
                          <button type="button" className="tiny-btn warn" onClick={() => removeEnrollment(item._id)}>
                            {t.delete}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}

export default function App() {
  const [auth, setAuth] = useState(loadAuth());
  const [locale, setLocale] = useState(loadLocale());
  const [notice, setNotice] = useState(null);
  const [bootLoading, setBootLoading] = useState(Boolean(loadAuth()?.accessToken));
  const [busy, setBusy] = useState(false);

  const t = useMemo(() => messages[locale] || messages['zh-CN'], [locale]);

  function notify(type, message) {
    setNotice({ type, message });
  }

  useEffect(() => {
    if (auth) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [auth]);

  useEffect(() => {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    let active = true;

    async function restore() {
      if (!auth?.accessToken) {
        setBootLoading(false);
        return;
      }

      try {
        const response = await apiRequest({
          path: '/me',
          auth,
          onAuthChange: (nextAuth) => active && setAuth(nextAuth),
          onUnauthorized: () => active && setAuth(null)
        });

        if (active) {
          setAuth((previous) => (previous ? { ...previous, user: response.data } : previous));
          if (response.data?.locale) setLocale(response.data.locale);
        }
      } catch {
        if (active) setAuth(null);
      } finally {
        if (active) setBootLoading(false);
      }
    }

    restore();

    return () => {
      active = false;
    };
  }, []);

  const callApi = useCallback(
    async (path, options = {}) =>
      apiRequest({
        path,
        method: options.method || 'GET',
        body: options.body,
        auth,
        onAuthChange: (nextAuth) => setAuth(nextAuth),
        onUnauthorized: () => setAuth(null)
      }),
    [auth]
  );

  const requestOtp = useCallback(
    async ({ email }) => {
      if (!email) return null;
      setBusy(true);
      try {
        const response = await apiRequest({
          path: '/auth/otp/request',
          method: 'POST',
          body: { email, locale }
        });
        return response.data;
      } catch (error) {
        notify('error', getErrorMessage(error, t.apiError));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [locale, t.apiError]
  );

  const verifyOtp = useCallback(
    async ({ email, otp, displayName }) => {
      setBusy(true);
      try {
        const response = await apiRequest({
          path: '/auth/otp/verify',
          method: 'POST',
          body: { email, otp, displayName, locale }
        });

        setAuth({
          user: response.data.user,
          accessToken: response.data.accessToken,
          refreshToken: response.data.refreshToken
        });

        return true;
      } catch (error) {
        notify('error', getErrorMessage(error, t.apiError));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [locale, t.apiError]
  );

  const logout = useCallback(async () => {
    if (auth?.refreshToken) {
      try {
        await apiRequest({
          path: '/auth/logout',
          method: 'POST',
          body: { refreshToken: auth.refreshToken }
        });
      } catch {
        // Ignore logout errors.
      }
    }

    setAuth(null);
  }, [auth]);

  return (
    <div className="app-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <Header
        user={auth?.user}
        locale={locale}
        t={t}
        onLocaleChange={(nextLocale) => {
          setLocale(nextLocale);
          if (auth?.accessToken) {
            callApi('/me/locale', {
              method: 'PATCH',
              body: { locale: nextLocale }
            }).catch(() => {
              // Ignore locale persistence errors.
            });
          }
        }}
        onLogout={logout}
      />

      {notice && <div className={`notice ${notice.type}`}>{notice.message}</div>}

      <main className="main-content">
        {bootLoading ? (
          <div className="loading-block">{t.refreshing}</div>
        ) : !auth?.user ? (
          <AuthPanel
            locale={locale}
            t={t}
            busy={busy}
            onRequestOtp={requestOtp}
            onVerifyOtp={verifyOtp}
            onNotice={notify}
          />
        ) : auth.user.role === 'student' ? (
          <StudentPanel t={t} locale={locale} callApi={callApi} onNotice={notify} />
        ) : auth.user.role === 'teacher' ? (
          <TeacherPanel t={t} locale={locale} callApi={callApi} onNotice={notify} />
        ) : (
          <AdminPanel t={t} callApi={callApi} onNotice={notify} />
        )}
      </main>
    </div>
  );
}
