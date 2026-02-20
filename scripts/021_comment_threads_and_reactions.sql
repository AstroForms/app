-- Add threaded comments and emoji reactions for post comments (MySQL/MariaDB)
-- Note: requires privileges like ALTER, CREATE, INDEX, REFERENCES.

-- 1) Add parent_comment_id for threaded replies
ALTER TABLE post_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id VARCHAR(191) NULL;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'post_comments'
    AND INDEX_NAME = 'idx_post_comments_parent_comment_id'
);

SET @sql := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_post_comments_parent_comment_id ON post_comments(parent_comment_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add FK only when missing (idempotent)
SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'post_comments'
    AND CONSTRAINT_NAME = 'fk_post_comments_parent_comment'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @sql := IF(
  @fk_exists = 0,
  'ALTER TABLE post_comments
     ADD CONSTRAINT fk_post_comments_parent_comment
     FOREIGN KEY (parent_comment_id) REFERENCES post_comments(id)
     ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) Store emoji reactions per comment
CREATE TABLE IF NOT EXISTS comment_reactions (
  id VARCHAR(191) NOT NULL PRIMARY KEY,
  comment_id VARCHAR(191) NOT NULL,
  user_id VARCHAR(191) NOT NULL,
  emoji VARCHAR(16) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_comment_reactions_comment_user_emoji (comment_id, user_id, emoji),
  KEY idx_comment_reactions_comment_id (comment_id),
  KEY idx_comment_reactions_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add FK comment_id only when missing
SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'comment_reactions'
    AND CONSTRAINT_NAME = 'fk_comment_reactions_comment'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @sql := IF(
  @fk_exists = 0,
  'ALTER TABLE comment_reactions
     ADD CONSTRAINT fk_comment_reactions_comment
     FOREIGN KEY (comment_id) REFERENCES post_comments(id)
     ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add FK user_id only when missing
SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'comment_reactions'
    AND CONSTRAINT_NAME = 'fk_comment_reactions_user'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @sql := IF(
  @fk_exists = 0,
  'ALTER TABLE comment_reactions
     ADD CONSTRAINT fk_comment_reactions_user
     FOREIGN KEY (user_id) REFERENCES profiles(id)
     ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
