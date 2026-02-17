-- Add banner_url to profiles and channels

-- Add banner_url column to profiles table
alter table public.profiles add column if not exists banner_url text;

-- Add banner_url column to channels table
alter table public.channels add column if not exists banner_url text;
