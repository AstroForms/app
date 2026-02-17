-- Bot Features: Profile images, verification, invites
-- Run this in Supabase SQL Editor

-- Add banner_url to bots
alter table public.bots add column if not exists banner_url text;

-- Drop rules column from bots (we only use hardcoded preset rules now)
alter table public.bots drop column if exists rules;

-- Add is_public column to bots for discoverability
alter table public.bots add column if not exists is_public boolean default false;

-- Bot invites table (invite bots to channels)
create table if not exists public.bot_channel_invites (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(bot_id, channel_id)
);

alter table public.bot_channel_invites enable row level security;

-- Anyone can view invites for their own bots or channels
create policy "bot_invites_select" on public.bot_channel_invites for select using (
  invited_by = auth.uid() or
  exists (select 1 from public.bots b where b.id = bot_id and b.owner_id = auth.uid()) or
  exists (select 1 from public.channels c where c.id = channel_id and c.owner_id = auth.uid())
);

-- Channel owners can invite bots
create policy "bot_invites_insert" on public.bot_channel_invites for insert with check (
  invited_by = auth.uid() and
  exists (select 1 from public.channels c where c.id = channel_id and c.owner_id = auth.uid())
);

-- Bot owners can update (accept/reject) invites
create policy "bot_invites_update" on public.bot_channel_invites for update using (
  exists (select 1 from public.bots b where b.id = bot_id and b.owner_id = auth.uid())
);

-- Channel owners or bot owners can delete invites
create policy "bot_invites_delete" on public.bot_channel_invites for delete using (
  invited_by = auth.uid() or
  exists (select 1 from public.bots b where b.id = bot_id and b.owner_id = auth.uid())
);

-- Bot active rules (selected preset rules per bot)
create table if not exists public.bot_active_rules (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade,
  rule_name text not null,
  rule_description text not null,
  rule_category text not null,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique(bot_id, rule_name)
);

alter table public.bot_active_rules enable row level security;

create policy "bot_rules_select_all" on public.bot_active_rules for select using (true);
create policy "bot_rules_insert_own" on public.bot_active_rules for insert with check (
  exists (select 1 from public.bots b where b.id = bot_id and b.owner_id = auth.uid())
);
create policy "bot_rules_update_own" on public.bot_active_rules for update using (
  exists (select 1 from public.bots b where b.id = bot_id and b.owner_id = auth.uid())
);
create policy "bot_rules_delete_own" on public.bot_active_rules for delete using (
  exists (select 1 from public.bots b where b.id = bot_id and b.owner_id = auth.uid())
);

-- Bot verification requests table
create table if not exists public.bot_verification_requests (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade unique,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  -- Questionnaire answers
  bot_purpose text not null,
  target_audience text not null,
  unique_features text not null,
  expected_users text not null,
  channel_count integer not null default 0,
  has_privacy_policy boolean default false,
  privacy_policy_url text,
  contact_email text not null,
  additional_info text,
  -- Review info
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.bot_verification_requests enable row level security;

-- Bot owners can view their own requests, admins can view all
create policy "bot_verify_select" on public.bot_verification_requests for select using (
  owner_id = auth.uid() or
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'owner'))
);

-- Bot owners can create requests (only if bot has 50+ channel invites)
create policy "bot_verify_insert" on public.bot_verification_requests for insert with check (
  owner_id = auth.uid() and
  exists (select 1 from public.bots b where b.id = bot_id and b.owner_id = auth.uid())
);

-- Only admins can update verification status
create policy "bot_verify_update" on public.bot_verification_requests for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'owner'))
);

-- Function to count bot's active channels
create or replace function get_bot_channel_count(p_bot_id uuid)
returns integer
language plpgsql
security definer
as $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.bot_channel_invites
  where bot_id = p_bot_id and status = 'accepted';
  return v_count;
end;
$$;

-- Function to check if bot can request verification (50+ channels)
create or replace function can_request_bot_verification(p_bot_id uuid)
returns boolean
language plpgsql
security definer
as $$
begin
  return get_bot_channel_count(p_bot_id) >= 50;
end;
$$;

-- Storage bucket for bot avatars and banners
insert into storage.buckets (id, name, public) values ('bot-images', 'bot-images', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload bot images
create policy "bot_images_insert" on storage.objects for insert
with check (bucket_id = 'bot-images' and auth.role() = 'authenticated');

create policy "bot_images_update" on storage.objects for update
using (bucket_id = 'bot-images' and auth.role() = 'authenticated');

create policy "bot_images_select" on storage.objects for select
using (bucket_id = 'bot-images');

create policy "bot_images_delete" on storage.objects for delete
using (bucket_id = 'bot-images' and auth.role() = 'authenticated');
