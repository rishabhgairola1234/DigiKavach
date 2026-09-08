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


-- ============================================================================
-- Step 10: multilingual complaint intake
-- ============================================================================

-- `description` always holds the English text that extraction/search/etc run
-- against. When a civilian writes in another language, the app translates it
-- before insert and keeps what they actually wrote here -- never discarded,
-- and left null for the (common) case where the complaint was already in
-- English, so "has an original" is a simple not-null check for the UI.
alter table public.complaints add column if not exists original_language text;
alter table public.complaints add column if not exists original_description text;

-- No new grants or policies needed: these are just two more columns on a row
-- civilians can already insert into (see the Step 4 "Civilians can file
-- their own complaints" INSERT policy) and officers can already select from.


-- ============================================================================
-- Step 11: officer dashboard quality-of-life (search/filter/stats, notes)
-- ============================================================================

-- Search, filtering, and the stats row are all computed client/server-side
-- from data already fetched -- no schema changes needed for those.

-- Private investigation notes. No SELECT (or any) policy exists for civilians
-- on purpose -- they must never see these, regardless of whose case it is.
create table if not exists public.officer_notes (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints (id) on delete cascade,
  officer_id uuid not null references auth.users (id) on delete cascade,
  note_text text not null,
  created_at timestamptz not null default now()
);

alter table public.officer_notes enable row level security;

grant select, insert on public.officer_notes to authenticated;

drop policy if exists "Officers can view all officer notes" on public.officer_notes;
create policy "Officers can view all officer notes"
  on public.officer_notes for select
  using (public.is_officer());

drop policy if exists "Officers can add officer notes" on public.officer_notes;
create policy "Officers can add officer notes"
  on public.officer_notes for insert
  with check (public.is_officer() and officer_id = auth.uid());


-- ============================================================================
-- Step 12: real-time status-change notifications
-- ============================================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  civilian_id uuid not null references auth.users (id) on delete cascade,
  complaint_id uuid not null references public.complaints (id) on delete cascade,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

grant select on public.notifications to authenticated;
grant update (is_read) on public.notifications to authenticated;

drop policy if exists "Civilians can view their own notifications" on public.notifications;
create policy "Civilians can view their own notifications"
  on public.notifications for select
  using (auth.uid() = civilian_id);

-- No INSERT policy, same reasoning as profiles/officer_notes: only the
-- trigger below (security definer) ever writes a notification.
drop policy if exists "Civilians can mark their own notifications as read" on public.notifications;
create policy "Civilians can mark their own notifications as read"
  on public.notifications for update
  using (auth.uid() = civilian_id)
  with check (auth.uid() = civilian_id);

-- Fires on the existing officer status-update path (complaints.status change)
-- with no app code changes required -- the database is what's watching here.
create or replace function public.notify_status_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.notifications (civilian_id, complaint_id, message)
    values (
      new.civilian_id,
      new.id,
      'Your complaint "' || new.title || '" status changed to ' ||
        case new.status
          when 'filed' then 'Filed'
          when 'under_review' then 'Under Review'
          when 'investigating' then 'Investigating'
          when 'resolved' then 'Resolved'
          when 'closed' then 'Closed'
          else new.status
        end
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notify_status_change on public.complaints;
create trigger notify_status_change
  after update on public.complaints
  for each row
  when (new.status is distinct from old.status)
  execute procedure public.notify_status_change();

alter table public.notifications replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;


-- ============================================================================
-- Step 13: Camera Intelligence (webcam object/motion detection + recording)
-- ============================================================================

-- Separate bucket from civilian-facing "evidence" -- these are officer-
-- generated recordings, not civilian-submitted evidence, and keeping them in
-- their own bucket means the officer-only access rule can't accidentally leak
-- through the civilian evidence bucket's path-based ownership policies.
insert into storage.buckets (id, name, public)
values ('camera-recordings', 'camera-recordings', false)
on conflict (id) do nothing;

drop policy if exists "Officers can upload camera recordings" on storage.objects;
create policy "Officers can upload camera recordings"
  on storage.objects for insert
  with check (bucket_id = 'camera-recordings' and public.is_officer());

drop policy if exists "Officers can view camera recordings" on storage.objects;
create policy "Officers can view camera recordings"
  on storage.objects for select
  using (bucket_id = 'camera-recordings' and public.is_officer());

create table if not exists public.camera_recordings (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints (id) on delete cascade,
  officer_id uuid not null references auth.users (id) on delete cascade,
  file_path text not null,
  detected_objects jsonb not null default '[]'::jsonb,
  motion_timeline jsonb not null default '[]'::jsonb,
  duration_seconds numeric not null,
  created_at timestamptz not null default now()
);

alter table public.camera_recordings enable row level security;

grant select, insert on public.camera_recordings to authenticated;

-- Officer-only in both directions -- no policy at all exists for civilians,
-- so RLS blocks them from ever seeing a recording exists, let alone playing
-- one back.
drop policy if exists "Officers can view all camera recordings" on public.camera_recordings;
create policy "Officers can view all camera recordings"
  on public.camera_recordings for select
  using (public.is_officer());

drop policy if exists "Officers can add camera recordings" on public.camera_recordings;
create policy "Officers can add camera recordings"
  on public.camera_recordings for insert
  with check (public.is_officer() and officer_id = auth.uid());


-- ============================================================================
-- Step 14: plate OCR cross-reference, key-moment highlights, integrity hash
-- ============================================================================

-- Plate OCR cross-referencing reuses the existing complaints/extracted_data
-- read path plus the same plate-normalization rule as the Step 9 trigger
-- (implemented in src/lib/plate-matching.ts) -- no schema change needed for
-- that part.

-- Thumbnails + reason captured automatically while recording, whenever
-- motion crosses into the "high" band or a not-recently-seen object class
-- appears. Table-level grants already cover new columns (no column-scoped
-- grant was used on this table), so no new GRANT statements are needed.
alter table public.camera_recordings add column if not exists key_moments jsonb not null default '[]'::jsonb;

-- SHA-256 of the uploaded video file, computed client-side via the Web
-- Crypto API before upload, so officers/courts can later verify the saved
-- recording hasn't been altered since capture.
alter table public.camera_recordings add column if not exists file_hash text;


-- ============================================================================
-- Step 15: evidence sufficiency, voice filing, public safety heatmap
-- ============================================================================

-- Evidence sufficiency (Gemini, manually triggered) and voice-based filing
-- (browser Web Speech API) need no schema changes -- they read/write columns
-- that already exist.

-- Best-effort geocoding of a complaint's free-text location, done once at
-- filing time (src/lib/geocoding.ts, via the free Nominatim API -- no key).
-- Null when geocoding fails or hasn't run; failure never blocks filing.
alter table public.complaints add column if not exists latitude double precision;
alter table public.complaints add column if not exists longitude double precision;

-- The public safety heatmap needs to read incident locations across EVERY
-- civilian's complaints, which the existing complaints RLS deliberately does
-- not allow (a civilian may only select their own rows, per Step 4). Rather
-- than loosen that table's RLS, this view exposes only the columns that are
-- genuinely safe to publish -- no title, no description, no civilian_id, no
-- name -- and nothing else. Views run with the privileges of their owner by
-- default (not the querying role), which is what lets this view read every
-- row while the underlying table's RLS stays exactly as restrictive as
-- before for direct table access.
create or replace view public.safety_map_points as
select
  id,
  latitude,
  longitude,
  extracted_data ->> 'category' as category,
  created_at
from public.complaints
where latitude is not null and longitude is not null;

grant select on public.safety_map_points to authenticated, anon;


-- ============================================================================
-- Step 16: automated officer case assignment/routing
-- ============================================================================

alter table public.complaints add column if not exists assigned_officer_id uuid references auth.users (id);

-- No new grant needed to read it: the existing table-level
-- `grant select on public.complaints to authenticated` (Step 4) already
-- covers every column, and it's already readable by officers under the
-- Step 6 "Officers can view all complaints" policy.

-- Assigns the officer with the fewest currently active ("under_review" or
-- "investigating") cases the moment AI extraction completes -- deterministic
-- load-balancing, no AI call. Only ever sets the column once per complaint
-- (the IS NULL check), so a later extracted_data change never reassigns it.
-- Security definer so it can see every officer's profile and every
-- complaint's current assignment regardless of the caller's own RLS access --
-- the civilian whose "update extracted_data" statement actually fires this
-- trigger has no visibility into other people's profiles or complaints.
create or replace function public.assign_officer_to_complaint()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  chosen_officer uuid;
begin
  if new.extracted_data is null or new.assigned_officer_id is not null then
    return new;
  end if;

  select p.id into chosen_officer
  from public.profiles p
  left join (
    select assigned_officer_id, count(*) as active_count
    from public.complaints
    where status in ('under_review', 'investigating')
      and assigned_officer_id is not null
    group by assigned_officer_id
  ) workload on workload.assigned_officer_id = p.id
  where p.role = 'officer'
  order by coalesce(workload.active_count, 0) asc, p.created_at asc
  limit 1;

  new.assigned_officer_id := chosen_officer;
  return new;
end;
$$;

-- BEFORE (not AFTER, unlike link_related_complaints) because this needs to
-- mutate NEW directly rather than issue a separate UPDATE. Column-level
-- privilege checks apply only to the columns named in the civilian's own
-- UPDATE statement (extracted_data), not to columns a BEFORE trigger
-- separately assigns on NEW -- so no new column grant is needed here either.
drop trigger if exists assign_officer_to_complaint on public.complaints;
create trigger assign_officer_to_complaint
  before update on public.complaints
  for each row
  when (new.extracted_data is distinct from old.extracted_data)
  execute procedure public.assign_officer_to_complaint();
