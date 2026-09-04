# 项目接口交接说明

本文件基于 `doc/local-prisma-troubleshooting.md`、`apps/api/src/*/*.controller.ts`、`apps/api/src/*/*.dto.ts`、`apps/api/prisma/schema.prisma` 和前后台 service 调用整理，用于后续接手时快速知道每个接口负责什么。

## 项目概览

- 仓库是 pnpm workspace，包含三端：
  - `apps/web`：前台 Vue 3 站点。
  - `apps/admin`：后台 Vue 3 + Element Plus 管理端。
  - `apps/api`：NestJS + Prisma + MySQL API。
- API 统一前缀为 `/api`，本地默认端口 `3000`。
- 前台默认端口 `5173`，后台默认端口 `5174`。
- 数据库使用 Prisma + MySQL，schema 位于 `apps/api/prisma/schema.prisma`。
- 本地 `.env` 需要提供 `DATABASE_URL`、`JWT_SECRET`、上传目录等配置。
- Swagger 地址：`http://localhost:3000/api/docs`。

## 接手启动顺序

1. 确认 MySQL 中存在与 `.env` 里 `DATABASE_URL` 匹配的数据库。
2. 如果 `prisma:migrate` 报 `P3014/P1010`，按 `doc/local-prisma-troubleshooting.md` 给本地 MySQL 用户补 shadow database 所需权限。
3. 初始化数据库：

```powershell
pnpm --filter @yuer/api prisma:validate
pnpm --filter @yuer/api prisma:generate
pnpm --filter @yuer/api prisma:migrate
pnpm --filter @yuer/api prisma:seed
```

4. 启动项目：

```powershell
pnpm dev
```

5. 默认管理员：
   - 账号：`admin`
   - 密码：`admin123`
   - 生产或长期使用前必须替换默认密码和 `JWT_SECRET`。

## 通用约定

- 后台接口一般以 `/admin/...` 开头，并通过 `AdminAuthGuard` 校验登录 cookie。
- 登录 cookie 名来自 `AUTH_COOKIE_NAME`，由 `POST /auth/login` 写入，`POST /auth/logout` 清除。
- 前台访问者相关接口通过 `X-Visitor-Id` 识别同一访客，用于点赞、留言、评论等。
- 预览能力通过 `X-Admin-Preview: 1` 支持，主要用于后台已登录状态下预览自定义页面和导航。
- 列表接口常用参数：`page`、`pageSize`、`search`，部分模块还有 `tag`、`category`、`albumId`、`status`、`scope` 等过滤项。
- 软删除内容会进入回收站；永久删除通过回收站 purge 完成。
- 多数后台写操作会记录 `operation_logs`，删除类操作会写 `recycle_bin_items`。

## 接口地图

### 健康检查

- `GET /health`：返回 API 服务健康状态，用于开发和部署探活。

### 认证

- `POST /auth/login`：后台管理员登录；参数为 `username`、`password`、`rememberMe`；成功后写入 httpOnly cookie，并返回管理员资料和过期秒数。
- `POST /auth/logout`：清除后台登录 cookie。
- `GET /auth/me`：读取当前登录管理员资料；需要后台登录。
- `POST /auth/change-password`：修改当前管理员密码；需要后台登录；参数为 `currentPassword`、`newPassword`。

### 站点设置与公告

- `GET /site/settings`：前台读取站点公开配置，如站点名、展示名、首页介绍、GitHub、头像、关于页内容、主题配置。
- `PUT /admin/settings`：后台更新站点配置；需要登录。
- `POST /admin/settings/avatar`：后台上传头像并写入头像 URL；`multipart/form-data`，字段名 `file`。
- `GET /site/announcement`：前台读取已启用的首页公告；未启用时返回 `null`。
- `GET /admin/announcement`：后台读取公告配置。
- `PUT /admin/announcement`：后台更新公告标题、内容和启用状态。

### 导航

- `GET /navigations/public`：前台读取可见导航树；支持后台预览未公开/未启用页面。
- `GET /admin/navigations`：后台分页读取导航项。
- `POST /admin/navigations`：后台创建导航项；支持内部链接、外部链接、自定义页面链接。
- `PUT /admin/navigations/:id`：后台更新导航项。
- `DELETE /admin/navigations/:id`：后台将导航项移入回收站。

### 自定义页面

- `GET /pages/public/:slug`：前台按 slug 读取已发布公开自定义页面；支持后台预览。
- `GET /admin/pages`：后台分页读取自定义页面。
- `POST /admin/pages`：后台创建自定义页面。
- `PUT /admin/pages/:id`：后台更新自定义页面。
- `DELETE /admin/pages/:id`：后台将自定义页面移入回收站。

### 随笔/碎片 Thoughts

- `GET /thoughts/public`：前台分页读取已发布公开随笔；支持 `tag` 过滤，并返回点赞数、当前访客是否已赞、标签。
- `GET /thoughts/tags/public`：前台读取随笔可用标签。
- `POST /thoughts/public/:id/like`：前台切换某条随笔点赞状态；依赖 `X-Visitor-Id`。
- `GET /admin/thoughts`：后台分页读取随笔，可按搜索和标签筛选。
- `POST /admin/thoughts`：后台创建随笔；支持内容、摘要、图片、状态、可见性、置顶、排序、标签名。
- `PUT /admin/thoughts/:id`：后台更新随笔。
- `DELETE /admin/thoughts/:id`：后台将随笔移入回收站。

### 文章 Essays

- `GET /essays/categories/public`：前台读取启用的文章分类。
- `GET /essays/public`：前台分页读取已发布公开文章；支持 `category`、`tag`、`search`，返回分类、标签、点赞状态。
- `GET /essays/public/:idOrSlug`：前台按 ID 或 slug 读取文章详情。
- `POST /essays/public/:id/like`：前台切换文章点赞状态；依赖 `X-Visitor-Id`。
- `GET /admin/essay-categories`：后台读取文章分类。
- `POST /admin/essay-categories`：后台创建文章分类。
- `PUT /admin/essay-categories/:id`：后台更新文章分类。
- `DELETE /admin/essay-categories/:id`：后台禁用文章分类。
- `GET /admin/essays`：后台分页读取文章。
- `POST /admin/essays`：后台创建文章；支持标题、slug、摘要、正文、封面、分类、状态、可见性、置顶、排序、标签名。
- `PUT /admin/essays/:id`：后台更新文章。
- `DELETE /admin/essays/:id`：后台将文章移入回收站。

### 相册与照片

- `GET /albums/public`：前台读取公开启用相册。
- `GET /photos/public`：前台分页读取公开照片；支持 `albumId` 过滤，返回相册信息、点赞数和当前访客点赞状态。
- `POST /photos/public/:id/like`：前台切换照片点赞状态；依赖 `X-Visitor-Id`。
- `GET /admin/albums`：后台分页读取相册。
- `POST /admin/albums`：后台创建相册。
- `PUT /admin/albums/:id`：后台更新相册。
- `DELETE /admin/albums/:id`：后台禁用或移除相册，进入回收逻辑。
- `GET /admin/photos`：后台分页读取照片。
- `POST /admin/photos`：后台创建照片记录；图片文件通常先走上传接口。
- `PUT /admin/photos/sort`：后台批量调整照片排序。
- `PUT /admin/photos/:id`：后台更新照片记录。
- `DELETE /admin/photos/:id`：后台将照片移入回收站。

### 留言、评论与审核

- `POST /messages`：前台提交留言；参数为昵称、邮箱、内容；会记录访客、IP 摘要、浏览器、设备，并经过禁词/黑名单评估。
- `GET /messages/public`：前台分页读取审核通过的留言。
- `POST /comments`：前台提交文章评论；参数为 `essayId`、可选 `parentId`、昵称、邮箱、内容；会校验文章和父评论。
- `GET /comments/public`：前台分页读取审核通过的文章评论；通常按 `essayId` 过滤。
- `GET /admin/messages`：后台分页读取留言，支持审核状态筛选。
- `PUT /admin/messages/:id/audit`：后台审核留言，通过或拒绝，并写入审核记录。
- `DELETE /admin/messages/:id`：后台将留言移入回收站。
- `GET /admin/comments`：后台分页读取评论，支持文章和审核状态筛选。
- `PUT /admin/comments/:id`：后台编辑评论昵称、邮箱或内容。
- `PUT /admin/comments/:id/audit`：后台审核评论。
- `POST /admin/comments/:id/reply`：后台回复某条评论。
- `DELETE /admin/comments/:id`：后台将评论移入回收站。
- `GET /admin/forbidden-words`：后台分页读取禁词规则。
- `POST /admin/forbidden-words`：后台创建禁词规则。
- `PUT /admin/forbidden-words/:id`：后台更新禁词规则。
- `DELETE /admin/forbidden-words/:id`：后台删除禁词规则。
- `GET /admin/blacklist`：后台分页读取黑名单。
- `POST /admin/blacklist`：后台创建黑名单项，类型包括昵称、邮箱、IP、访客 ID。
- `PUT /admin/blacklist/:id`：后台更新黑名单项。
- `DELETE /admin/blacklist/:id`：后台删除黑名单项。

### 通用点赞

- `POST /likes/toggle`：通用点赞切换接口；支持 `site`、`thought`、`essay`、`photo`，前台目前主要用于站点点赞，部分内容也有专用点赞接口。
- `GET /likes/status`：读取当前访客对某目标是否已点赞及总点赞数。
- `GET /admin/likes/summary`：后台读取点赞汇总统计。

### 标签

- `GET /tags/public`：前台读取启用标签；可按 `scope` 过滤，如 `THOUGHT`、`ESSAY`、`PHOTO`。
- `GET /admin/tags`：后台分页读取标签；支持 `scope`、`isEnabled`、搜索。
- `POST /admin/tags`：后台创建标签，并配置适用范围。
- `PUT /admin/tags/:id`：后台更新标签。
- `DELETE /admin/tags/:id`：后台禁用标签并写入回收记录。

### 搜索

- `GET /search/public`：前台全站搜索；参数 `q`、`page`、`pageSize`；按 thoughts、pages、essays、photos、messages 分组返回结果和摘要。

### 访问统计

- `POST /statistics/visit`：前台记录页面访问；参数为 `path`、可选 `pageType`、`pageId`；会记录 IP 摘要、浏览器、设备和访问日期。
- `GET /admin/statistics`：后台仪表盘统计；返回访问总数、今日访问、近 7/30 天趋势、热门页面、点赞统计。

### 音乐

- `GET /music/public`：前台读取启用的音乐曲目。
- `GET /admin/music`：后台分页读取音乐曲目。
- `POST /admin/music`：后台创建音乐曲目；支持本地音频 URL、外链、歌词文本、歌词文件 URL、排序、启用状态。
- `PUT /admin/music/:id`：后台更新音乐曲目。
- `DELETE /admin/music/:id`：后台将音乐曲目移入回收站。

### 看板娘 Mascot

- `GET /mascot/public`：前台按 `pageKey` 读取看板娘配置、页面固定台词和随机台词。
- `GET /admin/mascot/config`：后台读取看板娘配置。
- `PUT /admin/mascot/config`：后台更新看板娘名称、图片、展示范围、精灵图配置和启用状态。
- `GET /admin/mascot/lines`：后台读取页面台词和随机台词。
- `POST /admin/mascot/lines`：后台创建台词。
- `PUT /admin/mascot/lines/:id`：后台更新台词。
- `DELETE /admin/mascot/lines/:id`：后台删除台词。

### 文件上传

- `POST /admin/uploads/:kind`：后台通用上传接口；需要登录；`multipart/form-data` 字段名 `file`。
- 支持的 `kind`：
  - `image`：普通图片，保存到 `images/YYYY/MM`。
  - `photo`：照片上传，会同时生成 original、large、thumb 三份元数据，目前代码写入同一原始 buffer。
  - `music`：音频文件，支持 mp3、flac、ogg、wav，最大 20MB。
  - `lyric`：歌词文件，支持 lrc、txt。
  - `avatar`：头像图片，保存到 `site/avatar`。
  - `mascot`：看板娘图片，保存到 `site/mascot`。
  - `announcement`：公告图片，保存到 `site/announcement`。
- `POST /admin/settings/avatar`：头像专用上传并保存设置，底层同样使用上传服务。

### 回收站与操作日志

- `GET /admin/recycle-bin`：后台分页读取回收站 active 项；支持对象类型和搜索。
- `POST /admin/recycle-bin/:id/restore`：恢复回收站项目。
- `DELETE /admin/recycle-bin/:id/purge`：永久删除回收站项目。
- `GET /admin/operation-logs`：后台分页读取操作日志；支持动作、对象类型、搜索。

## 数据模型大图

- 账号与安全：`Admin`、登录 cookie、自定义签名 token、密码哈希和 `passwordVersion`。
- 内容：`Navigation`、`CustomPage`、`Thought`、`EssayCategory`、`Essay`、`Album`、`Photo`。
- 互动：`Message`、`Comment`、`Like`。
- 标签：`Tag`、`TagScope`、`TagRelation`。
- 审核：`ForbiddenWord`、`BlacklistItem`、`AuditRecord`。
- 站点功能：`Music`、`Mascot`、`MascotLine`、`Setting`、`Announcement`。
- 统计与审计：`VisitLog`、`OperationLog`、`RecycleBinItem`。

## 后续需要重点做什么

1. **先保证本地数据库可用**：优先按 `doc/local-prisma-troubleshooting.md` 解决 Prisma migrate 的 shadow database 权限问题；迁移成功后再 seed。
2. **补齐上传能力的真实处理**：`photo` 上传目前 original、large、thumb 都写入同一 buffer，只是路径不同；后续如果要上线，应接入真实压缩、缩略图和图片尺寸处理。
3. **统一点赞入口**：现在 thoughts、essays、photos 有专用 like 接口，同时还有 `/likes/toggle` 通用接口；后续可决定保留专用接口还是收敛到通用接口。
4. **完善自定义页面/导航预览流程**：已有 `X-Admin-Preview`，后续要确保后台编辑页跳转前台预览时 cookie 和 header 链路稳定。
5. **强化审核与反垃圾**：禁词 `REGEX_RESERVED` 目前是保留类型，黑名单和禁词规则可继续扩展频控、IP 段、正则规则和后台提示。
6. **补安全配置**：生产前必须替换 `JWT_SECRET`、默认管理员密码，并确认上传目录权限、文件 MIME/扩展名校验和静态资源暴露策略。
7. **页面切换动画无需逐页注册**：⚠️ 本条原先要求「新增一级导航页面时同步更新 `usePageFlip.ts` 的 `pageOrder` / `pagePathOrder`」，**该要求已废弃**。3D 书页翻页连同 `usePageFlip.ts`、`usePageTurnSnapshot.ts` 已整体删除，现在由 `App.vue` 里包裹 `RouterView` 的全局 `Transition`（`name="page-shift"`）统一处理，新增页面自动生效、不必登记顺序。详见 `doc/page-transition-handoff.md`。
8. **回归验证命令**：常规提交前执行 `pnpm lint`、`pnpm test`、`pnpm build`；~~`PageFlip.spec.ts`~~ 已随翻页动画删除，前台过渡的结构契约现在由 `pnpm --filter @yuer/web test -- AppShell.spec.ts` 覆盖。
