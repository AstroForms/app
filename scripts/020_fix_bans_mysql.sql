-- MySQL migration: fix bans table compatibility for runtime checks/listing
-- Safe to run multiple times and compatible with older MySQL variants.

CREATE TABLE IF NOT EXISTS `bans` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `banned_by` VARCHAR(191) NOT NULL,
  `reason` TEXT NULL,
  `is_global` TINYINT(1) NOT NULL DEFAULT 1,
  `banned_until` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

-- Add missing columns (without relying on ADD COLUMN IF NOT EXISTS support).
SET @has_banned_by := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'bans'
    AND column_name = 'banned_by'
);
SET @sql_banned_by := IF(
  @has_banned_by = 0,
  'ALTER TABLE `bans` ADD COLUMN `banned_by` VARCHAR(191) NOT NULL DEFAULT ''''',
  'SELECT 1'
);
PREPARE stmt FROM @sql_banned_by;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_reason := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'bans'
    AND column_name = 'reason'
);
SET @sql_reason := IF(
  @has_reason = 0,
  'ALTER TABLE `bans` ADD COLUMN `reason` TEXT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql_reason;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_is_global := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'bans'
    AND column_name = 'is_global'
);
SET @sql_is_global := IF(
  @has_is_global = 0,
  'ALTER TABLE `bans` ADD COLUMN `is_global` TINYINT(1) NOT NULL DEFAULT 1',
  'SELECT 1'
);
PREPARE stmt FROM @sql_is_global;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_banned_until := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'bans'
    AND column_name = 'banned_until'
);
SET @sql_banned_until := IF(
  @has_banned_until = 0,
  'ALTER TABLE `bans` ADD COLUMN `banned_until` DATETIME NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql_banned_until;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_created_at := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'bans'
    AND column_name = 'created_at'
);
SET @sql_created_at := IF(
  @has_created_at = 0,
  'ALTER TABLE `bans` ADD COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
  'SELECT 1'
);
PREPARE stmt FROM @sql_created_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_bans_user_id_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'bans'
    AND index_name = 'idx_bans_user_id'
);
SET @idx_bans_user_id_sql := IF(
  @idx_bans_user_id_exists = 0,
  'CREATE INDEX `idx_bans_user_id` ON `bans` (`user_id`)',
  'SELECT 1'
);
PREPARE stmt FROM @idx_bans_user_id_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
