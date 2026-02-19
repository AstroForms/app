-- MySQL migration for channel promotion approval workflow
-- Safe version for hosts where FK creation fails with errno 150.
--
-- Why this works:
-- - Creates the table without foreign key constraints (indexes still included).
-- - App/API already validates requester/channel IDs before approve/reject.
-- - You can add FKs later once table definitions are fully aligned.

CREATE TABLE IF NOT EXISTS `channel_promotion_requests` (
  `id` VARCHAR(191) NOT NULL,
  `channel_id` VARCHAR(191) NOT NULL,
  `requester_id` VARCHAR(191) NOT NULL,
  `package_key` VARCHAR(32) NOT NULL,
  `package_days` INT NOT NULL,
  `cost` INT NOT NULL,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  `reviewed_by` VARCHAR(191) NULL,
  `reviewed_at` DATETIME NULL,
  `rejection_reason` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_channel_promo_channel_status` (`channel_id`, `status`),
  KEY `idx_channel_promo_requester_status` (`requester_id`, `status`),
  KEY `idx_channel_promo_status_created` (`status`, `created_at`),
  KEY `idx_channel_promo_reviewed_by` (`reviewed_by`)
) ENGINE=InnoDB;

-- Optional: add FKs later (run one by one after checking SHOW CREATE TABLE outputs)
-- ALTER TABLE `channel_promotion_requests`
--   ADD CONSTRAINT `fk_channel_promo_channel`
--   FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON DELETE CASCADE;
--
-- ALTER TABLE `channel_promotion_requests`
--   ADD CONSTRAINT `fk_channel_promo_requester`
--   FOREIGN KEY (`requester_id`) REFERENCES `profiles`(`id`) ON DELETE CASCADE;
--
-- ALTER TABLE `channel_promotion_requests`
--   ADD CONSTRAINT `fk_channel_promo_reviewer`
--   FOREIGN KEY (`reviewed_by`) REFERENCES `profiles`(`id`) ON DELETE SET NULL;
