-- Increase post/comment content capacity for MySQL Prisma deployment
-- Fixes "value too long for column content" on /api/db insert into posts.

ALTER TABLE posts
  MODIFY COLUMN content TEXT NOT NULL;

ALTER TABLE post_comments
  MODIFY COLUMN content TEXT NOT NULL;
