-- Add is_verified to profiles and update bans table

-- Add is_verified column to profiles table (for verified users like checkmark)
alter table public.profiles add column if not exists is_verified boolean default false;

-- Add banned_until to bans table for temporary bans
alter table public.bans add column if not exists banned_until timestamptz;

-- Add warning table
create table if not exists public.warnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  warned_by uuid not null references public.profiles(id) on delete cascade,
  reason text,
  created_at timestamptz default now()
);

alter table public.warnings enable row level security;
create policy "warnings_select_admin" on public.warnings for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'moderator'))
);
create policy "warnings_insert_admin" on public.warnings for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'moderator'))
);
create policy "warnings_delete_admin" on public.warnings for delete using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'moderator'))
);

-- Add is_locked column to channels for locking channels
alter table public.channels add column if not exists is_locked boolean default false;
