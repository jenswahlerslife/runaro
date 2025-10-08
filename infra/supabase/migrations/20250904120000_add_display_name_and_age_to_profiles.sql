-- Add display_name and age columns to profiles table
-- This migration adds required columns for user profile data collection

-- 1) Ensure columns exist
alter table public.profiles
  add column if not exists display_name text,
  add column if not exists age int;

-- 2) Add server-side validation for age
alter table public.profiles
  add constraint if not exists profiles_age_range 
  check (age is null or (age >= 5 and age <= 120));

-- 3) Add constraint for display_name length
alter table public.profiles
  add constraint if not exists profiles_display_name_length
  check (display_name is null or (length(display_name) >= 2 and length(display_name) <= 50));

-- 4) Enable RLS (if not already enabled)
alter table public.profiles enable row level security;

-- 5) Create RLS policies for profiles access
create policy if not exists profiles_select_own
on public.profiles for select
using (auth.uid() = user_id);

create policy if not exists profiles_insert_own
on public.profiles for insert
with check (auth.uid() = user_id);

create policy if not exists profiles_update_own
on public.profiles for update
using (auth.uid() = user_id);

-- 6) Create trigger function to handle new user profile creation
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, username, display_name, age)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'username',
      split_part(new.email, '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'username',
      split_part(new.email, '@', 1)
    ),
    case 
      when new.raw_user_meta_data->>'age' is not null 
      then (new.raw_user_meta_data->>'age')::int 
      else null 
    end
  )
  on conflict (user_id) do update set
    display_name = coalesce(
      excluded.display_name,
      profiles.display_name,
      profiles.username
    ),
    age = coalesce(excluded.age, profiles.age);

  return new;
end;
$$;

-- 7) Create trigger for new user registration
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 8) Update existing profiles that might be missing display_name
update public.profiles 
set display_name = coalesce(display_name, username)
where display_name is null and username is not null;