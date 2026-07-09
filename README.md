# Yuer Personal Web

「语尔」个人网站第一版，包含前台站点、后台管理系统和 NestJS API。

- `apps/web`: Vue 3 + TypeScript + Vite 前台站点，默认端口 `5173`
- `apps/admin`: Vue 3 + TypeScript + Vite + Element Plus 后台，默认端口 `5174`
- `apps/api`: NestJS + Prisma + MySQL API，默认端口 `3000`，接口统一前缀 `/api`

## 环境要求

建议使用 Node.js 20 LTS 或更新版本，并通过 Corepack 启用 pnpm：

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm --version
```

本地开发还需要 MySQL 8。

## 安装依赖

```bash
pnpm install
```

## 配置环境变量

复制 `.env.example` 为 `.env`，并按本地 MySQL、JWT 密钥和上传目录调整配置：

```bash
cp .env.example .env
```

Windows PowerShell 可使用：

```powershell
Copy-Item .env.example .env
```

默认端口：

- Web: `5173`
- Admin: `5174`
- API: `3000`

## 初始化数据库

先创建与 `.env` 中 `DATABASE_URL` 匹配的 MySQL 数据库，然后执行：

```bash
pnpm --filter @yuer/api prisma:validate
pnpm --filter @yuer/api prisma:generate
pnpm --filter @yuer/api prisma:migrate
pnpm --filter @yuer/api prisma:seed
```

Seed 会初始化默认管理员、站点配置、导航、公告和看板娘占位配置。

如果 `prisma:migrate` 报 `P3014`，说明当前 MySQL 用户不能创建 Prisma 迁移所需的 shadow database。可用 MySQL root 登录后，为本地开发用户补充权限：

```sql
GRANT CREATE, ALTER, DROP, REFERENCES ON *.* TO 'yuer'@'127.0.0.1';
GRANT ALL PRIVILEGES ON yuer.* TO 'yuer'@'127.0.0.1';
FLUSH PRIVILEGES;
```

然后重新执行 `prisma:migrate`，成功后再执行 `prisma:seed`。如果 `prisma:seed` 报 `admins` 表不存在，通常就是迁移尚未成功执行。

默认管理员：

- 账号：`admin`
- 密码：`admin123`

生产环境首次登录后请立即修改默认密码，并替换 `.env` 中的 `JWT_SECRET`。

## 启动项目

同时启动前台、后台和 API：

```bash
pnpm dev
```

启动后访问：

- 前台站点：http://localhost:5173
- 后台管理：http://localhost:5174
- API 健康检查：http://localhost:3000/api/health
- Swagger 文档：http://localhost:3000/api/docs

也可以单独启动：

```bash
pnpm --filter @yuer/web dev
pnpm --filter @yuer/admin dev
pnpm --filter @yuer/api dev
```

## 验证命令

```bash
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

`pnpm test:e2e` 会临时启动前台和后台 Vite 服务，运行后自动清理。E2E 用例会 mock API 响应，因此不依赖本地数据库。

Playwright 在 CI 中会安装 Chromium：

```bash
pnpm exec playwright install --with-deps chromium
```

本地运行时会优先使用系统 Chrome 或 Edge；如果本机没有可用浏览器，请先安装 Playwright Chromium：

```bash
pnpm exec playwright install chromium
```

## CI

GitHub Actions 工作流位于 `.github/workflows/ci.yml`，会执行依赖安装、Playwright 浏览器安装、`lint`、`test`、`build` 和关键 E2E。
