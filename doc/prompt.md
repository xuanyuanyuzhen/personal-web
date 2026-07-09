# Vibe Coding 起始 Prompt

你是本项目的主 Agent，负责从零到可运行地实现「语尔」个人网站第一版。你需要读取并严格遵守以下输入文档：

- `doc/prd.md`
- `doc/detailed-design.md`
- `doc/tasks/progress.md`
- `doc/tasks/*.md`

你的目标不是生成计划后等待人工继续，而是在无人参与的情况下持续推进：审计仓库现状、拆分子 Agent、实现模块、补齐测试、运行验证、修复失败，直到第一版达到文档验收标准。

## 项目目标

实现一个完整前后端闭环的个人记录站：

- 前台个人网站：Vue 3 + TypeScript + Vite，公开访问，展示已发布且公开内容。
- 后台管理系统：Vue 3 + TypeScript + Vite + Element Plus，单管理员登录后维护内容、审核、配置、统计和日志。
- 后端接口服务：NestJS + Prisma + MySQL + Swagger，统一 `/api` 前缀，提供鉴权、内容管理、上传、审核、点赞、搜索、统计、回收站和操作日志等能力。

第一版必须实现 PRD 第 15 节列出的范围。PRD 明确标为“不实现”“预留”“后续实现”的功能，只保留必要数据结构或扩展入口，不要做成可用流程。

## 总体执行原则

1. 先读文档，再读代码。不要凭记忆或偏好替代 `doc/prd.md`、`doc/detailed-design.md` 和 `doc/tasks/*.md`。
2. 主 Agent 只负责总体协调、进度跟踪、跨模块约束、集成验证和最终收口。具体模块交给子 Agent 实现。
3. 每个子 Agent 必须只处理自己模块边界内的工作，但要兼容已完成模块的接口、模型和测试。
4. 所有代码必须有测试。后端用 Jest，前端组件用 Vitest + Vue Test Utils，端到端用 Playwright。
5. 每个模块完成后必须运行相关测试。阶段完成后必须运行更大范围验证。最终必须运行 lint、test、build 和关键 E2E。
6. 不要绕过失败。测试、构建或类型检查失败时，先定位并修复，再继续后续模块。
7. 不要删除或重写无关文件。若仓库已有用户改动，必须保留并顺着现状实现。
8. 不要引入 Turborepo、Nx、Docker、RSS、Sitemap、验证码、限流、内容多语言版本等第一版排除项。
9. 当前目标包管理器是 pnpm。若环境没有 pnpm，应按 README 说明通过 Corepack 或 npm 安装 pnpm，并在项目文档中说明。
10. 若实现细节在文档中已有明确约束，按文档执行；若没有明确约束，选择最小、稳定、可测试、符合现有工程风格的方案。

## 无人值守规则

整个实现过程默认不会有人工参与。遇到不明确处时按以下策略处理：

- 文档已明确的内容：直接执行。
- 文档标为第一版不实现或预留：只做字段、接口占位或扩展边界，不开放 UI 流程。
- 文档要求“实现前确认”的内容：采用保守实现，避免品牌、商标、外部资料依赖和法律风险，不阻塞主流程。
- 外部网络不可用或依赖下载失败：记录原因，使用已有依赖或稳定替代；若依赖是完成项目必要条件，则重试并记录。
- 数据库不可连接：仍应完成 schema、migration、seed、单元测试和 mock/in-memory 层面的验证，并在最终报告中明确实际数据库验证状态。

两个特别保守默认：

- 错误页：不要直接使用 Cloudflare 名称、商标、官方资产或参考项目源码。只实现通用网络错误页风格：状态诊断布局、返回上一页、重新加载，不提供首页和搜索入口。如后来决定使用 `donlon/cloudflare-error-page` 代码或资源，必须保留 MIT 许可声明。
- 违禁词字段：第一版只实现直接命中规则。正则、风险等级、云厂商分类仅做字段预留，不查阅或仿制腾讯云、阿里云等产品字段。

## 主 Agent 工作流

### 1. 仓库审计

先检查：

- 当前目录结构。
- 是否已有 `package.json`、`pnpm-workspace.yaml`、`apps/*`。
- 是否已有代码、测试、CI、README。
- `doc/tasks/progress.md` 中哪些任务已完成。

产出内部状态：

- 当前实现进度。
- 模块依赖图。
- 下一批可并行任务。
- 风险和阻塞项。

### 2. 子 Agent 编排

为每个模块生成子 Agent。每个子 Agent 的任务说明必须包含：

- 需要阅读的文档。
- 模块范围。
- 可修改的目录。
- 依赖的已完成模块。
- 必须实现的功能点。
- 必须补齐的测试。
- 验收命令。
- 不允许越界实现的内容。

子 Agent 完成后，主 Agent 要审查：

- 是否满足对应 `doc/tasks/*.md` 验收标准。
- 是否破坏其他模块。
- 是否有测试覆盖。
- 是否更新必要文档。
- 是否需要修改 `doc/tasks/progress.md` 的完成状态。

### 3. 进度跟踪

主 Agent 维护任务状态：

- 未开始
- 进行中
- 待集成
- 已完成
- 失败需修复

每个模块完成后更新 `doc/tasks/progress.md` 对应条目。不要一次性把所有任务标为完成，必须在实际实现和验证通过后再勾选。

### 4. 集成与收口

每个阶段结束后执行：

- 类型检查。
- lint。
- 单元测试。
- 必要的组件测试。
- 相关构建。

全部模块完成后执行：

- `pnpm lint`
- `pnpm test`
- `pnpm build`
- Playwright 关键 E2E
- README 本地启动流程核对
- `.env.example` 完整性核对
- Swagger 路径 `/api/docs` 核对

## 推荐实现顺序

按依赖关系推进。可并行时由主 Agent 拆分多个子 Agent 并合并结果。

### 阶段 1：工程基础

对应任务：

- `doc/tasks/engineering-foundation.md`

目标：

- 建立 pnpm workspace。
- 创建 `apps/web`、`apps/admin`、`apps/api`。
- 配置端口：web `5173`，admin `5174`，api `3000`。
- API 全局 `/api` 前缀。
- Swagger 本地 `/api/docs`。
- 根脚本：`dev`、`build`、`lint`、`test`。
- ESLint、Prettier、Stylelint、Husky、lint-staged。
- `.env.example`。

验收：

- `pnpm dev` 能启动三端。
- `pnpm build` 至少能完成已搭建应用构建。
- Swagger 本地可打开。

### 阶段 2：数据库与 Prisma

对应任务：

- `doc/tasks/database-prisma.md`

目标：

- 建立 Prisma schema、migration、seed。
- 覆盖管理员、导航、页面、碎碎念、随笔、照片、留言、评论、点赞、标签、审核、黑名单、音乐、看板娘、设置、公告、访问统计、操作日志、回收站。
- 初始化默认管理员 `admin` / `admin123`。
- 初始化默认站点配置、默认导航、默认公告、默认看板娘占位配置。

验收：

- migration 可执行。
- seed 可重复安全运行或明确防重复。
- Prisma Client 可查询初始化数据。

### 阶段 3：鉴权与后台壳

对应任务：

- `doc/tasks/auth-admin-shell.md`

目标：

- 实现 JWT + HttpOnly Cookie 登录。
- 支持“记住我”：默认 24 小时，勾选 7 天。
- 实现登出、当前管理员、修改密码。
- 后台登录页、主布局、菜单、路由守卫、请求封装。
- 登录和修改密码写入操作日志。

验收：

- 正确账号可登录。
- 错误密码不能登录。
- 登出后不能访问后台。
- 修改密码后旧密码失效。

### 阶段 4：公共后端能力

对应任务：

- `doc/tasks/upload.md`
- `doc/tasks/recycle-bin-operation-log.md`
- `doc/tasks/messages-comments-audit.md` 中的违禁词、黑名单、审核服务基础
- `doc/tasks/likes.md` 中的后端基础

目标：

- 统一上传服务。
- 回收站服务。
- 操作日志服务。
- 审核服务。
- 违禁词直接命中。
- 黑名单匹配。
- 点赞唯一性与切换。

验收：

- 上传格式和大小限制有后端测试。
- 删除进入回收站，恢复和彻底删除可测。
- 操作日志能记录关键后台行为。
- 违禁词和黑名单命中进入待审核。
- 同 visitorId 同对象点赞不会重复累计。

### 阶段 5：内容模型与后台 CRUD

对应任务：

- `doc/tasks/navigation-pages.md`
- `doc/tasks/thoughts.md`
- `doc/tasks/essays.md`
- `doc/tasks/tags.md`
- `doc/tasks/photos-albums.md`
- `doc/tasks/settings-announcement-about.md`
- `doc/tasks/music.md`
- `doc/tasks/mascot.md`

目标：

- 导航、自定义页面。
- 碎碎念。
- 随笔与分类。
- 标签管理。
- 照片与相册。
- 系统设置、公告、关于我。
- 音乐管理。
- 看板娘配置。
- 后台所有列表使用分页。
- 后台富文本使用 WangEditor。
- 删除默认进入回收站。
- 新增、编辑、删除写入操作日志。

验收：

- 各模块 CRUD 可用。
- 可见范围和发布状态正确。
- 标签适用范围限制正确。
- 照片私密数据不会出现在公开接口。
- 音乐无音频来源不能保存。
- 看板娘禁用页面不返回展示配置。

### 阶段 6：前台基础与核心页面

对应任务：

- `doc/tasks/web-foundation.md`
- `doc/tasks/navigation-pages.md`
- `doc/tasks/settings-announcement-about.md`
- `doc/tasks/thoughts.md`
- `doc/tasks/essays.md`
- `doc/tasks/photos-albums.md`
- `doc/tasks/search.md`
- `doc/tasks/error-pages.md`

目标：

- 前台布局、导航、移动端适配。
- 日间/夜间主题，夜间不用纯黑。
- 页面切换动画和加载动画。
- 中文、英文、日文固定 UI 多语言。
- visitorId localStorage。
- 首页、碎碎念、随笔列表和详情、照片墙、留言板、关于我、自定义页面、搜索页、404/500。
- 普通访客只能看到已发布且公开内容。

验收：

- 主题和语言刷新后保持。
- 导航桌面端和移动端可用。
- 草稿和私密内容不能被普通访客通过接口、详情 URL 或搜索看到。
- 错误页只提供返回上一页和重新加载。

### 阶段 7：互动与展示体验

对应任务：

- `doc/tasks/messages-comments-audit.md`
- `doc/tasks/likes.md`
- `doc/tasks/music.md`
- `doc/tasks/mascot.md`
- `doc/tasks/search.md`

目标：

- 前台留言提交和公开留言无限滚动。
- 评论后端和后台管理，但前台不展示评论入口或列表。
- 爱心点赞按钮与动画。
- 全站固定角落音乐播放器，默认不自动播放。
- 静态看板娘、页面台词、权重随机台词。
- 搜索弹窗和独立搜索结果页。

验收：

- 命中违禁词留言不会立即公开。
- 未命中留言可自动公开。
- 黑名单命中不直接拒绝或丢弃。
- 点赞和取消点赞状态正确。
- 音乐刷新后保持播放选择和播放模式，但不自动播放。
- 搜索弹窗和结果页规则一致。

### 阶段 8：统计、仪表盘、CI 与文档

对应任务：

- `doc/tasks/statistics-dashboard.md`
- `doc/tasks/testing-ci-docs.md`

目标：

- 访问统计记录。
- IP 脱敏保存。
- 今日访问量、总访问量、7 天和 30 天访问趋势。
- 点赞总数、7 天点赞趋势。
- 后台仪表盘接入 ECharts。
- GitHub Actions。
- README。
- 完整测试矩阵。

验收：

- 访问页面后统计入库。
- IP 不保存完整原始值。
- 仪表盘不展示 PRD 明确排除的内容数量和最新列表。
- CI 可执行 lint、test、build。
- README 能指导本地启动和测试。

## 关键架构约束

### 前台

- Vue 3 + TypeScript + Vite。
- 不使用后台组件库限制前台视觉。
- 整体偏粉色、安静记录、日记本、二次元氛围。
- 内容列表排版要多样化但统一。
- 移动端必须适配。
- 夜间模式柔和暗色，不用纯黑。
- 多语言只覆盖固定 UI，不覆盖内容数据。

### 后台

- Vue 3 + TypeScript + Vite。
- Element Plus。
- 只适配电脑端。
- 浅色管理界面。
- 从零搭建，不使用现成后台模板。
- 后台第一版使用中文。

### 后端

- NestJS。
- Prisma。
- MySQL 8.0.30。
- REST API。
- `/api` 全局前缀。
- Swagger `/api/docs`。
- Controller 只处理请求、参数校验和响应。
- Service 处理业务规则。
- 跨模块通过导出的 Service 协作。

### 数据与权限

内容类模块统一使用：

- 发布状态：`DRAFT`、`PUBLISHED`。
- 可见范围：`PUBLIC`、`PRIVATE`。

规则：

- 普通访客只读 `PUBLISHED + PUBLIC`。
- 后台管理员可读全部。
- 管理员前台预览模式可读管理员可见内容。
- 前台搜索遵守同样规则。
- 删除默认进入回收站。

### 上传

本地存储路径：

```text
uploads/
uploads/photos/original/{yyyy}/{mm}/
uploads/photos/large/{yyyy}/{mm}/
uploads/photos/thumb/{yyyy}/{mm}/
uploads/music/
uploads/site/avatar/
uploads/site/mascot/
uploads/site/announcement/
```

限制：

- 图片：jpg、jpeg、png、webp、gif，单文件 10MB。
- 音乐：mp3、wav、ogg、flac，单文件 20MB。
- 歌词：lrc、txt。
- 看板娘图片不限制大小，但仍校验格式。

## 测试要求

### 后端 Jest 必测

- 登录、登出、权限 Guard、修改密码。
- 违禁词直接命中。
- 黑名单命中。
- 留言自动公开和待审核。
- 评论 CRUD 和层级回复。
- 点赞与取消点赞。
- 上传限制。
- 回收站恢复和彻底删除。
- IP 脱敏和统计聚合。

### 前端 Vitest + Vue Test Utils 必测

前台：

- 主题切换。
- 多语言切换。
- 搜索弹窗。
- 留言表单。
- 点赞按钮。
- 音乐播放器基础交互。

后台：

- 登录表单。
- 内容编辑表单。
- 上传组件。
- 审核操作按钮。
- 表格分页。
- 回收站恢复和彻底删除确认。

### Playwright E2E 必测

- 管理员登录。
- 发布碎碎念。
- 上传照片。
- 访客留言。
- 留言命中违禁词进入审核。
- 点赞和取消点赞。
- 前台搜索。
- 后台审核留言。

## 子 Agent 输出格式

每个子 Agent 完成后必须向主 Agent 返回：

```text
模块：
修改文件：
实现内容：
测试覆盖：
执行命令：
结果：
未完成/风险：
```

若测试失败，必须返回：

```text
失败命令：
失败现象：
定位结论：
修复计划：
```

主 Agent 必须要求子 Agent 修复后重新验证，不允许带失败进入下一阶段。

## 最终交付标准

项目完成时必须满足：

- `pnpm install` 后可按 README 启动。
- `.env.example` 完整。
- `pnpm dev` 能同时启动 web、admin、api。
- `pnpm build` 通过。
- `pnpm lint` 通过。
- `pnpm test` 通过。
- 关键 Playwright E2E 通过。
- Swagger 在本地 `/api/docs` 可访问。
- 默认管理员、默认导航、默认公告、默认看板娘配置可初始化。
- 前台普通访客看不到草稿或私密内容。
- 后台管理员可以完成内容维护、审核、设置、统计和日志查看。
- README 说明 pnpm、依赖安装、环境变量、数据库初始化、启动和测试。
- `doc/tasks/progress.md` 与实际完成状态一致。

最终报告必须包含：

- 完成模块列表。
- 关键命令执行结果。
- 测试结果摘要。
- 未验证项及原因。
- 生产环境注意事项，尤其是首次登录后修改默认密码。
