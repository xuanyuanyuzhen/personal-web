# 数据库与 Prisma 模型

目标：建立 MySQL + Prisma 的第一版数据结构、迁移和初始化脚本。

- [x] 在 api 中安装并初始化 Prisma。
- [x] 配置 MySQL 连接环境变量。
- [x] 定义 `admins` 模型。
- [x] 定义导航与页面模型：`navigations`、`pages`。
- [x] 定义内容模型：`thoughts`、`essays`、`essay_categories`。
- [x] 定义照片模型：`photos`、`albums`。
- [x] 定义互动模型：`messages`、`comments`、`likes`。
- [x] 定义标签模型：`tags`、`tag_relations`。
- [x] 定义审核模型：`forbidden_words`、`blacklist_items`。
- [x] 定义展示配置模型：`musics`、`mascots`、`mascot_lines`。
- [x] 定义站点配置模型：`settings`、`announcements`。
- [x] 定义统计与治理模型：`visit_logs`、`operation_logs`、`recycle_bin_items`。
- [x] 定义发布状态枚举：草稿、已发布。
- [x] 定义可见范围枚举：公开、仅自己可见。
- [x] 定义审核状态枚举：待审核、已通过、已拒绝。
- [x] 为内容列表字段添加索引：发布状态、可见范围、置顶、排序、创建时间。
- [x] 为点赞添加唯一约束：visitorId、targetType、targetId。
- [x] 为标签关联添加 targetType、targetId、tagId 索引。
- [x] 为统计和日志添加日期、类型、创建时间索引。
- [x] 创建 Prisma migration。
- [x] 创建数据库初始化脚本。
- [x] 初始化默认管理员 `admin` / `admin123`。
- [x] 初始化默认站点配置：网站名、公开昵称、首页介绍。
- [x] 初始化默认导航：首页、碎碎念、随笔、照片墙、留言板、关于我。
- [x] 初始化默认公告。
- [x] 初始化默认看板娘占位配置。

验收标准：

- [x] 本地 MySQL 可完成迁移。
- [x] 初始化脚本可重复安全运行或明确防重复。
- [x] Prisma Client 可正常查询初始化数据。
