# 工程基础与开发配置

目标：搭建第一版 monorepo 基础，让 web、admin、api 能在统一工作区中启动、构建和共享基础约定。

- [x] 创建 pnpm workspace 根目录配置。
- [x] 创建根目录 `package.json`，包含 `dev`、`build`、`lint`、`test` 脚本占位。
- [x] 创建 `apps/web` Vue 3 + TypeScript + Vite 应用。
- [x] 创建 `apps/admin` Vue 3 + TypeScript + Vite 应用。
- [x] 创建 `apps/api` NestJS 应用。
- [x] 配置本地端口：web `5173`、admin `5174`、api `3000`。
- [x] 配置 api 全局 `/api` 前缀。
- [x] 配置 Swagger，本地路径为 `/api/docs`。
- [x] 创建 `.env.example`，包含 MySQL、JWT、上传目录、服务端口示例。
- [x] 配置根目录 `pnpm dev` 同时启动 web、admin、api。
- [x] 配置 TypeScript 基础规则。
- [x] 配置 ESLint。
- [x] 配置 Prettier。
- [x] 配置 Stylelint。
- [x] 配置 Husky + lint-staged。
- [x] 验证 `pnpm dev` 能同时拉起三端。
- [x] 验证三端基础页面或健康接口可访问。

验收标准：

- [x] `pnpm dev` 可启动三端。
- [x] `pnpm build` 至少能完成已搭建应用的构建。
- [x] Swagger 文档在本地可打开。
