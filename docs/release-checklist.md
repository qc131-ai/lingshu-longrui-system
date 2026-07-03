# Release Checklist

## 工程检查

- [ ] `npm run lint`
- [ ] `npm run backend:typecheck`
- [ ] `npm run build`
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
- [ ] Excel 数据导入导出。
- [ ] 系统设置保存后刷新仍保留。
- [ ] 新增用户、停用用户、重置密码。

## 安全检查

- [ ] `.env` 未提交。
- [ ] `JWT_SECRET` / `AUTH_TOKEN_SECRET` 已配置为非默认值。
- [ ] 所有核心查询按 `organizationId` 隔离。
- [ ] 前端不传 `organizationId`。
- [ ] `internalNotes` 不外泄。
- [ ] 家长报告不包含内部字段。
- [ ] AI 生成内容不包含 `operation_logs`、密码、token 或跨机构数据。
- [ ] 生产环境不使用测试密码。
