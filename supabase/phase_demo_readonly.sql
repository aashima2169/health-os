-- ============================================================================
-- Makes the demo account read-only: extends the existing insert/update/
-- delete RLS policies (from phase2_step5-6_rls_and_storage.sql) so that
-- specific account can never write, anywhere — enforced at the database,
-- not just hidden in the UI. SELECT policies are untouched; the demo
-- account can still read everything normally.
--
-- Paste the demo user's user_id (from scripts/create-demo-user.mjs)
-- into v_demo_user_id before running.
-- ============================================================================

do $$
declare
  t text;
  v_demo_user_id uuid := 'a33f88c0-b260-4b34-9754-0455af77e645';
  tables text[] := array[
    'blood_reports','daily_logs','daily_mental_states','daily_exercise','daily_recovery',
    'daily_supplements','meals','meal_items','health_events','health_event_photos',
    'weekly_photos','periods','masters','settings','agent_insights','specialist_qa',
    'signals','profile','profile_conditions','medications','gemini_call_log','signal_pattern_log'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists "insert own rows" on %I', t);
    execute format(
      'create policy "insert own rows" on %I for insert with check (auth.uid() = user_id and auth.uid() <> %L)',
      t, v_demo_user_id
    );

    execute format('drop policy if exists "update own rows" on %I', t);
    execute format(
      'create policy "update own rows" on %I for update using (auth.uid() = user_id and auth.uid() <> %L) with check (auth.uid() = user_id and auth.uid() <> %L)',
      t, v_demo_user_id, v_demo_user_id
    );

    execute format('drop policy if exists "delete own rows" on %I', t);
    execute format(
      'create policy "delete own rows" on %I for delete using (auth.uid() = user_id and auth.uid() <> %L)',
      t, v_demo_user_id
    );
  end loop;
end $$;
