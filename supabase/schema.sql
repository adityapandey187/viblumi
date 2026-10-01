-- Viblumi database setup. Paste this whole file into Supabase > SQL Editor > Run.
-- Safe to run more than once.

-- 1) Saved projects: one row per project a user creates.
create table if not exists public.projects (
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
create table if not exists public.app_rows (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  collection  text not null,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists app_rows_lookup on public.app_rows (project_id, collection, created_at);
create index if not exists projects_by_user on public.projects (user_id, updated_at desc);

-- 3) Security: each user can only see and change their own rows.
alter table public.projects enable row level security;
alter table public.app_rows enable row level security;

drop policy if exists "own projects" on public.projects;
create policy "own projects" on public.projects
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own app rows" on public.app_rows;
create policy "own app rows" on public.app_rows
  for all to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));

grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.app_rows to authenticated;
