-- 1. Create a table for user profiles linked to Supabase Auth
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  username text unique not null,
  email text unique not null,
  role text not null check (role in ('admin', 'teacher', 'student')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for profiles
alter table public.profiles enable row level security;

create policy "Allow public read access to profiles" on public.profiles
  for select using (true);

create policy "Allow users to update their own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Allow system/admin inserts" on public.profiles
  for insert with check (true);

-- 2. Create lessons table
create table public.lessons (
  id uuid default gen_random_uuid() primary key,
  teacher_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  content text not null,
  date timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.lessons enable row level security;
create policy "Allow read access to all profiles" on public.lessons for select using (true);
create policy "Allow teachers/admins to insert lessons" on public.lessons for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('teacher', 'admin'))
);
create policy "Allow teachers/admins to update lessons" on public.lessons for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('teacher', 'admin'))
);
create policy "Allow teachers/admins to delete lessons" on public.lessons for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('teacher', 'admin'))
);

-- 3. Create tasks table
create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  teacher_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text not null,
  due_date timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.tasks enable row level security;
create policy "Allow read access to all profiles" on public.tasks for select using (true);
create policy "Allow teachers/admins to insert tasks" on public.tasks for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('teacher', 'admin'))
);
create policy "Allow teachers/admins to update tasks" on public.tasks for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('teacher', 'admin'))
);
create policy "Allow teachers/admins to delete tasks" on public.tasks for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('teacher', 'admin'))
);

-- 4. Create meetings table
create table public.meetings (
  id uuid default gen_random_uuid() primary key,
  teacher_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  date timestamp with time zone not null,
  time text not null,
  link text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.meetings enable row level security;
create policy "Allow read access to all profiles" on public.meetings for select using (true);
create policy "Allow teachers/admins to write meetings" on public.meetings for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('teacher', 'admin'))
);

-- 5. Create announcements table
create table public.announcements (
  id uuid default gen_random_uuid() primary key,
  teacher_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.announcements enable row level security;
create policy "Allow read access to all profiles" on public.announcements for select using (true);
create policy "Allow teachers/admins to write announcements" on public.announcements for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('teacher', 'admin'))
);

-- 6. Create submissions table
create table public.submissions (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  student_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  submitted_at timestamp with time zone default timezone('utc'::text, now()) not null,
  grade integer check (grade >= 0 and grade <= 100),
  unique (task_id, student_id)
);

alter table public.submissions enable row level security;
create policy "Allow read access to own submissions or teachers/admins" on public.submissions for select using (
  auth.uid() = student_id or exists (select 1 from public.profiles where id = auth.uid() and role in ('teacher', 'admin'))
);
create policy "Allow students to insert/update their own submissions" on public.submissions for insert with check (
  auth.uid() = student_id
);
create policy "Allow students to update their own submissions" on public.submissions for update using (
  auth.uid() = student_id or exists (select 1 from public.profiles where id = auth.uid() and role in ('teacher', 'admin'))
);

-- 7. Trigger to automatically create profile on sign up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, username, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'Usuario Nuevo'),
    coalesce(new.raw_user_meta_data->>'username', substring(new.email from '[^@]+')),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'student')
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ==========================================
-- 8. DEFAULT ACCESES / SEED DEMO DATA
-- Copy and run this in Supabase SQL Editor
-- ==========================================

create extension if not exists pgcrypto;

-- Clear previous dummy profiles if re-running (linked cascade will clear submissions/etc)
-- DELETE FROM auth.users WHERE id IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003');

-- Insert Admin Account
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud, confirmation_token)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'admin@tradingacademy.com',
  crypt('admin123', gen_salt('bf', 10)),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Director General","username":"admin","role":"admin"}',
  now(),
  now(),
  'authenticated',
  'authenticated',
  ''
) ON CONFLICT (id) DO NOTHING;

-- Insert Teacher Account
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud, confirmation_token)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'teacher@tradingacademy.com',
  crypt('teacher123', gen_salt('bf', 10)),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Prof. Carlos Trader","username":"carlos_teacher","role":"teacher"}',
  now(),
  now(),
  'authenticated',
  'authenticated',
  ''
) ON CONFLICT (id) DO NOTHING;

-- Insert Student Account
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud, confirmation_token)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  'student@tradingacademy.com',
  crypt('student123', gen_salt('bf', 10)),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Ana Estudiante","username":"ana_student","role":"student"}',
  now(),
  now(),
  'authenticated',
  'authenticated',
  ''
) ON CONFLICT (id) DO NOTHING;
