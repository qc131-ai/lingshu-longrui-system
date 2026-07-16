# Sprint 5-5 客户试用交付准备与稳定性硬化报告

日期：2026-07-16

## 版本信息

- 分支：`codex-sprint-3`
- 当前提交：`2e1308c734c45f7cd2431ebc46ad790d8bbf5157`
- 前端 staging：`https://lingshu-longrui-system.vercel.app`
- 后端 staging：`https://astralink-backend-staging.onrender.com`
- 数据库：Neon PostgreSQL
- 最近稳定 tag：`v0.5.4-trial-ai-agent-docs`

## 本地工程检查

已运行：

```bash
git status --short
npm run backend:typecheck
npm run lint
npm run build
```

结果：

- 工作区开始检查时为 clean。
- `backend:typecheck` 通过。
- `lint` 通过。
- `build` 通过。
- Vite build 有 chunk size warning，属于现阶段非阻塞项。

## Staging 健康检查

- Render 后端 `GET /api/health`：200，返回 `astralink-backend` 正常状态。
- Vercel 前端首页：200，HTML 正常返回。
- Vercel `/api/health`：200，但返回前端 HTML，不是后端 JSON。当前 staging 前端应通过 `VITE_API_BASE_URL` 直连 Render API，此项记录为非阻塞观察。

## 登录与多机构隔离

已验证 4 个管理员账号均可登录，且 `organizationId` 不同：

| 机构 | 账号 | organizationId | 学员结果 | 课程结果 |
| --- | --- | --- | --- | --- |
| 朗睿教育 | `admin@longrui.com` | `01000000-0000-0000-0000-000000000001` | 10 条 | 9 条 |
| 我来教育 | `admin@wolai.com` | `ef65a677-d9be-7180-5778-7334d2324a59` | 4 条 | 2 条 |
| 广外留学 | `admin@guangwai.com` | `a5a82c1b-9e4b-0f4e-308f-f7c68eb20c7c` | 3 条 | 2 条 |
| AmazingX | `admin@amazingx.com` | `2f352078-f5e2-63ac-eb82-5df8e9e61409` | 3 条 | 2 条 |

隔离结论：

- `/api/students` 按当前 token 的机构返回数据。
- `/api/courses` 按当前 token 的机构返回数据。
- 我来教育当前有 4 个学生，其中多出的 `刘雯倩` 判断为 staging 真实试用/导入数据，不是其他机构数据混入。

## 核心业务 API Smoke Test

使用朗睿教育管理员 token 验证：

| API | 状态 | 结果数量 |
| --- | --- | --- |
| `GET /api/schedules?startDate=2026-06-29&endDate=2026-07-05` | 200 | 9 |
| `GET /api/lesson-records` | 200 | 12 |
| `GET /api/credits/accounts` | 200 | 12 |
| `GET /api/credits/transactions` | 200 | 16 |
| `GET /api/leave-makeup` | 200 | 5 |
| `GET /api/reports` | 200 | 5 |
| `GET /api/import/batches` | 200 | 3 |

结论：

- 教务主链核心查询可用。
- 课时账户、流水、请假补课、家长报告、导入批次均能在 staging 返回真实数据。

## DeepSeek AI Agent Smoke Test

测试问题：

```text
哪些学生课时低于 5 小时？请生成家长提醒话术和顾问跟进
```

结果：

- `POST /api/ai/agent`：200。
- provider：`deepseek`。
- intent：`low_credit_students`。
- cards：4。
- proposedActions：2。
- 首个动作：`CREATE_PARENT_MESSAGE`，状态 `proposed`，风险 `low`。
- 确认动作：`POST /api/ai/agent/actions/:id/confirm` 返回 200。
- 确认后动作状态：`executed`。
- execution result：`parent_message_draft`。
- 已生成 AI task：`ebe2d1aa-eb5f-4673-a2d5-36554ee785cc`。
- `GET /api/ai/tasks`：200，任务中心可查询到最新任务。

观察：

- DeepSeek 没有稳定返回完全符合本地 schema 的 `proposedActions` 时，后端已触发安全降级，用规则动作生成待确认卡片。
- 这是预期保护逻辑，主流程不失败。
- AI Agent 已达到 staging demo 标准，但仍应定位为“确认后执行的辅助 Agent”，不是完全自动执行系统。

## AI 权限隔离

已验证：

- 老师账号 `teacher@longrui.com` 可登录。
- 老师访问 `GET /api/ai/tasks` 返回 200，自己的任务列表为空。
- 老师尝试更新管理员 AI task，返回 404 `AI task not found`。

结论：

- AI task 当前按组织和可见范围隔离。
- 普通老师不能操作管理员生成的 AI task。

## 阻塞问题

当前未发现阻塞客户 staging 试用的问题。

## 非阻塞问题

1. Vercel `/api/health` 返回前端 HTML，不是后端 JSON。若需要前端域名下也支持 `/api/health` 代理，需要后续补充 rewrite；当前前端业务请求可通过 `VITE_API_BASE_URL` 直连 Render，不阻塞。
2. Vite build 存在 chunk size warning。当前不影响功能，但正式生产前建议评估 lazy loading。
3. DeepSeek 输出偶尔不完全符合动作 schema，当前后端会安全降级到规则动作。可继续保留，后续再提升 prompt 和 schema 稳定性。
4. staging demo 数据会随试用操作变化，客户试用前建议保留一套可重复恢复的 demo seed/备份流程。
5. Render 免费实例可能冷启动，首次访问慢属于部署层体验问题。

## 客户试用建议

可进入客户试用，但建议以 staging 试用方式开放，并提前说明：

- 账号仅用于 staging，不用于生产。
- AI 生成内容需人工确认后使用。
- AI Agent 目前只执行低风险确认动作，例如生成话术、跟进任务、请假补课说明。
- 不建议客户在 staging 中录入真实敏感数据。
- 若需要多轮客户演示，建议每轮演示前检查 demo 数据状态。

## 下一步建议

建议下一阶段命名：

`Sprint 5-6：客户试用支持与反馈收敛`

优先目标：

1. 建立客户试用问题记录表。
2. 将 staging 反馈分为阻塞、体验、需求、后续商业化四类。
3. 只修复影响登录、权限、主链路、AI Agent 可用性的高优先级问题。
4. 暂不扩展复杂新功能，避免试用前引入不稳定因素。

## 结论

当前版本可以进入客户 staging 试用。
