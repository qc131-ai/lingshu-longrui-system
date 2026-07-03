<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/a33c9ee7-0a47-4abf-b404-57fa84f5b4d6

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Astralink 本地前后端联调

前端 service 已逐步接入真实后端 API，目前学员、课程、班级、老师、排课等核心 service 会优先请求真实 API，失败时自动回退到本地 mock 数据并显示错误提示。

### 环境变量

复制 `.env.example` 为 `.env`，并按本地 PostgreSQL 配置修改：

```env
DATABASE_URL="postgresql://postgres:10202312@localhost:5432/astralink_jiaowu?schema=public"
PORT=4000
CORS_ORIGIN="http://localhost:3000,http://127.0.0.1:3000"
VITE_API_BASE_URL="http://localhost:3000/api"
VITE_API_PROXY_TARGET="http://localhost:4000"
APP_ENV="staging"
AUTH_TOKEN_SECRET="replace-with-staging-secret"
```

### 后端

```bash
npm run backend:prisma:push
npm run backend:seed
npm run backend:dev
```

后端默认监听 `http://localhost:4000`。

### 前端

```bash
npm run dev
```

前端默认监听 `http://localhost:3000`。浏览器请求 `http://localhost:3000/api` 时会通过 Vite proxy 转发到 `http://localhost:4000`。

### 已切换到真实 API 的模块

- 学员管理：列表、详情、新增、编辑
- 课程产品：列表、详情、新增、编辑、删除、分类/授课方式/状态筛选
- 班级管理：列表、详情、新建、编辑、删除、添加/移除学生
- 老师中心：列表、详情、新增、编辑、删除；老师角色仅查看和编辑自己资料
- 排课日历：列表、新建、取消/状态更新

## Staging 产品化能力

当前 staging 版本在 MVP 基础上新增：

- 基础登录系统：`POST /api/auth/login`、`GET /api/auth/me`
- 角色权限：管理员、教务主管、顾问、老师、财务
- 前端按角色动态显示导航菜单和关键操作按钮
- 后端核心 API 基础权限校验
- 核心业务表已增加 `organization_id`，seed 默认机构为「朗睿教育测试机构」
- 操作日志 `operation_logs`：记录新增学员、排课、消课、课时调整、发送报告等关键操作
- 文件上传 `POST /api/files/upload`：支持学生材料、作业附件、竞赛证书、合同、报告文件
- 客户试用 seed 数据：30 个学生、10 位老师、15 门课程、5 个班级、30 条排课、20 条上课记录、10 条请假补课、20 条课时流水、5 份家长报告、5 条 AI 教务提醒

## V1.0 正式版 P0 能力

当前 V1.0 冲刺版本在 staging 基础上补齐以下 P0 后端与前端服务能力：

- 多角色登录、组织隔离 `organization_id`、顾问/老师数据范围过滤
- RBAC 基础表：`roles`、`permissions`、`user_roles`、`role_permissions`
- 学员、课程、班级、老师、排课、上课记录、课时、请假补课、家长报告核心 API
- 排课老师/教室基础冲突拦截
- 确认消课自动扣减课时并生成 `credit_transactions`
- 核心写操作记录 `operation_logs`
- Excel 导入预览、确认导入、批次回滚、Excel 导出
- 前端核心 service 优先请求真实 API，失败时回退 mock，保留 loading/success/error 状态

### V1 Sprint 2 基础业务模块

Sprint 2 只覆盖四个基础业务模块，不包含排课、消课、家长报告、AI 助手等后续模块的新功能：

- 学员管理：`POST/GET/GET:id/PUT/DELETE /api/students`，所有数据带 `organization_id`，顾问仅能查看和维护自己负责的学员。
- 课程产品：`POST/GET/GET:id/PUT/DELETE /api/courses`，支持 `category`、`teachingMode`、`status` 筛选，字段包含课程名称、类别、授课方式、总课时、价格、适用年级、负责老师、状态、描述和大纲。
- 班级管理：`POST/GET/GET:id/PUT/DELETE /api/classes`，支持 `POST /api/classes/:id/students` 和 `DELETE /api/classes/:id/students/:studentId` 维护学生名单。
- 老师中心：`POST/GET/GET:id/PUT/DELETE /api/teachers`，管理员和教务主管可管理机构内全部老师，老师角色只能查看和编辑自己的基础资料。

以上写操作都会写入 `operation_logs`，前端页面保留原视觉风格，仅补充必要的新增、编辑、删除、刷新和基础校验交互。

### 测试账号

| 角色 | 邮箱 | 密码 |
|------|------|------|
| 管理员 | `admin@longrui.com` | `admin123` |
| 教务主管 | `academic@longrui.com` | `academic123` |
| 顾问 | `advisor@longrui.com` | `advisor123` |
| 老师 | `teacher@longrui.com` | `teacher123` |
| 财务 | `finance@longrui.com` | `finance123` |

登录成功后前端会保存 token 到本地，并自动进入首页看板；退出登录会调用 `POST /api/auth/logout` 后清理本地登录态。

### 完整启动顺序

```bash
npm install
npm run backend:prisma:push
npm run backend:seed
npm run backend:dev
```

另开终端启动前端：

```bash
npm run dev
```

访问 `http://localhost:3000`，使用上方任一测试账号登录。

### Excel 导入导出接口

Sprint 4-2 提供 V1 可用的数据迁移能力：模板下载、Excel 预览校验、确认写入、批次回滚和导出。

下载模板：

```bash
curl -L http://localhost:4000/api/import/templates/students \
  -H "Authorization: Bearer <token>" \
  -o students-template.xlsx
```

上传预览：

```bash
curl -X POST http://localhost:4000/api/import/preview \
  -H "Authorization: Bearer <token>" \
  -F "type=students" \
  -F "file=@students.xlsx"
```

确认导入：

```bash
curl -X POST http://localhost:4000/api/import/confirm/<batch-id> \
  -H "Authorization: Bearer <token>"
```

查看批次 / 回滚：

```bash
curl http://localhost:4000/api/import/batches \
  -H "Authorization: Bearer <token>"

curl -X POST http://localhost:4000/api/import/batches/<batch-id>/rollback \
  -H "Authorization: Bearer <token>"
```

导出：

```bash
curl -L http://localhost:4000/api/export/students \
  -H "Authorization: Bearer <token>" \
  -o students.xlsx
```

支持导入类型：`students`、`courses`、`teachers`、`classes`、`credit-balances`、`schedules`、`lesson-records`。

支持导出类型：`students`、`courses`、`teachers`、`classes`、`credit-accounts`、`credit-transactions`、`schedules`、`lesson-records`、`leave-makeup`、`parent-reports`。

本地页面入口：`/data-import`。所有接口由后端从 token 读取 `organizationId`，前端不要传 `organizationId`。

### AI 续费建议与家长沟通话术

Sprint 4-3 在 AI 教务助手中增加规则型内容生成能力。当前阶段不接真实 OpenAI API，也不调用外部大模型；后端基于真实数据库数据生成结构化建议，后续可替换为真实 AI API。

接口：

- `POST /api/ai/generate-renewal-suggestion`：生成续费建议。请求字段：`studentId`、`courseId?`、`tone?`、`includeParentMessage?`；返回 `studentSummary`、`creditSummary`、`riskLevel`、`renewalSuggestion`、`parentMessage`、`advisorTalkingPoints`、`nextActions`。
- `POST /api/ai/generate-parent-message`：生成家长沟通话术。请求字段：`studentId`、`scenario`、`courseId?`、`tone?`；`scenario` 支持 `low_credit_reminder`、`progress_update`、`makeup_notice`、`renewal_followup`、`report_delivery`、`risk_followup`。
- `POST /api/ai/polish-report`：润色家长报告。请求字段：`reportId`、`tone?`；返回原摘要、润色摘要、家长可见内容和下一步计划。
- `POST /api/ai/student-risk-summary`：生成学生风险总结。请求字段：`studentId`、`periodStart?`、`periodEnd?`；返回风险等级、风险原因、证据、建议动作和顾问话术。

数据来源：`students`、`credit_accounts`、`lesson_records`、`leave_makeup_requests`、`parent_reports`。所有接口由后端从 token 读取 `organizationId`，前端不要传 `organizationId`；返回内容不得暴露 `internalNotes`、`operation_logs` 或跨机构数据。

权限规则：管理员和教务主管可使用全部生成功能；顾问只能为自己负责学生生成续费建议和家长话术；老师不能生成续费建议；财务不能生成家长沟通话术和报告润色。

### Staging 部署方式

1. 准备 PostgreSQL 15+ 数据库。
2. 配置后端环境变量：

```env
DATABASE_URL="postgresql://<user>:<password>@<host>:5432/astralink_jiaowu?schema=public"
PORT=4000
APP_ENV="staging"
AUTH_TOKEN_SECRET="<replace-with-random-secret>"
CORS_ORIGIN="https://<frontend-domain>"
```

3. 配置前端环境变量：

```env
VITE_API_BASE_URL="https://<frontend-domain>/api"
VITE_API_PROXY_TARGET="https://<backend-domain>"
```

4. 初始化数据库与演示数据：

```bash
npm run backend:prisma:push
npm run backend:seed
```

5. 启动后端：

```bash
npm run backend:dev
```

6. 构建前端：

```bash
npm run build
```

生产部署可将 `dist/` 托管到静态站点服务，将 `/api` 反向代理至后端服务。

### 核心演示流程

1. 使用管理员账号登录，查看首页提醒和侧边栏完整菜单。
2. 进入「学员管理」，查看 30 个学生，并新增一个试用学员。
3. 进入「排课日历」，创建一条排课并确认日历刷新。
4. 进入「上课记录」，打开记录详情，生成 AI 反馈并确认消课。
5. 进入「订单课时」，查看课时流水和低课时预警。
6. 进入「家长报告」，生成 AI 摘要并模拟发送给家长。
7. 进入「AI 教务助手」，提问「哪些学生课时低于 5 小时？」。
8. 切换顾问、老师、财务账号，展示不同角色菜单和权限差异。

### 常见问题排查

| 问题 | 处理方式 |
|------|----------|
| 登录失败 | 确认已运行 `npm run backend:seed`，并使用 README 中测试账号 |
| 前端请求 404 | 确认 `VITE_API_BASE_URL=http://localhost:3000/api`，且 Vite proxy 指向 `http://localhost:4000` |
| 后端无法连接数据库 | 检查 `.env` 中 `DATABASE_URL`、PostgreSQL 端口和密码 |
| Prisma push 提示 schema 不一致 | 本地试用库可重新运行 `npm run backend:prisma:push` 后 `npm run backend:seed` |
| 角色看不到某页面 | 这是预期权限控制，可切换管理员账号查看全部页面 |
| 文件上传失败 | 检查是否使用 `multipart/form-data`，字段名必须为 `file` |

### 文件上传示例

```bash
curl -X POST http://localhost:4000/api/files/upload \
  -H "Authorization: Bearer <token>" \
  -F "category=student_material" \
  -F "studentId=<student-id>" \
  -F "file=@/path/to/file.pdf"
```
