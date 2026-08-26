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
- Swagger 文档：http://localhost:3000/api/docs（仅开发环境，生产构建不挂载）

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

## 上线部署

当前部署形态：**单进程 + Cloudflare Tunnel**。NestJS 一个进程同时托管前台产物、`/api` 和 `/uploads`，对外只暴露 `3000` 一个端口；Cloudflare Tunnel 把 `xyyuzhen.kdns.fr` 的流量送到这个端口。不需要公网 IP，也不需要在路由器上做端口映射。

### 1. 打包

```bash
pnpm build
```

会依次构建 `apps/web`、`apps/admin`、`apps/api` 三个产物。

> ⚠️ `dist/` 被 `.gitignore` 忽略，**产物不在仓库里**。所以每次部署都必须在机器上重新打包，`git pull` 之后不能直接重启了事。
>
> 顺带说明：`pnpm build` 也会构建 `apps/admin/dist`，但后台不对公网暴露（见第 3 步），这份产物目前不会被任何进程用到。

只想单独构建某一个：

```bash
pnpm --filter @yuer/web build
pnpm --filter @yuer/api build
```

### 2. 启动后端（同时提供前台站点）

```bash
pnpm --filter @yuer/api start
```

这条命令读根目录的 `.env`，跑 `apps/api/dist/main.js`。启动后：

| 路径             | 由谁响应                                                                  |
| ---------------- | ------------------------------------------------------------------------- |
| `/` 及各页面路由 | `apps/web/dist`（找不到文件时用 `index.html` 兜底，保证深链接刷新不 404） |
| `/api/*`         | NestJS 路由                                                               |
| `/uploads/*`     | 上传目录静态文件                                                          |

生产环境（`NODE_ENV=production`）与开发环境的差异：

- Swagger（`/api/docs`）**不挂载**，避免把完整接口地图公开
- `/api/admin/*` 与 `/api/auth/*` 拒绝公网来源（带 `CF-Connecting-IP` 的请求返回 404），只允许本机直连

启动后可以用这个脚本自查路由是否正常（11 项，覆盖深链接兜底、缺失资源仍 404、管理端已拦截等）：

```bash
pnpm exec node scripts/probe-serve-static.mjs
```

> ⚠️ **关掉终端站点就断了**。目前没有配置开机自启和崩溃重启，需要长期稳定运行的话得把它做成 Windows 服务（PM2 或 nssm）。

### 3. 启动隧道

```bash
cloudflared tunnel run yuer-web
```

配置在 `C:\Users\<用户名>\.cloudflared\config.yml`，ingress 指向 `http://127.0.0.1:3000`。看到若干行 `Registered tunnel connection` 才算连上。

排查：

- **Error 1033** —— 边缘连不上隧道。先确认 `cloudflared` 在跑且日志里有 `Registered tunnel connection`；再确认配置文件名是 `config.yml`（文件名写错时 cloudflared 不报错，而是按无配置运行，症状与真正的连接失败一样）。
- **日志里出现 `198.18.x.x` 这类地址** —— 那不是 Cloudflare 的边缘 IP，而是本机代理软件（Clash 等）的 fake-ip 段拦截了 DNS，QUIC 连不出去。关掉代理或给 cloudflared 配直连规则。

### 4. 打开管理员面板

后台**不对公网暴露**，只能在这台机器上访问：

```bash
pnpm --filter @yuer/admin dev
```

然后打开 http://localhost:5174 —— 它通过 Vite 代理把 `/api` 请求打到 `127.0.0.1:3000`，走的是本机直连，不经过 Cloudflare，所以不受第 2 步那条公网拦截规则影响。

这里改的是**线上真实数据**（同一个数据库），没有草稿环境，请留意。

### 部署清单

代码更新后完整走一遍：

```bash
git pull
pnpm install          # 依赖有变动时才需要
pnpm build
# 重启后端：在跑 start 的终端里 Ctrl+C，然后重新执行
pnpm --filter @yuer/api start
```

隧道不用重启 —— `cloudflared` 连的是端口，后端重启后会自动重连。
