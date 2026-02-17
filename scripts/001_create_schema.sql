-- AstroForms Database Schema

-- Profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  bio text,
  avatar_url text,
  xp integer default 0,
  level integer default 1,
  role text default 'user' check (role in ('user', 'moderator', 'admin', 'owner')),
  show_followers boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_all" on public.profiles for select using (true);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_delete_own" on public.profiles for delete using (auth.uid() = id);

-- Auto-create profile on signup trigger
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'full_name', coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', null)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Follows table
create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(follower_id, following_id)
);

alter table public.follows enable row level security;
create policy "follows_select_all" on public.follows for select using (true);
create policy "follows_insert_own" on public.follows for insert with check (auth.uid() = follower_id);
create policy "follows_delete_own" on public.follows for delete using (auth.uid() = follower_id);

-- Channels table
create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  icon_url text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  is_verified boolean default false,
  member_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.channels enable row level security;
create policy "channels_select_all" on public.channels for select using (true);
create policy "channels_insert_auth" on public.channels for insert with check (auth.uid() = owner_id);
create policy "channels_update_owner" on public.channels for update using (auth.uid() = owner_id);
create policy "channels_delete_owner" on public.channels for delete using (auth.uid() = owner_id);

-- Channel members
create table if not exists public.channel_members (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text default 'member' check (role in ('member', 'moderator', 'admin', 'owner')),
  joined_at timestamptz default now(),
  unique(channel_id, user_id)
);

alter table public.channel_members enable row level security;
create policy "members_select_all" on public.channel_members for select using (true);
create policy "members_insert_own" on public.channel_members for insert with check (auth.uid() = user_id);
create policy "members_delete_own" on public.channel_members for delete using (auth.uid() = user_id);
create policy "members_update_channel_admin" on public.channel_members for update using (
  exists (
    select 1 from public.channel_members cm
    where cm.channel_id = channel_members.channel_id
    and cm.user_id = auth.uid()
    and cm.role in ('admin', 'owner')
  )
);

-- Posts table
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  is_automated boolean default false,
  bot_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.posts enable row level security;
create policy "posts_select_all" on public.posts for select using (true);
create policy "posts_insert_own" on public.posts for insert with check (auth.uid() = user_id);
create policy "posts_update_own" on public.posts for update using (auth.uid() = user_id);
create policy "posts_delete_own" on public.posts for delete using (
  auth.uid() = user_id
  or exists (
    select 1 from public.channel_members cm
    where cm.channel_id = posts.channel_id
    and cm.user_id = auth.uid()
    and cm.role in ('moderator', 'admin', 'owner')
  )
);

-- Post likes
create table if not exists public.post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(post_id, user_id)
);

alter table public.post_likes enable row level security;
create policy "likes_select_all" on public.post_likes for select using (true);
create policy "likes_insert_own" on public.post_likes for insert with check (auth.uid() = user_id);
create policy "likes_delete_own" on public.post_likes for delete using (auth.uid() = user_id);

-- Reports table
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_type text not null check (reported_type in ('post', 'channel', 'user', 'bot')),
  reported_id uuid not null,
  reason text not null,
  status text default 'pending' check (status in ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at timestamptz default now()
);

alter table public.reports enable row level security;
create policy "reports_insert_auth" on public.reports for insert with check (auth.uid() = reporter_id);
create policy "reports_select_admin" on public.reports for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'owner', 'moderator'))
);

-- Bots table
create table if not exists public.bots (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  avatar_url text,
  is_verified boolean default false,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.bots enable row level security;
create policy "bots_select_all" on public.bots for select using (true);
create policy "bots_insert_own" on public.bots for insert with check (auth.uid() = owner_id);
create policy "bots_update_own" on public.bots for update using (auth.uid() = owner_id);
create policy "bots_delete_own" on public.bots for delete using (auth.uid() = owner_id);

-- Bot automations (block-based)
create table if not exists public.bot_automations (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade,
  name text not null,
  trigger_type text not null check (trigger_type in ('on_post', 'on_join', 'on_leave', 'scheduled', 'on_keyword')),
  trigger_config jsonb default '{}',
  action_type text not null check (action_type in ('send_post', 'send_reply', 'assign_badge', 'add_xp')),
  action_config jsonb default '{}',
  is_active boolean default true,
  channel_id uuid references public.channels(id) on delete cascade,
  created_at timestamptz default now()
);

alter table public.bot_automations enable row level security;
create policy "automations_select_all" on public.bot_automations for select using (true);
create policy "automations_insert_own" on public.bot_automations for insert with check (
  exists (select 1 from public.bots b where b.id = bot_automations.bot_id and b.owner_id = auth.uid())
);
create policy "automations_update_own" on public.bot_automations for update using (
  exists (select 1 from public.bots b where b.id = bot_automations.bot_id and b.owner_id = auth.uid())
);
create policy "automations_delete_own" on public.bot_automations for delete using (
  exists (select 1 from public.bots b where b.id = bot_automations.bot_id and b.owner_id = auth.uid())
);

-- User badges
create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete cascade,
  badge_type text not null check (badge_type in ('owner', 'admin', 'moderator', 'verified', 'bot_developer', 'early_adopter', 'top_contributor')),
  granted_at timestamptz default now(),
  granted_by uuid references public.profiles(id),
  unique(user_id, channel_id, badge_type)
);

alter table public.user_badges enable row level security;
create policy "badges_select_all" on public.user_badges for select using (true);
create policy "badges_insert_admin" on public.user_badges for insert with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'owner'))
  or exists (
    select 1 from public.channel_members cm
    where cm.channel_id = user_badges.channel_id
    and cm.user_id = auth.uid()
    and cm.role in ('admin', 'owner')
  )
);
create policy "badges_delete_admin" on public.user_badges for delete using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'owner'))
);

-- XP log for tracking
create table if not exists public.xp_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null,
  reason text not null,
  created_at timestamptz default now()
);

alter table public.xp_log enable row level security;
create policy "xp_log_select_own" on public.xp_log for select using (auth.uid() = user_id);
create policy "xp_log_insert_system" on public.xp_log for insert with check (auth.uid() = user_id);

-- Bans table
create table if not exists public.bans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete cascade,
  banned_by uuid not null references public.profiles(id),
  reason text,
  is_global boolean default false,
  expires_at timestamptz,
  created_at timestamptz default now()
);

alter table public.bans enable row level security;
create policy "bans_select_admin" on public.bans for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'owner', 'moderator'))
  or auth.uid() = user_id
);
create policy "bans_insert_admin" on public.bans for insert with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'owner'))
  or exists (
    select 1 from public.channel_members cm
    where cm.channel_id = bans.channel_id
    and cm.user_id = auth.uid()
    and cm.role in ('admin', 'owner', 'moderator')
  )
);

-- Function to add XP and level up
create or replace function public.add_xp(p_user_id uuid, p_amount integer, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  new_xp integer;
  new_level integer;
begin
  update profiles set xp = xp + p_amount where id = p_user_id returning xp into new_xp;
  new_level := 1 + floor(new_xp / 100.0)::integer;
  update profiles set level = new_level where id = p_user_id;
  insert into xp_log (user_id, amount, reason) values (p_user_id, p_amount, p_reason);
end;
$$;

-- Function to update channel member count
create or replace function public.update_channel_member_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update channels set member_count = member_count + 1 where id = NEW.channel_id;
    return NEW;
  elsif TG_OP = 'DELETE' then
    update channels set member_count = member_count - 1 where id = OLD.channel_id;
    return OLD;
  end if;
end;
$$;

drop trigger if exists on_member_change on public.channel_members;
create trigger on_member_change
  after insert or delete on public.channel_members
  for each row
  execute function public.update_channel_member_count();
