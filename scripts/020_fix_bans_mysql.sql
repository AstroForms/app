-- MySQL migration: fix bans table compatibility for runtime checks/listing
-- Safe to run multiple times.

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

ALTER TABLE `bans`
  ADD COLUMN IF NOT EXISTS `banned_by` VARCHAR(191) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS `reason` TEXT NULL,
  ADD COLUMN IF NOT EXISTS `is_global` TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS `banned_until` DATETIME NULL,
  ADD COLUMN IF NOT EXISTS `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

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
