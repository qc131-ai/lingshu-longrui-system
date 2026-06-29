# Astralink 教务系统后端 MVP

Node.js + TypeScript + Express + Prisma + PostgreSQL。

## 运行前准备

1. 安装依赖：

```bash
npm install
```

2. 创建 `.env`：

```bash
cp .env.example .env
```

3. 修改 `.env` 中的数据库连接：

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/astralink_jiaowu?schema=public"
PORT=4000
CORS_ORIGIN="http://localhost:3000,http://127.0.0.1:3000"
```

## 初始化数据库

```bash
npm run backend:prisma:generate
npm run backend:prisma:push
npm run backend:seed
```

## 启动服务

```bash
npm run backend:dev
```

健康检查：

```bash
curl http://localhost:4000/api/health
```

## 类型检查

```bash
npm run backend:typecheck
```

## Mock Auth

当前仅实现基础 mock auth，不做复杂权限系统。所有请求会自动注入默认用户：

```text
x-user-id: 00000000-0000-0000-0000-000000000001
x-user-role: admin
x-user-name: Mock Admin
```

也可以通过请求头覆盖。

## 统一响应格式

成功：

```json
{
  "success": true,
  "data": {}
}
```

失败：

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed"
  }
}
```

## 第一阶段接口

### 学员

```text
POST /api/students
GET /api/students
GET /api/students/:id
PUT /api/students/:id
```

### 课程

```text
POST /api/courses
GET /api/courses
GET /api/courses/:id
PUT /api/courses/:id
```

### 排课

```text
POST /api/schedules
GET /api/schedules
PUT /api/schedules/:id
```

`GET /api/schedules` 支持查询参数：`studentId`、`teacherId`、`dateFrom`、`dateTo`。

### 上课记录

```text
POST /api/lesson-records
GET /api/lesson-records
PUT /api/lesson-records/:id
POST /api/lesson-records/:id/deduct-credit
```

### 课时

```text
GET /api/credits/accounts
POST /api/credits/adjust
GET /api/credits/transactions
```

### 家长报告

```text
POST /api/reports/generate
GET /api/reports
GET /api/reports/:id
PUT /api/reports/:id
POST /api/reports/:id/send
```

### AI 教务助手

```text
POST /api/ai/assistant
```

当前 AI 使用 mock 规则逻辑，支持：

- 低课时学生查询
- 老师未提交反馈查询
- 作业逾期查询
- 生成家长报告摘要

## 与前端切换

前端后续可将 `src/services/config.ts` 中 `USE_MOCK` 改为 `false`，并配置：

```env
VITE_API_BASE_URL=http://localhost:4000/api
```

前端当前路径和后端 MVP 路径有少量差异时，可在前端 service 层做一次映射，例如：

- `/schedule/events` → `/schedules`
- `/lesson-records/:id/deduct` → `/lesson-records/:id/deduct-credit`
- `/credit-transactions/adjust` → `/credits/adjust`
