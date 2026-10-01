-- Viblumi database setup. Paste this whole file into Supabase > SQL Editor > Run.
-- Safe to run more than once.

-- 1) Saved projects: one row per project a user creates.
create table if not exists public.viblumi_projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null default 'Untitled project',
  mode        text not null default 'website',      -- 'website' or 'app' (full-stack)
  code        text not null default '',             -- the current generated HTML
  messages    jsonb not null default '[]'::jsonb,   -- the chat history
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2) Data that generated full-stack apps store (their "database").
--    One generic table: each row belongs to a project and a named collection.
create table if not exists public.viblumi_app_rows (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.viblumi_projects(id) on delete cascade,
  collection  text not null,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists viblumi_app_rows_lookup on public.viblumi_app_rows (project_id, collection, created_at);
create index if not exists viblumi_projects_by_user on public.viblumi_projects (user_id, updated_at desc);

-- 3) Security: each user can only see and change their own rows.
alter table public.viblumi_projects enable row level security;
alter table public.viblumi_app_rows enable row level security;

drop policy if exists "viblumi own projects" on public.viblumi_projects;
create policy "viblumi own projects" on public.viblumi_projects
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "viblumi own app rows" on public.viblumi_app_rows;
create policy "viblumi own app rows" on public.viblumi_app_rows
  for all to authenticated
  using (exists (select 1 from public.viblumi_projects p where p.id = project_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.viblumi_projects p where p.id = project_id and p.user_id = auth.uid()));

grant select, insert, update, delete on public.viblumi_projects to authenticated;
grant select, insert, update, delete on public.viblumi_app_rows to authenticated;
