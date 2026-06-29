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
| **当前调用的 service 函数** | `scheduleService.createSchedule(input, existingEvents)`<br>`scheduleService.getTeacherOptionsSync()`（教师下拉）<br>`courseService.list()`（**间接**，经 `AppContext` 提供课程选项） |
| **未来对应的后端 API** | `POST /api/schedule/events` |
| **请求字段** | `courseName`（由 UI `courseId` 解析）、`teacher`（由 UI `teacherId` 解析）、`roomId`（`room-1` / `room-2` / `room-3`）、`date`（YYYY-MM-DD）、`startTime`（HH:mm）、`duration`（小时，number） |
| **返回字段** | `{ event: Schedule, hasConflict: boolean }`<br>`Schedule`：`id`、`colIndex`、`topIndex`、`durationSlots`、`title`、`teacher`、`room`、`timeString`、`type` |
| **是否需要权限校验** | 是 · `admin` / `advisor` / 排课专员 |
| **是否第一阶段 MVP 必做** | **是** |

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

## 6. 提交上课记录

| 项目 | 内容 |
|------|------|
| **页面名称** | 上课记录与消课（`/records`） |
| **前端交互** | 点击记录行 → Drawer 填写课堂反馈（本节课内容、课堂表现、课后作业）→「保存草稿」或随消课一并提交 |
| **当前调用的 service 函数** | `lessonService.updateRecord(id, data)`（**service 已定义**）<br>「保存草稿」当前为 **仅 UI**（`toast`，未调 service）<br>「提交并确认消课」走 `lessonService.confirmDeduct()`（见第 7 条，合并提交反馈 + 消课） |
| **未来对应的后端 API** | `PATCH /api/lesson-records/:id`（草稿/提交反馈） |
| **请求字段** | 路径参数 `id`；Body：`status`、`attendance`、`creditsConsumed`、`topic`、`performance`、`homework`、`feedbackStatus`（`pending` \| `submitted`）、`needAdvisorFollowUp`（建议扩展）、`syncToParent`（建议扩展） |
| **返回字段** | 更新后的 `LessonRecord` |
| **是否需要权限校验** | 是 · `teacher`（本人课程）/ `admin` |
| **是否第一阶段 MVP 必做** | **是**（消课前置；草稿保存可 MVP 与消课合并实现） |

---

## 7. 确认消课

| 项目 | 内容 |
|------|------|
| **页面名称** | 上课记录与消课（`/records`） |
| **前端交互** | 记录详情 Drawer →（可选）生成 AI 反馈 → 点击「提交并确认消课」→ 二次确认 |
| **当前调用的 service 函数** | `lessonService.confirmDeduct({ record, student, aiSummary? })`<br>`lessonService.listRecords()`（**间接**，列表数据经 `AppContext`） |
| **未来对应的后端 API** | `POST /api/lesson-records/:id/deduct` |
| **请求字段** | 路径参数 `id`；Body：`aiSummary`（可选，AI 课后反馈摘要） |
| **返回字段** | `{ student: Student, record: LessonRecord }`<br>副作用：学员 `remainingCredits` 减少 `creditsConsumed`；记录 `status` → `completed`，`feedbackStatus` → `submitted` |
| **是否需要权限校验** | 是 · `teacher` / `advisor` / `admin` |
| **是否第一阶段 MVP 必做** | **是** |

---

## 8. 课时调整

| 项目 | 内容 |
|------|------|
| **页面名称** | 订单与课时（`/orders`） |
| **前端交互** | 点击「课时调整」→ Modal 选择学员、调整类型、变动课时等 →「确认调整」 |
| **当前调用的 service 函数** | `creditService.adjustCredits({ student, adjustType, creditsAmount, courseName?, amount?, notes? })` |
| **未来对应的后端 API** | `POST /api/credit-transactions/adjust` |
| **请求字段** | `studentId`（由 UI 选择学员解析）、`adjustType`（`purchase` \| `gift` \| `transfer_in` \| `makeup_return` \| `deduct` \| `refund` \| `transfer_out` \| `manual`）、`creditsAmount`（非 0）、`courseName`、`amount`、`notes` |
| **返回字段** | `{ student: Student, transaction: CreditTransaction }`<br>`CreditTransaction`：`id`、`studentId`、`studentName`、`courseName`、`amount`、`creditsAdded`、`creditsConsumed`、`date`、`status` |
| **是否需要权限校验** | 是 · `finance` / `admin` |
| **是否第一阶段 MVP 必做** | **是** |

---

## 9. 查看课时流水

| 项目 | 内容 |
|------|------|
| **页面名称** | 订单与课时（`/orders`） |
| **前端交互** | 页面加载展示课时流水表格；支持搜索订单号/学生姓名；右侧「课时台账摘要」展示汇总 |
| **当前调用的 service 函数** | `creditService.listTransactions()`（**间接**，经 `bootstrap` → `AppContext.orders`）<br>`creditService.getOrdersPageStatsSync()`、`creditService.getLedgerSummarySync()`（页头统计与台账摘要） |
| **未来对应的后端 API** | `GET /api/credit-transactions`（支持 `?studentId=&status=&dateFrom=&dateTo=`）<br>`GET /api/credit-transactions/ledger`（台账摘要）<br>`GET /api/credit-transactions/stats`（页头 KPI） |
| **请求字段** | 查询参数：`studentId`、`status`、`keyword`、`page`、`pageSize`（建议分页） |
| **返回字段** | `CreditTransaction[]`；台账摘要：`totalRemainingHours`、`monthlyConsumedHours`；统计：`monthlyNewOrders`、`monthlyRevenue`、`pendingOrders`、`warningStudents` |
| **是否需要权限校验** | 是 · `finance` / `advisor`（仅自己学员）/ `admin` |
| **是否第一阶段 MVP 必做** | **是** |

> 学员详情 Drawer 中「查看课时流水」按钮当前为 **仅 UI**，MVP 可跳转至 `/orders?studentId=xxx` 并调用带筛选的流水 API。

---

## 10. 生成家长报告

| 项目 | 内容 |
|------|------|
| **页面名称** | 家长报告（`/reports`） |
| **前端交互** | 进入页面加载报告画布（学习数据、趋势图、雷达图）→ 点击「生成 AI 摘要」 |
| **当前调用的 service 函数** | `reportService.getParentReportSync()` / `reportService.getParentReport(studentId?)`（报告主体数据）<br>`reportService.getTrendDataSync()`、`reportService.getRadarDataSync()`（图表）<br>`reportService.generateParentReportSummary(studentId?)`（AI 摘要） |
| **未来对应的后端 API** | `GET /api/reports/parent/:studentId`（报告数据）<br>`GET /api/reports/trend?studentId=`（趋势图）<br>`GET /api/reports/radar?studentId=`（雷达图）<br>`POST /api/reports/parent/summary`（AI 摘要） |
| **请求字段** | 路径/查询：`studentId`；AI 摘要 Body：`{ studentId?: string }` |
| **返回字段** | `ParentReport`：`studentName`、`grade`、`courses`、`advisor`、`period`、`monthlyHours`、`attendanceRate`、`homeworkRate`、`scoreImprovement`、`courseRecords[]`<br>AI 摘要：`{ summary: string }` |
| **是否需要权限校验** | 是 · `advisor` / `admin` |
| **是否第一阶段 MVP 必做** | **否**（可先展示静态/半自动报告；AI 摘要为增强） |

> 学员详情 Drawer「生成家长报告」当前为 **仅 UI**（toast），正式流程以 `/reports` 页为准。

---

## 11. 发送家长报告

| 项目 | 内容 |
|------|------|
| **页面名称** | 家长报告（`/reports`） |
| **前端交互** | 点击「发送给家长」→ 二次确认 → 通过企微/短信/邮件推送报告（含 AI 摘要） |
| **当前调用的 service 函数** | **无**（当前为 `confirm` + `toast`，**待新增** `reportService.sendParentReport()`） |
| **未来对应的后端 API** | `POST /api/reports/parent/:studentId/send` |
| **请求字段** | 路径参数 `studentId`；Body：`channel`（`wecom` \| `sms` \| `email`）、`summary`（可选，附 AI 摘要）、`recipientPhone`（可选） |
| **返回字段** | `{ success: boolean, sentAt: string, channel: string }` |
| **是否需要权限校验** | 是 · `advisor` / `admin`；需审计日志 |
| **是否第一阶段 MVP 必做** | **否**（第二阶段对接消息通道） |

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
| `lessonService` | `listRecords`、`updateRecord`、`confirmDeduct`、`generateFeedback` | `/records` |
| `creditService` | `listTransactions`、`adjustCredits` | `/orders` |
| `reportService` | `getParentReport`、`generateParentReportSummary` | `/reports` |
| `aiService` | `queryAssistant`、`generateRenewalSuggestion` | `/ai`、`/orders` |

---

## 版本记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0.0 | 2026-06-28 | 初版：覆盖 14 项核心交互，标注 service 接通状态与 MVP 优先级 |
