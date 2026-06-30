# AGENTS.md

## Project Role

This repository is the local Codex app workspace for Astralink 教务管理. The Codex app local project is the primary development environment.

Do not rebuild or redesign the UI unless the user explicitly asks for it. Keep existing pages, layouts, components, interaction patterns, and visual style intact. Prefer narrow fixes that preserve the current product surface.

## Tech Stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS, React Router, lucide-react, react-hot-toast, date-fns, Recharts
- Backend: Node.js, Express, TypeScript, tsx
- Database: PostgreSQL
- ORM: Prisma 7 with `@prisma/adapter-pg`
- Validation: Zod

## Branches

- `main` is the stable branch.
- `codex-sprint-3` is the current active development branch.
- GitHub `codex-sprint-3` is used for backup and synchronization. Do not use Codex Web unless opening a PR or running an async task is explicitly needed.

## Local Startup

Run commands from the project root:

```bash
npm run dev
```

Frontend runs on:

```text
http://localhost:3000
```

```bash
npm run backend:dev
```

Backend runs on:

```text
http://localhost:4000
```

Useful checks:

```bash
curl http://localhost:4000/api/health
```

## Data Isolation

All tenant data must be isolated by `organization_id`.

The backend must read `organizationId` from the authenticated token or backend auth context. The frontend must not send `organizationId` in request bodies or query strings for ordinary business operations.

Every backend list, read, create, update, delete, import, export, and reporting query must be scoped to the current user's `organizationId`.

## Sprint 3 Scope

Sprint 3 focuses on stabilizing:

- 排课
- 上课记录
- 确认消课
- 课时流水

Keep changes aligned with these workflows unless the user explicitly expands the scope.

## Schedule Room Handling

For schedule creation and updates:

- Only send `roomId` when it is a real PostgreSQL UUID from the `Room` table.
- Do not send mock room ids such as `room-1`, `room-2`, or `room-3` as `roomId`.
- If the UI only has a classroom label, send `classroom` text, for example `Room 301`.
- Backend code must ignore missing, empty, null, or non-UUID `roomId` values and must not query Prisma `Room` with them.
- Invalid `roomId` values should not cause `500 Internal server error`.
- Schedules may store classroom text without a real Room relation for the current MVP.

## Required Verification

After modifying code, run all of:

```bash
npm run lint
npm run backend:typecheck
npm run build
```

If a database schema change is made, also run the appropriate Prisma command for the local workflow, normally:

```bash
npm run backend:prisma:generate
npm run backend:prisma:push
```

Report any command that was not run or did not pass.
