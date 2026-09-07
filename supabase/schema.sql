-- DigiKavach: profiles table + role-based signup trigger
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


-- ============================================================================
-- Step 5: Gemini AI extraction
-- ============================================================================

alter table public.complaints add column if not exists extracted_data jsonb;

-- Column-scoped grant: the app updates a complaint after filing it only to
-- attach the AI extraction result, never to change title/status/etc, so the
-- grant itself only allows writing this one column (on top of the row-level
-- policy below, which still restricts it to the civilian's own complaint).
grant update (extracted_data) on public.complaints to authenticated;

drop policy if exists "Civilians can attach extracted_data to their own complaints" on public.complaints;
create policy "Civilians can attach extracted_data to their own complaints"
  on public.complaints for update
  using (auth.uid() = civilian_id)
  with check (auth.uid() = civilian_id);


-- ============================================================================
-- Step 6: officer case dashboard
-- ============================================================================

-- Helper used by every "officers can see/do X" policy below. security definer
-- so it can read profiles regardless of the caller's own row-level access,
-- though in practice a user can always read their own profile row anyway.
create or replace function public.is_officer()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'officer'
  );
$$;

grant execute on function public.is_officer() to authenticated;

-- Officers need to look up the civilian's name/email on each case, which
-- means reading a profile that isn't their own -- the existing "view their
-- own profile" policy above doesn't cover that.
drop policy if exists "Officers can view all profiles" on public.profiles;
create policy "Officers can view all profiles"
  on public.profiles for select
  using (public.is_officer());

drop policy if exists "Officers can view all complaints" on public.complaints;
create policy "Officers can view all complaints"
  on public.complaints for select
  using (public.is_officer());

drop policy if exists "Officers can view all evidence" on public.evidence;
create policy "Officers can view all evidence"
  on public.evidence for select
  using (public.is_officer());

drop policy if exists "Officers can view all evidence files" on storage.objects;
create policy "Officers can view all evidence files"
  on storage.objects for select
  using (
    bucket_id = 'evidence'
    and public.is_officer()
  );

grant update (status) on public.complaints to authenticated;

drop policy if exists "Officers can update status on any complaint" on public.complaints;
create policy "Officers can update status on any complaint"
  on public.complaints for update
  using (public.is_officer())
  with check (public.is_officer());

-- Civilians and officers are the same Postgres role ("authenticated"), so the
-- GRANTs above can't tell them apart on their own -- they only establish that
-- extracted_data and status are the *only* two columns anyone may ever touch.
-- This trigger is what stops a civilian from sneaking a status change through
-- their own "update extracted_data" policy, and an officer from sneaking an
-- extracted_data change through their own "update status" policy.
create or replace function public.enforce_complaint_update_permissions()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if public.is_officer() then
    if new.extracted_data is distinct from old.extracted_data then
      raise exception 'Officers may only update a complaint''s status.';
    end if;
  else
    if new.status is distinct from old.status then
      raise exception 'Civilians may only update a complaint''s extracted_data.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_complaint_update_permissions on public.complaints;
create trigger enforce_complaint_update_permissions
  before update on public.complaints
  for each row execute procedure public.enforce_complaint_update_permissions();


-- ============================================================================
-- Step 8: SOS emergency alerts
-- ============================================================================

create table if not exists public.sos_alerts (
  id uuid primary key default gen_random_uuid(),
  civilian_id uuid not null references auth.users (id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  status text not null default 'active' check (status in ('active', 'resolved')),
  created_at timestamptz not null default now()
);

alter table public.sos_alerts enable row level security;

grant select, insert on public.sos_alerts to authenticated;
grant update (status) on public.sos_alerts to authenticated;

drop policy if exists "Civilians can create their own SOS alerts" on public.sos_alerts;
create policy "Civilians can create their own SOS alerts"
  on public.sos_alerts for insert
  with check (auth.uid() = civilian_id);

-- No SELECT policy exists for civilians, on purpose -- there's no UI need for
-- them to read alerts back, and this keeps every row visible to officers only.
drop policy if exists "Officers can view all SOS alerts" on public.sos_alerts;
create policy "Officers can view all SOS alerts"
  on public.sos_alerts for select
  using (public.is_officer());

-- Unlike complaints.status, no trigger is needed here: civilians have no
-- UPDATE policy on this table at all, so RLS alone blocks them from ever
-- resolving their own (or anyone else's) alert.
drop policy if exists "Officers can resolve any SOS alert" on public.sos_alerts;
create policy "Officers can resolve any SOS alert"
  on public.sos_alerts for update
  using (public.is_officer())
  with check (public.is_officer());

-- Full row data on updates (so Realtime clients get the new status without a
-- refetch) -- otherwise Postgres only includes the primary key in the old row.
alter table public.sos_alerts replica identity full;

-- Adds this table to Supabase's Realtime publication so officer dashboards get
-- live INSERT/UPDATE events. Wrapped in a existence check so re-running this
-- file doesn't error with "relation is already member of publication".
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sos_alerts'
  ) then
    alter publication supabase_realtime add table public.sos_alerts;
  end if;
end $$;


-- ============================================================================
-- Step 9: cross-case pattern linking
-- ============================================================================

create table if not exists public.complaint_links (
  id uuid primary key default gen_random_uuid(),
  complaint_id_a uuid not null references public.complaints (id) on delete cascade,
  complaint_id_b uuid not null references public.complaints (id) on delete cascade,
  matched_on text not null,
  created_at timestamptz not null default now(),
  -- Canonical ordering (arbitrary but consistent, since uuid has a defined
  -- comparison order) so the same pair+reason can never be stored twice as
  -- (A,B) and (B,A).
  constraint complaint_links_ordered check (complaint_id_a < complaint_id_b),
  constraint complaint_links_unique unique (complaint_id_a, complaint_id_b, matched_on)
);

alter table public.complaint_links enable row level security;

grant select on public.complaint_links to authenticated;

-- No INSERT policy on purpose, same reasoning as profiles: the only writer is
-- the security-definer trigger below, which bypasses RLS entirely.
drop policy if exists "Officers can view all complaint links" on public.complaint_links;
create policy "Officers can view all complaint links"
  on public.complaint_links for select
  using (public.is_officer());

-- Deterministic, structured-field matching only -- no AI call. Fires whenever
-- a complaint's extracted_data is (re)populated, and links it to any other
-- complaint filed by a *different* civilian that shares a vehicle plate
-- number or a specific (first + last) person name. Two complaints from the
-- SAME civilian are never linked -- that's just one person filing more than
-- once, not a cross-case signal.
create or replace function public.link_related_complaints()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  vehicle jsonb;
  plate text;
  person jsonb;
  person_name text;
  other record;
begin
  if new.extracted_data is null then
    return new;
  end if;

  -- Vehicle plate matches. Plates are normalized (uppercased, punctuation and
  -- spaces stripped) before comparing, so "KA01 AB1234" and "ka-01-ab-1234"
  -- still match. Anything shorter than 4 characters after normalizing is too
  -- weak a signal to bother with (partial reads, placeholders, etc).
  for vehicle in select * from jsonb_array_elements(coalesce(new.extracted_data->'vehicles', '[]'::jsonb))
  loop
    plate := upper(regexp_replace(coalesce(vehicle->>'plate_number', ''), '[^a-zA-Z0-9]', '', 'g'));
    if length(plate) < 4 then
      continue;
    end if;

    for other in
      select distinct c.id
      from public.complaints c, jsonb_array_elements(coalesce(c.extracted_data->'vehicles', '[]'::jsonb)) v
      where c.id <> new.id
        and c.civilian_id <> new.civilian_id
        and c.extracted_data is not null
        and upper(regexp_replace(coalesce(v->>'plate_number', ''), '[^a-zA-Z0-9]', '', 'g')) = plate
    loop
      insert into public.complaint_links (complaint_id_a, complaint_id_b, matched_on)
      values (least(new.id, other.id), greatest(new.id, other.id), 'vehicle_plate: ' || plate)
      on conflict do nothing;
    end loop;
  end loop;

  -- Person name matches -- only full names (first + last, at least 5
  -- characters) count as "reasonably specific". A single first name like
  -- "Ramesh" is far too common to treat two mentions of it as related cases.
  for person in select * from jsonb_array_elements(coalesce(new.extracted_data->'people', '[]'::jsonb))
  loop
    person_name := lower(trim(coalesce(person->>'name', '')));
    if person_name = '' or position(' ' in person_name) = 0 or length(person_name) < 5 then
      continue;
    end if;

    for other in
      select distinct c.id
      from public.complaints c, jsonb_array_elements(coalesce(c.extracted_data->'people', '[]'::jsonb)) p
      where c.id <> new.id
        and c.civilian_id <> new.civilian_id
        and c.extracted_data is not null
        and lower(trim(coalesce(p->>'name', ''))) = person_name
    loop
      insert into public.complaint_links (complaint_id_a, complaint_id_b, matched_on)
      values (least(new.id, other.id), greatest(new.id, other.id), 'person_name: ' || initcap(person_name))
      on conflict do nothing;
    end loop;
  end loop;

  return new;
end;
$$;

drop trigger if exists link_related_complaints on public.complaints;
create trigger link_related_complaints
  after update on public.complaints
  for each row
  when (new.extracted_data is distinct from old.extracted_data)
  execute procedure public.link_related_complaints();
