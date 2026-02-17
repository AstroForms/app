-- Hashtags feature
-- Run this in Supabase SQL Editor

-- Create hashtags table
create table if not exists public.hashtags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  usage_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create index for faster lookups
create index if not exists idx_hashtags_name on public.hashtags (name);
create index if not exists idx_hashtags_usage_count on public.hashtags (usage_count desc);

-- Enable RLS
alter table public.hashtags enable row level security;

-- Everyone can read hashtags
create policy "hashtags_select_all" on public.hashtags for select using (true);

-- Authenticated users can insert hashtags
create policy "hashtags_insert_auth" on public.hashtags for insert with check (auth.role() = 'authenticated');

-- Authenticated users can update usage count
create policy "hashtags_update_auth" on public.hashtags for update using (auth.role() = 'authenticated');

-- Post-Hashtag junction table to track which posts use which hashtags
create table if not exists public.post_hashtags (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  hashtag_id uuid not null references public.hashtags(id) on delete cascade,
  created_at timestamptz default now(),
  unique(post_id, hashtag_id)
);

alter table public.post_hashtags enable row level security;

create policy "post_hashtags_select_all" on public.post_hashtags for select using (true);
create policy "post_hashtags_insert_auth" on public.post_hashtags for insert with check (auth.role() = 'authenticated');
create policy "post_hashtags_delete_auth" on public.post_hashtags for delete using (auth.role() = 'authenticated');

-- Function to get or create a hashtag
create or replace function get_or_create_hashtag(p_name text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_hashtag_id uuid;
  v_clean_name text;
begin
  -- Clean the hashtag name (lowercase, no special chars except underscore)
  v_clean_name := lower(regexp_replace(p_name, '[^a-zA-Z0-9_äöüß]', '', 'g'));
  
  -- Try to find existing hashtag
  select id into v_hashtag_id from public.hashtags where name = v_clean_name;
  
  -- If not found, create it
  if v_hashtag_id is null then
    insert into public.hashtags (name) values (v_clean_name)
    returning id into v_hashtag_id;
  end if;
  
  return v_hashtag_id;
end;
$$;

-- Function to increment hashtag usage count
create or replace function increment_hashtag_usage(p_hashtag_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.hashtags 
  set usage_count = usage_count + 1, updated_at = now()
  where id = p_hashtag_id;
end;
$$;

-- Function to process hashtags from post content
create or replace function process_post_hashtags(p_post_id uuid, p_content text)
returns void
language plpgsql
security definer
as $$
declare
  v_hashtag text;
  v_hashtag_id uuid;
  v_hashtags text[];
begin
  -- Extract hashtags from content using regex
  v_hashtags := array(
    select distinct lower(regexp_replace(m[1], '^#', ''))
    from regexp_matches(p_content, '#([a-zA-Z0-9_äöüß]+)', 'g') as m
  );
  
  -- Process each hashtag
  foreach v_hashtag in array v_hashtags loop
    if length(v_hashtag) > 0 and length(v_hashtag) <= 50 then
      -- Get or create the hashtag
      v_hashtag_id := get_or_create_hashtag(v_hashtag);
      
      -- Link to post (ignore if already linked)
      insert into public.post_hashtags (post_id, hashtag_id)
      values (p_post_id, v_hashtag_id)
      on conflict (post_id, hashtag_id) do nothing;
      
      -- Increment usage count
      perform increment_hashtag_usage(v_hashtag_id);
    end if;
  end loop;
end;
$$;

-- Function to search hashtags with autocomplete
create or replace function search_hashtags(p_query text, p_limit integer default 10)
returns table(id uuid, name text, usage_count integer)
language plpgsql
security definer
as $$
declare
  v_clean_query text;
begin
  v_clean_query := lower(regexp_replace(p_query, '[^a-zA-Z0-9_äöüß]', '', 'g'));
  
  return query
  select h.id, h.name, h.usage_count
  from public.hashtags h
  where h.name like v_clean_query || '%'
  order by h.usage_count desc, h.name asc
  limit p_limit;
end;
$$;

-- Trigger to automatically process hashtags when a post is created
create or replace function trigger_process_post_hashtags()
returns trigger
language plpgsql
security definer
as $$
begin
  perform process_post_hashtags(NEW.id, NEW.content);
  return NEW;
end;
$$;

drop trigger if exists process_post_hashtags_trigger on public.posts;
create trigger process_post_hashtags_trigger
  after insert on public.posts
  for each row
  execute function trigger_process_post_hashtags();

-- Add some popular initial hashtags
insert into public.hashtags (name, usage_count) values
  ('art', 50),
  ('musik', 45),
  ('gaming', 40),
  ('tech', 35),
  ('news', 30),
  ('memes', 28),
  ('frage', 25),
  ('diskussion', 22),
  ('hilfe', 20),
  ('tipp', 18),
  ('tutorial', 15),
  ('fotografie', 12),
  ('sport', 10),
  ('film', 8),
  ('anime', 6)
on conflict (name) do nothing;
