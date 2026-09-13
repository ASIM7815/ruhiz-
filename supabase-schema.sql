-- =============================================
-- Ruhiz Database Schema for Supabase
-- Run this in Supabase SQL Editor
-- =============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =============================================
-- PROFILES TABLE
-- =============================================
create table if not exists profiles (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade unique not null,
  username text unique not null,
  display_name text not null,
  avatar_url text,
  bio text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Username validation constraints
alter table profiles 
  add constraint username_length 
  check (char_length(username) >= 3 and char_length(username) <= 20);

alter table profiles 
  add constraint username_format 
  check (username ~ '^[a-zA-Z0-9_]+$');

-- Create index for faster username lookups
create index if not exists idx_profiles_username on profiles(lower(username));
create index if not exists idx_profiles_user_id on profiles(user_id);

-- Enable Row Level Security
alter table profiles enable row level security;

-- Profiles policies
drop policy if exists "Public profiles are viewable by everyone." on profiles;
create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

drop policy if exists "Users can insert their own profile." on profiles;
create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = user_id );

drop policy if exists "Users can update own profile." on profiles;
create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = user_id );

-- =============================================
-- MOMENTS (POSTS) TABLE
-- =============================================
create table if not exists moments (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  content text not null,
  image_url text,
  video_url text,
  topics text[] default '{}',
  likes_count integer default 0,
  comments_count integer default 0,
  shares_count integer default 0,
  saves_count integer default 0,
  been_here_count integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table moments enable row level security;

-- Moments policies
drop policy if exists "Moments are viewable by everyone." on moments;
create policy "Moments are viewable by everyone."
  on moments for select
  using ( true );

drop policy if exists "Authenticated users can insert moments." on moments;
create policy "Authenticated users can insert moments."
  on moments for insert
  with check ( auth.role() = 'authenticated' );

drop policy if exists "Users can update their own moments." on moments;
create policy "Users can update their own moments."
  on moments for update
  using ( auth.uid() = user_id );

drop policy if exists "Users can delete their own moments." on moments;
create policy "Users can delete their own moments."
  on moments for delete
  using ( auth.uid() = user_id );

-- =============================================
-- COMMENTS TABLE
-- =============================================
create table if not exists comments (
  id uuid default uuid_generate_v4() primary key,
  moment_id uuid references moments on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table comments enable row level security;

-- Comments policies
drop policy if exists "Comments are viewable by everyone." on comments;
create policy "Comments are viewable by everyone."
  on comments for select
  using ( true );

drop policy if exists "Authenticated users can insert comments." on comments;
create policy "Authenticated users can insert comments."
  on comments for insert
  with check ( auth.role() = 'authenticated' );

drop policy if exists "Users can update their own comments." on comments;
create policy "Users can update their own comments."
  on comments for update
  using ( auth.uid() = user_id );

drop policy if exists "Users can delete their own comments." on comments;
create policy "Users can delete their own comments."
  on comments for delete
  using ( auth.uid() = user_id );

-- =============================================
-- LIKES TABLE
-- =============================================
create table if not exists likes (
  id uuid default uuid_generate_v4() primary key,
  moment_id uuid references moments on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(moment_id, user_id)
);

-- Enable Row Level Security
alter table likes enable row level security;

-- Likes policies
drop policy if exists "Likes are viewable by everyone." on likes;
create policy "Likes are viewable by everyone."
  on likes for select
  using ( true );

drop policy if exists "Authenticated users can like moments." on likes;
create policy "Authenticated users can like moments."
  on likes for insert
  with check ( auth.role() = 'authenticated' );

drop policy if exists "Users can unlike moments." on likes;
create policy "Users can unlike moments."
  on likes for delete
  using ( auth.uid() = user_id );

-- =============================================
-- SAVES TABLE
-- =============================================
create table if not exists saves (
  id uuid default uuid_generate_v4() primary key,
  moment_id uuid references moments on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(moment_id, user_id)
);

-- Enable Row Level Security
alter table saves enable row level security;

-- Saves policies
drop policy if exists "Saves are viewable by users." on saves;
create policy "Saves are viewable by users."
  on saves for select
  using ( auth.uid() = user_id );

drop policy if exists "Users can save moments." on saves;
create policy "Users can save moments."
  on saves for insert
  with check ( auth.role() = 'authenticated' );

drop policy if exists "Users can unsave moments." on saves;
create policy "Users can unsave moments."
  on saves for delete
  using ( auth.uid() = user_id );

-- =============================================
-- BEEN HERE TABLE
-- =============================================
create table if not exists been_here (
  id uuid default uuid_generate_v4() primary key,
  moment_id uuid references moments on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(moment_id, user_id)
);

-- Enable Row Level Security
alter table been_here enable row level security;

-- Been here policies
drop policy if exists "Been here are viewable by everyone." on been_here;
create policy "Been here are viewable by everyone."
  on been_here for select
  using ( true );

drop policy if exists "Users can mark been here." on been_here;
create policy "Users can mark been here."
  on been_here for insert
  with check ( auth.role() = 'authenticated' );

drop policy if exists "Users can unmark been here." on been_here;
create policy "Users can unmark been here."
  on been_here for delete
  using ( auth.uid() = user_id );

-- =============================================
-- CONNECTIONS/FOLLOWS TABLE
-- =============================================
create table if not exists connections (
  id uuid default uuid_generate_v4() primary key,
  follower_id uuid references auth.users on delete cascade not null,
  following_id uuid references auth.users on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(follower_id, following_id),
  check (follower_id != following_id)
);

-- Enable Row Level Security
alter table connections enable row level security;

-- Connections policies
drop policy if exists "Connections are viewable by everyone." on connections;
create policy "Connections are viewable by everyone."
  on connections for select
  using ( true );

drop policy if exists "Users can follow others." on connections;
create policy "Users can follow others."
  on connections for insert
  with check ( auth.uid() = follower_id );

drop policy if exists "Users can unfollow others." on connections;
create policy "Users can unfollow others."
  on connections for delete
  using ( auth.uid() = follower_id );

-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================

-- Function to handle profile creation
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function to update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
drop trigger if exists handle_profiles_updated_at on profiles;
create trigger handle_profiles_updated_at
  before update on profiles
  for each row execute procedure public.handle_updated_at();

drop trigger if exists handle_moments_updated_at on moments;
create trigger handle_moments_updated_at
  before update on moments
  for each row execute procedure public.handle_updated_at();

drop trigger if exists handle_comments_updated_at on comments;
create trigger handle_comments_updated_at
  before update on comments
  for each row execute procedure public.handle_updated_at();

-- =============================================
-- STORAGE BUCKETS
-- =============================================

-- Create moments bucket for images/videos
insert into storage.buckets (id, name, public)
values ('moments', 'moments', true)
on conflict (id) do nothing;

-- Storage policies for moments bucket
drop policy if exists "Anyone can view moment media" on storage.objects;
create policy "Anyone can view moment media"
  on storage.objects for select
  using ( bucket_id = 'moments' );

drop policy if exists "Authenticated users can upload moment media" on storage.objects;
create policy "Authenticated users can upload moment media"
  on storage.objects for insert
  with check (
    bucket_id = 'moments'
    and auth.role() = 'authenticated'
  );

drop policy if exists "Users can update their own moment media" on storage.objects;
create policy "Users can update their own moment media"
  on storage.objects for update
  using ( auth.uid()::text = (storage.foldername(name))[1] );

drop policy if exists "Users can delete their own moment media" on storage.objects;
create policy "Users can delete their own moment media"
  on storage.objects for delete
  using ( auth.uid()::text = (storage.foldername(name))[1] );

-- Create avatars bucket for profile pictures
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Storage policies for avatars bucket
drop policy if exists "Anyone can view avatars" on storage.objects;
create policy "Anyone can view avatars"
  on storage.objects for select
  using ( bucket_id = 'avatars' );

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update
  using ( auth.uid()::text = (storage.foldername(name))[1] );

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
  on storage.objects for delete
  using ( auth.uid()::text = (storage.foldername(name))[1] );

-- =============================================
-- SUCCESS MESSAGE
-- =============================================
do $$
begin
  raise notice '✅ Ruhiz database schema created successfully!';
  raise notice '📊 Tables: profiles, moments, comments, likes, saves, been_here, connections';
  raise notice '🔒 Row Level Security enabled on all tables';
  raise notice '📦 Storage buckets: moments, avatars';
  raise notice '🎉 Ready to use!';
end $$;
