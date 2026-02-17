-- Add advanced post features: images, links, comments, saves, remixes

-- Add image_url and link_url to posts
alter table public.posts add column if not exists image_url text;
alter table public.posts add column if not exists link_url text;
alter table public.posts add column if not exists link_title text;
alter table public.posts add column if not exists link_description text;
alter table public.posts add column if not exists link_image text;
alter table public.posts add column if not exists parent_post_id uuid references public.posts(id) on delete set null;

-- Post likes table (in case it doesn't exist)
create table if not exists public.post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(post_id, user_id)
);

alter table public.post_likes enable row level security;
drop policy if exists "likes_select_all" on public.post_likes;
drop policy if exists "likes_insert_own" on public.post_likes;
drop policy if exists "likes_delete_own" on public.post_likes;
create policy "likes_select_all" on public.post_likes for select using (true);
create policy "likes_insert_own" on public.post_likes for insert with check (auth.uid() = user_id);
create policy "likes_delete_own" on public.post_likes for delete using (auth.uid() = user_id);

-- Post saves/bookmarks table
create table if not exists public.post_saves (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(post_id, user_id)
);

alter table public.post_saves enable row level security;
drop policy if exists "saves_select_own" on public.post_saves;
drop policy if exists "saves_insert_own" on public.post_saves;
drop policy if exists "saves_delete_own" on public.post_saves;
create policy "saves_select_own" on public.post_saves for select using (auth.uid() = user_id);
create policy "saves_insert_own" on public.post_saves for insert with check (auth.uid() = user_id);
create policy "saves_delete_own" on public.post_saves for delete using (auth.uid() = user_id);

-- Post comments table
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.post_comments enable row level security;
drop policy if exists "comments_select_all" on public.post_comments;
drop policy if exists "comments_insert_own" on public.post_comments;
drop policy if exists "comments_update_own" on public.post_comments;
drop policy if exists "comments_delete_own" on public.post_comments;
create policy "comments_select_all" on public.post_comments for select using (true);
create policy "comments_insert_own" on public.post_comments for insert with check (auth.uid() = user_id);
create policy "comments_update_own" on public.post_comments for update using (auth.uid() = user_id);
create policy "comments_delete_own" on public.post_comments for delete using (
  auth.uid() = user_id
  or exists (
    select 1 from public.posts p
    join public.channel_members cm on cm.channel_id = p.channel_id
    where p.id = post_comments.post_id
    and cm.user_id = auth.uid()
    and cm.role in ('moderator', 'admin', 'owner')
  )
);

-- Create indexes for better performance
create index if not exists idx_post_likes_post_id on public.post_likes(post_id);
create index if not exists idx_post_likes_user_id on public.post_likes(user_id);
create index if not exists idx_post_saves_post_id on public.post_saves(post_id);
create index if not exists idx_post_saves_user_id on public.post_saves(user_id);
create index if not exists idx_post_comments_post_id on public.post_comments(post_id);
create index if not exists idx_posts_parent_id on public.posts(parent_post_id);
