-- Fix member counts for all channels
-- Run this in Supabase SQL Editor

-- Update all channels with the correct member count
UPDATE channels c
SET member_count = (
  SELECT COUNT(*)
  FROM channel_members cm
  WHERE cm.channel_id = c.id
);

-- Ensure the trigger exists and works correctly
DROP TRIGGER IF EXISTS on_channel_member_change ON channel_members;

CREATE OR REPLACE FUNCTION public.update_channel_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE channels SET member_count = member_count + 1 WHERE id = NEW.channel_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE channels SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.channel_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_channel_member_change
  AFTER INSERT OR DELETE ON channel_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_channel_member_count();
