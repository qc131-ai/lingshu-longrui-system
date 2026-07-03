# Deployment Guide

## 推荐部署结构

- 前端：Vercel、Netlify、静态托管或 Nginx。
- 后端：Render、Railway、VPS、Docker 或 Node.js 进程管理器。
- 数据库：PostgreSQL 15+，建议托管数据库并开启自动备份。

## 环境变量

后端：

```env
DATABASE_URL="postgresql://user:password@host:5432/astralink_jiaowu?schema=public"
PORT=4000
NODE_ENV="production"
APP_ENV="staging"
FRONTEND_URL="https://your-frontend.example.com"
CORS_ORIGIN="https://your-frontend.example.com"
JWT_SECRET="replace-with-long-random-secret"
AUTH_TOKEN_SECRET="replace-with-long-random-secret"
OPENAI_API_KEY=""
GEMINI_API_KEY=""
```

前端：

```env
VITE_API_BASE_URL="https://your-backend.example.com/api"
VITE_API_PROXY_TARGET="https://your-backend.example.com"
```

Sprint 4 当前 AI 为规则型 / Mock AI，不强制配置真实 AI API Key。

## 数据库初始化

本地试用或 staging 可使用：

```bash
npm install
npm run prisma:generate
npm run prisma:push
npm run seed
```

生产环境建议使用正式 migration 流程；当前仓库 MVP 阶段以 `prisma db push` 作为本地和 staging 同步方式。

## 前端 API 地址

- 本地开发：`VITE_API_BASE_URL=http://localhost:3000/api`，通过 Vite proxy 转发到后端。
- 静态部署：`VITE_API_BASE_URL=https://backend-domain/api`。
- 如果前端和后端不同域名，必须正确设置后端 `CORS_ORIGIN`。

## CORS 配置

`CORS_ORIGIN` 支持逗号分隔：

```env
CORS_ORIGIN="https://staging.example.com,https://demo.example.com"
```

生产环境不要使用宽泛的 `*`。

## 生产安全注意事项

- `JWT_SECRET` / `AUTH_TOKEN_SECRET` 必须更换为高强度随机值。
- 不要提交 `.env`。
- 不要在生产环境使用测试密码。
- 用户新建和重置密码已使用 hash 存储；老 seed 账号仅用于演示。
- 数据库必须配置备份和恢复演练。
- 日志不要输出密码、token、家长报告内部备注、财务敏感字段。
- 家长报告和 AI 生成内容不得暴露 `internalNotes`、`operation_logs` 或跨机构数据。

## 试用环境建议

- 使用 staging 环境。
- 使用 demo organization：朗睿教育。
- 保留 5 个 demo accounts：
  - `admin@longrui.com / admin123`
  - `academic@longrui.com / academic123`
  - `advisor@longrui.com / advisor123`
  - `teacher@longrui.com / teacher123`
  - `finance@longrui.com / finance123`
- 执行 `npm run seed` 重置演示数据。
- 试用前运行 `docs/release-checklist.md` 中的检查项。
