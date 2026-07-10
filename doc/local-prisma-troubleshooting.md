# 本地 Prisma / MySQL 排错说明

这份文档用于帮助后续 agent 或维护者快速接手本地数据库初始化问题。

## 当前项目数据库配置

项目使用 Prisma + MySQL，Prisma schema 位于：

- `apps/api/prisma/schema.prisma`

本地连接信息来自仓库根目录 `.env`：

```env
DATABASE_URL=mysql://yuer:123456@127.0.0.1:3306/yuer
```

`.env` 不会提交到 Git。公开部署或长期使用前，应替换 `JWT_SECRET` 和默认管理员密码。

## 初始化顺序

请先确保 MySQL 中存在与 `DATABASE_URL` 匹配的数据库，然后在仓库根目录执行：

```powershell
pnpm --filter @yuer/api prisma:validate
pnpm --filter @yuer/api prisma:generate
pnpm --filter @yuer/api prisma:migrate
pnpm --filter @yuer/api prisma:seed
```

`prisma:migrate` 必须先成功，才能执行 `prisma:seed`。如果迁移失败，业务表不会创建，seed 会继续报表不存在。

## P3014 / P1010

报错示例：

```text
P3014 Prisma Migrate could not create the shadow database
P1010 User was denied access on the database prisma_migrate_shadow_db_...
```

原因：`prisma migrate dev` 会临时创建 shadow database，用于校验迁移历史。当前 MySQL 用户 `yuer` 能访问业务库 `yuer`，但没有创建 shadow database 的权限。

推荐修复方式：用 MySQL root 或管理员账号登录：

```powershell
mysql -u root -p
```

进入 MySQL 后执行：

```sql
CREATE DATABASE IF NOT EXISTS yuer CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'yuer'@'127.0.0.1' IDENTIFIED BY '123456';

GRANT CREATE, ALTER, DROP, REFERENCES ON *.* TO 'yuer'@'127.0.0.1';
GRANT ALL PRIVILEGES ON yuer.* TO 'yuer'@'127.0.0.1';

FLUSH PRIVILEGES;
```

如果 MySQL 版本不支持 `CREATE USER IF NOT EXISTS`，可改用：

```sql
ALTER USER 'yuer'@'127.0.0.1' IDENTIFIED BY '123456';
```

授权后退出 MySQL：

```sql
exit;
```

然后重新执行：

```powershell
pnpm --filter @yuer/api prisma:migrate
pnpm --filter @yuer/api prisma:seed
```

## P2021 admins 表不存在

报错示例：

```text
P2021 The table `admins` does not exist in the current database.
```

原因：这是 `prisma:seed` 的后续报错，不是首要问题。由于 `prisma:migrate` 没有成功，`admins` 等表还没有被创建。

处理方式：先解决 `P3014`，让迁移成功，再执行 seed。

## P3015 migration.sql 不存在

报错示例：

```text
P3015 Could not find the migration file at migration.sql.
Please delete the directory or restore the migration file.
```

原因：`apps/api/prisma/migrations` 下存在一个不完整迁移目录，目录里没有 `migration.sql`。本项目已发现本地残留目录：

```text
apps/api/prisma/migrations/20260603123000_init
```

该目录为空，可以删除。完整迁移位于：

```text
apps/api/prisma/migrations/20260603142000_init/migration.sql
```

删除空目录后重新执行：

```powershell
pnpm --filter @yuer/api prisma:migrate
pnpm --filter @yuer/api prisma:seed
```

## 可选方案：固定 shadow database

如果不想给 `yuer` 用户授予全局 `CREATE/DROP` 权限，可以改为固定 shadow database：

1. 新建一个专用库，例如 `yuer_shadow`。
2. 只给 `yuer` 用户授权访问 `yuer` 和 `yuer_shadow`。
3. 在 Prisma datasource 中配置 `shadowDatabaseUrl`。

当前代码尚未启用这个方案。若后续要采用，需要同步修改：

- `apps/api/prisma/schema.prisma`
- `.env.example`
- README 初始化说明

本地开发阶段优先使用前面的 root 授权方案，步骤更少。
