# Astralink 灵枢 Staging 部署手册

目标部署组合：

- 前端：Vercel
- 后端：Render
- 数据库：Neon PostgreSQL

本手册基于当前项目真实结构整理，适用于 `codex-sprint-3` staging 部署。

## 1. 当前项目结构判断

### 前端

当前前端是 Vite + React。

相关文件：

- `vite.config.ts`
- `index.html`
- `src/`

部署配置：

- Build Command: `npm run build`
- Output Directory: `dist`
- Framework Preset: `Vite`
- Root Directory: 留空

前端 API 环境变量：

```env
VITE_API_BASE_URL="https://你的-render-backend-url.onrender.com/api"
```

当前代码读取位置：

- `src/services/apiClient.ts`
- `src/services/importExportService.ts`
- `src/services/config.ts`

### 后端

当前后端是 Express + TypeScript。

相关文件：

- 入口文件：`backend/src/server.ts`
- App 文件：`backend/src/app.ts`
- Prisma client：`backend/src/lib/prisma.ts`

当前 dev command：

```bash
npm run backend:dev
```

实际执行：

```bash
tsx backend/src/server.ts
```

当前项目暂未配置正式 production scripts：

- `backend:build`
- `backend:start`

Render staging 可先使用：

```bash
npm run backend:dev
```

后续建议补充：

```json
"backend:build": "tsc -p backend/tsconfig.json",
"backend:start": "node dist/backend/src/server.js"
```

`PORT` 已使用 `process.env.PORT ?? 4000`。

### 数据库

Prisma schema：

```text
backend/prisma/schema.prisma
```

Prisma config：

```text
prisma.config.ts
```

当前没有 migrations 目录，因此 staging 初始化建议使用：

```bash
npm run prisma:generate
npm run prisma:push
```

暂不使用：

```bash
npx prisma migrate deploy
```

seed 脚本：

```bash
npm run seed
npm run seed:demo-orgs
```

## 2. 当前部署相关 scripts

```json
{
  "dev": "vite --port=3000 --host=0.0.0.0",
  "backend:dev": "tsx backend/src/server.ts",
  "backend:typecheck": "tsc -p backend/tsconfig.json --noEmit",
  "backend:prisma:generate": "prisma generate --schema backend/prisma/schema.prisma",
  "backend:prisma:push": "prisma db push --schema backend/prisma/schema.prisma",
  "backend:seed": "tsx backend/prisma/seed.ts",
  "seed:demo-orgs": "tsx backend/prisma/seed-demo-orgs.ts",
  "prisma:generate": "prisma generate --schema backend/prisma/schema.prisma",
  "prisma:push": "prisma db push --schema backend/prisma/schema.prisma",
  "seed": "tsx backend/prisma/seed.ts",
  "check": "npm run lint && npm run backend:typecheck && npm run build",
  "build": "vite build",
  "lint": "tsc --noEmit"
}
```

## 3. Neon PostgreSQL 步骤

1. 打开 Neon：

```text
https://neon.tech
```

2. 注册或登录。
3. 点击 `New Project`。
4. Project name 建议：

```text
astralink-staging
```

5. Region 尽量选择和 Render 后端接近的区域。
6. 创建数据库。
7. 在 Neon 控制台复制 connection string。

推荐使用 pooled connection，适合 Render 这类托管环境。

DATABASE_URL 示例：

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST.neon.tech/DBNAME?sslmode=require"
```

注意：

- 保留 `sslmode=require`
- 不要把 `DATABASE_URL` 提交到 GitHub
- 不要写入仓库里的 `.env.example`

### 初始化 Neon 数据库

本地执行版：

```bash
DATABASE_URL="你的 Neon DATABASE_URL" npm run prisma:generate
DATABASE_URL="你的 Neon DATABASE_URL" npm run prisma:push
DATABASE_URL="你的 Neon DATABASE_URL" npm run seed
DATABASE_URL="你的 Neon DATABASE_URL" npm run seed:demo-orgs
```

Render Shell 执行版：

```bash
npm run prisma:generate
npm run prisma:push
npm run seed
npm run seed:demo-orgs
```

## 4. Render 后端部署步骤

1. 打开 Render：

```text
https://render.com
```

2. 登录。
3. 点击 `New +` -> `Web Service`。
4. 连接 GitHub。
5. 选择仓库：

```text
qc131-ai/lingshu-longrui-system
```

6. Branch 选择：

```text
codex-sprint-3
```

当前 staging 稳定节点在 `codex-sprint-3`。等 staging 验收稳定后，再考虑合并到 `main`。

Render 配置：

- Root Directory: 留空
- Environment: `Node`
- Build Command:

```bash
npm install && npm run prisma:generate && npm run backend:typecheck
```

- Start Command:

```bash
npm run backend:dev
```

- Health Check Path:

```text
/api/health
```

### Render 环境变量

```env
DATABASE_URL="你的 Neon DATABASE_URL"
JWT_SECRET="强随机字符串"
AUTH_TOKEN_SECRET="强随机字符串"
NODE_ENV="production"
APP_ENV="staging"
FRONTEND_URL="https://你的-vercel-url.vercel.app"
CORS_ORIGIN="https://你的-vercel-url.vercel.app"
AI_PROVIDER="mock"
OPENAI_API_KEY=""
GEMINI_API_KEY=""
```

`PORT` 通常由 Render 自动注入，不需要手动设置。

生成 JWT secret：

```bash
openssl rand -hex 32
```

Vercel URL 出来前，可以临时使用：

```env
FRONTEND_URL="http://localhost:3000"
CORS_ORIGIN="http://localhost:3000"
```

Vercel 部署完成后，再回 Render 更新为真实 Vercel URL 并重启服务。

## 5. Vercel 前端部署步骤

1. 打开 Vercel：

```text
https://vercel.com
```

2. 登录。
3. 点击 `Add New` -> `Project`。
4. Import GitHub repo：

```text
qc131-ai/lingshu-longrui-system
```

5. Branch 选择：

```text
codex-sprint-3
```

Vercel 配置：

- Framework Preset: `Vite`
- Root Directory: 留空
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`

Vercel 环境变量：

```env
VITE_API_BASE_URL="https://你的-render-backend-url.onrender.com/api"
```

不要填写 localhost。

错误示例：

```env
VITE_API_BASE_URL="http://localhost:4000/api"
```

正确示例：

```env
VITE_API_BASE_URL="https://astralink-staging.onrender.com/api"
```

## 6. 推荐部署顺序

1. 创建 Neon 数据库。
2. 复制 Neon `DATABASE_URL`。
3. 创建 Render Web Service。
4. Render 配置环境变量。
5. Render 部署后端。
6. 对 Neon 执行 Prisma 初始化：

```bash
npm run prisma:generate
npm run prisma:push
npm run seed
npm run seed:demo-orgs
```

7. 测试后端：

```text
https://你的-render-backend-url.onrender.com/api/health
```

8. 创建 Vercel Project。
9. Vercel 配置 `VITE_API_BASE_URL`。
10. Vercel 部署前端。
11. 将 Vercel URL 回填到 Render：

```env
FRONTEND_URL="https://你的-vercel-url.vercel.app"
CORS_ORIGIN="https://你的-vercel-url.vercel.app"
```

12. 重启 Render 后端。
13. 测试登录和多机构隔离。

## 7. Staging 验证清单

### 后端

```text
https://你的-render-backend-url.onrender.com/api/health
```

应返回：

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "astralink-backend"
  }
}
```

### 前端

打开：

```text
https://你的-vercel-url.vercel.app
```

确认：

- 页面不是白屏
- 登录页正常
- Console 没有 localhost API 请求

### 测试账号

```text
admin@longrui.com / admin123
admin@wolai.com / admin123
admin@guangwai.com / admin123
admin@amazingx.com / admin123
```

### 多机构隔离

我来教育：

- 陈一然
- 林思远
- 赵可欣

广外留学：

- 黄子墨
- 梁雨桐
- 何嘉宁

AmazingX：

- Eric Chen
- Sophia Liu
- Kevin Zhang

朗睿教育：

- 只显示朗睿教育 demo 数据

### 核心页面

逐个检查：

- 学员管理
- 课程产品
- 排课日历
- 上课记录
- 家长报告
- 数据导入
- AI 教务助手
- 系统设置

确认：

- 无白屏
- 无 404
- 无 500
- 数据属于当前机构

### 文件下载

验证：

- Excel 模板下载
- 学员导出
- 课程导出
- 课时流水导出

### 权限

验证：

- 老师不能进入系统设置 / 用户管理
- 财务不能操作教务设置
- 顾问只能看自己负责学生
- 未登录访问业务 API 返回 401

## 8. 常见错误排查

### Render build 失败

检查：

```bash
npm install
npm run prisma:generate
npm run backend:typecheck
```

如果提示 `tsx not found`，确认 Render 没有跳过 devDependencies。

### Prisma Client 没生成

执行：

```bash
npm run prisma:generate
```

并确保 Render Build Command 包含这一步。

### DATABASE_URL 错误

检查：

- Neon URL 是否完整
- 是否包含密码
- 是否包含 `sslmode=require`
- Render 环境变量是否保存

### CORS 报错

Render 设置：

```env
CORS_ORIGIN="https://你的-vercel-url.vercel.app"
FRONTEND_URL="https://你的-vercel-url.vercel.app"
```

保存后重启 Render 服务。

### Vercel 前端请求 localhost

检查 Vercel 环境变量：

```env
VITE_API_BASE_URL="https://你的-render-backend-url.onrender.com/api"
```

修改后重新部署 Vercel。

### 登录 401

排查：

- seed 是否执行
- 账号是否存在
- 密码是否正确
- 账号是否停用
- 浏览器是否有旧 token

建议清空 localStorage 后重新登录。

### `/api/health` 正常但业务接口 500

优先检查：

- `DATABASE_URL`
- Prisma schema 是否已 push
- seed 是否缺数据
- Render logs 中 Prisma 错误

### seed 后数据重复

建议：

- staging 初次初始化执行一次 seed
- 不要频繁重复执行
- 确认连接的是 staging Neon，不是本地或生产库

### 多机构数据看起来一样

排查：

1. 退出登录
2. 清空 localStorage / sessionStorage
3. hard refresh
4. 重新登录不同机构
5. 检查 Network 是否带 Authorization
6. 检查 `VITE_API_BASE_URL`
7. 检查 Render 是否部署最新 `codex-sprint-3`

### 文件导出失败

检查：

- `/api/export/students`
- `/api/export/courses`
- `/api/export/credit-transactions`
- token 是否带上
- CORS 是否允许请求
- Render logs 是否有 ExcelJS 错误

### Render 免费实例休眠

现象：

- 首次访问慢
- 登录等待较久

处理：

- 演示前提前打开 `/api/health` 预热

## 9. 手动操作清单

需要手动完成：

1. Neon 创建数据库
2. 复制 Neon `DATABASE_URL`
3. Render 创建 Web Service
4. Render 填环境变量
5. Render 部署后端
6. 在 Render Shell 或本地初始化 Neon 数据库
7. Vercel 创建前端项目
8. Vercel 填 `VITE_API_BASE_URL`
9. Vercel 部署前端
10. Vercel URL 回填 Render
11. 登录测试账号验证多机构隔离

## 10. 可复制命令

本地检查：

```bash
npm run check
```

初始化 Neon：

```bash
DATABASE_URL="你的 Neon DATABASE_URL" npm run prisma:generate
DATABASE_URL="你的 Neon DATABASE_URL" npm run prisma:push
DATABASE_URL="你的 Neon DATABASE_URL" npm run seed
DATABASE_URL="你的 Neon DATABASE_URL" npm run seed:demo-orgs
```

Render Shell 初始化：

```bash
npm run prisma:generate
npm run prisma:push
npm run seed
npm run seed:demo-orgs
```

生成密钥：

```bash
openssl rand -hex 32
```

后端 health：

```bash
curl https://你的-render-backend-url.onrender.com/api/health
```

