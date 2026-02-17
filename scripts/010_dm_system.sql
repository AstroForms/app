-- Direct Messages (DM) System with Encryption
-- Run this in Supabase SQL Editor

-- Add DM privacy setting to profiles
alter table public.profiles add column if not exists dm_privacy text default 'everyone' check (dm_privacy in ('everyone', 'followers', 'request', 'nobody'));

-- Conversations table (for DM threads)
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_message_at timestamptz default now(),
  is_group boolean default false,
  name text, -- for group chats
  encryption_key_id text -- reference to client-side encryption key
);

alter table public.conversations enable row level security;

-- Conversation participants
create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  last_read_at timestamptz default now(),
  is_muted boolean default false,
  is_archived boolean default false,
  nickname text,
  role text default 'member' check (role in ('member', 'admin', 'owner')),
  unique(conversation_id, user_id)
);

alter table public.conversation_participants enable row level security;

-- Messages table (encrypted content)
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content_encrypted text not null, -- encrypted message content
  content_iv text, -- initialization vector for decryption
  message_type text default 'text' check (message_type in ('text', 'image', 'gif', 'file', 'voice', 'system')),
  media_url text, -- URL for media messages (stored encrypted reference)
  media_type text, -- MIME type
  media_size integer, -- file size in bytes
  reply_to_id uuid references public.messages(id) on delete set null,
  is_edited boolean default false,
  edited_at timestamptz,
  is_deleted boolean default false,
  deleted_at timestamptz,
  reactions jsonb default '{}', -- { "emoji": ["user_id1", "user_id2"] }
  created_at timestamptz default now()
);

alter table public.messages enable row level security;

-- DM Requests (for request-only mode)
create table if not exists public.dm_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  message_preview text, -- optional preview message
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(sender_id, recipient_id)
);

alter table public.dm_requests enable row level security;

-- Message read receipts
create table if not exists public.message_read_receipts (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz default now(),
  unique(message_id, user_id)
);

alter table public.message_read_receipts enable row level security;

-- Blocked users table
create table if not exists public.blocked_users (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  reason text,
  created_at timestamptz default now(),
  unique(blocker_id, blocked_id)
);

alter table public.blocked_users enable row level security;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Conversations: Can only see conversations you're part of
create policy "conversations_select_participant" on public.conversations for select using (
  exists (
    select 1 from public.conversation_participants cp 
    where cp.conversation_id = conversations.id and cp.user_id = auth.uid()
  )
);

create policy "conversations_insert" on public.conversations for insert with check (true);

create policy "conversations_update_participant" on public.conversations for update using (
  exists (
    select 1 from public.conversation_participants cp 
    where cp.conversation_id = conversations.id and cp.user_id = auth.uid()
  )
);

-- Conversation participants
create policy "participants_select_own" on public.conversation_participants for select using (
  user_id = auth.uid() or exists (
    select 1 from public.conversation_participants cp 
    where cp.conversation_id = conversation_participants.conversation_id and cp.user_id = auth.uid()
  )
);

create policy "participants_insert" on public.conversation_participants for insert with check (true);

create policy "participants_update_own" on public.conversation_participants for update using (
  user_id = auth.uid()
);

-- Messages: Can only see messages in conversations you're part of
create policy "messages_select_participant" on public.messages for select using (
  exists (
    select 1 from public.conversation_participants cp 
    where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
  )
);

create policy "messages_insert_participant" on public.messages for insert with check (
  sender_id = auth.uid() and exists (
    select 1 from public.conversation_participants cp 
    where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
  )
);

create policy "messages_update_own" on public.messages for update using (
  sender_id = auth.uid()
);

-- DM Requests
create policy "dm_requests_select_own" on public.dm_requests for select using (
  sender_id = auth.uid() or recipient_id = auth.uid()
);

create policy "dm_requests_insert" on public.dm_requests for insert with check (
  sender_id = auth.uid()
);

create policy "dm_requests_update_recipient" on public.dm_requests for update using (
  recipient_id = auth.uid()
);

create policy "dm_requests_delete_own" on public.dm_requests for delete using (
  sender_id = auth.uid() or recipient_id = auth.uid()
);

-- Read receipts
create policy "receipts_select_participant" on public.message_read_receipts for select using (
  exists (
    select 1 from public.messages m
    join public.conversation_participants cp on cp.conversation_id = m.conversation_id
    where m.id = message_read_receipts.message_id and cp.user_id = auth.uid()
  )
);

create policy "receipts_insert_own" on public.message_read_receipts for insert with check (
  user_id = auth.uid()
);

-- Blocked users
create policy "blocked_select_own" on public.blocked_users for select using (
  blocker_id = auth.uid() or blocked_id = auth.uid()
);

create policy "blocked_insert_own" on public.blocked_users for insert with check (
  blocker_id = auth.uid()
);

create policy "blocked_delete_own" on public.blocked_users for delete using (
  blocker_id = auth.uid()
);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Check if user can send DM to another user
create or replace function can_send_dm(p_sender_id uuid, p_recipient_id uuid)
returns boolean as $$
declare
  v_recipient_privacy text;
  v_is_blocked boolean;
  v_is_following boolean;
  v_has_accepted_request boolean;
begin
  -- Check if blocked
  select exists (
    select 1 from public.blocked_users 
    where (blocker_id = p_recipient_id and blocked_id = p_sender_id)
       or (blocker_id = p_sender_id and blocked_id = p_recipient_id)
  ) into v_is_blocked;
  
  if v_is_blocked then
    return false;
  end if;
  
  -- Get recipient's DM privacy setting
  select dm_privacy into v_recipient_privacy from public.profiles where id = p_recipient_id;
  
  -- Check based on privacy setting
  case v_recipient_privacy
    when 'everyone' then
      return true;
    when 'followers' then
      -- Check if sender follows recipient
      select exists (
        select 1 from public.follows where follower_id = p_sender_id and following_id = p_recipient_id
      ) into v_is_following;
      return v_is_following;
    when 'request' then
      -- Check if there's an accepted DM request
      select exists (
        select 1 from public.dm_requests 
        where sender_id = p_sender_id and recipient_id = p_recipient_id and status = 'accepted'
      ) or exists (
        select 1 from public.dm_requests 
        where sender_id = p_recipient_id and recipient_id = p_sender_id and status = 'accepted'
      ) into v_has_accepted_request;
      return v_has_accepted_request;
    when 'nobody' then
      return false;
    else
      return true;
  end case;
end;
$$ language plpgsql security definer;

-- Create or get existing conversation between two users
create or replace function get_or_create_dm_conversation(p_user1_id uuid, p_user2_id uuid)
returns uuid as $$
declare
  v_conversation_id uuid;
begin
  -- Check for existing conversation
  select c.id into v_conversation_id
  from public.conversations c
  join public.conversation_participants cp1 on cp1.conversation_id = c.id and cp1.user_id = p_user1_id
  join public.conversation_participants cp2 on cp2.conversation_id = c.id and cp2.user_id = p_user2_id
  where c.is_group = false
  limit 1;
  
  if v_conversation_id is not null then
    return v_conversation_id;
  end if;
  
  -- Create new conversation
  insert into public.conversations (is_group) values (false) returning id into v_conversation_id;
  
  -- Add participants
  insert into public.conversation_participants (conversation_id, user_id) values 
    (v_conversation_id, p_user1_id),
    (v_conversation_id, p_user2_id);
  
  return v_conversation_id;
end;
$$ language plpgsql security definer;

-- Send a DM request
create or replace function send_dm_request(p_recipient_id uuid, p_message_preview text default null)
returns uuid as $$
declare
  v_request_id uuid;
begin
  insert into public.dm_requests (sender_id, recipient_id, message_preview)
  values (auth.uid(), p_recipient_id, p_message_preview)
  on conflict (sender_id, recipient_id) do update set
    message_preview = excluded.message_preview,
    status = 'pending',
    updated_at = now()
  returning id into v_request_id;
  
  return v_request_id;
end;
$$ language plpgsql security definer;

-- Accept DM request
create or replace function accept_dm_request(p_request_id uuid)
returns uuid as $$
declare
  v_request record;
  v_conversation_id uuid;
begin
  select * into v_request from public.dm_requests where id = p_request_id and recipient_id = auth.uid();
  
  if v_request is null then
    raise exception 'Request not found or not authorized';
  end if;
  
  -- Update request status
  update public.dm_requests set status = 'accepted', updated_at = now() where id = p_request_id;
  
  -- Create conversation
  v_conversation_id := get_or_create_dm_conversation(v_request.sender_id, v_request.recipient_id);
  
  return v_conversation_id;
end;
$$ language plpgsql security definer;

-- Block a user
create or replace function block_user(p_user_id uuid, p_reason text default null)
returns void as $$
begin
  insert into public.blocked_users (blocker_id, blocked_id, reason)
  values (auth.uid(), p_user_id, p_reason)
  on conflict (blocker_id, blocked_id) do nothing;
  
  -- Also remove any follows
  delete from public.follows where 
    (follower_id = auth.uid() and following_id = p_user_id) or
    (follower_id = p_user_id and following_id = auth.uid());
end;
$$ language plpgsql security definer;

-- Unblock a user
create or replace function unblock_user(p_user_id uuid)
returns void as $$
begin
  delete from public.blocked_users where blocker_id = auth.uid() and blocked_id = p_user_id;
end;
$$ language plpgsql security definer;

-- Get unread message count
create or replace function get_unread_message_count(p_user_id uuid)
returns integer as $$
declare
  v_count integer;
begin
  select count(*)::integer into v_count
  from public.messages m
  join public.conversation_participants cp on cp.conversation_id = m.conversation_id and cp.user_id = p_user_id
  where m.sender_id != p_user_id
    and m.is_deleted = false
    and m.created_at > cp.last_read_at;
  
  return v_count;
end;
$$ language plpgsql security definer;

-- ============================================
-- INDEXES
-- ============================================

create index if not exists idx_messages_conversation on public.messages(conversation_id);
create index if not exists idx_messages_sender on public.messages(sender_id);
create index if not exists idx_messages_created on public.messages(created_at desc);
create index if not exists idx_conversation_participants_user on public.conversation_participants(user_id);
create index if not exists idx_conversation_participants_conversation on public.conversation_participants(conversation_id);
create index if not exists idx_dm_requests_recipient on public.dm_requests(recipient_id);
create index if not exists idx_dm_requests_sender on public.dm_requests(sender_id);
create index if not exists idx_blocked_users_blocker on public.blocked_users(blocker_id);
create index if not exists idx_blocked_users_blocked on public.blocked_users(blocked_id);

-- ============================================
-- REALTIME SUBSCRIPTIONS
-- ============================================

-- Enable realtime for messages
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.dm_requests;
