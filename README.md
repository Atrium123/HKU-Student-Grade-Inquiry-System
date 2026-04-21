# HKU 学生成绩查询系统

基于 `Node.js + Express + MongoDB + Crypto + Nodemailer + React` 的前后端分离成绩查询平台。

## 功能概览

- OTP 无密码认证（邮箱验证码）
- JWT 双令牌（Access + Refresh）与刷新轮换
- HKU 域名注册限制（`@hku.hk` / `@connect.hku.hk`）
- RBAC 三角色：`student` / `teacher` / `admin`
- 教师按课程授权录入成绩，管理员可管理用户/课程/选课
- 成绩支持构成项，自动换算等级与 GPA（HKU 4.3）
- React SPA：中英双语切换、移动端和桌面端适配

## 目录结构

```text
.
├─ server/         # Express API + MongoDB models + tests
├─ web/            # React + Vite SPA
├─ docker-compose.yml
└─ package.json    # 根脚本（并行启动）
```

## 本地启动

### 1) 安装依赖

```bash
npm install
npm install --prefix server
npm install --prefix web
```

### 2) 配置环境变量

复制：

- `server/.env.example` -> `server/.env`
- `web/.env.example` -> `web/.env`

如需真实邮件发送，请在 `server/.env` 中配置 SMTP（`SMTP_HOST/SMTP_USER/SMTP_PASS`）。

### 3) 启动开发环境

```bash
npm run dev
```

- 后端默认: `http://localhost:4000`
- 前端默认: `http://localhost:5173`

## Docker（可选）

```bash
docker compose up --build
```

- 前端: `http://localhost:8080`
- 后端: `http://localhost:4000`
- MongoDB: `mongodb://localhost:27017`

## 测试

运行后端集成测试：

```bash
npm run test:server
```

覆盖认证安全、RBAC、成绩业务主链路。

## 核心接口

### Auth
- `POST /api/v1/auth/otp/request`
- `POST /api/v1/auth/otp/verify`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`

### User & Profile
- `GET /api/v1/me`
- `PATCH /api/v1/me/locale`

### Admin
- `GET/POST /api/v1/admin/users`
- `PATCH /api/v1/admin/users/:userId`
- `GET/POST /api/v1/admin/courses`
- `PATCH /api/v1/admin/courses/:courseId`
- `GET/POST /api/v1/admin/enrollments`
- `DELETE /api/v1/admin/enrollments/:enrollmentId`

### Grade
- `GET /api/v1/grades/me`
- `GET /api/v1/teacher/courses`
- `GET /api/v1/teacher/courses/:courseId/enrollments`
- `GET /api/v1/teacher/grades`
- `POST /api/v1/teacher/grades`
- `PATCH /api/v1/teacher/grades/:gradeId`

## 默认安全策略

- OTP 6 位，5 分钟有效，最多 5 次校验
- OTP 发送频控（邮箱/IP 双维度：分钟级 + 小时级）
- Refresh Token 轮换，旧令牌失效
- 首个管理员可通过环境变量幂等初始化
