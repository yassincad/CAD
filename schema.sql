-- CAD OFPPT starter schema. Run in Supabase SQL Editor.
-- IMPORTANT: review your institute's privacy rules before collecting CIN or photos.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  cin text not null,
  section text not null,
  photo_path text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  role text not null default 'trainee' check (role in ('trainee','admin')),
  rank text default 'D' check (rank in ('A','B','C','D')),
  monthly_star boolean not null default false,
  skills text[] not null default '{}',
  languages text[] not null default '{}',
  bio text,
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_cin_unique on public.profiles (upper(cin));

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  image_path text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  body text not null,
  status text not null default 'new' check (status in ('new','reviewing','resolved','closed')),
  created_at timestamptz not null default now()
);
create table if not exists public.skill_proofs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text default '',
  file_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

create or replace function public.is_cad_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.status = 'approved'); $$;
revoke all on function public.is_cad_admin() from public;
grant execute on function public.is_cad_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.announcements enable row level security;
alter table public.complaints enable row level security;
alter table public.skill_proofs enable row level security;

drop policy if exists "profile read own or admin" on public.profiles;
create policy "profile read own or admin" on public.profiles for select to authenticated using (id = auth.uid() or public.is_cad_admin());
drop policy if exists "trainee creates own pending profile" on public.profiles;
create policy "trainee creates own pending profile" on public.profiles for insert to authenticated with check (id = auth.uid() and role = 'trainee' and status = 'pending' and rank = 'D');
drop policy if exists "trainee updates own profile fields" on public.profiles;
create policy "trainee updates own profile fields" on public.profiles for update to authenticated
using (id = auth.uid() and status = 'approved')
with check (id = auth.uid() and role = 'trainee' and status = 'approved');
drop policy if exists "admin updates profiles" on public.profiles;
create policy "admin updates profiles" on public.profiles for update to authenticated using (public.is_cad_admin()) with check (public.is_cad_admin());

drop policy if exists "approved members read announcements" on public.announcements;
create policy "approved members read announcements" on public.announcements for select to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.status='approved') or public.is_cad_admin());
drop policy if exists "admins manage announcements" on public.announcements;
create policy "admins manage announcements" on public.announcements for all to authenticated using (public.is_cad_admin()) with check (public.is_cad_admin());

drop policy if exists "complainant or admin reads complaints" on public.complaints;
create policy "complainant or admin reads complaints" on public.complaints for select to authenticated using (user_id = auth.uid() or public.is_cad_admin());
drop policy if exists "approved trainee sends complaint" on public.complaints;
create policy "approved trainee sends complaint" on public.complaints for insert to authenticated with check (user_id = auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.status='approved' and p.role='trainee'));
drop policy if exists "admin updates complaint" on public.complaints;
create policy "admin updates complaint" on public.complaints for update to authenticated using (public.is_cad_admin()) with check (public.is_cad_admin());

drop policy if exists "owner or admin reads skill proofs" on public.skill_proofs;
create policy "owner or admin reads skill proofs" on public.skill_proofs for select to authenticated using (user_id=auth.uid() or public.is_cad_admin());
drop policy if exists "approved trainee submits skill proof" on public.skill_proofs;
create policy "approved trainee submits skill proof" on public.skill_proofs for insert to authenticated with check (user_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.status='approved' and p.role='trainee'));
drop policy if exists "admin reviews skill proofs" on public.skill_proofs;
create policy "admin reviews skill proofs" on public.skill_proofs for update to authenticated using (public.is_cad_admin()) with check (public.is_cad_admin());

-- Private bucket for profile photos, proof images, and announcement images.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cad-private', 'cad-private', false, 5242880, array['image/jpeg','image/png'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png'];

drop policy if exists "users upload own private files" on storage.objects;
create policy "users upload own private files" on storage.objects for insert to authenticated
with check (bucket_id='cad-private' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "owner or admin reads private files" on storage.objects;
create policy "owner or admin reads private files" on storage.objects for select to authenticated
using (bucket_id='cad-private' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_cad_admin() or (storage.foldername(name))[1] = 'announcements'));
drop policy if exists "admins upload announcement files" on storage.objects;
create policy "admins upload announcement files" on storage.objects for insert to authenticated
with check (bucket_id='cad-private' and (storage.foldername(name))[1] = 'announcements' and public.is_cad_admin());

-- After creating your own account, promote ONLY the verified CAD president/admin:
-- update public.profiles set role='admin', status='approved' where id='AUTH-USER-UUID';
-- Find UUID in Authentication > Users. Do not expose service_role keys in Vercel frontend.
