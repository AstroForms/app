-- Add rules column to bots table
-- Run this in Supabase SQL Editor

-- Add rules column to store bot rules/instructions
alter table public.bots add column if not exists rules jsonb default '[]';

-- Each rule looks like: { "id": "uuid", "name": "Rule Name", "description": "What the bot must do", "priority": 1, "is_active": true }
