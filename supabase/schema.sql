-- DigiAstra: profiles table + role-based signup trigger
-- Run this once in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query).

-- One row per auth user, holding the role that decides which dashboard they see.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'civilian' check (role in ('civilian', 'officer')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- RLS policies (below) only ever narrow rows -- Postgres still requires the
-- "authenticated" role to hold a base table-level grant before RLS is even
-- evaluated. Without this, every query gets "permission denied for table
-- profiles" (42501), which looks like a data problem but is actually a
-- missing grant.
grant select, update on public.profiles to authenticated;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- No insert policy is defined on purpose: the only way a profile row gets created
-- is the trigger below (running as security definer), so a client can never insert
-- an arbitrary row -- e.g. one with role = 'officer' -- through the public API.

-- Auto-create a profile whenever someone signs up. Role is always hardcoded to
-- 'civilian' here, regardless of what the client sends -- this is what makes the
-- public signup form incapable of creating an officer account.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name', 'civilian');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================================
-- Step 4: civilian complaint filing
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  civilian_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text not null,
  incident_datetime timestamptz not null,
  location text not null,
  status text not null default 'filed'
    check (status in ('filed', 'under_review', 'investigating', 'resolved', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints (id) on delete cascade,
  file_path text not null,
  file_type text not null,
  uploaded_at timestamptz not null default now()
);

alter table public.complaints enable row level security;
alter table public.evidence enable row level security;

-- See the note above the profiles grant: RLS alone is not enough, the
-- authenticated role also needs a base table-level grant.
grant select, insert on public.complaints to authenticated;
grant select, insert on public.evidence to authenticated;

drop policy if exists "Civilians can view their own complaints" on public.complaints;
create policy "Civilians can view their own complaints"
  on public.complaints for select
  using (auth.uid() = civilian_id);

drop policy if exists "Civilians can file their own complaints" on public.complaints;
create policy "Civilians can file their own complaints"
  on public.complaints for insert
  with check (auth.uid() = civilian_id);

-- Evidence rows have no civilian_id of their own -- ownership is proven by
-- joining back to the parent complaint, which is what these policies check.
drop policy if exists "Civilians can view evidence on their own complaints" on public.evidence;
create policy "Civilians can view evidence on their own complaints"
  on public.evidence for select
  using (
    exists (
      select 1 from public.complaints c
      where c.id = evidence.complaint_id
      and c.civilian_id = auth.uid()
    )
  );

drop policy if exists "Civilians can attach evidence to their own complaints" on public.evidence;
create policy "Civilians can attach evidence to their own complaints"
  on public.evidence for insert
  with check (
    exists (
      select 1 from public.complaints c
      where c.id = evidence.complaint_id
      and c.civilian_id = auth.uid()
    )
  );

-- Private storage bucket for evidence files. Not public -- every read goes
-- through the RLS policies below, which use the file's own path as the
-- authorization check.
insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false)
on conflict (id) do nothing;

-- The app uploads files under `${civilian_id}/${complaint_id}/${filename}`,
-- so the first path segment being the caller's own uid is what proves
-- ownership here -- storage.foldername() splits the object path into segments.
drop policy if exists "Civilians can upload their own evidence" on storage.objects;
create policy "Civilians can upload their own evidence"
  on storage.objects for insert
  with check (
    bucket_id = 'evidence'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Civilians can view their own evidence" on storage.objects;
create policy "Civilians can view their own evidence"
  on storage.objects for select
  using (
    bucket_id = 'evidence'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
