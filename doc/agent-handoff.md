# Codex 接手说明

本项目是 `personal-web` 个人网站 monorepo，使用 pnpm workspace 管理。

## 项目结构

- `apps/web`：前台站点，Vue 3 + Vite，默认端口 `5173`。
- `apps/admin`：后台管理，Vue 3 + Vite + Element Plus，默认端口 `5174`。
- `apps/api`：NestJS + Prisma + MySQL API，默认端口 `3000`，接口前缀 `/api`。
- `doc/tasks`：任务拆分与完成状态。
- `e2e`：Playwright 冒烟测试。
- `scripts/run-e2e.mjs`：本地启动 web/admin 并运行 E2E 的脚本，E2E 使用 mock API。

## 常用命令

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
pnpm dev
```

API Prisma 常用命令：

```powershell
pnpm --filter @yuer/api prisma:validate
pnpm --filter @yuer/api prisma:generate
pnpm --filter @yuer/api prisma:migrate
pnpm --filter @yuer/api prisma:seed
```

## 环境文件

本地环境文件为仓库根目录 `.env`，不会提交到 Git。

关键变量：

```env
DATABASE_URL=mysql://yuer:123456@127.0.0.1:3306/yuer
ADMIN_INITIAL_USERNAME=admin
ADMIN_INITIAL_PASSWORD=admin123
JWT_SECRET=replace-with-a-long-random-secret
UPLOAD_DIR=uploads
PUBLIC_UPLOAD_BASE_URL=/uploads
```

生产或公开预览前应修改：

- `JWT_SECRET`
- `ADMIN_INITIAL_PASSWORD`

## 数据库初始化注意事项

Prisma Migrate 在 `migrate dev` 时需要创建 shadow database。若 MySQL 用户没有创建数据库权限，会报：

```text
P3014 Prisma Migrate could not create the shadow database
P1010 User was denied access on the database prisma_migrate_shadow_db_...
```

此时 `prisma:seed` 也会失败，因为迁移没有成功执行，真实数据库中不存在 `admins` 等业务表。

处理方式：

1. 给当前 MySQL 用户授予创建 shadow database 的权限；或
2. 在 Prisma datasource 中配置固定 `SHADOW_DATABASE_URL`，并提前创建 shadow 数据库。

本地开发推荐简单方式：使用 MySQL root 执行授权后，重新运行 `prisma:migrate`，成功后再运行 `prisma:seed`。

## Git / 忽略规则

已忽略：

- `.env`
- `node_modules/`
- `.pnpm-store/`
- `.codex/`
- `.agents/`
- `.codex-logs/`
- `test-results/`
- `tmp-dev-logs/`
- `uploads/`
- `*.log`

不要把本地依赖、运行日志、上传目录、Codex/agent 缓存提交到仓库。
