-- Bot Channel Rules Execution System
-- Run this in Supabase SQL Editor

-- Table to track which rules are active for bots in specific channels
-- When a bot is accepted to a channel, the channel owner can choose which rules to activate
create table if not exists public.bot_channel_rules (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  rule_name text not null,
  rule_category text not null,
  is_enabled boolean default true,
  config jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(bot_id, channel_id, rule_name)
);

create index if not exists idx_bot_channel_rules_bot on public.bot_channel_rules(bot_id);
create index if not exists idx_bot_channel_rules_channel on public.bot_channel_rules(channel_id);

alter table public.bot_channel_rules enable row level security;

-- Everyone can view active rules
create policy "bot_channel_rules_select" on public.bot_channel_rules for select using (true);

-- Channel owners can manage rules for their channels
create policy "bot_channel_rules_insert" on public.bot_channel_rules for insert with check (
  exists (select 1 from public.channels c where c.id = channel_id and c.owner_id = auth.uid())
);

create policy "bot_channel_rules_update" on public.bot_channel_rules for update using (
  exists (select 1 from public.channels c where c.id = channel_id and c.owner_id = auth.uid())
);

create policy "bot_channel_rules_delete" on public.bot_channel_rules for delete using (
  exists (select 1 from public.channels c where c.id = channel_id and c.owner_id = auth.uid())
);

-- Bot execution logs (track when rules are executed)
create table if not exists public.bot_execution_logs (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  rule_name text not null,
  trigger_type text not null,
  trigger_data jsonb,
  action_result jsonb,
  executed_at timestamptz default now()
);

create index if not exists idx_bot_execution_logs_bot on public.bot_execution_logs(bot_id);
create index if not exists idx_bot_execution_logs_channel on public.bot_execution_logs(channel_id);
create index if not exists idx_bot_execution_logs_executed on public.bot_execution_logs(executed_at desc);

alter table public.bot_execution_logs enable row level security;

-- Channel owners and bot owners can view logs
create policy "bot_logs_select" on public.bot_execution_logs for select using (
  exists (select 1 from public.channels c where c.id = channel_id and c.owner_id = auth.uid()) or
  exists (select 1 from public.bots b where b.id = bot_id and b.owner_id = auth.uid())
);

-- Only system can insert logs (via triggers/functions)
create policy "bot_logs_insert" on public.bot_execution_logs for insert with check (true);

-- Function to get all active bots in a channel with their enabled rules
create or replace function get_channel_bots_with_rules(p_channel_id uuid)
returns table(
  bot_id uuid,
  bot_name text,
  bot_avatar text,
  is_verified boolean,
  rule_name text,
  rule_category text,
  rule_config jsonb
)
language plpgsql
security definer
as $$
begin
  return query
  select 
    b.id as bot_id,
    b.name as bot_name,
    b.avatar_url as bot_avatar,
    b.is_verified,
    bcr.rule_name,
    bcr.rule_category,
    bcr.config as rule_config
  from public.bots b
  inner join public.bot_channel_invites bci on bci.bot_id = b.id
  inner join public.bot_channel_rules bcr on bcr.bot_id = b.id and bcr.channel_id = p_channel_id
  where bci.channel_id = p_channel_id
    and bci.status = 'accepted'
    and b.is_active = true
    and bcr.is_enabled = true
  order by b.name, bcr.rule_category, bcr.rule_name;
end;
$$;

-- Function to check if a bot has a specific rule active in a channel
create or replace function is_bot_rule_active(p_bot_id uuid, p_channel_id uuid, p_rule_name text)
returns boolean
language plpgsql
security definer
as $$
declare
  v_is_active boolean;
begin
  select bcr.is_enabled into v_is_active
  from public.bot_channel_rules bcr
  inner join public.bot_channel_invites bci on bci.bot_id = bcr.bot_id and bci.channel_id = bcr.channel_id
  where bcr.bot_id = p_bot_id
    and bcr.channel_id = p_channel_id
    and bcr.rule_name = p_rule_name
    and bci.status = 'accepted';
  
  return coalesce(v_is_active, false);
end;
$$;

-- Function to get all enabled rules for a bot in a channel
create or replace function get_bot_channel_rules(p_bot_id uuid, p_channel_id uuid)
returns table(
  rule_name text,
  rule_category text,
  is_enabled boolean,
  config jsonb
)
language plpgsql
security definer
as $$
begin
  return query
  select 
    bcr.rule_name,
    bcr.rule_category,
    bcr.is_enabled,
    bcr.config
  from public.bot_channel_rules bcr
  inner join public.bot_channel_invites bci on bci.bot_id = bcr.bot_id and bci.channel_id = bcr.channel_id
  where bcr.bot_id = p_bot_id
    and bcr.channel_id = p_channel_id
    and bci.status = 'accepted'
  order by bcr.rule_category, bcr.rule_name;
end;
$$;

-- Function to enable a rule for a bot in a channel
create or replace function enable_bot_channel_rule(
  p_bot_id uuid, 
  p_channel_id uuid, 
  p_rule_name text,
  p_rule_category text,
  p_config jsonb default '{}'
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_rule_id uuid;
begin
  -- Check if user owns the channel
  if not exists (select 1 from public.channels where id = p_channel_id and owner_id = auth.uid()) then
    raise exception 'Not authorized to manage rules for this channel';
  end if;
  
  -- Check if bot is accepted in the channel
  if not exists (
    select 1 from public.bot_channel_invites 
    where bot_id = p_bot_id and channel_id = p_channel_id and status = 'accepted'
  ) then
    raise exception 'Bot is not active in this channel';
  end if;
  
  -- Insert or update the rule
  insert into public.bot_channel_rules (bot_id, channel_id, rule_name, rule_category, config, is_enabled)
  values (p_bot_id, p_channel_id, p_rule_name, p_rule_category, p_config, true)
  on conflict (bot_id, channel_id, rule_name) 
  do update set is_enabled = true, config = p_config, updated_at = now()
  returning id into v_rule_id;
  
  return v_rule_id;
end;
$$;

-- Function to disable a rule for a bot in a channel
create or replace function disable_bot_channel_rule(p_bot_id uuid, p_channel_id uuid, p_rule_name text)
returns void
language plpgsql
security definer
as $$
begin
  -- Check if user owns the channel
  if not exists (select 1 from public.channels where id = p_channel_id and owner_id = auth.uid()) then
    raise exception 'Not authorized to manage rules for this channel';
  end if;
  
  update public.bot_channel_rules
  set is_enabled = false, updated_at = now()
  where bot_id = p_bot_id and channel_id = p_channel_id and rule_name = p_rule_name;
end;
$$;

-- Function to log bot rule execution
create or replace function log_bot_execution(
  p_bot_id uuid,
  p_channel_id uuid,
  p_rule_name text,
  p_trigger_type text,
  p_trigger_data jsonb default null,
  p_action_result jsonb default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_log_id uuid;
begin
  insert into public.bot_execution_logs (bot_id, channel_id, rule_name, trigger_type, trigger_data, action_result)
  values (p_bot_id, p_channel_id, p_rule_name, p_trigger_type, p_trigger_data, p_action_result)
  returning id into v_log_id;
  
  return v_log_id;
end;
$$;

-- Trigger function to execute bot rules when a post is created
create or replace function trigger_bot_on_post()
returns trigger
language plpgsql
security definer
as $$
declare
  v_bot record;
  v_action text;
begin
  -- Get all bots with relevant rules for this channel
  for v_bot in 
    select bcr.bot_id, bcr.rule_name, bcr.config, b.name as bot_name
    from public.bot_channel_rules bcr
    inner join public.bots b on b.id = bcr.bot_id
    inner join public.bot_channel_invites bci on bci.bot_id = bcr.bot_id and bci.channel_id = bcr.channel_id
    where bcr.channel_id = NEW.channel_id
      and bci.status = 'accepted'
      and bcr.is_enabled = true
      and b.is_active = true
      and bcr.rule_category in ('Moderation', 'Engagement', 'Utility')
  loop
    -- Log the execution (actual action would be handled by edge functions/webhooks)
    perform log_bot_execution(
      v_bot.bot_id, 
      NEW.channel_id, 
      v_bot.rule_name, 
      'on_post',
      jsonb_build_object('post_id', NEW.id, 'user_id', NEW.user_id, 'content', left(NEW.content, 100)),
      jsonb_build_object('status', 'triggered', 'bot_name', v_bot.bot_name)
    );
  end loop;
  
  return NEW;
end;
$$;

-- Create trigger for post creation (only if not automated post from bot)
drop trigger if exists bot_on_post_trigger on public.posts;
create trigger bot_on_post_trigger
  after insert on public.posts
  for each row
  when (NEW.is_automated = false)
  execute function trigger_bot_on_post();

-- Trigger function to execute bot rules when a user joins a channel
create or replace function trigger_bot_on_join()
returns trigger
language plpgsql
security definer
as $$
declare
  v_bot record;
begin
  -- Get all bots with join-related rules for this channel
  for v_bot in 
    select bcr.bot_id, bcr.rule_name, bcr.config, b.name as bot_name
    from public.bot_channel_rules bcr
    inner join public.bots b on b.id = bcr.bot_id
    inner join public.bot_channel_invites bci on bci.bot_id = bcr.bot_id and bci.channel_id = bcr.channel_id
    where bcr.channel_id = NEW.channel_id
      and bci.status = 'accepted'
      and bcr.is_enabled = true
      and b.is_active = true
      and bcr.rule_name in ('Willkommens-Nachricht', 'Vorstellungs-Reminder', 'Mentor-Zuweisung', 'Neue-Account-Prüfung')
  loop
    perform log_bot_execution(
      v_bot.bot_id, 
      NEW.channel_id, 
      v_bot.rule_name, 
      'on_join',
      jsonb_build_object('user_id', NEW.user_id, 'joined_at', NEW.joined_at),
      jsonb_build_object('status', 'triggered', 'bot_name', v_bot.bot_name)
    );
  end loop;
  
  return NEW;
end;
$$;

-- Create trigger for channel membership
drop trigger if exists bot_on_join_trigger on public.channel_members;
create trigger bot_on_join_trigger
  after insert on public.channel_members
  for each row
  execute function trigger_bot_on_join();
