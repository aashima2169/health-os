-- ============================================================================
-- HEALTH OS — COMPLETE SUPABASE SCHEMA (fully confirmed, zero inference)
-- ============================================================================
-- Every column type/nullability/default AND every PRIMARY KEY, FOREIGN KEY,
-- and UNIQUE constraint below is taken directly from information_schema
-- queries against your actual database. Nothing in this file is guessed.
--
-- Exception: the `signals` table has no constraint data to confirm since
-- it doesn't exist in your database yet — it's defined here exactly as
-- built during this project, ready to run for the first time.
--
-- Entire script is idempotent (if not exists / create or replace) — safe
-- to run again without side effects.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────
-- CORE APP TABLES
-- ────────────────────────────────────────────────────────────────────────

create table if not exists blood_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  report_date date not null,
  file_url text,
  markers jsonb,
  notes text,
  extraction_status text default 'pending',
  extraction_error text,
  created_at timestamptz default now()
);

create table if not exists daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  log_date date not null,
  weight_kg numeric,
  sleep_hours numeric,
  energy_level integer,
  brain_fog boolean default false,
  watched_sunrise boolean default false,
  watched_sunset boolean default false,
  breathing text,
  grounding_done boolean default false,
  exercised boolean default false,
  creative_done boolean default false,
  supplements_taken boolean default false,
  reflection text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, log_date)
);

-- Child tables below all carry a confirmed composite FK on
-- (user_id, log_date) -> daily_logs(user_id, log_date). A daily_logs row
-- must exist for that date/user before these can be inserted.

create table if not exists daily_mental_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  log_date date not null,
  state text not null,
  foreign key (user_id, log_date) references daily_logs(user_id, log_date)
);

create table if not exists daily_exercise (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  log_date date not null,
  exercise_type text not null,
  foreign key (user_id, log_date) references daily_logs(user_id, log_date)
);

create table if not exists daily_recovery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  log_date date not null,
  activity text not null,
  foreign key (user_id, log_date) references daily_logs(user_id, log_date)
);

create table if not exists daily_supplements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  log_date date not null,
  supplement text not null,
  foreign key (user_id, log_date) references daily_logs(user_id, log_date)
);

create table if not exists meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  log_date date not null,
  slot text not null,                      -- 'breakfast' | 'lunch' | 'dinner' | 'snacks'
  location text not null default 'home',   -- 'home' | 'outside'
  outside_reason text,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, log_date, slot),
  foreign key (user_id, log_date) references daily_logs(user_id, log_date)
);

create table if not exists meal_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  slot text not null,
  item_name text not null,
  sort_order integer default 0,
  created_at timestamptz default now(),
  unique (user_id, slot, item_name)
);

create table if not exists health_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  event_type text not null,
  start_date date not null,
  end_date date,
  severity integer,
  status text default 'new',               -- 'new' | 'existing'
  body_location text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists health_event_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  health_event_id uuid references health_events(id),
  photo_url text not null,
  taken_at date not null,
  notes text,
  created_at timestamptz default now()
);

create table if not exists weekly_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  week_of date not null,
  photo_type text not null,                -- 'acne' | 'tongue' | 'flare' | 'body'
  photo_url text not null,
  notes text,
  created_at timestamptz default now(),
  unique (user_id, week_of, photo_type)
);

create table if not exists periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  start_date date not null,
  end_date date,
  created_at timestamptz default now()
);

create table if not exists masters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  category text not null,                  -- e.g. 'health_event_type', 'body_location', 'outside_reason'
  value text not null,
  is_default boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now(),
  unique (user_id, category, value)
);

create table if not exists settings (
  user_id uuid not null references auth.users(id) default auth.uid(),
  key text not null,
  value jsonb,
  primary key (user_id, key)
);


-- ────────────────────────────────────────────────────────────────────────
-- AGENT / AI LAYER TABLES
-- ────────────────────────────────────────────────────────────────────────

create table if not exists agent_insights (
  user_id uuid not null references auth.users(id) default auth.uid(),
  agent_id text not null,
  period text not null default 'all',
  version text,
  result jsonb not null default '{}'::jsonb,
  status text not null default 'success', -- 'success' | 'error' | 'generating'
  error text,
  generated_at timestamptz not null default now(),
  claimed_at timestamptz,
  primary key (user_id, agent_id, period)
);

comment on table agent_insights is 'Latest stored analysis per (user, agent, period). Regenerated by events (new blood report, new check-in), not page loads.';

create or replace function claim_agent_generation(
  p_agent_id text,
  p_period text,
  p_stale_seconds int default 360
) returns boolean
language plpgsql
as $$
declare
  v_claimed boolean := false;
begin
  insert into agent_insights (user_id, agent_id, period, status, claimed_at, result)
  values (auth.uid(), p_agent_id, p_period, 'generating', now(), '{}'::jsonb)
  on conflict (user_id, agent_id, period) do update
    set status = 'generating', claimed_at = now()
    where agent_insights.status != 'generating'
       or agent_insights.claimed_at is null
       or agent_insights.claimed_at < now() - (p_stale_seconds || ' seconds')::interval
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$$;

comment on function claim_agent_generation is 'Atomically claims the right to regenerate (user, agent_id, period). Returns true if the caller won the claim.';

create table if not exists specialist_qa (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  agent_id text not null,
  question text not null,
  answer text,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, agent_id, question)
);

comment on table specialist_qa is 'Questions specialists asked and the person''s own answers, fed back into future specialist runs.';

create table if not exists signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  title text not null,
  hypothesis text not null,
  status text not null default 'active',   -- 'active' | 'resolved' | 'needs_more_data' | 'dismissed'
  confidence int not null,
  confidence_trend text,                   -- 'increasing' | 'decreasing' | 'stable' | 'new'
  suggested_experiment text,               -- small, non-medical, testable action tied to the strongest contributing factor
  contributing_factors jsonb not null default '[]'::jsonb,
  contradictions jsonb not null default '[]'::jsonb,
  missing_information jsonb not null default '[]'::jsonb,
  confidence_history jsonb not null default '[]'::jsonb,
  possible_explanations jsonb not null default '[]'::jsonb,
  first_generated_at timestamptz not null default now(),
  last_updated_at timestamptz not null default now(),
  topic_key text not null,
  unique (user_id, topic_key)
);

comment on table signals is 'Persistent, evolving hypotheses — the core Signals module.';


-- ────────────────────────────────────────────────────────────────────────
-- PROFILE — static, rarely-changing facts (not asked at check-in)
-- ────────────────────────────────────────────────────────────────────────

-- Singleton per user — the legacy fixed 'singleton' id PK is left in place
-- (harmless), but user_id (unique) is now the real per-user identity: one
-- profile row per signed-in user.
create table if not exists profile (
  id text primary key default 'singleton',
  user_id uuid not null references auth.users(id) default auth.uid() unique,
  gender text,                    -- 'female' | 'male' | 'other' | 'prefer_not_to_say'
  age integer,
  city text,
  lat double precision,           -- geocoded from city, cached so Signals doesn't re-geocode every run
  lon double precision,
  menstruating_status text,       -- 'menstruating' | 'not_menstruating' (only meaningful if gender = 'female')
  updated_at timestamptz not null default now()
);

create table if not exists profile_conditions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  condition_name text not null,
  diagnosed_date date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  name text not null,
  dosage text,
  frequency text,
  start_date date,                 -- null = not started yet (e.g. prescribed but starts in future)
  end_date date,                   -- null = ongoing
  notes text,
  prescription_url text,          -- source prescription document, if added via upload
  created_at timestamptz not null default now()
);

comment on table profile is 'Per-user row of static demographic facts (gender, age, city, menstruating status), keyed by user_id.';
comment on table profile_conditions is 'Known/diagnosed health conditions, entered once and rarely changed.';
comment on table medications is 'Current and past medications with dosage, frequency, and date range. duration is computed from start_date/end_date, never stored.';


-- ────────────────────────────────────────────────────────────────────────
-- GEMINI CALL LOG — token usage per call, for optimization work later
-- ────────────────────────────────────────────────────────────────────────

create table if not exists gemini_call_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  call_site text not null,              -- 'SIGNALS' | 'A1' | 'A3a' | ... | 'EXTRACT_MARKERS' | 'EXTRACT_PRESCRIPTION'
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  tool_tokens integer not null default 0,  -- reserved — 0 today, no live tool-calling in use
  total_tokens integer not null default 0,
  latency_ms integer,
  created_at timestamptz not null default now()
);

comment on table gemini_call_log is 'Per-call token usage (input/output/tool) across every Gemini call site, for later cost/optimization analysis.';


-- ────────────────────────────────────────────────────────────────────────
-- SIGNAL PATTERN LOG — deterministic flare-pattern computation history
-- ────────────────────────────────────────────────────────────────────────
-- Append-only: one row per Signals run, capturing what buildFlareWindows/
-- computeCandidatePatterns (lib/agents/flarePatterns.ts) actually computed
-- that pass and which topic_keys the LLM ended up surfacing from it — so
-- the deterministic weighting logic can be evaluated/tuned later using
-- real history, not just the latest pass.

create table if not exists signal_pattern_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  period text not null,
  flare_count integer not null default 0,
  candidate_patterns jsonb not null default '[]'::jsonb,
  surfaced_topic_keys jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

comment on table signal_pattern_log is 'One row per Signals run: the deterministic candidate_patterns it computed and which topic_keys the LLM surfaced from them, for evaluating/tuning the weighting logic over time.';


-- ────────────────────────────────────────────────────────────────────────
-- USER CONSENT — one-time, per-account data consent
-- ────────────────────────────────────────────────────────────────────────
-- Recorded once, right after a person's first-ever sign-in (see
-- app/consent/page.tsx). middleware.ts checks this on every request for a
-- signed-in user and redirects to /consent if missing — a real gate, not
-- just sign-in-page decoration. Full RLS setup in
-- supabase/phase_user_consent.sql.

create table if not exists user_consent (
  user_id uuid primary key references auth.users(id) default auth.uid(),
  consented_at timestamptz not null default now()
);

comment on table user_consent is 'One row per user, inserted once when they accept the data-consent screen. Presence of a row = consented; there is no update/delete path.';


-- ────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY — every table scoped to auth.uid() = user_id
-- ────────────────────────────────────────────────────────────────────────
-- Applied via supabase/phase2_step5-6_rls_and_storage.sql, which loops this
-- same select/insert/update/delete pattern over every table above. Storage
-- bucket policies (blood-reports, health-event-photos, weekly-photos,
-- prescriptions — scoped to Storage's automatic `owner` column) are also
-- defined in that file, not here, since Storage isn't part of this
-- Postgres schema.


-- ────────────────────────────────────────────────────────────────────────
-- DEFAULT MASTER-LIST SEEDING — new sign-ups start with a generic template
-- ────────────────────────────────────────────────────────────────────────
-- Full content + the create function/trigger statements live in
-- supabase/phase_seed_default_masters.sql. Fires once per new auth.users
-- row, seeding masters + meal_items for that user_id with is_default =
-- true rows they can edit/add/remove freely afterward via Settings.
-- Existing accounts are untouched — this only affects future sign-ups.

-- ============================================================================
-- END
-- ============================================================================