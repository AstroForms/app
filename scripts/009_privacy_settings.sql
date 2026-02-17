-- Privacy Settings Migration
-- Run this in Supabase SQL Editor

-- Add privacy columns to profiles
alter table public.profiles add column if not exists is_private boolean default false;
alter table public.profiles add column if not exists show_liked_posts boolean default true;

-- Create follow_requests table for private profiles
create table if not exists public.follow_requests (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(follower_id, following_id)
);

alter table public.follow_requests enable row level security;

-- Anyone can see their own requests (sent or received)
create policy "follow_requests_select_own" on public.follow_requests for select using (
  auth.uid() = follower_id or auth.uid() = following_id
);

-- Anyone can send a follow request
create policy "follow_requests_insert" on public.follow_requests for insert with check (
  auth.uid() = follower_id
);

-- Only the person being followed can update (accept/reject)
create policy "follow_requests_update" on public.follow_requests for update using (
  auth.uid() = following_id
);

-- Either party can delete the request
create policy "follow_requests_delete" on public.follow_requests for delete using (
  auth.uid() = follower_id or auth.uid() = following_id
);

-- Function to handle follow request acceptance
create or replace function accept_follow_request(p_request_id uuid)
returns void as $$
declare
  v_request record;
begin
  -- Get the request
  select * into v_request from public.follow_requests where id = p_request_id and following_id = auth.uid();
  
  if v_request is null then
    raise exception 'Request not found or not authorized';
  end if;
  
  -- Update request status
  update public.follow_requests set status = 'accepted', updated_at = now() where id = p_request_id;
  
  -- Create the follow relationship
  insert into public.follows (follower_id, following_id)
  values (v_request.follower_id, v_request.following_id)
  on conflict do nothing;
  
  -- Update follower counts
  update public.profiles set followers_count = followers_count + 1 where id = v_request.following_id;
  update public.profiles set following_count = following_count + 1 where id = v_request.follower_id;
end;
$$ language plpgsql security definer;

-- Function to reject follow request
create or replace function reject_follow_request(p_request_id uuid)
returns void as $$
begin
  update public.follow_requests 
  set status = 'rejected', updated_at = now() 
  where id = p_request_id and following_id = auth.uid();
end;
$$ language plpgsql security definer;

-- Index for faster queries
create index if not exists idx_follow_requests_follower on public.follow_requests(follower_id);
create index if not exists idx_follow_requests_following on public.follow_requests(following_id);
create index if not exists idx_follow_requests_status on public.follow_requests(status);
