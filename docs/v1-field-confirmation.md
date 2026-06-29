# Astralink 灵枢教务系统 V1 核心字段确认表

## 使用说明

本文档用于和朗睿教育确认 V1 正式版数据字段。标记说明：

- 必填：创建或导入时是否必须提供。
- 家长可见：是否可出现在家长报告、家长端或对外发送内容中。
- 导入：是否支持 Excel 导入。
- 导出：是否支持后台导出。
- 数据库表：已落库表使用当前表名；未落库对象标注为 V1 建议表。

## Student

| 字段名称 | 字段类型 | 必填 | 家长可见 | 导入 | 导出 | 对应页面 | 对应数据库表 |
|----------|----------|------|----------|------|------|----------|--------------|
| 学员 ID | UUID/系统生成 | 是 | 否 | 否 | 是 | 学员管理 | `students.id` |
| 姓名 | 文本 | 是 | 是 | 是 | 是 | 学员管理、家长报告 | `students.name` |
| 手机号 | 文本 | 是 | 否 | 是 | 是 | 学员管理 | `students.phone` |
| 年级 | 文本/枚举 | 是 | 是 | 是 | 是 | 学员管理、家长报告 | `students.grade` |
| 学校 | 文本 | 否 | 是 | 是 | 是 | 学员管理、家长报告 | `students.school` |
| 学员状态 | 枚举 | 是 | 否 | 是 | 是 | 学员管理 | `students.status` |
| 风险状态 | 枚举 | 是 | 否 | 是 | 是 | 学员管理、首页 | `students.risk_status` |
| 标签 | JSON 数组 | 否 | 否 | 是 | 是 | 学员管理 | `students.tags` |
| 入学日期 | 日期 | 是 | 否 | 是 | 是 | 学员管理 | `students.enrollment_date` |
| 负责顾问 | 用户 ID | 否 | 否 | 是 | 是 | 学员管理 | `students.advisor_id` |
| 最近测评分 | 数字 | 否 | 是 | 是 | 是 | 学员详情、家长报告 | `students.recent_test_score` |
| 目标国家 | 文本 | 否 | 否 | 是 | 是 | 学员详情 | `students.target_country` |
| 目标方向 | 文本 | 否 | 否 | 是 | 是 | 学员详情 | `students.target_direction` |
| 家长电话 | 文本 | 否 | 否 | 是 | 是 | 学员详情 | `students.parent_phone` |
| 内部备注 | 长文本 | 否 | 否 | 是 | 是 | 学员详情 | `students.notes` |
| AI 学习总结 | 长文本 | 否 | 是 | 否 | 是 | 学员详情、家长报告 | `students.ai_learning_summary` |
| 作业逾期提醒 | 长文本 | 否 | 否 | 否 | 是 | 首页、AI 助手 | `students.homework_overdue_warning` |

## Course

| 字段名称 | 字段类型 | 必填 | 家长可见 | 导入 | 导出 | 对应页面 | 对应数据库表 |
|----------|----------|------|----------|------|------|----------|--------------|
| 课程 ID | UUID/系统生成 | 是 | 否 | 否 | 是 | 课程产品 | `courses.id` |
| 课程名称 | 文本 | 是 | 是 | 是 | 是 | 课程产品、排课、报告 | `courses.name` |
| 分类 | 枚举 | 是 | 是 | 是 | 是 | 课程产品 | `courses.category` |
| 级别 | 文本 | 是 | 是 | 是 | 是 | 课程产品 | `courses.level` |
| 标准总课时 | 数字 | 是 | 否 | 是 | 是 | 课程产品 | `courses.total_lessons` |
| 标准价格 | 金额 | 是 | 否 | 是 | 是 | 课程产品、订单课时 | `courses.price` |
| 课程描述 | 长文本 | 否 | 是 | 是 | 是 | 课程产品 | `courses.description` |
| 授课方式 | 文本 | 否 | 是 | 是 | 是 | 课程产品 | `courses.teaching_method` |
| 适用年级 | JSON 数组 | 否 | 是 | 是 | 是 | 课程产品 | `courses.target_grades` |
| 课程状态 | 枚举 | 是 | 否 | 是 | 是 | 课程产品 | `courses.status` |

## Class

| 字段名称 | 字段类型 | 必填 | 家长可见 | 导入 | 导出 | 对应页面 | 对应数据库表 |
|----------|----------|------|----------|------|------|----------|--------------|
| 班级 ID | UUID/系统生成 | 是 | 否 | 否 | 是 | 班级管理 | `classes.id` |
| 班级名称 | 文本 | 是 | 是 | 是 | 是 | 班级管理、排课、报告 | `classes.name` |
| 关联课程 | 课程 ID | 是 | 是 | 是 | 是 | 班级管理 | `classes.course_id` |
| 主讲老师 | 老师 ID | 是 | 是 | 是 | 是 | 班级管理、老师中心 | `classes.teacher_id` |
| 上课时间描述 | 文本 | 否 | 是 | 是 | 是 | 班级管理 | `classes.schedule_desc` |
| 容量 | 数字 | 是 | 否 | 是 | 是 | 班级管理 | `classes.capacity` |
| 已报名人数 | 数字/计算 | 是 | 否 | 否 | 是 | 班级管理 | `classes.enrolled_count` |
| 教室 | 文本 | 否 | 是 | 是 | 是 | 班级管理、排课 | `classes.classroom` |
| 状态 | 文本/枚举 | 是 | 否 | 是 | 是 | 班级管理 | `classes.status` |
| 班级学员 | 关联列表 | 是 | 否 | 是 | 是 | 班级管理 | `class_enrollments` |

## Teacher

| 字段名称 | 字段类型 | 必填 | 家长可见 | 导入 | 导出 | 对应页面 | 对应数据库表 |
|----------|----------|------|----------|------|------|----------|--------------|
| 老师 ID | UUID/系统生成 | 是 | 否 | 否 | 是 | 老师中心 | `teachers.id` |
| 关联账号 | 用户 ID | 否 | 否 | 是 | 是 | 老师中心、权限 | `teachers.user_id` |
| 老师姓名 | 文本 | 是 | 是 | 是 | 是 | 老师中心、排课、报告 | `teachers.name` |
| 授课科目 | JSON 数组 | 是 | 是 | 是 | 是 | 老师中心 | `teachers.subjects` |
| 老师类型 | 枚举 | 是 | 否 | 是 | 是 | 老师中心 | `teachers.type` |
| 评分 | 数字 | 否 | 否 | 是 | 是 | 老师中心 | `teachers.rating` |
| 当前班级数 | 数字 | 是 | 否 | 否 | 是 | 老师中心 | `teachers.classes_count` |
| 可用时间 | JSON 数组 | 否 | 否 | 是 | 是 | 老师中心、排课 | `teachers.available_time` |
| 反馈率 | 数字 | 否 | 否 | 否 | 是 | 老师中心 | `teachers.feedback_rate` |
| 状态 | 文本/枚举 | 是 | 否 | 是 | 是 | 老师中心 | `teachers.status` |

## Schedule

| 字段名称 | 字段类型 | 必填 | 家长可见 | 导入 | 导出 | 对应页面 | 对应数据库表 |
|----------|----------|------|----------|------|------|----------|--------------|
| 排课 ID | UUID/系统生成 | 是 | 否 | 否 | 是 | 排课日历 | `schedules.id` |
| 课程 | 课程 ID | 是 | 是 | 是 | 是 | 排课日历 | `schedules.course_id` |
| 老师 | 老师 ID | 是 | 是 | 是 | 是 | 排课日历 | `schedules.teacher_id` |
| 班级 | 班级 ID | 否 | 是 | 是 | 是 | 排课日历 | `schedules.class_id` |
| 教室 | 教室 ID | 是 | 是 | 是 | 是 | 排课日历 | `schedules.room_id` |
| 标题 | 文本 | 是 | 是 | 是 | 是 | 排课日历 | `schedules.title` |
| 事件类型 | 枚举 | 是 | 否 | 是 | 是 | 排课日历 | `schedules.event_type` |
| 上课日期 | 日期 | 是 | 是 | 是 | 是 | 排课日历 | `schedules.lesson_date` |
| 开始时间 | 时间 | 是 | 是 | 是 | 是 | 排课日历 | `schedules.start_time` |
| 结束时间 | 时间 | 是 | 是 | 是 | 是 | 排课日历 | `schedules.end_time` |
| 时长 | 数字 | 是 | 是 | 是 | 是 | 排课日历 | `schedules.duration_hours` |
| 状态 | 枚举 | 是 | 否 | 是 | 是 | 排课日历 | `schedules.status` |
| 是否冲突 | 布尔 | 否 | 否 | 否 | 是 | 排课日历 | `schedules.has_conflict` |
| 取消原因 | 长文本 | 否 | 否 | 是 | 是 | 排课日历 | `schedules.cancel_reason` |

## LessonRecord

| 字段名称 | 字段类型 | 必填 | 家长可见 | 导入 | 导出 | 对应页面 | 对应数据库表 |
|----------|----------|------|----------|------|------|----------|--------------|
| 记录 ID | UUID/系统生成 | 是 | 否 | 否 | 是 | 上课记录 | `lesson_records.id` |
| 排课 | 排课 ID | 否 | 否 | 是 | 是 | 上课记录 | `lesson_records.schedule_id` |
| 班级 | 班级 ID | 是 | 是 | 是 | 是 | 上课记录 | `lesson_records.class_id` |
| 学员 | 学员 ID | 是 | 是 | 是 | 是 | 上课记录、报告 | `lesson_records.student_id` |
| 老师 | 老师 ID | 是 | 是 | 是 | 是 | 上课记录、报告 | `lesson_records.teacher_id` |
| 上课日期 | 日期 | 是 | 是 | 是 | 是 | 上课记录、报告 | `lesson_records.lesson_date` |
| 课程主题 | 文本 | 否 | 是 | 是 | 是 | 上课记录、报告 | `lesson_records.topic` |
| 出勤 | 枚举 | 是 | 是 | 是 | 是 | 上课记录、报告 | `lesson_records.attendance` |
| 上课状态 | 枚举 | 是 | 否 | 是 | 是 | 上课记录 | `lesson_records.status` |
| 反馈状态 | 枚举 | 是 | 否 | 是 | 是 | 上课记录 | `lesson_records.feedback_status` |
| 消耗课时 | 数字 | 是 | 否 | 是 | 是 | 上课记录、课时流水 | `lesson_records.credits_consumed` |
| 课堂表现 | 长文本 | 否 | 是 | 是 | 是 | 上课记录、报告 | `lesson_records.performance` |
| 作业要求 | 长文本 | 否 | 是 | 是 | 是 | 上课记录、报告 | `lesson_records.homework` |
| AI 摘要 | 长文本 | 否 | 是 | 否 | 是 | 上课记录、报告 | `lesson_records.ai_summary` |
| 是否需要顾问跟进 | 布尔 | 否 | 否 | 是 | 是 | 上课记录 | `lesson_records.need_advisor_follow_up` |
| 是否同步家长 | 布尔 | 否 | 否 | 是 | 是 | 上课记录 | `lesson_records.sync_to_parent` |
| 消课时间 | 时间戳 | 否 | 否 | 否 | 是 | 上课记录 | `lesson_records.deducted_at` |

## CreditTransaction

| 字段名称 | 字段类型 | 必填 | 家长可见 | 导入 | 导出 | 对应页面 | 对应数据库表 |
|----------|----------|------|----------|------|------|----------|--------------|
| 流水 ID | UUID/系统生成 | 是 | 否 | 否 | 是 | 订单课时 | `credit_transactions.id` |
| 课时账户 | 账户 ID | 是 | 否 | 是 | 是 | 订单课时 | `credit_transactions.account_id` |
| 学员 | 学员 ID | 是 | 否 | 是 | 是 | 订单课时 | `credit_transactions.student_id` |
| 课程 | 课程 ID | 否 | 否 | 是 | 是 | 订单课时 | `credit_transactions.course_id` |
| 上课记录 | 记录 ID | 否 | 否 | 是 | 是 | 上课记录、订单课时 | `credit_transactions.lesson_record_id` |
| 变动类型 | 枚举 | 是 | 否 | 是 | 是 | 订单课时 | `credit_transactions.adjust_type` |
| 课时变化 | 数字 | 是 | 否 | 是 | 是 | 订单课时 | `credit_transactions.credits_delta` |
| 变动后余额 | 数字 | 是 | 否 | 是 | 是 | 订单课时 | `credit_transactions.balance_after` |
| 金额 | 金额 | 是 | 否 | 是 | 是 | 订单课时、财务 | `credit_transactions.amount` |
| 状态 | 枚举 | 是 | 否 | 是 | 是 | 订单课时 | `credit_transactions.status` |
| 课程名称快照 | 文本 | 否 | 否 | 是 | 是 | 订单课时 | `credit_transactions.course_name` |
| 备注 | 长文本 | 否 | 否 | 是 | 是 | 订单课时 | `credit_transactions.notes` |
| 交易日期 | 日期 | 是 | 否 | 是 | 是 | 订单课时 | `credit_transactions.transaction_date` |
| 到期日期 | 日期 | 否 | 否 | 是 | 是 | 订单课时 | `credit_transactions.expire_date` |
| 操作人 | 用户 ID | 否 | 否 | 否 | 是 | 订单课时 | `credit_transactions.created_by` |

## LeaveMakeup

| 字段名称 | 字段类型 | 必填 | 家长可见 | 导入 | 导出 | 对应页面 | 对应数据库表 |
|----------|----------|------|----------|------|------|----------|--------------|
| 申请 ID | UUID/系统生成 | 是 | 否 | 否 | 是 | 请假补课 | `leave_records.id` |
| 类型 | 枚举 | 是 | 是 | 是 | 是 | 请假补课 | `leave_records.type` |
| 学员 | 学员 ID | 否 | 是 | 是 | 是 | 请假补课 | `leave_records.student_id` |
| 老师 | 老师 ID | 否 | 是 | 是 | 是 | 请假补课 | `leave_records.teacher_id` |
| 班级 | 班级 ID | 是 | 是 | 是 | 是 | 请假补课 | `leave_records.class_id` |
| 原课程日期 | 日期 | 是 | 是 | 是 | 是 | 请假补课 | `leave_records.original_date` |
| 补课日期 | 日期 | 否 | 是 | 是 | 是 | 请假补课 | `leave_records.makeup_date` |
| 原因 | 长文本 | 是 | 可选 | 是 | 是 | 请假补课 | `leave_records.reason` |
| 是否扣课时 | 布尔 | 是 | 否 | 是 | 是 | 请假补课、课时流水 | `leave_records.deduct_credit` |
| 状态 | 枚举 | 是 | 否 | 是 | 是 | 请假补课 | `leave_records.status` |
| 通知状态 | 文本/枚举 | 是 | 否 | 是 | 是 | 请假补课 | `leave_records.notify_status` |

## Homework

| 字段名称 | 字段类型 | 必填 | 家长可见 | 导入 | 导出 | 对应页面 | 对应数据库表 |
|----------|----------|------|----------|------|------|----------|--------------|
| 作业 ID | UUID/系统生成 | 是 | 否 | 否 | 是 | 作业测评 | V1 建议表 `homeworks.id` |
| 上课记录 | 记录 ID | 否 | 否 | 是 | 是 | 上课记录、作业测评 | V1 建议表 `homeworks.lesson_record_id` |
| 学员 | 学员 ID | 是 | 是 | 是 | 是 | 作业测评 | V1 建议表 `homeworks.student_id` |
| 老师 | 老师 ID | 是 | 是 | 是 | 是 | 作业测评 | V1 建议表 `homeworks.teacher_id` |
| 作业标题 | 文本 | 是 | 是 | 是 | 是 | 作业测评 | V1 建议表 `homeworks.title` |
| 作业说明 | 长文本 | 否 | 是 | 是 | 是 | 作业测评 | V1 建议表 `homeworks.description` |
| 截止日期 | 日期 | 否 | 是 | 是 | 是 | 作业测评 | 当前简化在 `lesson_records.homework_due_at` |
| 提交日期 | 日期 | 否 | 是 | 是 | 是 | 作业测评 | 当前简化在 `lesson_records.homework_submitted_at` |
| 状态 | 枚举 | 是 | 是 | 是 | 是 | 作业测评 | V1 建议表 `homeworks.status` |
| 附件 | 文件列表 | 否 | 是 | 否 | 是 | 作业测评 | `uploaded_files` |

## Assessment

| 字段名称 | 字段类型 | 必填 | 家长可见 | 导入 | 导出 | 对应页面 | 对应数据库表 |
|----------|----------|------|----------|------|------|----------|--------------|
| 测评 ID | UUID/系统生成 | 是 | 否 | 否 | 是 | 作业测评 | V1 建议表 `assessments.id` |
| 学员 | 学员 ID | 是 | 是 | 是 | 是 | 作业测评、家长报告 | V1 建议表 `assessments.student_id` |
| 课程 | 课程 ID | 否 | 是 | 是 | 是 | 作业测评 | V1 建议表 `assessments.course_id` |
| 老师 | 老师 ID | 否 | 是 | 是 | 是 | 作业测评 | V1 建议表 `assessments.teacher_id` |
| 测评名称 | 文本 | 是 | 是 | 是 | 是 | 作业测评 | V1 建议表 `assessments.title` |
| 测评日期 | 日期 | 是 | 是 | 是 | 是 | 作业测评 | V1 建议表 `assessments.assessment_date` |
| 分数 | 数字 | 否 | 是 | 是 | 是 | 作业测评、报告 | V1 建议表 `assessments.score` |
| 满分 | 数字 | 否 | 是 | 是 | 是 | 作业测评 | V1 建议表 `assessments.full_score` |
| 评价 | 长文本 | 否 | 是 | 是 | 是 | 作业测评、报告 | V1 建议表 `assessments.comment` |
| 错题/薄弱点 | JSON 数组 | 否 | 可选 | 是 | 是 | 作业测评 | V1 建议表 `assessments.weakness_tags` |

## CompetitionProject

| 字段名称 | 字段类型 | 必填 | 家长可见 | 导入 | 导出 | 对应页面 | 对应数据库表 |
|----------|----------|------|----------|------|------|----------|--------------|
| 项目 ID | UUID/系统生成 | 是 | 否 | 否 | 是 | 竞赛项目 | V1 建议表 `competition_projects.id` |
| 项目名称 | 文本 | 是 | 是 | 是 | 是 | 竞赛项目 | V1 建议表 `competition_projects.name` |
| 竞赛类型 | 文本/枚举 | 是 | 是 | 是 | 是 | 竞赛项目 | V1 建议表 `competition_projects.category` |
| 关联学员 | 学员 ID | 是 | 是 | 是 | 是 | 竞赛项目 | V1 建议表 `competition_projects.student_id` |
| 负责顾问 | 用户 ID | 否 | 否 | 是 | 是 | 竞赛项目 | V1 建议表 `competition_projects.advisor_id` |
| 报名截止 | 日期 | 否 | 是 | 是 | 是 | 竞赛项目 | V1 建议表 `competition_projects.registration_deadline` |
| 比赛日期 | 日期 | 否 | 是 | 是 | 是 | 竞赛项目 | V1 建议表 `competition_projects.event_date` |
| 当前阶段 | 文本/枚举 | 是 | 是 | 是 | 是 | 竞赛项目 | V1 建议表 `competition_projects.stage` |
| 成果/奖项 | 文本 | 否 | 是 | 是 | 是 | 竞赛项目 | V1 建议表 `competition_projects.award` |
| 证书附件 | 文件列表 | 否 | 是 | 否 | 是 | 竞赛项目 | `uploaded_files` |

## ParentReport

| 字段名称 | 字段类型 | 必填 | 家长可见 | 导入 | 导出 | 对应页面 | 对应数据库表 |
|----------|----------|------|----------|------|------|----------|--------------|
| 报告 ID | UUID/系统生成 | 是 | 否 | 否 | 是 | 家长报告 | `parent_reports.id` |
| 学员 | 学员 ID | 是 | 是 | 是 | 是 | 家长报告 | `parent_reports.student_id` |
| 顾问 | 用户 ID | 否 | 否 | 是 | 是 | 家长报告 | `parent_reports.advisor_id` |
| 周期标签 | 文本 | 是 | 是 | 是 | 是 | 家长报告 | `parent_reports.period_label` |
| 周期开始 | 日期 | 是 | 是 | 是 | 是 | 家长报告 | `parent_reports.period_start` |
| 周期结束 | 日期 | 是 | 是 | 是 | 是 | 家长报告 | `parent_reports.period_end` |
| 学员姓名快照 | 文本 | 是 | 是 | 是 | 是 | 家长报告 | `parent_reports.student_name` |
| 年级快照 | 文本 | 是 | 是 | 是 | 是 | 家长报告 | `parent_reports.grade` |
| 课程摘要 | 长文本 | 否 | 是 | 是 | 是 | 家长报告 | `parent_reports.courses_summary` |
| 月度课时 | 数字 | 是 | 是 | 是 | 是 | 家长报告 | `parent_reports.monthly_hours` |
| 出勤率 | 数字 | 是 | 是 | 是 | 是 | 家长报告 | `parent_reports.attendance_rate` |
| 作业完成率 | 数字 | 是 | 是 | 是 | 是 | 家长报告 | `parent_reports.homework_rate` |
| 成绩提升 | 数字 | 否 | 是 | 是 | 是 | 家长报告 | `parent_reports.score_improvement` |
| 课程记录 | JSON | 否 | 是 | 是 | 是 | 家长报告 | `parent_reports.course_records` |
| AI 总结 | 长文本 | 否 | 是 | 否 | 是 | 家长报告 | `parent_reports.ai_summary` |
| 状态 | 枚举 | 是 | 否 | 是 | 是 | 家长报告 | `parent_reports.status` |
| 发送渠道 | 文本/枚举 | 否 | 否 | 是 | 是 | 家长报告 | `parent_reports.sent_channel` |

## Order

| 字段名称 | 字段类型 | 必填 | 家长可见 | 导入 | 导出 | 对应页面 | 对应数据库表 |
|----------|----------|------|----------|------|------|----------|--------------|
| 订单 ID | UUID/系统生成 | 是 | 否 | 否 | 是 | 订单课时、财务 | V1 建议表 `orders.id` |
| 订单号 | 文本 | 是 | 否 | 是 | 是 | 订单课时、财务 | V1 建议表 `orders.order_no` |
| 学员 | 学员 ID | 是 | 否 | 是 | 是 | 订单课时 | 可先映射 `credit_transactions.student_id` |
| 课程 | 课程 ID | 否 | 否 | 是 | 是 | 订单课时 | 可先映射 `credit_transactions.course_id` |
| 购买课时 | 数字 | 是 | 否 | 是 | 是 | 订单课时 | 可先映射 `credit_transactions.credits_delta` |
| 实收金额 | 金额 | 是 | 否 | 是 | 是 | 财务 | 可先映射 `credit_transactions.amount` |
| 付款状态 | 枚举 | 是 | 否 | 是 | 是 | 财务 | 可先映射 `credit_transactions.status` |
| 付款方式 | 文本/枚举 | 否 | 否 | 是 | 是 | 财务 | V1 建议表 `orders.payment_method` |
| 下单日期 | 日期 | 是 | 否 | 是 | 是 | 财务 | 可先映射 `credit_transactions.transaction_date` |
| 到期日期 | 日期 | 否 | 否 | 是 | 是 | 订单课时 | 可先映射 `credit_transactions.expire_date` |
| 销售/顾问 | 用户 ID | 否 | 否 | 是 | 是 | 财务 | V1 建议表 `orders.owner_id` |
| 备注 | 长文本 | 否 | 否 | 是 | 是 | 财务 | 可先映射 `credit_transactions.notes` |

## 上线前字段确认结论

| 对象 | 当前结论 | 待客户确认 |
|------|----------|------------|
| Student | 已覆盖主档核心字段 | 家长电话、目标方向、标签字典、顾问范围 |
| Course | 已覆盖课程产品核心字段 | 价格口径、课时包与课程关系 |
| Class | 已覆盖班级与报名关系 | 转班、退班、容量规则 |
| Teacher | 已覆盖基础老师档案 | 可用时间维护方式、反馈率统计 |
| Schedule | 已覆盖基础排课 | 冲突规则、周期排课 |
| LessonRecord | 已覆盖反馈与消课 | 反馈模板、家长同步字段 |
| CreditTransaction | 已覆盖课时流水 | 是否拆独立订单表 |
| LeaveMakeup | 已有基础表 | 请假扣课规则和通知状态 |
| Homework | 当前简化在上课记录 | 是否 V1 独立建表 |
| Assessment | 未独立落库 | 是否纳入 V1 或 P1 |
| CompetitionProject | 未独立落库 | 建议 P2 |
| ParentReport | 已覆盖报告快照 | 模板和发送渠道 |
| Order | 当前可由课时流水承载 | 财务是否需要独立订单模型 |
