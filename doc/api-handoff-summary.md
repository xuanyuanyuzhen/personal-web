# API 接手说明

本文基于 `doc/local-prisma-troubleshooting.md`、`doc/agent-handoff.md`、`apps/api/src/**/*.controller.ts`、DTO、Prisma schema 和任务清单整理，用于快速接手接口与后续工作。

## 项目概况

- Monorepo：`apps/web` 前台、`apps/admin` 后台、`apps/api` NestJS API。
- API 技术栈：NestJS + Prisma + MySQL，接口统一前缀 `/api`。
- Swagger：本地访问 `/api/docs`。
- 鉴权：后台接口使用 HttpOnly Cookie，Cookie 名为 `yuer_admin_token`。
- 上传资源：`UPLOAD_DIR` 默认 `uploads`，公开 URL 前缀默认 `/uploads`。
- 数据库 schema：`apps/api/prisma/schema.prisma`。

## 本地 Prisma / MySQL 接手要点

`doc/local-prisma-troubleshooting.md` 的核心结论：

1. 先确保 `.env` 中 `DATABASE_URL` 对应的 MySQL 数据库存在，例如 `mysql://yuer:123456@127.0.0.1:3306/yuer`。
2. 初始化顺序必须是：
   ```powershell
   pnpm --filter @yuer/api prisma:validate
   pnpm --filter @yuer/api prisma:generate
   pnpm --filter @yuer/api prisma:migrate
   pnpm --filter @yuer/api prisma:seed
   ```
3. `P3014 / P1010` 表示 Prisma Migrate 创建 shadow database 失败，需要给 MySQL 用户补 `CREATE / ALTER / DROP / REFERENCES` 等权限，或后续改成固定 `shadowDatabaseUrl`。
4. `P2021 admins 表不存在` 通常是迁移没成功导致的后续错误，先修 `prisma:migrate`。
5. `P3015 migration.sql 不存在` 是空迁移目录导致的。当前工作区 `apps/api/prisma/migrations` 下只看到完整的 `20260603142000_init` 和 `migration_lock.toml`，未看到文档中提到的空目录。

## 全局接口规则

- `GET /api/health`：健康检查。
- 分页查询大多支持 `page`、`pageSize`、`search`，`pageSize` 最大 100。
- 公开内容默认只返回 `PUBLISHED + PUBLIC + deletedAt = null`。
- 管理端接口基本位于 `/api/admin/...`，需要 `yuer_admin_token` Cookie。
- 管理员预览：部分公开接口支持请求头 `x-admin-preview: 1` 或 `true`，并且必须带有效后台 Cookie，才能看到草稿、私有或仅管理员可见内容。
- 访客点赞、留言、评论依赖请求头 `x-visitor-id` 识别访客。
- 内容删除多数是软删除：业务表写 `deletedAt`，同时写入 `recycle_bin_items`；回收站可恢复或彻底删除。

## 接口地图

### Auth

| 方法 | 路径                        | 鉴权 | 作用                                                                |
| ---- | --------------------------- | ---- | ------------------------------------------------------------------- |
| POST | `/api/auth/login`           | 否   | 管理员登录，校验账号密码，写入 HttpOnly Cookie，支持 `rememberMe`。 |
| POST | `/api/auth/logout`          | 否   | 清除后台登录 Cookie。                                               |
| GET  | `/api/auth/me`              | 是   | 返回当前管理员资料。                                                |
| POST | `/api/auth/change-password` | 是   | 修改当前管理员密码，并通过 `passwordVersion` 使旧 token 失效。      |

### Health

| 方法 | 路径          | 鉴权 | 作用                    |
| ---- | ------------- | ---- | ----------------------- |
| GET  | `/api/health` | 否   | 返回 API 服务健康状态。 |

### Settings / Announcement

| 方法 | 路径                         | 鉴权 | 作用                                                                 |
| ---- | ---------------------------- | ---- | -------------------------------------------------------------------- |
| GET  | `/api/site/settings`         | 否   | 获取公开站点设置：站名、公开昵称、首页介绍、GitHub、头像、关于我等。 |
| PUT  | `/api/admin/settings`        | 是   | 更新站点设置并写操作日志。                                           |
| POST | `/api/admin/settings/avatar` | 是   | 上传头像并保存头像 URL 到站点设置。                                  |
| GET  | `/api/site/announcement`     | 否   | 获取启用中的首页公告。                                               |
| GET  | `/api/admin/announcement`    | 是   | 获取后台公告配置。                                                   |
| PUT  | `/api/admin/announcement`    | 是   | 更新公告标题、富文本内容、启用状态。                                 |

### Navigation / Custom Page

| 方法   | 路径                         | 鉴权     | 作用                                                             |
| ------ | ---------------------------- | -------- | ---------------------------------------------------------------- |
| GET    | `/api/navigations/public`    | 可选预览 | 返回前台导航树；普通访客过滤禁用、删除、草稿和私有页面。         |
| GET    | `/api/admin/navigations`     | 是       | 后台分页查询导航，支持搜索。                                     |
| POST   | `/api/admin/navigations`     | 是       | 创建导航项，支持内部路径、外链、自定义页面、父子级、图标和排序。 |
| PUT    | `/api/admin/navigations/:id` | 是       | 更新导航项。                                                     |
| DELETE | `/api/admin/navigations/:id` | 是       | 将导航软删除并放入回收站。                                       |
| GET    | `/api/pages/public/:slug`    | 可选预览 | 按 slug 获取公开自定义页面；预览模式可看管理员可见页面。         |
| GET    | `/api/admin/pages`           | 是       | 后台分页查询自定义页面。                                         |
| POST   | `/api/admin/pages`           | 是       | 创建自定义页面，支持富文本、发布状态、可见范围、SEO 预留字段。   |
| PUT    | `/api/admin/pages/:id`       | 是       | 更新自定义页面。                                                 |
| DELETE | `/api/admin/pages/:id`       | 是       | 将自定义页面软删除并放入回收站。                                 |

### Thoughts

| 方法   | 路径                            | 鉴权 | 作用                                                             |
| ------ | ------------------------------- | ---- | ---------------------------------------------------------------- |
| GET    | `/api/thoughts/public`          | 否   | 分页获取公开碎碎念，支持 `search`、`tag`，返回标签与点赞状态。   |
| GET    | `/api/thoughts/tags/public`     | 否   | 获取碎碎念可用公开标签。                                         |
| POST   | `/api/thoughts/public/:id/like` | 否   | 对公开碎碎念切换点赞，需要 `x-visitor-id`。                      |
| GET    | `/api/admin/thoughts`           | 是   | 后台分页查询碎碎念，包含草稿、私有等非删除内容。                 |
| POST   | `/api/admin/thoughts`           | 是   | 创建碎碎念，支持富文本、配图、状态、可见范围、置顶、排序、标签。 |
| PUT    | `/api/admin/thoughts/:id`       | 是   | 更新碎碎念。                                                     |
| DELETE | `/api/admin/thoughts/:id`       | 是   | 将碎碎念软删除并放入回收站。                                     |

### Essays / Categories

| 方法   | 路径                              | 鉴权 | 作用                                                                           |
| ------ | --------------------------------- | ---- | ------------------------------------------------------------------------------ |
| GET    | `/api/essays/categories/public`   | 否   | 获取启用的公开随笔分类。                                                       |
| GET    | `/api/essays/public`              | 否   | 分页获取公开随笔，支持 `search`、`category`、`tag`，返回分类、标签、点赞状态。 |
| GET    | `/api/essays/public/:idOrSlug`    | 否   | 获取公开随笔详情，支持数字 ID 或 slug。                                        |
| POST   | `/api/essays/public/:id/like`     | 否   | 对公开随笔切换点赞，需要 `x-visitor-id`。                                      |
| GET    | `/api/admin/essay-categories`     | 是   | 后台获取随笔分类。                                                             |
| POST   | `/api/admin/essay-categories`     | 是   | 创建随笔分类。                                                                 |
| PUT    | `/api/admin/essay-categories/:id` | 是   | 更新随笔分类。                                                                 |
| DELETE | `/api/admin/essay-categories/:id` | 是   | 禁用随笔分类。                                                                 |
| GET    | `/api/admin/essays`               | 是   | 后台分页查询随笔。                                                             |
| POST   | `/api/admin/essays`               | 是   | 创建随笔，支持富文本、封面、分类、标签、状态、可见范围。                       |
| PUT    | `/api/admin/essays/:id`           | 是   | 更新随笔。                                                                     |
| DELETE | `/api/admin/essays/:id`           | 是   | 将随笔软删除并放入回收站。                                                     |

### Photos / Albums

| 方法   | 路径                          | 鉴权 | 作用                                                       |
| ------ | ----------------------------- | ---- | ---------------------------------------------------------- |
| GET    | `/api/albums/public`          | 否   | 获取公开相册。                                             |
| GET    | `/api/photos/public`          | 否   | 分页获取公开照片，支持 `search`、`albumId`，返回点赞状态。 |
| POST   | `/api/photos/public/:id/like` | 否   | 对公开照片切换点赞，需要 `x-visitor-id`。                  |
| GET    | `/api/admin/albums`           | 是   | 后台分页查询相册。                                         |
| POST   | `/api/admin/albums`           | 是   | 创建相册。                                                 |
| PUT    | `/api/admin/albums/:id`       | 是   | 更新相册。                                                 |
| DELETE | `/api/admin/albums/:id`       | 是   | 禁用或删除相册相关状态，并纳入回收恢复逻辑。               |
| GET    | `/api/admin/photos`           | 是   | 后台分页查询照片。                                         |
| POST   | `/api/admin/photos`           | 是   | 创建照片记录，关联上传返回的原图、大图、缩略图 URL。       |
| PUT    | `/api/admin/photos/sort`      | 是   | 批量更新照片排序。                                         |
| PUT    | `/api/admin/photos/:id`       | 是   | 更新照片信息。                                             |
| DELETE | `/api/admin/photos/:id`       | 是   | 将照片软删除并放入回收站。                                 |

### Messages / Comments / Moderation

| 方法   | 路径                             | 鉴权 | 作用                                                                     |
| ------ | -------------------------------- | ---- | ------------------------------------------------------------------------ |
| POST   | `/api/messages`                  | 否   | 访客提交留言，记录昵称、邮箱、内容、visitorId、IP 脱敏信息和 UA 粗分类。 |
| GET    | `/api/messages/public`           | 否   | 分页获取已通过审核的公开留言，隐藏邮箱等私密字段。                       |
| POST   | `/api/comments`                  | 否   | 访客提交随笔评论，绑定 `essayId`，可带 `parentId`。                      |
| GET    | `/api/comments/public`           | 否   | 获取某随笔已通过审核的公开评论。                                         |
| GET    | `/api/admin/messages`            | 是   | 后台分页查询留言，支持审核状态筛选。                                     |
| PUT    | `/api/admin/messages/:id/audit`  | 是   | 审核留言，通过或拒绝，并记录原因与操作日志。                             |
| DELETE | `/api/admin/messages/:id`        | 是   | 将留言软删除并放入回收站。                                               |
| GET    | `/api/admin/comments`            | 是   | 后台分页查询评论。                                                       |
| PUT    | `/api/admin/comments/:id`        | 是   | 后台编辑评论昵称、邮箱、内容。                                           |
| PUT    | `/api/admin/comments/:id/audit`  | 是   | 审核评论，通过或拒绝。                                                   |
| POST   | `/api/admin/comments/:id/reply`  | 是   | 管理员回复评论，生成子评论。                                             |
| DELETE | `/api/admin/comments/:id`        | 是   | 将评论软删除并放入回收站。                                               |
| GET    | `/api/admin/forbidden-words`     | 是   | 分页查询违禁词。                                                         |
| POST   | `/api/admin/forbidden-words`     | 是   | 新增违禁词。第一版只启用普通文本命中。                                   |
| PUT    | `/api/admin/forbidden-words/:id` | 是   | 更新违禁词。                                                             |
| DELETE | `/api/admin/forbidden-words/:id` | 是   | 删除违禁词。                                                             |
| GET    | `/api/admin/blacklist`           | 是   | 分页查询黑名单。                                                         |
| POST   | `/api/admin/blacklist`           | 是   | 新增黑名单，支持昵称、邮箱、IP、visitorId。                              |
| PUT    | `/api/admin/blacklist/:id`       | 是   | 更新黑名单。                                                             |
| DELETE | `/api/admin/blacklist/:id`       | 是   | 删除黑名单。                                                             |

说明：留言和评论命中违禁词或黑名单时进入 `PENDING`，不会直接拒绝；未命中时自动通过。

### Tags

| 方法   | 路径                  | 鉴权 | 作用                                                |
| ------ | --------------------- | ---- | --------------------------------------------------- |
| GET    | `/api/tags/public`    | 否   | 获取启用的公开标签，可按 `scope` 过滤。             |
| GET    | `/api/admin/tags`     | 是   | 后台分页查询标签，支持 `scope`、`isEnabled`、搜索。 |
| POST   | `/api/admin/tags`     | 是   | 创建标签，维护颜色、启用状态和适用范围。            |
| PUT    | `/api/admin/tags/:id` | 是   | 更新标签。                                          |
| DELETE | `/api/admin/tags/:id` | 是   | 禁用标签并写入回收站记录。                          |

### Likes

| 方法 | 路径                       | 鉴权 | 作用                                                                          |
| ---- | -------------------------- | ---- | ----------------------------------------------------------------------------- |
| POST | `/api/likes/toggle`        | 否   | 通用点赞切换，支持 `site`、`thought`、`essay`、`photo`，需要 `x-visitor-id`。 |
| GET  | `/api/likes/status`        | 否   | 查询某访客对某对象的点赞状态与点赞数；无 visitorId 时可查总数。               |
| GET  | `/api/admin/likes/summary` | 是   | 后台点赞汇总：按类型统计总数和最近趋势。                                      |

### Search

| 方法 | 路径                 | 鉴权     | 作用                                                                                           |
| ---- | -------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| GET  | `/api/search/public` | 可选预览 | 前台分区搜索，查询参数 `q`、`page`、`pageSize`；搜索碎碎念、自定义页面、随笔、照片、公开留言。 |

### Music

| 方法   | 路径                   | 鉴权 | 作用                                                                |
| ------ | ---------------------- | ---- | ------------------------------------------------------------------- |
| GET    | `/api/music/public`    | 否   | 获取启用的公开音乐列表。                                            |
| GET    | `/api/admin/music`     | 是   | 后台分页查询音乐，支持搜索。                                        |
| POST   | `/api/admin/music`     | 是   | 创建音乐，要求本地文件 URL 或外链至少一项，支持歌词文本和歌词文件。 |
| PUT    | `/api/admin/music/:id` | 是   | 更新音乐。                                                          |
| DELETE | `/api/admin/music/:id` | 是   | 将音乐软删除并放入回收站。                                          |

### Mascot

| 方法   | 路径                          | 鉴权 | 作用                                                          |
| ------ | ----------------------------- | ---- | ------------------------------------------------------------- |
| GET    | `/api/mascot/public`          | 否   | 按 `pageKey` 获取前台看板娘配置、页面台词和随机台词池。       |
| GET    | `/api/admin/mascot/config`    | 是   | 获取后台看板娘配置。                                          |
| PUT    | `/api/admin/mascot/config`    | 是   | 更新看板娘名称、图片、显示范围、Live2D 预留配置、启用状态。   |
| GET    | `/api/admin/mascot/lines`     | 是   | 获取看板娘页面台词和随机台词。                                |
| POST   | `/api/admin/mascot/lines`     | 是   | 创建台词，支持页面标识、权重、随机/页面台词、排序、启用状态。 |
| PUT    | `/api/admin/mascot/lines/:id` | 是   | 更新台词。                                                    |
| DELETE | `/api/admin/mascot/lines/:id` | 是   | 删除台词。                                                    |

### Statistics

| 方法 | 路径                    | 鉴权 | 作用                                                                          |
| ---- | ----------------------- | ---- | ----------------------------------------------------------------------------- |
| POST | `/api/statistics/visit` | 否   | 记录前台访问，保存路径、页面类型、页面 ID、IP 哈希/脱敏、浏览器和设备粗分类。 |
| GET  | `/api/admin/statistics` | 是   | 获取后台仪表盘统计：访问量、最近趋势、点赞聚合等。                            |

### Recycle Bin / Operation Logs

| 方法   | 路径                                 | 鉴权 | 作用                                                      |
| ------ | ------------------------------------ | ---- | --------------------------------------------------------- |
| GET    | `/api/admin/recycle-bin`             | 是   | 分页查询回收站，可按 `objectType` 和搜索过滤。            |
| POST   | `/api/admin/recycle-bin/:id/restore` | 是   | 恢复回收站内容，把对应业务表的删除状态还原。              |
| DELETE | `/api/admin/recycle-bin/:id/purge`   | 是   | 彻底删除回收站内容和对应业务记录。                        |
| GET    | `/api/admin/operation-logs`          | 是   | 分页查询后台操作日志，支持 `action`、`objectType`、搜索。 |

### Uploads

| 方法 | 路径                       | 鉴权 | 作用                                                                                                                  |
| ---- | -------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------- |
| POST | `/api/admin/uploads/:kind` | 是   | 统一上传接口，表单字段名 `file`，`kind` 支持 `announcement`、`avatar`、`image`、`lyric`、`mascot`、`music`、`photo`。 |

上传规则：

- 图片：`gif/jpeg/jpg/png/webp`，普通图片 10MB 限制。
- 音乐：`flac/mp3/ogg/wav`，20MB 限制。
- 歌词：`lrc/txt`。
- 看板娘图片校验图片格式，但不限制大小。
- `photo` 会返回 `original`、`large`、`thumb` 三份元数据；当前实现是同一文件内容写三份路径，并未真正压缩生成不同尺寸。

## 数据模型脉络

主要表：

- 管理员与审计：`admins`、`operation_logs`。
- 内容：`navigations`、`pages`、`thoughts`、`essays`、`essay_categories`。
- 图片：`albums`、`photos`。
- 互动审核：`messages`、`comments`、`likes`、`forbidden_words`、`blacklist_items`、`audit_records`。
- 标签：`tags`、`tag_scopes`、`tag_relations`。
- 展示配置：`musics`、`mascots`、`mascot_lines`。
- 站点配置：`settings`、`announcements`。
- 统计与治理：`visit_logs`、`recycle_bin_items`。

关键枚举：

- `PublishStatus`：`DRAFT`、`PUBLISHED`。
- `Visibility`：`PUBLIC`、`PRIVATE`。
- `AuditStatus`：`PENDING`、`APPROVED`、`REJECTED`。
- `TargetType`：站点、导航、页面、碎碎念、随笔、照片、相册、留言、评论、音乐、标签、看板娘、公告、设置等。
- `NavigationType`：`INTERNAL`、`EXTERNAL`、`PAGE`。

## 当前状态判断

- `doc/tasks/progress.md` 中第一版模块均为已完成。
- 后端测试覆盖登录、权限、留言审核、点赞、统计、上传、回收站、搜索、看板娘、音乐、标签、内容模块等。
- E2E 使用 mock API，不依赖本地 MySQL。
- 当前最容易阻塞本地运行的是 MySQL / Prisma 初始化，而不是业务接口缺失。

## 后续建议

1. 先跑通本地数据库：按 `local-prisma-troubleshooting.md` 授权 MySQL 用户，依次执行 validate、generate、migrate、seed。
2. 跑基础验证：`pnpm --filter @yuer/api test`、`pnpm test`、`pnpm build`，确认当前工作区改动没有破坏接口。
3. 修复 Swagger/DTO 示例中文乱码，避免接口文档对后续维护者不友好。
4. 确认生产部署策略：生产环境应替换 `JWT_SECRET`、默认管理员密码，决定是否关闭或保护 Swagger。
5. 评估固定 shadow database 方案：如果不想给业务 MySQL 用户全局建库/删库权限，需要引入 `shadowDatabaseUrl`，并同步 `.env.example`、README、Prisma schema。
6. 明确上传增强：照片接口目前保存 original/large/thumb 三份文件路径，但未真正压缩或生成缩略图；若上线需要真实图片处理，应接入 sharp 等图片处理。
7. 明确预留能力是否启用：正则违禁词、Live2D、对象存储、验证码/限流、自动清理、RSS/Sitemap 等目前多为预留或未启用。
8. 真实联调前检查前台文案：`apps/web/src/composables/useI18n.ts` 里仍有“后续接入公开设置接口”等占位表述，可能与当前已实现状态不一致。
