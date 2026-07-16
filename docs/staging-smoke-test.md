# Astralink 灵枢 Staging Smoke Test

适用环境：

- 前端：`https://lingshu-longrui-system.vercel.app`
- 后端：`https://astralink-backend-staging.onrender.com`

建议每次 Render / Vercel 部署后执行。

## 1. 基础检查

- 打开 `https://astralink-backend-staging.onrender.com/api/health`，应返回 `status=ok`。
- 打开前端首页，应正常显示登录页。
- 使用 `admin@longrui.com / admin123` 登录。
- 左下角应显示朗睿教育管理员和朗睿教育。

## 2. 多机构隔离检查

分别登录：

- `admin@wolai.com / admin123`
- `admin@guangwai.com / admin123`
- `admin@amazingx.com / admin123`

检查：

- 学员管理只显示当前机构学生。
- 课程产品只显示当前机构课程。
- AI 教务助手只返回当前机构数据。

## 3. 教务主链冒烟

在朗睿教育管理员账号下检查：

1. 学员管理页面可打开。
2. 课程产品页面可打开。
3. 排课日历可加载当前周。
4. 上课记录列表可加载。
5. 订单课时可加载课时账户和流水。
6. 请假补课可加载申请。
7. 家长报告可加载报告列表。

不建议每次 smoke test 都新建大量数据；客户演示前可只打开已有数据确认链路正常。

## 4. AI Agent 冒烟

进入「AI 教务助手」，输入：

```text
哪些学生课时低于 5 小时？请生成家长提醒话术和顾问跟进
```

期望：

- 返回 `DeepSeek` 或 fallback 提示，但页面不能白屏。
- 出现低课时学生卡片。
- 出现待确认动作卡片。
- 点击「确认执行」后状态变为已执行。
- 执行结果中出现草稿内容。

进入「AI 任务中心」：

- 能看到刚生成的 AI 任务。
- 能按状态筛选。
- 能复制内容。
- 能标记完成或不采用。

## 5. 权限冒烟

使用 `teacher@longrui.com / teacher123` 登录：

- 老师不应看到「系统设置」。
- 老师不应看到「AI 任务中心」入口。
- 老师只能查看自己的排课和上课记录。

使用 `finance@longrui.com / finance123` 登录：

- 财务可查看订单课时和流水。
- 财务不应看到系统设置和 AI 任务中心入口。

## 6. 文件导入导出冒烟

进入「数据导入」：

- 下载学生模板应成功。
- 导入批次列表不应 404。
- 导出学生或课时流水应成功。

## 7. 常见失败判断

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| `/api/health` 失败 | Render 未启动或部署失败 | 查看 Render logs |
| AI 动作确认 500 | `ai_actions` 表未同步或 Prisma Client 旧 | 在 Render Shell 执行 `npm run backend:prisma:generate` 和 `npm run backend:prisma:push` |
| AI 任务中心为空 | 还没有确认过 AI 动作 | 先在 AI 助手确认一条动作 |
| 页面刷新 404 | Vercel rewrite 缺失 | 检查 `vercel.json` |
| 多机构数据一样 | 前端缓存或 AppContext 未刷新 | 退出登录、清缓存、重新登录；仍异常检查 token 和 API |

## 8. 发布判定

满足以下条件可认为 staging smoke test 通过：

- Health 正常。
- 管理员可登录。
- 多机构隔离正常。
- AI Agent 可生成确认动作。
- AI 任务中心可查看确认后的任务。
- 老师 / 财务权限不越界。
- 数据导入导出页面不报 404。
