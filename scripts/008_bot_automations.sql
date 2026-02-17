-- Extended Bot Automations & Features
-- Run this in Supabase SQL Editor

-- ============================================
-- EXTEND TRIGGER TYPES
-- ============================================

-- Drop and recreate the constraint with more trigger types
alter table public.bot_automations drop constraint if exists bot_automations_trigger_type_check;
alter table public.bot_automations add constraint bot_automations_trigger_type_check 
  check (trigger_type in (
    -- Post triggers
    'on_post',           -- When any post is created
    'on_post_edit',      -- When a post is edited
    'on_post_delete',    -- When a post is deleted
    -- User triggers  
    'on_join',           -- When someone joins the channel
    'on_leave',          -- When someone leaves the channel
    'on_first_post',     -- When a user makes their first post
    -- Interaction triggers
    'on_like',           -- When a post gets liked
    'on_comment',        -- When someone comments
    'on_share',          -- When a post is shared
    'on_remix',          -- When a post is remixed
    'on_save',           -- When a post is saved
    -- Content triggers
    'on_keyword',        -- When specific keyword is detected
    'on_mention',        -- When the bot or user is mentioned
    'on_hashtag',        -- When specific hashtag is used
    'on_link',           -- When a link is posted
    'on_image',          -- When an image is posted
    'on_gif',            -- When a GIF is posted
    -- Milestone triggers
    'on_xp_milestone',   -- When user reaches XP milestone
    'on_level_up',       -- When user levels up
    'on_streak',         -- When user maintains a streak
    'on_post_count',     -- When user reaches post count milestone
    -- Time triggers
    'scheduled',         -- Scheduled/timed trigger
    'on_time_inactive',  -- When channel is inactive for time
    -- Moderation triggers
    'on_report',         -- When content is reported
    'on_spam_detected',  -- When spam is detected
    'on_bad_word',       -- When bad word is detected
    -- Special triggers
    'on_birthday',       -- On user's birthday
    'on_anniversary',    -- On channel join anniversary
    'manual'             -- Manually triggered
  ));

-- ============================================
-- EXTEND ACTION TYPES
-- ============================================

alter table public.bot_automations drop constraint if exists bot_automations_action_type_check;
alter table public.bot_automations add constraint bot_automations_action_type_check 
  check (action_type in (
    -- Messaging actions
    'send_post',         -- Send a post in channel
    'send_reply',        -- Reply to triggering post
    'send_dm',           -- Send direct message (future)
    'send_welcome',      -- Send welcome message
    'send_reminder',     -- Send a reminder
    'send_announcement', -- Send announcement post
    -- Moderation actions
    'delete_post',       -- Delete the triggering post
    'warn_user',         -- Send warning to user
    'mute_user',         -- Mute user for duration
    'kick_user',         -- Remove user from channel
    'ban_user',          -- Ban user from channel
    'pin_post',          -- Pin the post
    'unpin_post',        -- Unpin a post
    'lock_post',         -- Lock post from comments
    'hide_post',         -- Hide post from feed
    -- Reward actions
    'add_xp',            -- Give XP to user
    'remove_xp',         -- Remove XP from user
    'assign_badge',      -- Assign a badge
    'remove_badge',      -- Remove a badge
    'assign_role',       -- Assign a role
    'add_streak',        -- Add to streak count
    -- Utility actions
    'auto_tag',          -- Auto-add tags to post
    'translate_post',    -- Translate post content
    'create_poll',       -- Create a poll
    'archive_post',      -- Archive old post
    'log_action',        -- Log to audit log
    -- Engagement actions
    'auto_like',         -- Like the post
    'auto_comment',      -- Add automated comment
    'feature_post',      -- Feature the post
    'share_to_channel',  -- Share to another channel
    -- Chain actions
    'trigger_automation' -- Trigger another automation
  ));

-- ============================================
-- BOT ACTION LOG
-- ============================================

create table if not exists public.bot_action_log (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid references public.bots(id) on delete set null,
  automation_id uuid references public.bot_automations(id) on delete set null,
  action_type text not null,
  trigger_type text,
  target_user_id uuid references public.profiles(id) on delete set null,
  target_post_id uuid references public.posts(id) on delete set null,
  channel_id uuid references public.channels(id) on delete set null,
  details jsonb default '{}',
  success boolean default true,
  error_message text,
  executed_at timestamptz default now()
);

alter table public.bot_action_log enable row level security;
create policy "log_select_own" on public.bot_action_log for select using (
  exists (select 1 from public.bots b where b.id = bot_action_log.bot_id and b.owner_id = auth.uid())
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'owner'))
);

-- Index for faster queries
create index if not exists idx_bot_action_log_bot on public.bot_action_log(bot_id);
create index if not exists idx_bot_action_log_channel on public.bot_action_log(channel_id);
create index if not exists idx_bot_action_log_time on public.bot_action_log(executed_at desc);

-- ============================================
-- SCHEDULED TASKS
-- ============================================

create table if not exists public.scheduled_tasks (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.bot_automations(id) on delete cascade,
  next_run_at timestamptz not null,
  last_run_at timestamptz,
  schedule_type text not null check (schedule_type in ('once', 'hourly', 'daily', 'weekly', 'monthly', 'custom')),
  schedule_config jsonb default '{}', -- e.g. { "hour": 9, "minute": 0, "days": ["Mon", "Wed", "Fri"] }
  is_active boolean default true,
  run_count integer default 0,
  created_at timestamptz default now()
);

alter table public.scheduled_tasks enable row level security;
create policy "scheduled_select_own" on public.scheduled_tasks for select using (
  exists (
    select 1 from public.bot_automations ba 
    join public.bots b on b.id = ba.bot_id 
    where ba.id = scheduled_tasks.automation_id and b.owner_id = auth.uid()
  )
);
create policy "scheduled_insert_own" on public.scheduled_tasks for insert with check (
  exists (
    select 1 from public.bot_automations ba 
    join public.bots b on b.id = ba.bot_id 
    where ba.id = scheduled_tasks.automation_id and b.owner_id = auth.uid()
  )
);
create policy "scheduled_update_own" on public.scheduled_tasks for update using (
  exists (
    select 1 from public.bot_automations ba 
    join public.bots b on b.id = ba.bot_id 
    where ba.id = scheduled_tasks.automation_id and b.owner_id = auth.uid()
  )
);
create policy "scheduled_delete_own" on public.scheduled_tasks for delete using (
  exists (
    select 1 from public.bot_automations ba 
    join public.bots b on b.id = ba.bot_id 
    where ba.id = scheduled_tasks.automation_id and b.owner_id = auth.uid()
  )
);

-- ============================================
-- USER WARNINGS
-- ============================================

create table if not exists public.user_warnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete cascade,
  issued_by_bot_id uuid references public.bots(id) on delete set null,
  issued_by_user_id uuid references public.profiles(id) on delete set null,
  reason text not null,
  severity text not null check (severity in ('info', 'warning', 'severe')),
  expires_at timestamptz,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table public.user_warnings enable row level security;
create policy "warnings_select_own" on public.user_warnings for select using (
  user_id = auth.uid() 
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'owner', 'moderator'))
  or exists (
    select 1 from public.channel_members cm 
    where cm.channel_id = user_warnings.channel_id 
    and cm.user_id = auth.uid() 
    and cm.role in ('admin', 'owner', 'moderator')
  )
);
create policy "warnings_insert_mod" on public.user_warnings for insert with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'owner', 'moderator'))
  or exists (
    select 1 from public.channel_members cm 
    where cm.channel_id = user_warnings.channel_id 
    and cm.user_id = auth.uid() 
    and cm.role in ('admin', 'owner', 'moderator')
  )
);

-- ============================================
-- USER MUTES
-- ============================================

create table if not exists public.user_mutes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete cascade, -- null = global mute
  muted_by_bot_id uuid references public.bots(id) on delete set null,
  muted_by_user_id uuid references public.profiles(id) on delete set null,
  reason text,
  muted_at timestamptz default now(),
  unmute_at timestamptz, -- null = permanent
  is_active boolean default true
);

alter table public.user_mutes enable row level security;
create policy "mutes_select_own_or_mod" on public.user_mutes for select using (
  user_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'owner', 'moderator'))
  or exists (
    select 1 from public.channel_members cm 
    where cm.channel_id = user_mutes.channel_id 
    and cm.user_id = auth.uid() 
    and cm.role in ('admin', 'owner', 'moderator')
  )
);

-- ============================================
-- USER BANS
-- ============================================

create table if not exists public.user_bans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete cascade, -- null = global ban
  banned_by_bot_id uuid references public.bots(id) on delete set null,
  banned_by_user_id uuid references public.profiles(id) on delete set null,
  reason text,
  banned_at timestamptz default now(),
  unban_at timestamptz, -- null = permanent
  is_active boolean default true
);

alter table public.user_bans enable row level security;
create policy "bans_select_all" on public.user_bans for select using (true);

-- ============================================
-- WORD FILTER / BLACKLIST
-- ============================================

create table if not exists public.word_filters (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references public.channels(id) on delete cascade, -- null = global filter
  word text not null,
  filter_type text not null check (filter_type in ('exact', 'contains', 'regex')),
  action text not null check (action in ('delete', 'warn', 'flag', 'replace')),
  replacement text, -- for 'replace' action
  severity text default 'warning' check (severity in ('info', 'warning', 'severe')),
  created_by uuid references public.profiles(id) on delete set null,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table public.word_filters enable row level security;
create policy "filters_select_mod" on public.word_filters for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'owner', 'moderator'))
  or exists (
    select 1 from public.channel_members cm 
    where cm.channel_id = word_filters.channel_id 
    and cm.user_id = auth.uid() 
    and cm.role in ('admin', 'owner', 'moderator')
  )
);
create policy "filters_insert_mod" on public.word_filters for insert with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'owner', 'moderator'))
  or exists (
    select 1 from public.channel_members cm 
    where cm.channel_id = word_filters.channel_id 
    and cm.user_id = auth.uid() 
    and cm.role in ('admin', 'owner', 'moderator')
  )
);

-- ============================================
-- AUTO-RESPONSES
-- ============================================

create table if not exists public.auto_responses (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete cascade,
  trigger_phrase text not null,
  match_type text not null check (match_type in ('exact', 'contains', 'starts_with', 'ends_with', 'regex')),
  response_content text not null,
  response_type text default 'reply' check (response_type in ('reply', 'post', 'dm')),
  cooldown_seconds integer default 0,
  last_triggered_at timestamptz,
  trigger_count integer default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table public.auto_responses enable row level security;
create policy "autoresponses_select_all" on public.auto_responses for select using (true);
create policy "autoresponses_insert_own" on public.auto_responses for insert with check (
  exists (select 1 from public.bots b where b.id = auto_responses.bot_id and b.owner_id = auth.uid())
);
create policy "autoresponses_update_own" on public.auto_responses for update using (
  exists (select 1 from public.bots b where b.id = auto_responses.bot_id and b.owner_id = auth.uid())
);
create policy "autoresponses_delete_own" on public.auto_responses for delete using (
  exists (select 1 from public.bots b where b.id = auto_responses.bot_id and b.owner_id = auth.uid())
);

-- ============================================
-- BOT COMMANDS
-- ============================================

create table if not exists public.bot_commands (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade,
  command text not null, -- e.g. "!help", "!xp", "!stats"
  description text,
  response_content text,
  action_type text check (action_type in ('respond', 'add_xp', 'show_stats', 'show_leaderboard', 'create_poll', 'assign_role', 'custom')),
  action_config jsonb default '{}',
  required_role text check (required_role in ('member', 'moderator', 'admin', 'owner')),
  cooldown_seconds integer default 0,
  usage_count integer default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique(bot_id, command)
);

alter table public.bot_commands enable row level security;
create policy "commands_select_all" on public.bot_commands for select using (true);
create policy "commands_insert_own" on public.bot_commands for insert with check (
  exists (select 1 from public.bots b where b.id = bot_commands.bot_id and b.owner_id = auth.uid())
);
create policy "commands_update_own" on public.bot_commands for update using (
  exists (select 1 from public.bots b where b.id = bot_commands.bot_id and b.owner_id = auth.uid())
);
create policy "commands_delete_own" on public.bot_commands for delete using (
  exists (select 1 from public.bots b where b.id = bot_commands.bot_id and b.owner_id = auth.uid())
);

-- ============================================
-- STREAKS TABLE
-- ============================================

create table if not exists public.user_streaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete cascade,
  streak_type text not null check (streak_type in ('daily_post', 'daily_login', 'weekly_active', 'comment_streak')),
  current_streak integer default 0,
  longest_streak integer default 0,
  last_activity_at timestamptz,
  created_at timestamptz default now(),
  unique(user_id, channel_id, streak_type)
);

alter table public.user_streaks enable row level security;
create policy "streaks_select_all" on public.user_streaks for select using (true);
create policy "streaks_insert_own" on public.user_streaks for insert with check (auth.uid() = user_id);
create policy "streaks_update_own" on public.user_streaks for update using (auth.uid() = user_id);

-- ============================================
-- FEATURED POSTS
-- ============================================

create table if not exists public.featured_posts (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  featured_by_bot_id uuid references public.bots(id) on delete set null,
  featured_by_user_id uuid references public.profiles(id) on delete set null,
  featured_at timestamptz default now(),
  expires_at timestamptz,
  position integer default 0,
  is_active boolean default true
);

alter table public.featured_posts enable row level security;
create policy "featured_select_all" on public.featured_posts for select using (true);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check if user is muted in channel
create or replace function is_user_muted(p_user_id uuid, p_channel_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.user_mutes 
    where user_id = p_user_id 
    and (channel_id = p_channel_id or channel_id is null)
    and is_active = true
    and (unmute_at is null or unmute_at > now())
  );
end;
$$ language plpgsql security definer;

-- Function to check if user is banned from channel
create or replace function is_user_banned(p_user_id uuid, p_channel_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.user_bans 
    where user_id = p_user_id 
    and (channel_id = p_channel_id or channel_id is null)
    and is_active = true
    and (unban_at is null or unban_at > now())
  );
end;
$$ language plpgsql security definer;

-- Function to log bot action
create or replace function log_bot_action(
  p_bot_id uuid,
  p_automation_id uuid,
  p_action_type text,
  p_trigger_type text,
  p_target_user_id uuid,
  p_target_post_id uuid,
  p_channel_id uuid,
  p_details jsonb,
  p_success boolean,
  p_error_message text
)
returns uuid as $$
declare
  v_log_id uuid;
begin
  insert into public.bot_action_log (
    bot_id, automation_id, action_type, trigger_type, 
    target_user_id, target_post_id, channel_id, 
    details, success, error_message
  ) values (
    p_bot_id, p_automation_id, p_action_type, p_trigger_type,
    p_target_user_id, p_target_post_id, p_channel_id,
    p_details, p_success, p_error_message
  ) returning id into v_log_id;
  
  return v_log_id;
end;
$$ language plpgsql security definer;

-- Function to warn user
create or replace function warn_user(
  p_user_id uuid,
  p_channel_id uuid,
  p_reason text,
  p_severity text,
  p_issued_by_bot_id uuid default null,
  p_issued_by_user_id uuid default null
)
returns uuid as $$
declare
  v_warning_id uuid;
begin
  insert into public.user_warnings (
    user_id, channel_id, issued_by_bot_id, issued_by_user_id, reason, severity
  ) values (
    p_user_id, p_channel_id, p_issued_by_bot_id, p_issued_by_user_id, p_reason, p_severity
  ) returning id into v_warning_id;
  
  return v_warning_id;
end;
$$ language plpgsql security definer;

-- Function to mute user
create or replace function mute_user(
  p_user_id uuid,
  p_channel_id uuid,
  p_reason text,
  p_duration_minutes integer,
  p_muted_by_bot_id uuid default null,
  p_muted_by_user_id uuid default null
)
returns uuid as $$
declare
  v_mute_id uuid;
  v_unmute_at timestamptz;
begin
  if p_duration_minutes is not null and p_duration_minutes > 0 then
    v_unmute_at := now() + (p_duration_minutes || ' minutes')::interval;
  end if;
  
  insert into public.user_mutes (
    user_id, channel_id, muted_by_bot_id, muted_by_user_id, reason, unmute_at
  ) values (
    p_user_id, p_channel_id, p_muted_by_bot_id, p_muted_by_user_id, p_reason, v_unmute_at
  ) returning id into v_mute_id;
  
  return v_mute_id;
end;
$$ language plpgsql security definer;

-- Function to update streak
create or replace function update_user_streak(
  p_user_id uuid,
  p_channel_id uuid,
  p_streak_type text
)
returns integer as $$
declare
  v_existing record;
  v_new_streak integer;
begin
  select * into v_existing from public.user_streaks 
  where user_id = p_user_id 
  and (channel_id = p_channel_id or (channel_id is null and p_channel_id is null))
  and streak_type = p_streak_type;
  
  if v_existing is null then
    -- Create new streak
    insert into public.user_streaks (user_id, channel_id, streak_type, current_streak, longest_streak, last_activity_at)
    values (p_user_id, p_channel_id, p_streak_type, 1, 1, now());
    return 1;
  else
    -- Check if within streak window (24h for daily, 7d for weekly)
    if v_existing.last_activity_at > now() - interval '36 hours' then
      v_new_streak := v_existing.current_streak + 1;
    else
      v_new_streak := 1; -- Reset streak
    end if;
    
    update public.user_streaks 
    set current_streak = v_new_streak,
        longest_streak = greatest(longest_streak, v_new_streak),
        last_activity_at = now()
    where id = v_existing.id;
    
    return v_new_streak;
  end if;
end;
$$ language plpgsql security definer;

-- ============================================
-- EXTEND AUTOMATIONS TABLE
-- ============================================

-- Add more columns to automations for advanced features
alter table public.bot_automations add column if not exists cooldown_seconds integer default 0;
alter table public.bot_automations add column if not exists last_triggered_at timestamptz;
alter table public.bot_automations add column if not exists trigger_count integer default 0;
alter table public.bot_automations add column if not exists max_triggers_per_day integer;
alter table public.bot_automations add column if not exists priority integer default 0;
alter table public.bot_automations add column if not exists conditions jsonb default '[]';

-- Add execution count to bots
alter table public.bots add column if not exists total_actions integer default 0;
alter table public.bots add column if not exists last_action_at timestamptz;
