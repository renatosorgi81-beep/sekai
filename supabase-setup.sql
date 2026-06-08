-- ══════════════════════════════════════════════
-- SEKAI — Setup Database Supabase
-- Esegui questo nell'SQL Editor di Supabase
-- ══════════════════════════════════════════════

-- ── TABELLA UTENTI ──
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  username text unique not null,
  birth_date date not null,
  paid boolean default false,
  paid_at timestamp with time zone,
  has_avatar boolean default false,
  created_at timestamp with time zone default now(),
  last_seen timestamp with time zone default now()
);

-- ── TABELLA AVATAR ──
create table if not exists public.avatars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade unique,
  -- Aspetto visivo
  name text not null,
  gender text default 'm',
  face text default 'oval',
  hair text default 'wild',
  hair_color text default '#c8a020',
  eyes text default 'round',
  eye_color text default '#206040',
  brows text default 'natural',
  nose text default 'soft',
  mouth text default 'smile',
  skin text default '#f0c898',
  cloth text default 'hoodie',
  cloth_color text default '#1a3a6a',
  accessory text default 'none',
  svg_string text,
  -- Identità interiore
  personality text[] default '{}',
  passions text[] default '{}',
  values text[] default '{}',
  life_phase text default '',
  social_style text default '',
  gift text default '',
  silence_mode text default '',
  favorite_area text default '',
  -- Campi liberi
  love_text text default '',
  learning_text text default '',
  understand_text text default '',
  -- Privati
  dream_text text default '',
  strength_text text default '',
  -- Codice univoco
  avatar_code text unique,
  -- Storico modifiche aspetto
  last_appearance_change timestamp with time zone default now(),
  -- Timestamps
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- ── TABELLA SESSIONI CUSTOM ──
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  token text unique not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default now()
);

-- ── TABELLA SEGNALAZIONI ──
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.users(id),
  reported_user_id uuid references public.users(id),
  content_type text not null, -- 'whisper','letter','thought','profile'
  content_text text,
  reason text,
  status text default 'pending', -- pending, reviewed, dismissed, actioned
  admin_note text,
  created_at timestamp with time zone default now()
);

-- ── ROW LEVEL SECURITY ──
alter table public.users enable row level security;
alter table public.avatars enable row level security;
alter table public.sessions enable row level security;
alter table public.reports enable row level security;

-- Utenti: ognuno vede solo se stesso
create policy "Users can read own data"
  on public.users for select
  using (true); -- lettura pubblica username (per il villaggio)

create policy "Users can update own data"
  on public.users for update
  using (true);

create policy "Anyone can insert user"
  on public.users for insert
  with check (true);

-- Avatar: pubblici in lettura, privati in scrittura
create policy "Avatars are public"
  on public.avatars for select
  using (true);

create policy "Anyone can insert avatar"
  on public.avatars for insert
  with check (true);

create policy "Anyone can update avatar"
  on public.avatars for update
  using (true);

-- Sessioni
create policy "Sessions insert"
  on public.sessions for insert with check (true);
create policy "Sessions select"
  on public.sessions for select using (true);
create policy "Sessions delete"
  on public.sessions for delete using (true);

-- Segnalazioni
create policy "Reports insert"
  on public.reports for insert with check (true);
create policy "Reports select"
  on public.reports for select using (true);
create policy "Reports update"
  on public.reports for update using (true);

-- ── INDICI ──
create index if not exists idx_users_email on public.users(email);
create index if not exists idx_avatars_user_id on public.avatars(user_id);
create index if not exists idx_sessions_token on public.sessions(token);
create index if not exists idx_reports_status on public.reports(status);

-- ── ACCOUNT DEMO ──
insert into public.users (email, username, birth_date, paid, has_avatar)
values ('renatosorgi81@gmail.com', 'renatosorgi81', '1981-01-01', true, false)
on conflict (email) do nothing;

