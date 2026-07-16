# Release Checklist

## 当前 Staging 环境

- 前端：`https://lingshu-longrui-system.vercel.app`
- 后端：`https://astralink-backend-staging.onrender.com`
- Health：`https://astralink-backend-staging.onrender.com/api/health`
- 数据库：Neon PostgreSQL

这是 staging 测试环境。默认测试账号仅用于 staging / 演示，生产环境必须更换密码。Render 免费实例可能会休眠，首次访问较慢属于可接受现象。

## 工程检查

- [ ] `npm run lint`
- [ ] `npm run backend:typecheck`
- [ ] `npm run build`
- [ ] `npm run check`
- [ ] 后端可启动：`npm run backend:dev`
- [ ] 前端可启动：`npm run dev`
- [ ] 后端健康检查：`GET /api/health`
- [ ] 前端代理健康检查：`GET http://localhost:3000/api/health`

## 数据库检查

- [ ] Prisma schema 与数据库同步。
- [ ] `npm run prisma:generate` 成功。
- [ ] `npm run prisma:push` 或正式 migration 成功。
- [ ] `npm run seed` 成功。
- [ ] demo 数据包含学生、课程、老师、班级、排课、上课记录、课时账户、课时流水、请假补课、家长报告、AI 查询样本。
- [ ] 低课时学生、未提交反馈老师、待审批请假补课、待发送家长报告、高风险学生均可查询。

## 账号检查

- [ ] `admin@longrui.com / admin123` 可登录。
- [ ] `academic@longrui.com / academic123` 可登录。
- [ ] `advisor@longrui.com / advisor123` 可登录。
- [ ] `teacher@longrui.com / teacher123` 可登录。
- [ ] `finance@longrui.com / finance123` 可登录。
- [ ] 停用账号不能登录。
- [ ] 权限菜单正确。
- [ ] 越权 API 返回 403 或按数据范围隐藏为 404。

## 权限检查

- [ ] 管理员可以访问全部模块和系统设置。
- [ ] 教务主管可以查看系统设置和教务数据，但不能管理管理员账号。
- [ ] 顾问只能查看负责学员相关数据。
- [ ] 老师只能查看本人排课和上课记录。
- [ ] 财务只能访问订单课时、课时流水和授权导出。
- [ ] 老师 / 顾问不能访问导入批次管理。

## 主链路检查

- [ ] 新增学员。
- [ ] 新建课程。
- [ ] 新建老师。
- [ ] 新建排课。
- [ ] 从排课生成上课记录。
- [ ] 提交老师反馈。
- [ ] 确认消课。
- [ ] 查看课时流水。
- [ ] 创建、审批、安排请假补课。
- [ ] 生成、编辑、发送家长报告。
- [ ] AI 助手真实数据查询。
- [ ] AI 续费建议、家长话术、报告润色、风险总结。
- [ ] DeepSeek AI Agent 可生成确认动作卡片。
- [ ] 确认 AI 动作后生成 `ai_tasks` 草稿记录。
- [ ] AI 任务中心可查看、复制、筛选、标记状态。
- [ ] Excel 数据导入导出。
- [ ] 系统设置保存后刷新仍保留。
- [ ] 新增用户、停用用户、重置密码。

## AI 功能检查

- [ ] AI 教务助手可查询低课时学生。
- [ ] AI 教务助手可查询未提交反馈老师。
- [ ] AI 教务助手可查询今日 / 本周待办。
- [ ] AI 教务助手可查询待处理请假补课。
- [ ] AI 教务助手可查询待发送家长报告。
- [ ] AI 教务助手可查询高风险学生。
- [ ] 可生成续费建议。
- [ ] 可生成家长沟通话术。
- [ ] 可润色家长报告。
- [ ] 可生成学生风险总结。
- [ ] AI Agent 查询低课时学生后可生成 `CREATE_PARENT_MESSAGE` / `CREATE_ADVISOR_FOLLOW_UP`。
- [ ] AI Agent 动作必须人工点击确认后才执行。
- [ ] AI Agent 重复确认返回 `409`。
- [ ] AI Agent 老师账号确认动作返回 `403` 或不泄露资源存在。
- [ ] AI 任务中心 `/ai-tasks` 管理员、教务主管、顾问可见。
- [ ] AI 任务中心老师、财务无导航入口。
- [ ] AI 任务中心状态筛选和复制内容可用。

## 导入导出检查

- [ ] 数据导入页面打开不报错。
- [ ] 下载学生模板成功。
- [ ] 上传包含有效数据的 Excel 可预览。
- [ ] 确认导入成功。
- [ ] 导入批次列表按角色权限过滤。
- [ ] 导出课时流水成功。

## 系统设置检查

- [ ] 登录页显示 5 个测试账号和一键填入。
- [ ] 登录失败可区分账号不存在、密码错误、账号停用、后端未连接。
- [ ] 修改机构信息后刷新仍保留。
- [ ] 修改低课时阈值后保存成功。
- [ ] 权限矩阵展示管理员、教务主管、顾问、老师、财务。

## 安全检查

- [ ] `.env` 未提交。
- [ ] `JWT_SECRET` / `AUTH_TOKEN_SECRET` 已配置为非默认值。
- [ ] 所有核心查询按 `organizationId` 隔离。
- [ ] 前端不传 `organizationId`。
- [ ] `internalNotes` 不外泄。
- [ ] 家长报告不包含内部字段。
- [ ] AI 生成内容不包含 `operation_logs`、密码、token 或跨机构数据。
- [ ] AI 不允许删除数据、扣课时、发送报告、重置密码、修改权限、导出数据。
- [ ] 生产环境不使用测试密码。

## 部署检查

- [ ] `.env.example` 中 staging 所需变量完整。
- [ ] `VITE_API_BASE_URL` 指向正确后端 `/api`。
- [ ] 当前 staging 前端 `VITE_API_BASE_URL=https://astralink-backend-staging.onrender.com/api`。
- [ ] `CORS_ORIGIN` 只包含允许访问的前端域名。
- [ ] 当前 staging 后端 `CORS_ORIGIN` / `FRONTEND_URL` 指向 `https://lingshu-longrui-system.vercel.app`。
- [ ] Vercel 已配置 SPA rewrite，直接刷新 `/students`、`/courses`、`/schedules` 等子路由不返回 404。
- [ ] `NODE_ENV` / `APP_ENV` 与部署环境一致。
- [ ] PostgreSQL 连接使用托管 staging / production 数据库。
- [ ] Prisma generate / push 或 migrate 已执行。
- [ ] staging 已执行 seed，production 未执行 demo seed。
- [ ] `docs/demo-script.md`、`docs/trial-guide.md`、`docs/ai-agent-demo-guide.md`、`docs/trial-feedback-form.md` 已准备好。

## 客户试用支持检查

- [ ] 已准备 `docs/sprint-5-6-trial-support-playbook.md`。
- [ ] 已准备 `docs/trial-issue-log-template.md`。
- [ ] 已明确 P0 / P1 / P2 / P3 分级规则。
- [ ] 已明确客户反馈登记、复现、修复、复测流程。
- [ ] 已明确试用 Go / No-Go 标准。
- [ ] 已明确试用期间不扩展大功能、不重做 UI、不让 AI 自动执行高风险动作。
