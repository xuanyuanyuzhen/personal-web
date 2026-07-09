-- CreateTable
CREATE TABLE `admins` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(64) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `passwordVersion` INTEGER NOT NULL DEFAULT 1,
    `displayName` VARCHAR(64) NOT NULL DEFAULT 'Administrator',
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `admins_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `navigations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(64) NOT NULL,
    `title` VARCHAR(80) NOT NULL,
    `type` ENUM('INTERNAL', 'EXTERNAL', 'PAGE') NOT NULL DEFAULT 'INTERNAL',
    `path` VARCHAR(255) NULL,
    `url` VARCHAR(500) NULL,
    `target` VARCHAR(32) NULL,
    `icon` VARCHAR(64) NULL,
    `parentId` INTEGER NULL,
    `pageId` INTEGER NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `navigations_key_key`(`key`),
    INDEX `navigations_parentId_sortOrder_idx`(`parentId`, `sortOrder`),
    INDEX `navigations_isEnabled_sortOrder_idx`(`isEnabled`, `sortOrder`),
    INDEX `navigations_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(160) NOT NULL,
    `slug` VARCHAR(160) NOT NULL,
    `summary` VARCHAR(500) NULL,
    `content` LONGTEXT NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `visibility` ENUM('PUBLIC', 'PRIVATE') NOT NULL DEFAULT 'PUBLIC',
    `seoTitle` VARCHAR(160) NULL,
    `seoDescription` VARCHAR(500) NULL,
    `seoKeywords` VARCHAR(255) NULL,
    `isPinned` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `publishedAt` DATETIME(3) NULL,
    `scheduledAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pages_slug_key`(`slug`),
    INDEX `pages_status_visibility_isPinned_sortOrder_createdAt_idx`(`status`, `visibility`, `isPinned`, `sortOrder`, `createdAt`),
    INDEX `pages_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `thoughts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `content` LONGTEXT NOT NULL,
    `summary` VARCHAR(500) NULL,
    `imageUrl` VARCHAR(500) NULL,
    `mood` VARCHAR(64) NULL,
    `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `visibility` ENUM('PUBLIC', 'PRIVATE') NOT NULL DEFAULT 'PUBLIC',
    `isPinned` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `publishedAt` DATETIME(3) NULL,
    `scheduledAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `thoughts_status_visibility_isPinned_sortOrder_createdAt_idx`(`status`, `visibility`, `isPinned`, `sortOrder`, `createdAt`),
    INDEX `thoughts_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `essay_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(80) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `essay_categories_name_key`(`name`),
    UNIQUE INDEX `essay_categories_slug_key`(`slug`),
    INDEX `essay_categories_isEnabled_sortOrder_idx`(`isEnabled`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `essays` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(180) NOT NULL,
    `slug` VARCHAR(180) NOT NULL,
    `summary` VARCHAR(500) NULL,
    `content` LONGTEXT NOT NULL,
    `coverUrl` VARCHAR(500) NULL,
    `categoryId` INTEGER NULL,
    `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `visibility` ENUM('PUBLIC', 'PRIVATE') NOT NULL DEFAULT 'PUBLIC',
    `isPinned` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `publishedAt` DATETIME(3) NULL,
    `scheduledAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `essays_slug_key`(`slug`),
    INDEX `essays_categoryId_status_visibility_idx`(`categoryId`, `status`, `visibility`),
    INDEX `essays_status_visibility_isPinned_sortOrder_createdAt_idx`(`status`, `visibility`, `isPinned`, `sortOrder`, `createdAt`),
    INDEX `essays_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `albums` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `description` VARCHAR(500) NULL,
    `coverUrl` VARCHAR(500) NULL,
    `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'PUBLISHED',
    `visibility` ENUM('PUBLIC', 'PRIVATE') NOT NULL DEFAULT 'PUBLIC',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `albums_name_key`(`name`),
    UNIQUE INDEX `albums_slug_key`(`slug`),
    INDEX `albums_status_visibility_isEnabled_sortOrder_idx`(`status`, `visibility`, `isEnabled`, `sortOrder`),
    INDEX `albums_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `photos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(160) NOT NULL,
    `description` VARCHAR(500) NULL,
    `originalUrl` VARCHAR(500) NOT NULL,
    `largeUrl` VARCHAR(500) NULL,
    `thumbUrl` VARCHAR(500) NULL,
    `albumId` INTEGER NULL,
    `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'PUBLISHED',
    `visibility` ENUM('PUBLIC', 'PRIVATE') NOT NULL DEFAULT 'PUBLIC',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `photos_albumId_status_visibility_sortOrder_idx`(`albumId`, `status`, `visibility`, `sortOrder`),
    INDEX `photos_status_visibility_sortOrder_createdAt_idx`(`status`, `visibility`, `sortOrder`, `createdAt`),
    INDEX `photos_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `messages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nickname` VARCHAR(80) NOT NULL,
    `email` VARCHAR(160) NOT NULL,
    `content` TEXT NOT NULL,
    `avatarUrl` VARCHAR(500) NULL,
    `visitorId` VARCHAR(128) NOT NULL,
    `ipHash` VARCHAR(128) NULL,
    `ipMasked` VARCHAR(64) NULL,
    `browser` VARCHAR(64) NULL,
    `device` VARCHAR(64) NULL,
    `auditStatus` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `hitWords` JSON NULL,
    `blacklistMatched` BOOLEAN NOT NULL DEFAULT false,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `messages_auditStatus_createdAt_idx`(`auditStatus`, `createdAt`),
    INDEX `messages_visitorId_createdAt_idx`(`visitorId`, `createdAt`),
    INDEX `messages_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `comments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `essayId` INTEGER NOT NULL,
    `parentId` INTEGER NULL,
    `nickname` VARCHAR(80) NOT NULL,
    `email` VARCHAR(160) NOT NULL,
    `content` TEXT NOT NULL,
    `visitorId` VARCHAR(128) NOT NULL,
    `ipHash` VARCHAR(128) NULL,
    `ipMasked` VARCHAR(64) NULL,
    `browser` VARCHAR(64) NULL,
    `device` VARCHAR(64) NULL,
    `auditStatus` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `hitWords` JSON NULL,
    `blacklistMatched` BOOLEAN NOT NULL DEFAULT false,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `comments_essayId_auditStatus_createdAt_idx`(`essayId`, `auditStatus`, `createdAt`),
    INDEX `comments_parentId_idx`(`parentId`),
    INDEX `comments_visitorId_createdAt_idx`(`visitorId`, `createdAt`),
    INDEX `comments_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `likes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `visitorId` VARCHAR(128) NOT NULL,
    `targetType` ENUM('SITE', 'NAVIGATION', 'PAGE', 'THOUGHT', 'ESSAY', 'ESSAY_CATEGORY', 'PHOTO', 'ALBUM', 'MESSAGE', 'COMMENT', 'MUSIC', 'TAG', 'MASCOT', 'ANNOUNCEMENT', 'SETTING') NOT NULL,
    `targetId` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `likes_targetType_targetId_createdAt_idx`(`targetType`, `targetId`, `createdAt`),
    INDEX `likes_createdAt_idx`(`createdAt`),
    UNIQUE INDEX `likes_visitorId_targetType_targetId_key`(`visitorId`, `targetType`, `targetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tags` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(80) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `color` VARCHAR(32) NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tags_name_key`(`name`),
    UNIQUE INDEX `tags_slug_key`(`slug`),
    INDEX `tags_isEnabled_name_idx`(`isEnabled`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tag_scopes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tagId` INTEGER NOT NULL,
    `targetType` ENUM('SITE', 'NAVIGATION', 'PAGE', 'THOUGHT', 'ESSAY', 'ESSAY_CATEGORY', 'PHOTO', 'ALBUM', 'MESSAGE', 'COMMENT', 'MUSIC', 'TAG', 'MASCOT', 'ANNOUNCEMENT', 'SETTING') NOT NULL,

    INDEX `tag_scopes_targetType_idx`(`targetType`),
    UNIQUE INDEX `tag_scopes_tagId_targetType_key`(`tagId`, `targetType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tag_relations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tagId` INTEGER NOT NULL,
    `targetType` ENUM('SITE', 'NAVIGATION', 'PAGE', 'THOUGHT', 'ESSAY', 'ESSAY_CATEGORY', 'PHOTO', 'ALBUM', 'MESSAGE', 'COMMENT', 'MUSIC', 'TAG', 'MASCOT', 'ANNOUNCEMENT', 'SETTING') NOT NULL,
    `targetId` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `tag_relations_targetType_targetId_idx`(`targetType`, `targetId`),
    UNIQUE INDEX `tag_relations_tagId_targetType_targetId_key`(`tagId`, `targetType`, `targetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `forbidden_words` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `word` VARCHAR(160) NOT NULL,
    `ruleType` ENUM('PLAIN', 'REGEX_RESERVED') NOT NULL DEFAULT 'PLAIN',
    `note` VARCHAR(500) NULL,
    `extension` JSON NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `forbidden_words_word_key`(`word`),
    INDEX `forbidden_words_isEnabled_ruleType_idx`(`isEnabled`, `ruleType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `blacklist_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` ENUM('NAME', 'EMAIL', 'IP', 'VISITOR_ID') NOT NULL,
    `value` VARCHAR(255) NOT NULL,
    `note` VARCHAR(500) NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `blacklist_items_isEnabled_type_idx`(`isEnabled`, `type`),
    UNIQUE INDEX `blacklist_items_type_value_key`(`type`, `value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `targetType` ENUM('SITE', 'NAVIGATION', 'PAGE', 'THOUGHT', 'ESSAY', 'ESSAY_CATEGORY', 'PHOTO', 'ALBUM', 'MESSAGE', 'COMMENT', 'MUSIC', 'TAG', 'MASCOT', 'ANNOUNCEMENT', 'SETTING') NOT NULL,
    `targetId` VARCHAR(64) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL,
    `reason` VARCHAR(500) NULL,
    `hitWords` JSON NULL,
    `reviewedBy` INTEGER NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_records_targetType_targetId_idx`(`targetType`, `targetId`),
    INDEX `audit_records_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `musics` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(160) NOT NULL,
    `artist` VARCHAR(160) NOT NULL,
    `localUrl` VARCHAR(500) NULL,
    `externalUrl` VARCHAR(500) NULL,
    `lyricText` LONGTEXT NULL,
    `lyricFileUrl` VARCHAR(500) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `musics_isEnabled_sortOrder_idx`(`isEnabled`, `sortOrder`),
    INDEX `musics_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mascots` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(64) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `imageUrl` VARCHAR(500) NULL,
    `displayScopes` JSON NULL,
    `live2dConfig` JSON NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `mascots_key_key`(`key`),
    INDEX `mascots_isEnabled_idx`(`isEnabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mascot_lines` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(80) NOT NULL,
    `mascotId` INTEGER NULL,
    `pageKey` VARCHAR(80) NOT NULL DEFAULT '*',
    `content` VARCHAR(500) NOT NULL,
    `weight` INTEGER NOT NULL DEFAULT 1,
    `isRandom` BOOLEAN NOT NULL DEFAULT true,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `mascot_lines_key_key`(`key`),
    INDEX `mascot_lines_pageKey_isEnabled_weight_idx`(`pageKey`, `isEnabled`, `weight`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(100) NOT NULL,
    `group` VARCHAR(60) NOT NULL DEFAULT 'site',
    `value` JSON NOT NULL,
    `description` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `settings_key_key`(`key`),
    INDEX `settings_group_idx`(`group`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `announcements` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(64) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `announcements_key_key`(`key`),
    INDEX `announcements_isEnabled_publishedAt_idx`(`isEnabled`, `publishedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `visit_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pageType` ENUM('SITE', 'NAVIGATION', 'PAGE', 'THOUGHT', 'ESSAY', 'ESSAY_CATEGORY', 'PHOTO', 'ALBUM', 'MESSAGE', 'COMMENT', 'MUSIC', 'TAG', 'MASCOT', 'ANNOUNCEMENT', 'SETTING') NOT NULL,
    `pageId` VARCHAR(64) NULL,
    `path` VARCHAR(500) NOT NULL,
    `ipHash` VARCHAR(128) NULL,
    `ipMasked` VARCHAR(64) NULL,
    `browser` VARCHAR(64) NULL,
    `device` VARCHAR(64) NULL,
    `visitDate` DATE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `visit_logs_visitDate_idx`(`visitDate`),
    INDEX `visit_logs_pageType_pageId_visitDate_idx`(`pageType`, `pageId`, `visitDate`),
    INDEX `visit_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `operation_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `adminId` INTEGER NULL,
    `action` ENUM('LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'PERMANENT_DELETE', 'AUDIT', 'CHANGE_PASSWORD', 'UPDATE_SETTING') NOT NULL,
    `objectType` ENUM('SITE', 'NAVIGATION', 'PAGE', 'THOUGHT', 'ESSAY', 'ESSAY_CATEGORY', 'PHOTO', 'ALBUM', 'MESSAGE', 'COMMENT', 'MUSIC', 'TAG', 'MASCOT', 'ANNOUNCEMENT', 'SETTING') NULL,
    `objectId` VARCHAR(64) NULL,
    `ip` VARCHAR(64) NULL,
    `detail` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `operation_logs_adminId_createdAt_idx`(`adminId`, `createdAt`),
    INDEX `operation_logs_action_createdAt_idx`(`action`, `createdAt`),
    INDEX `operation_logs_objectType_objectId_idx`(`objectType`, `objectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recycle_bin_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `objectType` ENUM('SITE', 'NAVIGATION', 'PAGE', 'THOUGHT', 'ESSAY', 'ESSAY_CATEGORY', 'PHOTO', 'ALBUM', 'MESSAGE', 'COMMENT', 'MUSIC', 'TAG', 'MASCOT', 'ANNOUNCEMENT', 'SETTING') NOT NULL,
    `objectId` VARCHAR(64) NOT NULL,
    `title` VARCHAR(180) NOT NULL,
    `summary` VARCHAR(500) NULL,
    `snapshot` JSON NULL,
    `status` ENUM('ACTIVE', 'RESTORED', 'PURGED') NOT NULL DEFAULT 'ACTIVE',
    `deletedById` INTEGER NULL,
    `deletedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `restoredAt` DATETIME(3) NULL,
    `purgedAt` DATETIME(3) NULL,

    INDEX `recycle_bin_items_objectType_objectId_idx`(`objectType`, `objectId`),
    INDEX `recycle_bin_items_status_deletedAt_idx`(`status`, `deletedAt`),
    INDEX `recycle_bin_items_deletedById_deletedAt_idx`(`deletedById`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `navigations` ADD CONSTRAINT `navigations_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `navigations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `navigations` ADD CONSTRAINT `navigations_pageId_fkey` FOREIGN KEY (`pageId`) REFERENCES `pages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `essays` ADD CONSTRAINT `essays_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `essay_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `photos` ADD CONSTRAINT `photos_albumId_fkey` FOREIGN KEY (`albumId`) REFERENCES `albums`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comments` ADD CONSTRAINT `comments_essayId_fkey` FOREIGN KEY (`essayId`) REFERENCES `essays`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comments` ADD CONSTRAINT `comments_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `comments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tag_scopes` ADD CONSTRAINT `tag_scopes_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tag_relations` ADD CONSTRAINT `tag_relations_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mascot_lines` ADD CONSTRAINT `mascot_lines_mascotId_fkey` FOREIGN KEY (`mascotId`) REFERENCES `mascots`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `operation_logs` ADD CONSTRAINT `operation_logs_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `admins`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recycle_bin_items` ADD CONSTRAINT `recycle_bin_items_deletedById_fkey` FOREIGN KEY (`deletedById`) REFERENCES `admins`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
