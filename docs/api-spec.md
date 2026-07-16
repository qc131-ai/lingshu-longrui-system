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

## Sprint 3-1 排课日历 API

排课相关接口均使用当前登录 token 中的 `organizationId` 做数据隔离，前端不得传 `organizationId`。

### GET /api/schedules

查询当前机构内的排课日历数据。

| 查询参数 | 类型 | 必填 | 说明 |
|----------|------|------|------|
| startDate | string | 否 | 开始日期，`YYYY-MM-DD` |
| endDate | string | 否 | 结束日期，`YYYY-MM-DD` |
| teacherId | string | 否 | 按老师筛选 |
| studentId | string | 否 | 按学员筛选，包含直接学员排课、上课记录、班级学员 |
| classId | string | 否 | 按班级筛选 |
| courseId | string | 否 | 按课程筛选 |
| status | enum | 否 | `scheduled`、`in_progress`、`completed`、`cancelled`、`student_leave`、`teacher_leave`、`makeup_pending` |

`undefined`、`null`、空字符串、`Invalid Date` 会被忽略。

### POST /api/schedules

创建排课。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| courseId | string | 否 | 真实课程 UUID；也可用 `courseName` 兜底解析 |
| courseName | string | 否 | 课程名称 |
| teacherId | string | 否 | 真实老师 UUID；也可用 `teacher` 兜底解析 |
| teacher | string | 否 | 老师姓名 |
| studentId | string | 否 | 学员 UUID |
| classId | string | 否 | 班级 UUID |
| roomId | string | 否 | 仅允许真实 Room UUID；mock id 不应传 |
| classroom | string | 否 | 教室文本，例如 `Room 301` |
| date | string | 是 | 上课日期，`YYYY-MM-DD` |
| startTime | string | 是 | 开始时间，`HH:mm` |
| endTime | string | 否 | 结束时间，`HH:mm` |
| duration | number | 否 | 本次课时，小时 |
| consumedHours | number | 否 | 本次消耗课时，小时 |
| lessonType | enum | 否 | `class`、`exam`、`meeting` |
| status | enum | 否 | 默认 `scheduled` |
| notes | string | 否 | 备注 |

`roomId` 只有真实 UUID 才会关联 Room；非 UUID 会被忽略，使用 `classroom` 文本保存。

### PUT /api/schedules/:id

编辑排课。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| date | string | 否 | 上课日期 |
| startTime | string | 否 | 开始时间 |
| endTime | string | 否 | 结束时间 |
| duration | number | 否 | 本次课时 |
| teacherId | string | 否 | 老师 UUID |
| studentId | string \| null | 否 | 学员 UUID，传 `null` 可清空 |
| classId | string \| null | 否 | 班级 UUID，传 `null` 可清空 |
| roomId | string | 否 | 仅真实 Room UUID |
| classroom | string | 否 | 教室文本 |
| status | enum | 否 | 排课状态 |
| cancelReason | string | 否 | 取消原因 |
| notes | string | 否 | 备注 |

### PATCH /api/schedules/:id/status

单独更新排课状态。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| status | enum | 是 | `scheduled`、`in_progress`、`completed`、`cancelled`、`student_leave`、`teacher_leave`、`makeup_pending` |
| cancelReason | string | 否 | 当 `status=cancelled` 时作为取消原因 |
| notes | string | 否 | 状态备注 |

取消排课采用 `PATCH /api/schedules/:id/status`，Body 示例：

```json
{
  "status": "cancelled",
  "cancelReason": "学生临时请假"
}
```

### 冲突响应

新建或编辑排课时会检测老师、学员、班级、教室文本/Room 是否在同一日期同一时间冲突。

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "排课时间冲突",
    "details": {
      "conflictType": "teacher",
      "conflictScheduleId": "..."
    }
  }
}
```

以下操作会写入 `operation_logs`，日志失败只记录 warning，不阻断主流程：新建排课、编辑排课、取消排课、修改排课状态。

## Sprint 3-2 上课记录与老师反馈 API

上课记录接口均按当前 token 中的 `organizationId` 隔离数据。财务角色不应访问上课记录详情；老师仅能查看和编辑自己的记录；顾问可查看自己负责学生相关记录但不能修改老师反馈。

### GET /api/lesson-records

| 查询参数 | 类型 | 必填 | 说明 |
|----------|------|------|------|
| startDate | string | 否 | 开始日期，`YYYY-MM-DD` |
| endDate | string | 否 | 结束日期，`YYYY-MM-DD` |
| teacherId | string | 否 | 按老师筛选 |
| courseId | string | 否 | 按课程筛选 |
| status | enum | 否 | `draft`、`pending_feedback`、`submitted`、`completed`、`cancelled` |
| search | string | 否 | 搜索学生、班级、课程 |

### GET /api/lesson-records/:id

返回单条上课记录详情，包含 `scheduleId`、`courseId/courseName`、`studentId/studentName`、`classId/className`、`teacherId/teacherName`、日期、开始/结束时间、教室、课时、反馈字段和 AI 总结。

### POST /api/lesson-records

手动创建上课记录。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| scheduleId | string | 否 | 来源排课 ID |
| courseId | string | 否 | 课程 UUID |
| studentId | string | 否 | 学员 UUID，`studentId` 和 `classId` 至少一个 |
| classId | string | 否 | 班级 UUID，`studentId` 和 `classId` 至少一个 |
| teacherId | string | 是 | 老师 UUID |
| date | string | 是 | 上课日期 |
| startTime | string | 否 | 开始时间 |
| endTime | string | 否 | 结束时间 |
| classroom | string | 否 | 教室文本 |
| duration | number | 否 | 本节课时 |
| status | enum | 否 | 默认 `draft` |

### POST /api/lesson-records/from-schedule/:scheduleId

从排课生成上课记录。

规则：

- 一个 schedule 默认只生成一条 lesson record，重复调用会返回已有记录。
- 生成时继承 `scheduleId`、`courseId`、`studentId` 或 `classId`、`teacherId`、日期、开始/结束时间、教室、课时。
- 初始状态为 `pending_feedback`，反馈状态为 `pending`。
- 写入 `operation_logs`，日志失败只 warning。

### PUT /api/lesson-records/:id

保存老师反馈草稿或更新记录字段。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| topic | string | 否 | 本节课内容 |
| performance | string | 否 | 学生课堂表现 |
| knowledgeMastery | string | 否 | 知识点掌握情况 |
| homework | string | 否 | 作业布置 |
| nextPlan | string | 否 | 下节课计划 |
| needAdvisorFollowUp | boolean | 否 | 是否需要顾问跟进 |
| syncToParent | boolean | 否 | 是否同步给家长 |
| internalNotes | string | 否 | 内部备注 |
| aiSummary | string | 否 | AI 反馈总结 |
| status | enum | 否 | `draft`、`pending_feedback`、`submitted`、`completed`、`cancelled` |
| feedbackStatus | enum | 否 | `pending`、`submitted` |

### PATCH /api/lesson-records/:id/status

单独修改上课记录状态。提交反馈时前端先 `PUT` 保存反馈字段，再 `PATCH` 为 `submitted`。提交后关联 schedule 状态更新为 `completed`。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| status | enum | 是 | `draft`、`pending_feedback`、`submitted`、`completed`、`cancelled` |
| aiSummary | string | 否 | AI 总结 |

### 状态流转

```text
draft -> pending_feedback -> submitted -> completed
                           -> cancelled
```

## Sprint 3-3 确认消课与课时流水 API

消课、课时账户、课时流水接口均按当前 token 中的 `organizationId` 隔离数据；前端不得传 `organizationId`。消课只允许管理员、教务主管确认；财务可查看和调整课时但默认不确认消课；老师和顾问不能手动调整课时。

### POST /api/lesson-records/:id/confirm-deduction

确认消课。仅 `submitted` 或 `completed` 的上课记录可以消课；已消课记录会被后端拦截。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| consumedHours | number | 是 | 本次扣减课时，必须大于 0 |
| deductionNote | string | 否 | 消课备注 |
| syncToParent | boolean | 否 | 是否同步给家长 |

返回：

| 字段 | 类型 | 说明 |
|------|------|------|
| lessonRecord | LessonRecord | 消课后的上课记录，`deductionStatus=deducted`，`status=completed` |
| creditAccount | CreditAccount | 扣减后的课时账户 |
| creditTransaction | CreditTransaction | 本次自动生成的课时流水 |

业务规则：

- 上课记录必须关联 `studentId` 和 `courseId`，否则返回明确错误。
- 系统按 `studentId + courseId + organizationId` 查找课时账户；未找到时返回 `未找到该学生课程的课时账户`，不静默创建账户。
- 非管理员不能透支；当 `consumedHours` 超过剩余课时时返回明确错误。
- 消课成功后生成 `transactionType=lesson_deduction` 的流水，`hoursChange=-consumedHours`，记录 `balanceBefore` 和 `balanceAfter`。
- `remainingHours <= 5` 时标记低课时，可被订单课时页和 AI 教务助手查询。
- 重复消课返回 `该上课记录已完成消课`。

### GET /api/credits/accounts

查询课时账户。

| 查询参数 | 类型 | 必填 | 说明 |
|----------|------|------|------|
| studentId | string | 否 | 按学员筛选 |
| courseId | string | 否 | 按课程筛选 |
| lowBalance | boolean | 否 | `true` 时只返回低课时账户 |
| status | string | 否 | 账户状态，默认可用值 `active` |

### GET /api/credits/accounts/:id

返回单个课时账户，包含学员、课程、购买课时、已消耗课时、剩余课时、赠送课时、冻结课时、低课时状态。

### GET /api/credits/transactions

查询课时流水。

| 查询参数 | 类型 | 必填 | 说明 |
|----------|------|------|------|
| studentId | string | 否 | 按学员筛选 |
| courseId | string | 否 | 按课程筛选 |
| transactionType | string | 否 | 如 `lesson_deduction`、`purchase`、`gift`、`manual` |
| startDate | string | 否 | 开始日期，`YYYY-MM-DD` |
| endDate | string | 否 | 结束日期，`YYYY-MM-DD` |

### POST /api/credits/adjust

手动调整课时。仅管理员、教务主管、财务可操作。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| studentId | string | 是 | 学员 ID |
| courseId | string | 否 | 课程 ID；存在时按课程账户调整 |
| transactionType | string | 是 | 调整类型，如 `purchase`、`gift`、`manual`、`deduct` |
| hoursChange | number | 是 | 课时变动，正数增加，负数扣减 |
| note | string | 否 | 调整备注 |

调整会更新 `credit_accounts`，并写入 `credit_transactions`，保存 `balanceBefore`、`balanceAfter`、`operatorId` 和备注。`operation_logs` 写入失败只记录 warning，不阻断主流程。

## Sprint 3-4A 请假补课 API

请假补课接口统一使用当前 token 中的 `organizationId` 做数据隔离，前端不得传 `organizationId`。

### GET /api/leave-makeup

查询请假、调课、取消课程和补课申请。

| 查询参数 | 类型 | 必填 | 说明 |
|----------|------|------|------|
| studentId | string | 否 | 按学员筛选 |
| teacherId | string | 否 | 按老师筛选 |
| courseId | string | 否 | 按课程筛选 |
| classId | string | 否 | 按班级筛选 |
| requestType | enum | 否 | `student_leave`、`teacher_leave`、`reschedule`、`cancellation`、`makeup` |
| status | enum | 否 | `pending`、`approved`、`rejected`、`makeup_pending`、`makeup_scheduled`、`completed`、`parent_notified`、`cancelled` |
| startDate | string | 否 | 原上课开始日期 |
| endDate | string | 否 | 原上课结束日期 |

### POST /api/leave-makeup

创建申请。后端按 `scheduleId` 读取原排课，自动写入原课程、老师、学生/班级和原上课时间。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| scheduleId | string | 是 | 原排课 ID |
| lessonRecordId | string | 否 | 已有关联上课记录 |
| requestType | enum | 是 | 申请类型 |
| reason | string | 是 | 申请原因 |
| deductCredit | boolean | 否 | 是否扣课时，默认 false |
| needMakeup | boolean | 否 | 是否需要补课，学生/老师请假默认 true |
| newDate | string | 否 | 调课/补课新日期 |
| newStartTime | string | 否 | 新开始时间 |
| newEndTime | string | 否 | 新结束时间 |

### PUT /api/leave-makeup/:id

编辑申请原因、新时间、是否扣课时、是否需要补课等字段。`deductCredit` 变更会写入操作日志。

### PATCH /api/leave-makeup/:id/status

管理员、教务主管更新状态。拒绝时必须提供 `rejectReason`。

### POST /api/leave-makeup/:id/approve

审批通过。若 `needMakeup=true`，申请进入 `makeup_pending`，原排课标记为 `makeup_pending`；若课程取消或不需要补课，原排课标记为 `cancelled`。若 `deductCredit=true` 且原上课记录未消课，生成 `leave_deduction` 课时流水。

### POST /api/leave-makeup/:id/reject

拒绝申请，请求体必须包含 `rejectReason`。

### POST /api/leave-makeup/:id/schedule-makeup

安排补课，创建新的 `schedule`，并将申请状态更新为 `makeup_scheduled`。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| date | string | 是 | 补课日期 |
| startTime | string | 是 | 开始时间 |
| endTime | string | 是 | 结束时间 |
| teacherId | string | 否 | 不传则沿用原老师 |
| classroom | string | 否 | 教室文本 |
| lessonType | enum | 否 | `class`、`exam`、`meeting` |
| notes | string | 否 | 备注 |

### POST /api/leave-makeup/:id/notify-parent

模拟通知家长，设置 `parentNotified=true`，状态更新为 `parent_notified`。

### 状态流转

```text
pending -> approved / rejected
pending -> makeup_pending -> makeup_scheduled -> parent_notified -> completed
pending -> cancelled
```

权限规则：管理员、教务主管可创建、审批、安排补课和通知；老师只能提交自己的老师请假并查看自己的申请；顾问只能为自己负责学员提交申请、查看状态和通知；财务当前无请假补课访问和操作权限，直接请求返回 403。

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
| **方法** | `POST /api/schedules` |

**请求字段**（与前端排课 Modal 一致）

| UI 字段 | 提交字段 | 类型 | 必填 | 说明 |
|---------|----------|------|------|------|
| courseId | courseName | string | 是 | 选择课程后解析为课程名称 |
| teacherId | teacher | string | 是 | 选择教师后解析为教师姓名 |
| roomId / classroom | roomId / classroom | string | 否 | `roomId` 仅真实 UUID；否则只传 `classroom` 文本 |
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
| **方法** | `PATCH /api/schedules/:id/status` |

**请求** — `{ "status": "cancelled", "cancelReason": "..." }`

**返回** — 更新后的 `Schedule`

---

### 5. 确认消课

| 项目 | 内容 |
|------|------|
| **页面** | `/records` — 上课记录与消课 |
| **操作** | 点击记录行 → Drawer → 提交老师反馈后在「确认消课」区域二次确认 |
| **Service** | `lessonService.confirmDeduction()` / `lessonService.generateFeedback()` |
| **方法** | `POST /lesson-records/:id/confirm-deduction` |

**消课请求字段**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| consumedHours | number | 是 | 本次扣减课时 |
| deductionNote | string | 否 | 消课备注 |
| syncToParent | boolean | 否 | 是否同步给家长 |

**消课返回字段**

| 字段 | 类型 | 说明 |
|------|------|------|
| lessonRecord | LessonRecord | 状态更新后的上课记录 |
| creditAccount | CreditAccount | 扣减后的课时账户 |
| creditTransaction | CreditTransaction | 自动生成的课时流水 |

**副作用** — `credit_accounts.remainingHours` 减少；`credit_transactions` 新增 `lesson_deduction` 流水；记录 `deductionStatus` → `deducted`、`status` → `completed`。重复调用返回 `该上课记录已完成消课`。

--- 

### 6. 课时调整

| 项目 | 内容 |
|------|------|
| **页面** | `/orders` — 订单与课时 |
| **操作** | 点击「课时调整」→ 填写表单 →「确认调整」 |
| **Service** | `creditService.adjustCredits()` |
| **方法** | `POST /credits/adjust` |

**请求字段**（与前端课时调整 Modal 一致）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| studentId | string | 是 | 学员 ID |
| courseId | string | 否 | 课程 ID |
| transactionType | string | 是 | `purchase` \| `gift` \| `transfer_in` \| `makeup_return` \| `deduct` \| `refund` \| `transfer_out` \| `manual` |
| hoursChange | number | 是 | 变动课时数（正增负减，非 0） |
| amount | number | 否 | 关联金额 (¥) |
| note | string | 否 | 操作备注 |

**返回字段**

| 字段 | 类型 | 说明 |
|------|------|------|
| student | Student | 更新后学员 |
| creditAccount | CreditAccount | 调整后的课时账户 |
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
| GET | `/import/templates/:type` | 下载 Excel 模板 | 管理员、教务主管、财务按类型授权 |
| POST | `/import/preview` | 上传 Excel 生成导入预览批次 | 管理员、教务主管、财务按类型授权 |
| POST | `/import/confirm/:batchId` | 确认导入预览批次 | 管理员、教务主管、财务按类型授权 |
| GET | `/import/batches` | 查询导入批次 | 登录用户按机构隔离 |
| GET | `/import/batches/:id` | 查询导入批次详情 | 登录用户按机构隔离 |
| POST | `/import/batches/:id/rollback` | 按批次回滚可回滚数据 | 管理员、教务主管 |
| GET | `/export/:type` | 导出 Excel 文件 | 按角色和类型授权 |

导入 `type` 支持：`students`、`courses`、`teachers`、`classes`、`credit-balances`、`schedules`、`lesson-records`。

导出 `type` 支持：`students`、`courses`、`teachers`、`classes`、`credit-accounts`、`credit-transactions`、`schedules`、`lesson-records`、`leave-makeup`、`parent-reports`。

### 数据范围规则

| 角色 | 数据范围 |
|------|----------|
| 管理员 | 当前机构全部数据 |
| 教务主管 | 当前机构教务数据 |
| 顾问 | 负责学员、负责学员报告和课时数据 |
| 老师 | 自己的老师档案、课程、排课和上课记录 |
| 财务 | 课时、流水和付款相关数据 |

## Sprint 3-4B 家长报告 API

家长报告接口统一使用 token 中的 `organizationId` 做数据隔离，前端不得传 `organizationId`。报告内容面向家长，不返回 `internalNotes` 给家长预览，不暴露 `operation_logs` 或非授权财务敏感字段。

### GET /api/reports

支持筛选：`studentId`、`courseId`、`advisorId`、`reportType`、`status`、`startDate`、`endDate`。

### GET /api/reports/:id

获取报告详情。管理员、教务主管可查看全部；顾问仅负责学员；老师仅可查看与自己课程相关报告摘要；财务不可访问。

### POST /api/reports/generate

生成家长报告。

请求字段：`studentId`、`courseId?`、`reportType`、`reportPeriodStart`、`reportPeriodEnd`、`includeLessons?`、`includeCredits?`、`includeLeaveMakeup?`、`includeHomework?`、`includeAiSummary?`。

后端聚合 `lesson_records`、`credit_accounts`、`credit_transactions`、`leave_makeup_requests`，并用 mock 规则生成中文 `aiSummary`、`parentVisibleContent`、课时摘要、请假补课摘要和下阶段计划。

### PUT /api/reports/:id

编辑报告。可编辑：`title`、`summary`、`teacherFeedbackSummary`、`weaknessAnalysis`、`nextStepPlan`、`aiSummary`、`parentVisibleContent`、`internalNotes`。`draft`、`generated`、`reviewed` 可编辑；`sent` 仅管理员可编辑。

### POST /api/reports/:id/send

模拟发送报告给家长，设置 `status=sent`、`sentAt`、`sentBy`、`sentChannel`，并写入 `operation_logs`。

### PATCH /api/reports/:id/status

管理员、教务主管更新报告状态。状态枚举：`draft`、`generated`、`reviewed`、`sent`、`archived`。

报告类型枚举：`weekly`、`monthly`、`stage`、`custom`。

### AI 助手查询

| 项目 | 内容 |
|------|------|
| **页面** | `/ai` — AI 智能助理 |
| **操作** | 输入问题并发送 |
| **Service** | `aiService.queryAssistant(message, context?)` |
| **方法** | `POST /api/ai/assistant` |

**请求**

```json
{
  "message": "哪些学生课时低于 5 小时？",
  "context": {}
}
```

前端不传 `organizationId`，后端从登录 token 的 `req.user.organizationId` 读取并隔离所有查询。

**返回** — `AIQueryResult`

```json
{
  "answer": "我找到了 3 名剩余课时低于或等于 5 小时的学生。",
  "intent": "low_credit_students",
  "cards": [
    {
      "id": "credit-account-id",
      "type": "low_credit_student",
      "title": "李佳怡",
      "subtitle": "SAT数学高分",
      "priority": "high",
      "fields": [
        { "label": "剩余课时", "value": 2 }
      ],
      "actions": [
        { "label": "查看学员", "type": "navigate", "target": "/students" }
      ]
    }
  ],
  "actions": [],
  "relatedData": { "count": 3 }
}
```

| intent | 说明 |
|--------|------|
| `low_credit_students` | 查询 `credit_accounts.balance <= 5` 的低课时学生，返回学生、课程、剩余课时、顾问、风险等级 |
| `missing_teacher_feedback` | 查询 `lesson_records.status in draft/pending_feedback`，按老师聚合未提交反馈 |
| `academic_todo` | 聚合今日排课、待提交反馈、待审批请假补课、待发送家长报告、低课时预警 |
| `leave_makeup_pending` | 查询 `leave_makeup_requests.status in pending/makeup_pending` |
| `parent_report_pending` | 查询 `parent_reports.status in draft/generated/reviewed`，并统计本月缺失报告 |
| `student_risk` | 综合低课时、需顾问跟进反馈、待处理请假补课、待发送报告生成风险卡片 |
| `unknown` | 无法识别意图时返回可尝试的问题类型 |

权限规则：

- 管理员、教务主管可查询机构内全部教务数据。
- 顾问只能查询自己负责学生相关数据。
- 老师只能查询自己的课程、反馈、请假补课风险，不返回全机构报告或财务数据。
- 财务仅返回课时、续费相关数据，不返回老师反馈、请假补课、家长报告详情。
- 每次提问和识别到的 intent 写入 `operation_logs`；日志失败不影响主流程。

### Sprint 4-3 AI 内容生成 API

本阶段仍为规则型生成 / mock AI，不接真实 OpenAI API；但所有内容都基于真实数据库数据生成。前端不得传 `organizationId`，后端从 token 的 `req.user.organizationId` 隔离数据。返回内容不得暴露 `internalNotes`、`operation_logs` 或跨机构数据。

#### POST /api/ai/generate-renewal-suggestion

生成续费建议。读取 `students`、`credit_accounts`、最近 `lesson_records`、待处理 `leave_makeup_requests`、最近 `parent_reports`。

请求：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| studentId | string | 是 | 学员 ID |
| courseId | string | 否 | 课程 ID；不传则使用低课时或最近课程 |
| tone | enum | 否 | `professional`、`friendly`、`urgent` |
| includeParentMessage | boolean | 否 | 是否返回家长沟通话术 |

返回：

```json
{
  "studentSummary": "学生当前情况摘要",
  "creditSummary": "课时账户摘要",
  "riskLevel": "medium",
  "renewalSuggestion": "续费建议",
  "parentMessage": "家长沟通话术",
  "advisorTalkingPoints": ["沟通重点"],
  "nextActions": ["下一步动作"]
}
```

规则：`remainingHours <= 3` 为高优先级，`<= 5` 为中高优先级；如有未处理请假补课，建议先处理服务问题；如报告未发送，建议先发送报告再推进续费。

### Sprint 5-3 DeepSeek AI Agent API

DeepSeek 仅在后端调用，使用 OpenAI-compatible Chat Completion。前端不得接触 `DEEPSEEK_API_KEY`。如果后端未配置 `DEEPSEEK_API_KEY`，系统 fallback 到规则型 mock AI，不返回 500。

#### POST /api/ai/agent

请求：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| message | string | 是 | 用户自然语言问题 |
| context | object | 否 | 前端上下文，不得包含 organizationId |

返回：

```json
{
  "answer": "自然语言回答",
  "intent": "low_credit_students",
  "cards": [],
  "actions": [],
  "proposedActions": [
    {
      "actionType": "CREATE_PARENT_MESSAGE",
      "title": "生成家长沟通话术",
      "description": "给学生家长生成低课时提醒",
      "payload": { "studentId": "uuid" },
      "riskLevel": "low",
      "requiresConfirmation": true
    }
  ],
  "warnings": [],
  "confidence": 0.82,
  "provider": "mock"
}
```

第一阶段说明：`proposedActions` 只返回给前端展示，不保存、不确认、不执行、不修改数据库。前端按钮显示“下一阶段开放”。`AiAction` 表、确认 API 和 action executor 将在 Sprint 5-3 第二阶段实现。

允许的低风险 `actionType`：

- `CREATE_PARENT_MESSAGE`
- `CREATE_ADVISOR_FOLLOW_UP`
- `GENERATE_RENEWAL_SUGGESTION`
- `POLISH_PARENT_REPORT`
- `MARK_STUDENT_FOLLOW_UP_NEEDED`
- `CREATE_LEAVE_MAKEUP_NOTE`

禁止的高风险动作：

- `DELETE_ANYTHING`
- `UPDATE_CREDIT_BALANCE`
- `CONFIRM_CREDIT_DEDUCTION`
- `SEND_PARENT_REPORT`
- `SEND_MESSAGE_TO_PARENT`
- `CHANGE_USER_ROLE`
- `RESET_PASSWORD`
- `CREATE_USER`
- `UPDATE_ORGANIZATION_SETTINGS`
- `EXPORT_DATA`

权限：管理员和教务主管可确认低风险动作；顾问只能为自己负责学生确认家长沟通、顾问跟进、续费建议和跟进标记；老师不能确认续费/家长沟通动作；财务不能确认沟通类 AI action。所有接口按 `req.user.organizationId` 隔离。

#### POST /api/ai/generate-parent-message

生成家长沟通话术。读取学生档案、课时、最近反馈、请假补课和报告状态。

请求：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| studentId | string | 是 | 学员 ID |
| scenario | enum | 是 | `low_credit_reminder`、`progress_update`、`makeup_notice`、`renewal_followup`、`report_delivery`、`risk_followup` |
| courseId | string | 否 | 课程 ID |
| tone | enum | 否 | `professional`、`friendly`、`urgent`、`warm`、`concise` |

返回：

```json
{
  "title": "低课时提醒话术",
  "message": "可发送给家长的文本",
  "keyPoints": ["关键点"],
  "suggestedSendChannel": "wecom",
  "cautionNotes": ["注意事项"]
}
```

#### POST /api/ai/polish-report

润色家长报告，只返回预览结果，不自动覆盖报告。读取 `parent_reports` 中家长可见字段，不返回 `internalNotes`。

请求：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| reportId | string | 是 | 家长报告 ID |
| tone | enum | 否 | `professional`、`warm`、`concise` |

返回：

```json
{
  "originalSummary": "原摘要",
  "polishedSummary": "润色摘要",
  "polishedParentVisibleContent": "润色后的家长可见内容",
  "suggestedNextStepPlan": "建议下一步计划"
}
```

#### POST /api/ai/student-risk-summary

生成学生风险总结。综合低课时、待提交反馈、请假补课未处理、报告未发送、老师标记 `needAdvisorFollowUp` 等真实数据。

请求：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| studentId | string | 是 | 学员 ID |
| periodStart | string | 否 | 开始日期，`YYYY-MM-DD` |
| periodEnd | string | 否 | 结束日期，`YYYY-MM-DD` |

返回：

```json
{
  "riskLevel": "high",
  "riskReasons": ["风险原因"],
  "evidence": {},
  "recommendedActions": ["建议动作"],
  "advisorMessage": "顾问跟进话术"
}
```

权限规则：

- 管理员、教务主管：可生成全部机构内内容。
- 顾问：只能为自己负责学生生成续费建议、家长话术、报告润色和风险总结。
- 老师：不能生成续费建议；可基于自己课程相关学生生成风险/学习反馈类总结。
- 财务：不能生成家长报告和学生沟通话术。
- 所有生成操作写入 `operation_logs`；日志失败只输出 warning，不影响主流程。

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
| GET | `/credits/transactions` | `creditService.listTransactions()` | 订单与课时 |
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
| 4.2.0 | 2026-07-01 | Sprint 4-2：补充 Excel 导入导出 API、模板、批次、回滚与权限 |
| 2.0.0 | 2026-06-28 | 对齐 Astralink 工程结构，补充 6 大交互 API 与页面对应关系 |
| 1.0.0 | 2026-06-28 | 初始版本 |

## Sprint 4-2 Excel 导入导出 API

### 导入 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/import/templates/:type` | 下载导入模板 `.xlsx` |
| POST | `/api/import/preview` | 上传 Excel 预览校验，`multipart/form-data`：`type`、`file` |
| POST | `/api/import/confirm/:batchId` | 确认导入有效行 |
| GET | `/api/import/batches` | 查询导入批次 |
| GET | `/api/import/batches/:id` | 查看批次详情 |
| POST | `/api/import/batches/:id/rollback` | 回滚已导入批次 |

兼容旧路径：`/api/imports/:type/preview`、`/api/imports/:id/commit`、`/api/imports/:id/rollback`。

支持导入类型：`students`、`courses`、`teachers`、`classes`、`credit-balances`、`schedules`、`lesson-records`。

模板字段：

- `students`：学员姓名、手机号、年级、当前学校、目标国家、目标方向、负责顾问、家长姓名、家长电话、标签、风险状态、备注。
- `courses`：课程名称、课程类别、授课方式、总课时、标准价格、适合年级、负责老师、状态、课程简介、课程大纲。
- `teachers`：老师姓名、手机号、邮箱、老师类型、擅长科目、可授课程、可用时间、状态、备注。
- `classes`：班级名称、关联课程、主讲老师、上课时间、教室、容量、状态、备注。
- `credit-balances`：学员姓名、手机号、课程名称、已购买课时、已消耗课时、剩余课时、赠送课时、冻结课时、备注。
- `schedules`：学员姓名、班级名称、课程名称、老师姓名、上课日期、开始时间、结束时间、教室、状态、备注。
- `lesson-records`：学员姓名、班级名称、课程名称、老师姓名、上课日期、开始时间、结束时间、本节课时、课堂内容、学生表现、作业布置、老师反馈、状态、是否已消课、备注。

预览返回：`importBatchId`、`totalRows`、`validRows`、`invalidRows`、`warningRows`、`errors`、`previewRows`。单行错误不会导致整个预览失败；确认导入只写入有效行。

### 导出 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/export/:type` | 导出 `.xlsx` |

支持导出类型：`students`、`courses`、`teachers`、`classes`、`credit-accounts`、`credit-transactions`、`schedules`、`lesson-records`、`leave-makeup`、`parent-reports`。

导出筛选：`startDate`、`endDate`、`studentId`、`courseId`、`teacherId`、`status`。V1 对日期范围已用于排课/上课记录，其他筛选预留。

权限：管理员全部；教务主管可导入导出教务数据；财务可导入课时余额并导出课时账户/流水；顾问只能导出负责学生相关数据；老师只能导出自己的排课和上课记录。所有接口从 `req.user.organizationId` 读取机构，不接受前端传 `organizationId`。

## Sprint 4-4 系统设置与账号管理 API

所有接口从登录 token 读取 `req.user.organizationId`，前端不传 `organizationId`。写操作写入 `operation_logs`，日志失败不影响主流程。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/settings` | 读取机构信息、教务基础配置、通知设置、AI 设置 |
| PUT | `/api/settings` | 保存系统设置，管理员可用 |
| GET | `/api/settings/permissions` | 读取只读角色权限矩阵 |
| GET | `/api/settings/users` | 读取用户账号列表 |
| POST | `/api/settings/users` | 新增用户，初始密码 hash 存储 |
| PUT | `/api/settings/users/:id` | 编辑用户姓名、角色、状态和关联信息 |
| PATCH | `/api/settings/users/:id/status` | 启用或停用用户 |
| POST | `/api/settings/users/:id/reset-password` | 管理员重置用户密码 |

系统设置字段：

- 机构信息：`organizationName`、`shortName`、`phone`、`email`、`address`、`logoText`、`version`、`environment`。
- 教务配置：`lowCreditThreshold`、`defaultLessonDurationHours`、`allowCreditOverdraft`、`enableConflictDetection`、`enableLeaveApproval`、`enableParentReportReview`。
- 通知设置：`enableParentNotification`、`enableTeacherReminder`、`enableAdvisorRenewalReminder`、`notificationChannels`。
- AI 设置：`aiMode`、`enableAiAssistant`、`enableAiRenewalSuggestion`、`enableAiReportPolish`。

权限：管理员可查看和修改系统设置、管理用户；教务主管可查看系统设置、用户列表和权限矩阵；顾问、老师、财务访问系统设置 API 返回 `403`。停用用户不能登录，后续接口会校验用户状态。

## Sprint 5-3B AI Agent 确认动作 API

DeepSeek 仍只负责生成建议。后端会把允许范围内的 `proposedActions` 保存为 `ai_actions`，前端必须使用后端返回的 `id` 执行确认或取消，不允许把前端 payload 当作执行依据。

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/ai/agent` | 查询真实数据并生成回答、结果卡片和已持久化的确认动作 |
| GET | `/api/ai/agent/actions` | 查询当前机构 AI 动作，管理员/教务主管可看机构内动作，其他角色只看自己创建的动作 |
| GET | `/api/ai/agent/actions/:id` | 查看单个 AI 动作 |
| POST | `/api/ai/agent/actions/:id/confirm` | 确认执行 AI 动作 |
| POST | `/api/ai/agent/actions/:id/cancel` | 取消 AI 动作 |

`confirm` 请求：

```json
{
  "confirmationNote": "可选确认备注"
}
```

`cancel` 请求：

```json
{
  "reason": "可选取消原因"
}
```

确认动作状态：

- `proposed`：待确认。
- `executed`：已确认并生成安全结果。
- `cancelled`：用户取消。
- `expired`：超过有效期，需重新生成。
- `failed`：执行失败。

权限与安全规则：

- 所有接口使用 `req.user.organizationId` 隔离，不接受前端传 `organizationId`。
- 管理员、教务主管可以确认机构内 AI 动作；顾问只能确认自己生成的动作。
- 老师和财务默认不能确认 AI 动作。
- 5-3B 的确认执行只写入 `ai_actions.executionResult`，不会自动扣课时、发送报告、发送消息、修改用户权限或修改业务主链数据。
- 删除、扣课时、重置密码、导出数据、发送家长报告等高风险请求仍会被拒绝。
- 确认和取消都会写入 `operation_logs`，日志失败不影响主流程。

### Sprint 5-3C 受控执行器

5-3C 在 5-3B 确认卡片基础上，开放低风险动作的受控执行。确认后后端会创建一条 `ai_tasks` 记录，并把 `taskId` 写入 `ai_actions.executionResult`，用于审计和后续详情化展示。

当前允许的执行结果：

| actionType | 执行结果 | 不会做的事 |
|------------|----------|------------|
| `CREATE_PARENT_MESSAGE` | 保存家长沟通草稿到 `ai_tasks` | 不自动发送给家长 |
| `CREATE_ADVISOR_FOLLOW_UP` | 创建顾问跟进记录到 `ai_tasks` | 不自动推送外部通知 |
| `GENERATE_RENEWAL_SUGGESTION` | 保存续费建议草稿到 `ai_tasks` | 不修改订单或课时 |
| `POLISH_PARENT_REPORT` | 保存报告润色草稿到 `ai_tasks` | 不覆盖原家长报告 |
| `MARK_STUDENT_FOLLOW_UP_NEEDED` | 保存学生跟进建议到 `ai_tasks` | 不直接修改学生业务状态 |
| `CREATE_LEAVE_MAKEUP_NOTE` | 保存请假补课处理备注到 `ai_tasks` | 不审批、不排课 |

仍然禁止：删除、扣课时、确认消课、发送报告/消息、修改用户权限、重置密码、导出数据、修改机构设置。所有执行前都会重新从 `ai_actions` 读取 payload，并校验 `organizationId` 和资源归属。

### Sprint 5-3D AI 任务中心 API

5-3D 将 5-3C 生成的 `ai_tasks` 做成可查看、筛选和标记状态的任务中心。任务中心不触发新的 AI 执行，也不发送消息。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/ai/tasks` | 查询 AI 任务/草稿列表 |
| GET | `/api/ai/tasks/:id` | 查看 AI 任务详情 |
| PATCH | `/api/ai/tasks/:id/status` | 标记任务状态 |

查询参数：

- `status`：`pending`、`processing`、`completed`、`failed`
- `taskType`：`lesson_feedback`、`parent_report_summary`、`renewal_suggestion`、`learning_summary`、`chat`
- `studentId`

状态更新请求：

```json
{
  "status": "completed"
}
```

权限：

- 管理员、教务主管可查看和标记机构内任务。
- 顾问可查看/标记自己生成或自己负责学生相关任务。
- 老师、财务只允许查看自己生成的任务，不能修改状态。
- 所有查询按 `req.user.organizationId` 隔离。
