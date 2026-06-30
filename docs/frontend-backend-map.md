# 前端交互与后端 API 对应表

> Astralink 灵枢教务系统 · 基于当前前端工程整理  
> 数据流：`pages` → `services` → `data`（Mock）/ 真实 API  
> 关联文档：[api-spec.md](./api-spec.md)

## 图例

| 标记 | 含义 |
|------|------|
| **已接通** | 页面已调用对应 `service` 函数 |
| **仅 UI** | 界面有按钮/表单，尚未接入 `service` |
| **间接** | 经 `AppContext` / `bootstrap` 初始化，页面不直接调 `service` |

**权限角色参考**：`admin` 管理员 · `advisor` 顾问 · `teacher` 教师 · `finance` 财务

---

## 1. 新增学员

| 项目 | 内容 |
|------|------|
| **页面名称** | 学员管理（`/students`） |
| **前端交互** | 点击「新增学员」→ 填写 Modal 表单 →「保存学员」 |
| **当前调用的 service 函数** | `studentService.createStudent()`（经 `AppContext.addStudent`）<br>`studentService.getFormOptionsSync()`（年级、标签选项） |
| **未来对应的后端 API** | `POST /api/students` |
| **请求字段** | `name`（必填）、`phone`（必填）、`grade`、`school`、`remainingCredits`、`riskStatus`（`high` \| `medium` \| `low` \| `normal`）、`tags`、`enrollmentDate` |
| **返回字段** | 完整 `Student`（含服务端生成 `id`） |
| **是否需要权限校验** | 是 · `advisor` / `admin` |
| **是否第一阶段 MVP 必做** | **是** |

> 表单中的目标国家、目标方向、顾问、家长电话、备注等字段当前仅 UI 展示，未提交至 service。

---

## 2. 查看学员详情

| 项目 | 内容 |
|------|------|
| **页面名称** | 学员管理（`/students`） |
| **前端交互** | 点击表格行或「详情」→ 右侧 Drawer 展示课程档案、课时概览、风险提示、AI 学习总结 |
| **当前调用的 service 函数** | `studentService.getStudentDetail(studentId, students)` |
| **未来对应的后端 API** | `GET /api/students/:id` |
| **请求字段** | 路径参数 `id`（学员 ID） |
| **返回字段** | `StudentDetail`：`id`、`name`、`grade`、`school`、`phone`、`remainingCredits`、`riskStatus`、`tags`、`enrollmentDate`、`advisor`、`consumedCredits`、`lastLesson`、`aiLearningSummary`、`homeworkOverdueWarning` |
| **是否需要权限校验** | 是 · `advisor` / `teacher` / `admin`（按数据范围过滤） |
| **是否第一阶段 MVP 必做** | **是** |

---

## 3. 编辑学员资料

| 项目 | 内容 |
|------|------|
| **页面名称** | 学员管理（`/students`） |
| **前端交互** | 学员详情 Drawer 底部点击「编辑资料」→ 修改基础信息并保存 |
| **当前调用的 service 函数** | `studentService.updateStudent(id, data)`（**service 已定义，页面按钮尚未接入**） |
| **未来对应的后端 API** | `PATCH /api/students/:id` |
| **请求字段** | 路径参数 `id`；Body 为 `Partial<Student>`，常见字段：`name`、`phone`、`grade`、`school`、`remainingCredits`、`riskStatus`、`tags` |
| **返回字段** | 更新后的完整 `Student` |
| **是否需要权限校验** | 是 · `advisor` / `admin` |
| **是否第一阶段 MVP 必做** | **是**（基础档案维护；前端待接线） |

---

## 4. 新建排课

| 项目 | 内容 |
|------|------|
| **页面名称** | 排课管理（`/schedule`） |
| **前端交互** | 点击「新建排课」或日历格 → 填写 Modal →「保存排课」；冲突时二次确认 |
| **当前调用的 service 函数** | `scheduleService.listEvents()`、`scheduleService.createSchedule()`、`scheduleService.updateSchedule()`、`scheduleService.updateScheduleStatus()`、`scheduleService.cancelSchedule()`<br>`courseService.list()`（**间接**，经 `AppContext` 提供课程选项） |
| **后端 API** | `GET /api/schedules`、`POST /api/schedules`、`PUT /api/schedules/:id`、`PATCH /api/schedules/:id/status` |
| **查询字段** | `startDate`、`endDate`、`teacherId`、`studentId`、`classId`、`courseId`、`status`；空值、`undefined`、`null`、`Invalid Date` 会被忽略 |
| **创建字段** | `courseId` / `courseName`、`teacherId` / `teacher`、`studentId`、`classId`、`roomId`（仅真实 UUID）、`classroom`、`date`、`startTime`、`endTime`、`duration`、`lessonType`、`status`、`notes` |
| **编辑字段** | `date`、`startTime`、`endTime`、`teacherId`、`roomId`（仅真实 UUID）、`classroom`、`status`、`cancelReason`、`notes` |
| **返回字段** | `Schedule`：`id`、`courseId`、`teacherId`、`studentId`、`classId`、`roomId`、`colIndex`、`topIndex`、`durationSlots`、`title`、`courseName`、`studentName`、`className`、`teacher`、`room`、`classroom`、`timeString`、`startTime`、`endTime`、`type`、`status`、`date`、`notes`、`cancelReason`、`createdBy`、`updatedAt` |
| **是否需要权限校验** | 是 · `admin` / `advisor` / 排课专员 |
| **是否第一阶段 MVP 必做** | **是** |

> Sprint 3-1 约定：取消排课不删除记录，而是调用 `PATCH /api/schedules/:id/status`，传 `{ status: "cancelled", cancelReason }`。排课详情 Drawer 展示真实后端字段；编辑/取消成功后刷新当前周日历。

---

## 5. 查看课程详情

| 项目 | 内容 |
|------|------|
| **页面名称** | 课程管理（`/courses`） |
| **前端交互** | 课程列表中点击行或「编辑」查看课程名称、分类、层级、总课时、标准定价等详情 |
| **当前调用的 service 函数** | `courseService.list()`（**间接**，经 `bootstrap` → `AppContext.courses` 渲染列表；**无单条详情 API 调用**） |
| **未来对应的后端 API** | `GET /api/courses/:id` |
| **请求字段** | 路径参数 `id`（课程 ID） |
| **返回字段** | `Course`：`id`、`name`、`category`、`level`、`totalLessons`、`price`、`description`、`teachingMethod`、`targetGrades`、`status` |
| **是否需要权限校验** | 是 · 登录用户可读；编辑需 `admin` |
| **是否第一阶段 MVP 必做** | **否**（MVP 可先依赖列表字段；详情 Drawer 为增强项） |

---

## 6. 上课记录与老师反馈

| 项目 | 内容 |
|------|------|
| **页面名称** | 上课记录与消课（`/records`） |
| **前端交互** | 页面加载真实上课记录；支持日期、老师、课程、状态和关键词筛选；点击记录打开 Drawer 填写老师反馈并确认消课 |
| **当前调用的 service 函数** | `lessonService.listRecords()`、`lessonService.saveDraft()`、`lessonService.submitFeedback()`、`lessonService.generateFeedback()`、`lessonService.confirmDeduction()` |
| **后端 API** | `GET /api/lesson-records`、`GET /api/lesson-records/:id`、`PUT /api/lesson-records/:id`、`PATCH /api/lesson-records/:id/status`、`POST /api/lesson-records/:id/confirm-deduction` |
| **请求字段** | 草稿/反馈 Body：`topic`、`performance`、`knowledgeMastery`、`homework`、`nextPlan`、`needAdvisorFollowUp`、`syncToParent`、`internalNotes`、`aiSummary`、`status`、`feedbackStatus` |
| **返回字段** | `LessonRecord`：排课来源、学员/班级、课程、老师、日期时间、教室、课时、状态、反馈字段、AI 总结、消课状态 |
| **是否需要权限校验** | 是 · `admin` / `academic_manager` 可查看全部；`teacher` 仅本人；`advisor` 仅查看负责学生且不能修改；`finance` 不可访问详情 |
| **是否第一阶段 MVP 必做** | **是**（消课前置；草稿保存可 MVP 与消课合并实现） |

> Sprint 3-3 起，消课在老师反馈提交后由管理员/教务主管确认。确认消课会扣减课时账户、生成课时流水，并把 lesson record 标记为 `deducted`。

## 6.1 从排课生成上课记录

| 项目 | 内容 |
|------|------|
| **页面名称** | 排课管理（`/schedule`） |
| **前端交互** | 排课详情 Drawer →「生成上课记录」；已生成时显示「查看上课记录」 |
| **当前调用的 service 函数** | `lessonService.createFromSchedule(scheduleId)` |
| **后端 API** | `POST /api/lesson-records/from-schedule/:scheduleId` |
| **规则** | 一个 schedule 默认只生成一条记录；重复生成返回已有记录；继承 schedule 的课程、老师、学员或班级、日期时间、教室、课时 |
| **初始状态** | `pending_feedback`，反馈状态 `pending` |

---

## 7. 确认消课

| 项目 | 内容 |
|------|------|
| **页面名称** | 上课记录与消课（`/records`） |
| **前端交互** | 记录详情 Drawer →「确认消课」区域展示当前余额、本次扣减和扣减后余额 → 二次确认 |
| **当前调用的 service 函数** | `lessonService.confirmDeduction(id, { consumedHours, deductionNote, syncToParent })`<br>`creditService.listAccounts({ studentId, courseId })` |
| **后端 API** | `POST /api/lesson-records/:id/confirm-deduction` |
| **请求字段** | 路径参数 `id`；Body：`consumedHours`、`deductionNote?`、`syncToParent?` |
| **返回字段** | `{ lessonRecord, creditAccount, creditTransaction }`<br>副作用：`credit_accounts.remainingHours` 减少；`credit_transactions` 新增 `lesson_deduction`；记录 `deductionStatus` → `deducted`、`status` → `completed` |
| **是否需要权限校验** | 是 · `admin` / `academic_manager` 可确认；`teacher` / `advisor` / `finance` 默认不可确认 |
| **是否第一阶段 MVP 必做** | **是** |

---

## 8. 课时调整

| 项目 | 内容 |
|------|------|
| **页面名称** | 订单与课时（`/orders`） |
| **前端交互** | 点击「课时调整」→ Modal 选择学员、调整类型、变动课时等 →「确认调整」 |
| **当前调用的 service 函数** | `creditService.adjustCredits({ studentId, courseId?, transactionType, hoursChange, note? })` |
| **后端 API** | `POST /api/credits/adjust` |
| **请求字段** | `studentId`、`courseId?`、`transactionType`、`hoursChange`（正增负减，非 0）、`note?` |
| **返回字段** | `{ student, creditAccount, transaction }`<br>`CreditTransaction`：`id`、`studentId`、`courseId`、`creditAccountId`、`transactionType`、`hoursChange`、`balanceBefore`、`balanceAfter`、`operatorId`、`note`、`createdAt` |
| **是否需要权限校验** | 是 · `admin` / `academic_manager` / `finance` |
| **是否第一阶段 MVP 必做** | **是** |

---

## 9. 查看课时流水

| 项目 | 内容 |
|------|------|
| **页面名称** | 订单与课时（`/orders`） |
| **前端交互** | 页面加载展示课时流水表格；支持搜索订单号/学生姓名；右侧「课时台账摘要」展示汇总 |
| **当前调用的 service 函数** | `creditService.listTransactions()`、`creditService.listAccounts({ lowBalance: true })`<br>`creditService.getOrdersPageStatsSync()`、`creditService.getLedgerSummarySync()`（页头统计与台账摘要） |
| **后端 API** | `GET /api/credits/transactions`、`GET /api/credits/accounts`、`GET /api/credits/accounts/:id` |
| **请求字段** | 流水查询：`studentId`、`courseId`、`transactionType`、`startDate`、`endDate`；账户查询：`studentId`、`courseId`、`lowBalance=true`、`status` |
| **返回字段** | `CreditTransaction[]`、`CreditAccount[]`；低课时账户由 `remainingHours <= 5` 或 `lowBalance=true` 标记 |
| **是否需要权限校验** | 是 · `finance` / `advisor`（仅自己学员）/ `admin` |
| **是否第一阶段 MVP 必做** | **是** |

> 学员详情 Drawer 中「查看课时流水」按钮当前为 **仅 UI**，MVP 可跳转至 `/orders?studentId=xxx` 并调用带筛选的流水 API。

---

## 10. 请假补课

| 项目 | 内容 |
|------|------|
| **页面名称** | 请假补课（`/leaves`） |
| **前端交互** | 页面加载真实请假补课申请；支持类型、状态、老师、学员、日期范围筛选；点击申请打开右侧 Drawer 查看流程并执行审批、拒绝、安排补课、通知家长 |
| **当前调用的 service 函数** | `leaveMakeupService.list()`、`create()`、`approve()`、`reject()`、`scheduleMakeup()`、`notifyParent()` |
| **后端 API** | `GET /api/leave-makeup`、`GET /api/leave-makeup/:id`、`POST /api/leave-makeup`、`PUT /api/leave-makeup/:id`、`PATCH /api/leave-makeup/:id/status`、`POST /api/leave-makeup/:id/approve`、`POST /api/leave-makeup/:id/reject`、`POST /api/leave-makeup/:id/schedule-makeup`、`POST /api/leave-makeup/:id/notify-parent` |
| **请求字段** | 创建：`scheduleId`、`lessonRecordId?`、`requestType`、`reason`、`deductCredit?`、`needMakeup?`、`newDate?`、`newStartTime?`、`newEndTime?`；安排补课：`date`、`startTime`、`endTime`、`teacherId?`、`classroom?`、`lessonType?`、`notes?` |
| **返回字段** | `LeaveRecord`：原排课、学员/班级、课程、老师、原时间、新时间、原因、是否扣课时、是否需要补课、审批状态、通知状态、补课排课 |
| **是否需要权限校验** | 是 · `admin` / `academic_manager` 全部；`advisor` 仅负责学员提交和通知；`teacher` 仅自己的老师请假；`finance` 无操作权限 |
| **是否第一阶段 MVP 必做** | **是**（教务异常流程） |

> 排课详情 Drawer 已增加「学生请假」「老师请假」「调课」「取消课程」快捷入口，自动带入当前 `scheduleId`，后端从原排课补齐课程、老师、学员/班级和原时间。

---

## 11. 家长报告

| 项目 | 内容 |
|------|------|
| **页面名称** | 家长报告（`/reports`） |
| **前端交互** | 页面加载真实报告列表；支持学员、课程、类型、状态筛选；点击「生成报告」弹窗选择周期和包含模块；点击报告展示家长预览画布；支持编辑、模拟发送、导出 PDF toast |
| **当前调用的 service 函数** | `reportService.listReports()`、`getReport()`、`generateReport()`、`updateReport()`、`updateStatus()`、`sendReport()` |
| **后端 API** | `GET /api/reports`、`GET /api/reports/:id`、`POST /api/reports/generate`、`PUT /api/reports/:id`、`POST /api/reports/:id/send`、`PATCH /api/reports/:id/status` |
| **请求字段** | 生成：`studentId`、`courseId?`、`reportType`、`reportPeriodStart`、`reportPeriodEnd`、`includeLessons?`、`includeCredits?`、`includeLeaveMakeup?`、`includeHomework?`、`includeAiSummary?` |
| **返回字段** | `ParentReport`：报告标题、学员/课程/顾问、周期、状态、发送时间、阶段总结、老师反馈摘要、课时情况、请假补课摘要、薄弱点、下阶段计划、家长可见内容、图表数据 |
| **是否需要权限校验** | 是 · `admin` / `academic_manager` 全部；`advisor` 生成和查看负责学员；`teacher` 仅查看相关摘要；`finance` 不可访问 |
| **是否第一阶段 MVP 必做** | **是**（家校沟通闭环） |

> 报告预览只展示家长可见内容，不显示 `internalNotes`、`operation_logs` 或非授权财务敏感字段；PDF 本阶段为 toast 占位。

---

## 12. AI 教务助手提问

| 项目 | 内容 |
|------|------|
| **页面名称** | AI 智能助理（`/ai`） |
| **前端交互** | 输入自然语言问题 → 发送 → 展示结构化回复（课时预警列表、补课提醒、报告意图等） |
| **当前调用的 service 函数** | `aiService.queryAssistant(message, students)`<br>`aiService.getHistorySync()`（左侧历史会话列表） |
| **未来对应的后端 API** | `POST /api/ai/chat`<br>`GET /api/ai/history` |
| **请求字段** | `POST` Body：`{ message: string }`；可选上下文 `sessionId` |
| **返回字段** | `AIQueryResult`（按 `intent` 分支）：<br>· `credit_warning`：`{ intent, students: Student[] }`<br>· `makeup`：`{ intent, items: string[], count }`<br>· `report`：`{ intent: "report" }`<br>· `default`：`{ intent, fallbackText }` |
| **是否需要权限校验** | 是 · 登录教务人员；AI 调用需限流与审计 |
| **是否第一阶段 MVP 必做** | **否**（体验增强；MVP 可用固定报表替代） |

---

## 13. 生成 AI 反馈总结

| 项目 | 内容 |
|------|------|
| **页面名称** | 上课记录与消课（`/records`） |
| **前端交互** | 记录详情 Drawer → 课堂反馈区下方点击「一键生成家长反馈」→ 展示 AI 摘要，可重新生成 |
| **当前调用的 service 函数** | `lessonService.generateFeedback(record)` |
| **未来对应的后端 API** | `POST /api/lesson-records/:id/ai-feedback` |
| **请求字段** | 路径参数 `id`（上课记录 ID）；Body 可扩展传入 `performance`、`homework`、`topic` 等上下文 |
| **返回字段** | `{ summary: string }` |
| **是否需要权限校验** | 是 · `teacher` / `advisor` / `admin` |
| **是否第一阶段 MVP 必做** | **建议是**（与消课流程强相关；可降级为模板文案） |

---

## 14. 生成续费建议

| 项目 | 内容 |
|------|------|
| **页面名称** | 订单与课时（`/orders`） |
| **前端交互** | 右侧「智能续费建议」卡片 → 点击「生成续费分析」→ 展示学员、课程进度、风险分析与推荐话术 |
| **当前调用的 service 函数** | `aiService.generateRenewalSuggestion()` |
| **未来对应的后端 API** | `POST /api/ai/renewal-suggestion` |
| **请求字段** | 可选 Body：`{ studentId?: string }`（当前 Mock 返回固定样例；生产应按学员分析） |
| **返回字段** | `RenewalSuggestion`：`name`、`course`、`credits`、`progress`、`risk`、`script` |
| **是否需要权限校验** | 是 · `advisor` / `admin` |
| **是否第一阶段 MVP 必做** | **否**（顾问效率工具，第二阶段） |

---

## MVP 优先级汇总

| 优先级 | 交互编号 | 说明 |
|--------|----------|------|
| **P0 必做** | 1、2、4、7、8、9 | 学员建档、详情、排课、消课、课时调整、流水查询 |
| **P0 建议** | 3、6、13 | 编辑学员、提交上课记录、AI 反馈（3/6 前端待完整接线） |
| **P1 增强** | 10、12、14 | 家长报告 AI、教务助手、续费建议 |
| **P2 扩展** | 5、11 | 课程详情页、报告发送通道 |

---

## Service 与页面对照索引

| Service | 主要函数 | 关联页面 |
|---------|----------|----------|
| `studentService` | `createStudent`、`getStudentDetail`、`updateStudent`、`list` | `/students` |
| `courseService` | `list`、`createCourse` | `/courses`、`/schedule`（课程选项） |
| `scheduleService` | `createSchedule`、`cancelSchedule`、`listEvents` | `/schedule` |
| `lessonService` | `listRecords`、`updateRecord`、`confirmDeduction`、`generateFeedback` | `/records` |
| `creditService` | `listTransactions`、`adjustCredits` | `/orders` |
| `reportService` | `getParentReport`、`generateParentReportSummary` | `/reports` |
| `aiService` | `queryAssistant`、`generateRenewalSuggestion` | `/ai`、`/orders` |

---

## 版本记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0.0 | 2026-06-28 | 初版：覆盖 14 项核心交互，标注 service 接通状态与 MVP 优先级 |
