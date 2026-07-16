# Sprint 5-7 客户试用运行与首轮反馈收敛

日期：2026-07-16

## 1. 阶段目标

Sprint 5-7 用于正式承接客户 staging 试用，不继续扩展功能，重点是：

- 确认 staging 环境可交付给客户试用。
- 跟踪客户真实反馈。
- 只优先修复 P0 / P1 阻塞问题。
- 将 P2 / P3 体验问题和新需求沉淀到后续 Sprint。

## 2. 当前环境

- 前端：`https://lingshu-longrui-system.vercel.app`
- 后端：`https://astralink-backend-staging.onrender.com`
- 后端健康检查：`https://astralink-backend-staging.onrender.com/api/health`
- 当前本地分支：`codex-sprint-3`
- 当前基线提交：`92ef13823861cee7ff8e44f5c57e58d0d908d6ac`

## 3. 试用前 Smoke Test 结果

### 基础健康检查

| 检查项 | 结果 |
| --- | --- |
| Vercel 前端首页 | 200 |
| Render 后端 `/api/health` | 200 |
| 后端服务标识 | `astralink-backend` |

### 多机构登录与数据隔离

| 机构 | 管理员账号 | 登录 | 学员数量 | 课程数量 | 结论 |
| --- | --- | --- | --- | --- | --- |
| 朗睿教育 | `admin@longrui.com` | 200 | 10 | 9 | 通过 |
| 我来教育 | `admin@wolai.com` | 200 | 4 | 2 | 通过 |
| 广外留学 | `admin@guangwai.com` | 200 | 3 | 2 | 通过 |
| AmazingX | `admin@amazingx.com` | 200 | 3 | 2 | 通过 |

观察：

- 4 个机构的 `organizationId` 均不同。
- 学员和课程接口均按当前 token 返回机构内数据。
- 我来教育当前存在 4 个学生，其中 `刘雯倩` 判断为 staging 试用数据，不是跨机构混入。

### 核心业务 API

使用朗睿教育管理员账号验证：

| API | 状态 | 数量 |
| --- | --- | --- |
| `GET /api/schedules?startDate=2026-06-29&endDate=2026-07-05` | 200 | 9 |
| `GET /api/lesson-records` | 200 | 12 |
| `GET /api/credits/accounts` | 200 | 12 |
| `GET /api/credits/transactions` | 200 | 16 |
| `GET /api/leave-makeup` | 200 | 5 |
| `GET /api/reports` | 200 | 5 |
| `GET /api/import/batches` | 200 | 3 |

结论：教务主链、课时、请假补课、家长报告、导入批次查询可用。

### DeepSeek AI Agent

测试输入：

```text
哪些学生课时低于 5 小时？请生成家长提醒话术和顾问跟进
```

结果：

- `POST /api/ai/agent`：200。
- provider：`deepseek`。
- intent：`low_credit_students`。
- cards：2。
- proposedActions：2。
- 首个动作：`CREATE_PARENT_MESSAGE`，状态 `proposed`，风险 `low`。
- 确认动作：200。
- 确认后动作状态：`executed`。
- 执行结果：`parent_message_draft`。
- 生成 AI task：`023c662f-132b-4be5-b273-fcabb76c2644`。
- `GET /api/ai/tasks`：200，任务数量 9。

观察：

- DeepSeek 有返回业务提示 warning。
- DeepSeek 未稳定返回本地确认动作 schema 时，系统按安全规则生成确认动作卡片，这是预期保护逻辑。

### 权限 Smoke

| 检查项 | 结果 |
| --- | --- |
| `teacher@longrui.com` 登录 | 200 |
| 老师角色 | `teacher` |
| 老师访问 `/api/ai/tasks` | 200 |
| 老师任务数量 | 0 |

结论：老师账号可登录，AI 任务按权限范围隐藏。

## 4. 当前阻塞问题

暂无 P0 / P1 阻塞问题。

## 5. 当前非阻塞观察

1. Render 免费实例可能冷启动，首次访问慢。
2. DeepSeek 输出偶尔不完全符合本地动作 schema，当前已通过安全规则 fallback 保护。
3. staging 数据会随着试用操作变化，试用前如需固定演示状态，建议提前备份或重新执行 demo seed。
4. 我来教育已有额外试用学生 `刘雯倩`，不影响隔离，但演示时可说明 staging 数据会变化。

## 6. 客户反馈收集方式

客户填写：

- `docs/client-feedback-form.md`

项目组内部登记：

- `docs/trial-issue-log-template.md`

试用支持规则：

- `docs/sprint-5-6-trial-support-playbook.md`

## 7. 首轮反馈汇总模板

### P0 / P1 必须修复

| ID | 来源 | 问题 | 优先级 | 状态 | 负责人 | 目标修复时间 |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |

### P2 体验问题

| ID | 来源 | 问题 | 影响 | 建议处理 |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

### P3 后续需求

| ID | 来源 | 需求 | 业务价值 | 建议 Sprint |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## 8. Go / No-Go 判定

当前判定：可以启动客户 staging 试用。

试用期间若出现以下任一问题，应暂停试用并优先修复：

- 跨机构数据泄露。
- 核心账号无法登录。
- 学员、课程、排课、上课记录、消课任一主链路持续 500。
- AI Agent 绕过人工确认执行高风险动作。
- 家长报告或导出暴露内部敏感字段。

## 9. 下一步

1. 将 `docs/trial-guide.md`、`docs/staging-account-list.md`、`docs/demo-script.md`、`docs/client-feedback-form.md` 发给客户。
2. 客户开始 staging 试用。
3. 项目组用 `docs/trial-issue-log-template.md` 记录反馈。
4. 只修 P0 / P1，P2 / P3 进入需求池。
5. 首轮试用结束后，基于本文件补充真实反馈结论。

