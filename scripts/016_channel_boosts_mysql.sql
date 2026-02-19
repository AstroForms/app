-- MySQL migration for channel advertising/boosting
-- Features:
-- 1) adds channels.boosted_until
-- 2) adds index for sorting boosted channels
-- 3) adds procedure promote_channel(...) with owner check + XP cost deduction

ALTER TABLE `channels`
  ADD COLUMN `boosted_until` DATETIME NULL AFTER `member_count`;

CREATE INDEX `idx_channels_boosted_until` ON `channels` (`boosted_until`);

DELIMITER //

DROP PROCEDURE IF EXISTS `promote_channel`//
CREATE PROCEDURE `promote_channel`(
  IN p_user_id VARCHAR(191),
  IN p_channel_id VARCHAR(191),
  IN p_package VARCHAR(16)
)
BEGIN
  DECLARE v_cost INT;
  DECLARE v_days INT;
  DECLARE v_owner_id VARCHAR(191);
  DECLARE v_current_until DATETIME;
  DECLARE v_now DATETIME;
  DECLARE v_xp INT;
  DECLARE v_new_xp INT;
  DECLARE v_level INT DEFAULT 1;
  DECLARE v_threshold INT;
  DECLARE v_new_until DATETIME;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SET v_now = UTC_TIMESTAMP();

  CASE p_package
    WHEN 'day' THEN
      SET v_cost = 300;
      SET v_days = 1;
    WHEN 'week' THEN
      SET v_cost = 1000;
      SET v_days = 7;
    WHEN 'month' THEN
      SET v_cost = 3500;
      SET v_days = 30;
    ELSE
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid package';
  END CASE;

  START TRANSACTION;

  SELECT `owner_id`, `boosted_until`
    INTO v_owner_id, v_current_until
  FROM `channels`
  WHERE `id` = p_channel_id
  FOR UPDATE;

  IF v_owner_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Channel not found';
  END IF;

  IF v_owner_id <> p_user_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only owner can promote this channel';
  END IF;

  SELECT `xp`
    INTO v_xp
  FROM `profiles`
  WHERE `id` = p_user_id
  FOR UPDATE;

  IF v_xp IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Profile not found';
  END IF;

  IF v_xp < v_cost THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Not enough XP';
  END IF;

  SET v_new_xp = v_xp - v_cost;

  -- Keep the same level progression logic as app/api/rpc/add_xp
  SET v_level = 1;
  SET v_threshold = v_level * v_level * 50;
  WHILE v_new_xp >= v_threshold DO
    SET v_level = v_level + 1;
    SET v_threshold = v_level * v_level * 50;
  END WHILE;

  UPDATE `profiles`
  SET `xp` = v_new_xp,
      `level` = v_level
  WHERE `id` = p_user_id;

  IF v_current_until IS NOT NULL AND v_current_until > v_now THEN
    SET v_new_until = DATE_ADD(v_current_until, INTERVAL v_days DAY);
  ELSE
    SET v_new_until = DATE_ADD(v_now, INTERVAL v_days DAY);
  END IF;

  UPDATE `channels`
  SET `boosted_until` = v_new_until
  WHERE `id` = p_channel_id;

  COMMIT;

  SELECT v_new_xp AS xp, v_level AS level, v_new_until AS boosted_until;
END//

DELIMITER ;

-- Example ranking query (boosted channels first):
-- SELECT c.*
-- FROM channels c
-- WHERE c.is_public = 1
-- ORDER BY
--   (c.boosted_until IS NOT NULL AND c.boosted_until > UTC_TIMESTAMP()) DESC,
--   c.boosted_until DESC,
--   c.member_count DESC,
--   c.created_at DESC;
