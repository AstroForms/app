-- MySQL migration: extended admin moderation + reports + verification fixes
-- Safe to run multiple times.

-- 1) Ensure verification + lock columns exist for moderation features.
ALTER TABLE `profiles`
  ADD COLUMN IF NOT EXISTS `is_verified` TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE `channels`
  ADD COLUMN IF NOT EXISTS `is_locked` TINYINT(1) NOT NULL DEFAULT 0;

-- 2) Extend reports with queueing, priority and ownership metadata.
ALTER TABLE `reports`
  ADD COLUMN IF NOT EXISTS `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN IF NOT EXISTS `queue_status` ENUM('PENDING', 'TRIAGED', 'ESCALATED', 'RESOLVED', 'DISMISSED') NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS `assigned_to` VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `severity_score` INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `resolution_action` VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `last_action_at` DATETIME NULL;

-- Backfill queue_status from existing status values where possible.
UPDATE `reports`
SET `queue_status` =
  CASE UPPER(COALESCE(`status`, 'PENDING'))
    WHEN 'RESOLVED' THEN 'RESOLVED'
    WHEN 'DISMISSED' THEN 'DISMISSED'
    ELSE `queue_status`
  END
WHERE `queue_status` IN ('PENDING', 'TRIAGED', 'ESCALATED');

-- Helpful indexes for admin workflows (idempotent).
SET @idx_reports_queue_status_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'reports'
    AND index_name = 'idx_reports_queue_status'
);
SET @idx_reports_queue_status_sql := IF(
  @idx_reports_queue_status_exists = 0,
  'CREATE INDEX `idx_reports_queue_status` ON `reports` (`queue_status`)',
  'SELECT 1'
);
PREPARE stmt FROM @idx_reports_queue_status_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_reports_priority_created_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'reports'
    AND index_name = 'idx_reports_priority_created'
);
SET @idx_reports_priority_created_sql := IF(
  @idx_reports_priority_created_exists = 0,
  'CREATE INDEX `idx_reports_priority_created` ON `reports` (`priority`, `created_at`)',
  'SELECT 1'
);
PREPARE stmt FROM @idx_reports_priority_created_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_reports_assigned_status_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'reports'
    AND index_name = 'idx_reports_assigned_status'
);
SET @idx_reports_assigned_status_sql := IF(
  @idx_reports_assigned_status_exists = 0,
  'CREATE INDEX `idx_reports_assigned_status` ON `reports` (`assigned_to`, `queue_status`)',
  'SELECT 1'
);
PREPARE stmt FROM @idx_reports_assigned_status_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_reports_last_action_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'reports'
    AND index_name = 'idx_reports_last_action'
);
SET @idx_reports_last_action_sql := IF(
  @idx_reports_last_action_exists = 0,
  'CREATE INDEX `idx_reports_last_action` ON `reports` (`last_action_at`)',
  'SELECT 1'
);
PREPARE stmt FROM @idx_reports_last_action_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3) Report action history for auditability.
CREATE TABLE IF NOT EXISTS `report_actions` (
  `id` VARCHAR(191) NOT NULL,
  `report_id` VARCHAR(191) NOT NULL,
  `actor_id` VARCHAR(191) NOT NULL,
  `action` VARCHAR(64) NOT NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_report_actions_report` (`report_id`),
  KEY `idx_report_actions_actor` (`actor_id`),
  KEY `idx_report_actions_created` (`created_at`)
) ENGINE=InnoDB;
