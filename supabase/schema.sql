-- Fileit schema for the independent Vercel + Supabase deployment.
-- Run this once in Supabase SQL Editor before the first Vercel deploy.

create table if not exists public.folders (
  id text primary key,
  name text not null,
  share_token text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.files (
  id text primary key,
  original_name text not null,
  size integer not null,
  mime_type text not null,
  share_token text not null unique,
  storage_path text not null,
  folder_id text,
  download_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.text_messages (
  id text primary key,
  title text not null default 'Untitled snippet',
  content text not null,
  language text not null default 'plaintext',
  file_id text,
  folder_id text,
  created_at timestamptz not null default now()
);

create index if not exists files_folder_id_idx on public.files(folder_id);
create index if not exists text_messages_file_id_idx on public.text_messages(file_id);
create index if not exists text_messages_folder_id_idx on public.text_messages(folder_id);

-- Fileit uses the server-side Supabase service role for metadata and signed uploads.
alter table public.folders enable row level security;
alter table public.files enable row level security;
alter table public.text_messages enable row level security;

insert into storage.buckets (id, name, public)
values ('fileit', 'fileit', true)
on conflict (id) do update set public = true;