# Astralink 灵枢教务系统 API 规范

本文档描述前端 `src/services/` 层对接的后端 REST API，与 `src/types/` 类型定义及页面操作一一对应。

## 概述

| 项目 | 说明 |
|------|------|
| 系统名称 | Astralink 灵枢教务系统 |
| 基础路径 | `/api`（环境变量 `VITE_API_BASE_URL` 可覆盖） |
| 数据格式 | `application/json` |
| Mock 策略 | 前端 `src/services/` 默认请求真实 API，失败时回退 `src/data/` mock |
| 数据隔离 | 所有业务数据按当前登录用户 `organization_id` 过滤 |

## 通用约定

### 请求头

```
Content-Type: application/json
Authorization: Bearer <token>
```

### 错误响应

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "字段 phone 格式不正确"
  }
}
```

---

## 核心类型（`src/types/`）

| 类型 | 文件 | 说明 |
|------|------|------|
| `Student` | `student.ts` | 学员基础信息 |
| `StudentDetail` | `student.ts` | 学员档案详情（含顾问、消耗课时等） |
| `Course` | `course.ts` | 课程 |
| `Class` | `course.ts` | 班级 |
| `Teacher` | `teacher.ts` | 教师 |
| `Schedule` | `schedule.ts` | 排课事件 |
| `LessonRecord` | `lesson.ts` | 上课记录 |
| `CreditTransaction` | `credit.ts` | 课时流水 / 订单 |
| `ParentReport` | `report.ts` | 家长报告 |
| `AIMessage` | `ai.ts` | AI 对话消息 |

---

## 已实现交互 API（6 个核心流程）

### 1. 新增学员

| 项目 | 内容 |
|------|------|
| **页面** | `/students` — 学员管理 |
| **操作** | 点击「新增学员」→ 填写表单 →「保存学员」 |
| **Service** | `studentService.createStudent()` |
| **方法** | `POST /students` |

**请求字段**（与前端表单一致）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 学员姓名（表单校验） |
| phone | string | 是 | 手机号（表单校验） |
| grade | string | 否 | 年级，默认 `10年级` |
| school | string | 否 | 学校 |
| remainingCredits | number | 否 | 购买课时 |
| riskStatus | enum | 否 | `high` \| `medium` \| `low` \| `normal` |
| tags | string[] | 否 | 课程标签 |
| enrollmentDate | string | 否 | 入学日期，默认当天 |

> 表单中的目标国家、顾问、家长电话、备注等字段当前仅 UI 展示，未提交至 service。

**返回字段** — 完整 `Student`（含服务端生成的 `id`）

---

### 2. 查看学员详情

| 项目 | 内容 |
|------|------|
| **页面** | `/students` — 学员管理 |
| **操作** | 点击表格行 /「详情」→ 右侧 Drawer |
| **Service** | `studentService.getStudentDetail(studentId)` |
| **方法** | `GET /students/:id` |

**返回字段** — `StudentDetail`

| 字段 | 类型 | 说明 |
|------|------|------|
| id, name, grade, school, phone, ... | — | 同 Student |
| advisor | string | 负责顾问 |
| consumedCredits | number | 已消耗课时 |
| lastLesson | string | 最近上课 |
| aiLearningSummary | string | AI 学习总结 |
| homeworkOverdueWarning | string | 作业逾期提示 |

---

### 3. 新建排课

| 项目 | 内容 |
|------|------|
| **页面** | `/schedule` — 排课管理 |
| **操作** | 点击「新建排课」或点击日历格 → 填写表单 →「保存排课」 |
| **Service** | `scheduleService.createSchedule(input, existingEvents)` |
| **方法** | `POST /schedule/events` |

**请求字段**（与前端排课 Modal 一致）

| UI 字段 | 提交字段 | 类型 | 必填 | 说明 |
|---------|----------|------|------|------|
| courseId | courseName | string | 是 | 选择课程后解析为课程名称 |
| teacherId | teacher | string | 是 | 选择教师后解析为教师姓名 |
| roomId | roomId | string | 是 | `room-1` / `room-2` / `room-3` |
| date | date | string | 是 | 日期 YYYY-MM-DD |
| startTime | startTime | string | 是 | 开始时间 HH:mm |
| duration | duration | number | 是 | 时长（小时） |

**返回字段**

| 字段 | 类型 | 说明 |
|------|------|------|
| event | Schedule | 新建排课事件 |
| hasConflict | boolean | 是否与已有排课冲突 |

**Schedule 结构**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 事件 ID |
| colIndex | number | 周列索引（0=周一） |
| topIndex | number | 时间槽索引（0=8:00） |
| durationSlots | number | 持续时段数 |
| title | string | 课程标题 |
| teacher | string | 教师 |
| room | string | 教室 |
| timeString | string | 时间展示文本 |
| type | string | 事件类型 |

---

### 4. 取消排课

| 项目 | 内容 |
|------|------|
| **页面** | `/schedule` — 排课管理 |
| **操作** | 点击日历事件 → Drawer →「取消排课」 |
| **Service** | `scheduleService.cancelSchedule(eventId, events)` |
| **方法** | `DELETE /schedule/events/:id` |

**返回** — 更新后的 `Schedule[]`

---

### 5. 确认消课

| 项目 | 内容 |
|------|------|
| **页面** | `/records` — 上课记录与消课 |
| **操作** | 点击记录行 → Drawer →（可选）生成 AI 反馈 →「提交并确认消课」 |
| **Service** | `lessonService.confirmDeduct()` / `lessonService.generateFeedback()` |
| **方法** | `POST /lesson-records/:id/deduct` / `POST /lesson-records/:id/ai-feedback` |

**消课请求字段**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| aiSummary | string | 否 | AI 课后反馈摘要 |

**消课返回字段**

| 字段 | 类型 | 说明 |
|------|------|------|
| student | Student | 扣减课时后的学员 |
| record | LessonRecord | 状态更新后的上课记录 |

**AI 反馈返回**

```json
{ "summary": "家长您好，今天..." }
```

**副作用** — 学员 `remainingCredits` 减少 `creditsConsumed`；记录 `status` → `completed`，`feedbackStatus` → `submitted`

---

### 6. 课时调整

| 项目 | 内容 |
|------|------|
| **页面** | `/orders` — 订单与课时 |
| **操作** | 点击「课时调整」→ 填写表单 →「确认调整」 |
| **Service** | `creditService.adjustCredits()` |
| **方法** | `POST /credit-transactions/adjust` |

**请求字段**（与前端课时调整 Modal 一致）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| studentId | string | 是 | 学员 ID |
| adjustType | string | 是 | `purchase` \| `gift` \| `transfer_in` \| `makeup_return` \| `deduct` \| `refund` \| `transfer_out` \| `manual` |
| creditsAmount | number | 是 | 变动课时数（非 0） |
| courseName | string | 否 | 关联课程 |
| amount | number | 否 | 关联金额 (¥) |
| notes | string | 否 | 操作备注 |

**返回字段**

| 字段 | 类型 | 说明 |
|------|------|------|
| student | Student | 更新后学员 |
| transaction | CreditTransaction | 新增流水记录 |

---

## 辅助交互 API

## V1.0 P0 新增 API

### V1 Sprint 2 基础业务 CRUD

本阶段只覆盖学员管理、课程产品、班级管理、老师中心。所有接口都需要 `Authorization: Bearer <token>`，新增、编辑、删除/状态变更会写入 `operation_logs`。

#### 学员管理

| 方法 | 路径 | 说明 | 权限与数据范围 |
|------|------|------|------|
| GET | `/students` | 获取学员列表 | 管理员/教务主管查看机构全部；顾问仅查看自己负责学员 |
| POST | `/students` | 创建学员，同时创建课时账户 | 管理员、教务主管、顾问 |
| GET | `/students/:id` | 获取学员详情 | 同列表数据范围 |
| PUT | `/students/:id` | 编辑学员资料和剩余课时 | 管理员、教务主管、顾问；顾问仅自己负责学员 |
| DELETE | `/students/:id` | 软删除学员，状态归档 | 管理员、教务主管、顾问；顾问仅自己负责学员 |
| PATCH | `/students/:id/status` | 更新学员状态 | 管理员、教务主管、顾问 |

核心字段：`name`、`phone`、`grade`、`school`、`remainingCredits`、`riskStatus`、`tags`、`enrollmentDate`、`targetCountry`、`targetDirection`、`parentPhone`、`advisorId`、`notes`。

#### 课程产品

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/courses` | 获取课程列表，支持 `category`、`teachingMode`、`status` 筛选 | 登录用户 |
| POST | `/courses` | 创建课程产品 | 管理员、教务主管 |
| GET | `/courses/:id` | 获取课程详情 | 登录用户 |
| PUT | `/courses/:id` | 编辑课程产品 | 管理员、教务主管 |
| DELETE | `/courses/:id` | 课程软删除，状态归档 | 管理员、教务主管 |
| PATCH | `/courses/:id/status` | 更新课程状态 | 管理员、教务主管 |

核心字段：`courseName`/`name`、`category`、`teachingMode`/`teachingMethod`、`totalHours`/`totalLessons`、`price`、`suitableGrades`/`targetGrades`、`responsibleTeacherId`、`status`、`description`、`syllabus`。

### 班级管理

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/classes` | 获取班级列表 | 登录用户 |
| POST | `/classes` | 创建班级，可带 `studentIds` 入班 | 管理员、教务主管 |
| GET | `/classes/:id` | 获取班级详情 | 登录用户 |
| PUT | `/classes/:id` | 编辑班级、容量和学员名单 | 管理员、教务主管 |
| DELETE | `/classes/:id` | 班级软删除，状态归档 | 管理员、教务主管 |
| PATCH | `/classes/:id/status` | 更新班级状态 | 管理员、教务主管 |
| POST | `/classes/:id/students` | 学员加入班级 | 管理员、教务主管 |
| DELETE | `/classes/:id/students/:studentId` | 学员移出班级 | 管理员、教务主管 |

班级详情返回 `courseName`、`teacherName`、`schedule`/`scheduleDesc`、`status`、`studentIds`、`studentNames`。

### 老师中心

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/teachers` | 获取老师列表；老师角色仅返回自身 | 登录用户 |
| POST | `/teachers` | 创建老师档案 | 管理员、教务主管 |
| GET | `/teachers/:id` | 获取老师详情 | 登录用户 |
| PUT | `/teachers/:id` | 编辑老师档案；老师角色仅可编辑自己的基础资料 | 管理员、教务主管、老师本人 |
| DELETE | `/teachers/:id` | 老师软删除，状态归档 | 管理员、教务主管 |
| PATCH | `/teachers/:id/status` | 更新老师状态 | 管理员、教务主管 |

老师字段：`name`、`subjects`、`type`、`rating`、`availableTime`、`feedbackRate`、`status`、`classes`。

### 请假补课

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/leaves` | 获取请假补课记录 | 登录用户，按角色过滤 |
| POST | `/leaves` | 创建请假补课申请 | 管理员、教务主管、顾问、老师 |
| GET | `/leaves/:id` | 获取请假补课详情 | 登录用户 |
| PUT | `/leaves/:id` | 审批、安排补课、更新状态 | 管理员、教务主管、顾问 |

### Excel 导入导出

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/imports/:type/preview` | 上传 Excel 或提交 rows，生成导入预览批次 | 管理员、教务主管、财务 |
| POST | `/imports/:id/commit` | 确认导入预览批次 | 管理员、教务主管、财务 |
| POST | `/imports/:id/rollback` | 按批次回滚可回滚数据 | 管理员 |
| GET | `/imports/export/:type` | 导出 Excel 文件 | 管理员、教务主管、财务 |

`type` 支持：`students`、`courses`、`teachers`、`credits`、`schedules`、`lesson-records`、`orders`。

### 数据范围规则

| 角色 | 数据范围 |
|------|----------|
| 管理员 | 当前机构全部数据 |
| 教务主管 | 当前机构教务数据 |
| 顾问 | 负责学员、负责学员报告和课时数据 |
| 老师 | 自己的老师档案、课程、排课和上课记录 |
| 财务 | 课时、流水和付款相关数据 |

### 生成家长报告

| 项目 | 内容 |
|------|------|
| **页面** | `/reports` — 家长报告 |
| **操作** | 点击「生成 AI 摘要」 |
| **Service** | `reportService.generateParentReportSummary()` |
| **方法** | `POST /reports/parent/summary` |

**请求** `{ "studentId": "S001" }`（可选）

**返回** `{ "summary": "子涵家长您好！..." }`

### 获取家长报告数据

| 项目 | 内容 |
|------|------|
| **页面** | `/reports` |
| **Service** | `reportService.getParentReport()` |
| **方法** | `GET /reports/parent/:studentId` |

**返回** — `ParentReport`

### AI 助手查询

| 项目 | 内容 |
|------|------|
| **页面** | `/ai` — AI 智能助理 |
| **操作** | 输入问题并发送 |
| **Service** | `aiService.queryAssistant(message, students)` |
| **方法** | `POST /ai/chat` |

**请求** `{ "message": "哪些学生课时低于 5 小时？" }`

**返回** — `AIQueryResult`

| intent | 说明 |
|--------|------|
| `credit_warning` | 课时预警，含 `students[]` |
| `report` | 报告生成意图 |
| `makeup` | 补课提醒，含 `items[]` |
| `default` | 默认回复 `fallbackText` |

### AI 续费建议

| 项目 | 内容 |
|------|------|
| **页面** | `/orders` — 右侧智能续费卡片 |
| **Service** | `aiService.generateRenewalSuggestion()` |
| **方法** | `POST /ai/renewal-suggestion` |

**返回** — `RenewalSuggestion`

---

## 数据查询 API（列表页）

| 方法 | 路径 | Service | 页面 |
|------|------|---------|------|
| GET | `/students` | `studentService.list()` | 学员管理 |
| GET | `/courses` | `courseService.list()` | 课程管理 |
| GET | `/classes` | `courseService.listClasses()` | 班级管理 |
| GET | `/teachers` | — | 教师管理 |
| GET | `/schedule/events` | `scheduleService.listEvents()` | 排课管理 |
| GET | `/lesson-records` | `lessonService.listRecords()` | 上课记录 |
| GET | `/leaves` | `lessonService.listLeaves()` | 请假补课 |
| GET | `/assessments` | `lessonService.listAssessments()` | 作业测评 |
| GET | `/credit-transactions` | `creditService.listTransactions()` | 订单与课时 |
| GET | `/reports/trend` | `reportService.getTrendData()` | 家长报告 |
| GET | `/reports/radar` | `reportService.getRadarData()` | 家长报告 |
| GET | `/dashboard/chart` | `reportService.getDashboardChart()` | 数据看板 |
| GET | `/dashboard/tasks` | `reportService.getDashboardTasks()` | 数据看板 |
| GET | `/ai/history` | `aiService.getHistory()` | AI 助手 |

---

## 前端工程结构

```
src/
├── data/           # Mock 数据（当前数据源）
├── types/          # TypeScript 类型定义
├── services/       # API 抽象层（USE_MOCK 控制 Mock/真实 API）
├── context/        # AppContext 全局状态
├── pages/          # 页面组件
└── components/     # 可复用 UI 组件
```

### 数据流

```
pages → services.*() → data/（Mock）或 fetch API（生产）
         ↓
    AppContext（6 个交互的状态持久化）
```

### 接入真实后端

1. 实现本文档 API
2. 设置 `VITE_API_BASE_URL`
3. `src/services/config.ts` → `USE_MOCK = false`

---

## 版本记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 2.0.0 | 2026-06-28 | 对齐 Astralink 工程结构，补充 6 大交互 API 与页面对应关系 |
| 1.0.0 | 2026-06-28 | 初始版本 |
