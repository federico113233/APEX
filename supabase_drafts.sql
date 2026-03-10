-- Run this in the Supabase SQL editor

create table if not exists drafts (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  job_id            text        not null default '',
  job_title         text        not null default '',
  company           text        not null default '',
  location          text                 default '',
  job_description   text                 default '',
  job_url           text                 default '',
  cv_text           text                 default '',
  cover_letter_text text                 default '',
  created_at        timestamptz          default now(),
  updated_at        timestamptz          default now(),
  unique (user_id, job_id)
);

alter table drafts enable row level security;

create policy "Users manage own drafts"
  on drafts for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
