-- MySQL migration: user blocking for DMs (WhatsApp-like)
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS `blocked_users` (
  `id` VARCHAR(191) NOT NULL,
  `blocker_id` VARCHAR(191) NOT NULL,
  `blocked_id` VARCHAR(191) NOT NULL,
  `reason` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_blocker_blocked` (`blocker_id`, `blocked_id`),
  KEY `idx_blocked_users_blocker` (`blocker_id`),
  KEY `idx_blocked_users_blocked` (`blocked_id`)
) ENGINE=InnoDB;

-- Optional cleanup for invalid historic rows.
DELETE FROM `blocked_users` WHERE `blocker_id` = `blocked_id`;

-- Self-block prevention is enforced in API code.
