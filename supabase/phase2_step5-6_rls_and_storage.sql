-- ============================================================================
-- PHASE 2, STEPS 5–6 — enable RLS + storage policies. FINAL STEP.
--
-- Run this ONLY after you've verified the app still works correctly signed
-- in as you, with the code refactor deployed (Step 4). Before this script
-- runs, every table is still fully open to anyone with the anon key —
-- this is the step that actually turns on per-user isolation.
--
-- Safe to re-run: every policy is dropped-if-exists before being recreated.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────
-- STEP 5 — RLS on all 21 tables: select/insert/update/delete each scoped
-- to auth.uid() = user_id. Looped rather than hand-written 21×4 times so
-- the one pattern is easy to audit against the table list below.
-- ────────────────────────────────────────────────────────────────────────

do $$
declare
  t text;
  tables text[] := array[
    'blood_reports','daily_logs','daily_mental_states','daily_exercise','daily_recovery',
    'daily_supplements','meals','meal_items','health_events','health_event_photos',
    'weekly_photos','periods','masters','settings','agent_insights','specialist_qa',
    'signals','profile','profile_conditions','medications','gemini_call_log','signal_pattern_log'
  ];
begin
  foreach t in array tables loop
    execute format('alter table %I enable row level security', t);

    execute format('drop policy if exists "select own rows" on %I', t);
    execute format('create policy "select own rows" on %I for select using (auth.uid() = user_id)', t);

    execute format('drop policy if exists "insert own rows" on %I', t);
    execute format('create policy "insert own rows" on %I for insert with check (auth.uid() = user_id)', t);

    execute format('drop policy if exists "update own rows" on %I', t);
    execute format('create policy "update own rows" on %I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);

    execute format('drop policy if exists "delete own rows" on %I', t);
    execute format('create policy "delete own rows" on %I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ────────────────────────────────────────────────────────────────────────
-- STEP 6 — Storage: replace the current public anon policies on all 4
-- buckets with ones scoped to Supabase Storage's automatic `owner` column
-- (set to auth.uid() at upload time by an authenticated client — every
-- upload in this app now goes through either the browser client or the
-- request-scoped server client from lib/supabaseServer.ts, both of which
-- carry a real session, so `owner` will be populated correctly going
-- forward).
--
-- This drops ALL existing policies on storage.objects first — safe here
-- since this app only ever uses these 4 buckets, so nothing else is being
-- inadvertently removed.
-- ────────────────────────────────────────────────────────────────────────

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' loop
    execute format('drop policy %I on storage.objects', pol.policyname);
  end loop;
end $$;

do $$
declare
  b text;
  buckets text[] := array['blood-reports','health-event-photos','weekly-photos','prescriptions'];
begin
  foreach b in array buckets loop
    execute format(
      'create policy %I on storage.objects for select using (bucket_id = %L and auth.uid() = owner)',
      'select own — ' || b, b
    );
    execute format(
      'create policy %I on storage.objects for insert with check (bucket_id = %L and auth.uid() = owner)',
      'insert own — ' || b, b
    );
    execute format(
      'create policy %I on storage.objects for update using (bucket_id = %L and auth.uid() = owner)',
      'update own — ' || b, b
    );
    execute format(
      'create policy %I on storage.objects for delete using (bucket_id = %L and auth.uid() = owner)',
      'delete own — ' || b, b
    );
  end loop;
end $$;

-- ────────────────────────────────────────────────────────────────────────
-- VERIFICATION — run these after, to confirm the lockdown took effect
-- ────────────────────────────────────────────────────────────────────────

-- Every row here should show rowsecurity = true.
-- select relname, relrowsecurity from pg_class
--   where relname in (
--     'blood_reports','daily_logs','daily_mental_states','daily_exercise','daily_recovery',
--     'daily_supplements','meals','meal_items','health_events','health_event_photos',
--     'weekly_photos','periods','masters','settings','agent_insights','specialist_qa',
--     'signals','profile','profile_conditions','medications','gemini_call_log','signal_pattern_log'
--   );

-- Should list 4 policies per bucket (16 rows total).
-- select policyname, cmd from pg_policies where schemaname = 'storage' and tablename = 'objects';

-- ============================================================================
-- END
-- ============================================================================
