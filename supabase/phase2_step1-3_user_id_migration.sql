-- ============================================================================
-- PHASE 2, STEPS 1–3 — add user_id, fix constraints, backfill, lock down.
-- Run this whole script once in the Supabase SQL editor. RLS is NOT touched
-- here — the app keeps working exactly as today throughout. RLS is a
-- separate, final script you'll run only after the code refactor is deployed
-- and verified.
--
-- If any single ALTER TABLE ... DROP/ADD CONSTRAINT statement errors because
-- a constraint name doesn't match what's guessed here, stop and paste me the
-- exact error — I'll look up the real name and give you a one-line fix.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────
-- STEP 1a — add user_id (nullable for now) to every table
-- ────────────────────────────────────────────────────────────────────────

alter table blood_reports        add column if not exists user_id uuid references auth.users(id);
alter table daily_logs           add column if not exists user_id uuid references auth.users(id);
alter table daily_mental_states  add column if not exists user_id uuid references auth.users(id);
alter table daily_exercise       add column if not exists user_id uuid references auth.users(id);
alter table daily_recovery       add column if not exists user_id uuid references auth.users(id);
alter table daily_supplements    add column if not exists user_id uuid references auth.users(id);
alter table meals                add column if not exists user_id uuid references auth.users(id);
alter table meal_items           add column if not exists user_id uuid references auth.users(id);
alter table health_events        add column if not exists user_id uuid references auth.users(id);
alter table health_event_photos  add column if not exists user_id uuid references auth.users(id);
alter table weekly_photos        add column if not exists user_id uuid references auth.users(id);
alter table periods              add column if not exists user_id uuid references auth.users(id);
alter table masters              add column if not exists user_id uuid references auth.users(id);
alter table settings             add column if not exists user_id uuid references auth.users(id);
alter table agent_insights       add column if not exists user_id uuid references auth.users(id);
alter table specialist_qa        add column if not exists user_id uuid references auth.users(id);
alter table signals              add column if not exists user_id uuid references auth.users(id);
alter table profile              add column if not exists user_id uuid references auth.users(id);
alter table profile_conditions   add column if not exists user_id uuid references auth.users(id);
alter table medications          add column if not exists user_id uuid references auth.users(id);
alter table gemini_call_log      add column if not exists user_id uuid references auth.users(id);
alter table signal_pattern_log   add column if not exists user_id uuid references auth.users(id);

-- ────────────────────────────────────────────────────────────────────────
-- STEP 1b — backfill every row to your account (looked up by email, so
-- no UUID hunting required)
-- ────────────────────────────────────────────────────────────────────────

update blood_reports        set user_id = (select id from auth.users where email = 'aashima.kapoordps@gmail.com') where user_id is null;
update daily_logs           set user_id = (select id from auth.users where email = 'aashima.kapoordps@gmail.com') where user_id is null;
update daily_mental_states  set user_id = (select id from auth.users where email = 'aashima.kapoordps@gmail.com') where user_id is null;
update daily_exercise       set user_id = (select id from auth.users where email = 'aashima.kapoordps@gmail.com') where user_id is null;
update daily_recovery       set user_id = (select id from auth.users where email = 'aashima.kapoordps@gmail.com') where user_id is null;
update daily_supplements    set user_id = (select id from auth.users where email = 'aashima.kapoordps@gmail.com') where user_id is null;
update meals                set user_id = (select id from auth.users where email = 'aashima.kapoordps@gmail.com') where user_id is null;
update meal_items           set user_id = (select id from auth.users where email = 'aashima.kapoordps@gmail.com') where user_id is null;
update health_events        set user_id = (select id from auth.users where email = 'aashima.kapoordps@gmail.com') where user_id is null;
update health_event_photos  set user_id = (select id from auth.users where email = 'aashima.kapoordps@gmail.com') where user_id is null;
update weekly_photos        set user_id = (select id from auth.users where email = 'aashima.kapoordps@gmail.com') where user_id is null;
update periods               set user_id = (select id from auth.users where email = 'aashima.kapoordps@gmail.com') where user_id is null;
update masters               set user_id = (select id from auth.users where email = 'aashima.kapoordps@gmail.com') where user_id is null;
update settings               set user_id = (select id from auth.users where email = 'aashima.kapoordps@gmail.com') where user_id is null;
update agent_insights        set user_id = (select id from auth.users where email = 'aashima.kapoordps@gmail.com') where user_id is null;
update specialist_qa         set user_id = (select id from auth.users where email = 'aashima.kapoordps@gmail.com') where user_id is null;
update signals                set user_id = (select id from auth.users where email = 'aashima.kapoordps@gmail.com') where user_id is null;
update profile                set user_id = (select id from auth.users where email = 'aashima.kapoordps@gmail.com') where user_id is null;
update profile_conditions    set user_id = (select id from auth.users where email = 'aashima.kapoordps@gmail.com') where user_id is null;
update medications            set user_id = (select id from auth.users where email = 'aashima.kapoordps@gmail.com') where user_id is null;
update gemini_call_log        set user_id = (select id from auth.users where email = 'aashima.kapoordps@gmail.com') where user_id is null;
update signal_pattern_log    set user_id = (select id from auth.users where email = 'aashima.kapoordps@gmail.com') where user_id is null;

-- ────────────────────────────────────────────────────────────────────────
-- STEP 1c — fix constraints that are currently global and would let two
-- users silently collide/overwrite each other's rows
-- ────────────────────────────────────────────────────────────────────────

-- Child tables FK to daily_logs(log_date) must be DROPPED FIRST — they
-- depend on daily_logs' unique index, which blocks dropping it otherwise.
alter table daily_mental_states drop constraint if exists daily_mental_states_log_date_fkey;
alter table daily_exercise      drop constraint if exists daily_exercise_log_date_fkey;
alter table daily_recovery      drop constraint if exists daily_recovery_log_date_fkey;
alter table daily_supplements   drop constraint if exists daily_supplements_log_date_fkey;
alter table meals               drop constraint if exists meals_log_date_fkey;

-- Now safe to drop daily_logs.log_date's global unique and replace with composite.
-- Every ADD CONSTRAINT below is guarded (checks pg_constraint first) so this
-- whole script is safe to re-run from the top no matter where a prior
-- attempt stopped — the Supabase SQL editor commits statements as it goes,
-- it does not roll back the whole script on a later error.
alter table daily_logs drop constraint if exists daily_logs_log_date_key;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'daily_logs_user_log_date_key') then
    alter table daily_logs add constraint daily_logs_user_log_date_key unique (user_id, log_date);
  end if;
end $$;

-- Re-add the child FKs, now composite against the new unique constraint.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'daily_mental_states_user_log_date_fkey') then
    alter table daily_mental_states add constraint daily_mental_states_user_log_date_fkey
      foreign key (user_id, log_date) references daily_logs(user_id, log_date);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'daily_exercise_user_log_date_fkey') then
    alter table daily_exercise add constraint daily_exercise_user_log_date_fkey
      foreign key (user_id, log_date) references daily_logs(user_id, log_date);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'daily_recovery_user_log_date_fkey') then
    alter table daily_recovery add constraint daily_recovery_user_log_date_fkey
      foreign key (user_id, log_date) references daily_logs(user_id, log_date);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'daily_supplements_user_log_date_fkey') then
    alter table daily_supplements add constraint daily_supplements_user_log_date_fkey
      foreign key (user_id, log_date) references daily_logs(user_id, log_date);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'meals_user_log_date_fkey') then
    alter table meals add constraint meals_user_log_date_fkey
      foreign key (user_id, log_date) references daily_logs(user_id, log_date);
  end if;
end $$;

-- meals(log_date, slot) -> add user_id
alter table meals drop constraint if exists meals_log_date_slot_key;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'meals_user_log_date_slot_key') then
    alter table meals add constraint meals_user_log_date_slot_key unique (user_id, log_date, slot);
  end if;
end $$;

-- meal_items(slot, item_name) -> add user_id
alter table meal_items drop constraint if exists meal_items_slot_item_name_key;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'meal_items_user_slot_item_name_key') then
    alter table meal_items add constraint meal_items_user_slot_item_name_key unique (user_id, slot, item_name);
  end if;
end $$;

-- weekly_photos(week_of, photo_type) -> add user_id
alter table weekly_photos drop constraint if exists weekly_photos_week_of_photo_type_key;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'weekly_photos_user_week_of_photo_type_key') then
    alter table weekly_photos add constraint weekly_photos_user_week_of_photo_type_key unique (user_id, week_of, photo_type);
  end if;
end $$;

-- masters(category, value) -> add user_id
alter table masters drop constraint if exists masters_category_value_key;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'masters_user_category_value_key') then
    alter table masters add constraint masters_user_category_value_key unique (user_id, category, value);
  end if;
end $$;

-- signals.topic_key -> add user_id
alter table signals drop constraint if exists signals_topic_key_key;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'signals_user_topic_key_key') then
    alter table signals add constraint signals_user_topic_key_key unique (user_id, topic_key);
  end if;
end $$;

-- specialist_qa(agent_id, question) -> add user_id (missed in the original
-- plan list — same collision risk: two users' answers to the same
-- standard specialist question would otherwise overwrite each other)
alter table specialist_qa drop constraint if exists specialist_qa_agent_id_question_key;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'specialist_qa_user_agent_id_question_key') then
    alter table specialist_qa add constraint specialist_qa_user_agent_id_question_key unique (user_id, agent_id, question);
  end if;
end $$;

-- agent_insights primary key (agent_id, period) -> (user_id, agent_id, period)
alter table agent_insights drop constraint if exists agent_insights_pkey;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'agent_insights_pkey') then
    alter table agent_insights add constraint agent_insights_pkey primary key (user_id, agent_id, period);
  end if;
end $$;

-- settings: key -> (user_id, key)
alter table settings drop constraint if exists settings_pkey;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'settings_pkey') then
    alter table settings add constraint settings_pkey primary key (user_id, key);
  end if;
end $$;

-- profile: leave the existing 'singleton' id PK alone (harmless), just
-- make user_id the real per-user identity going forward.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profile_user_id_key') then
    alter table profile add constraint profile_user_id_key unique (user_id);
  end if;
end $$;

-- claim_agent_generation's ON CONFLICT target must match the new PK.
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

-- ────────────────────────────────────────────────────────────────────────
-- STEP 3 — lock down: user_id required + auto-populated going forward
-- ────────────────────────────────────────────────────────────────────────

alter table blood_reports        alter column user_id set not null, alter column user_id set default auth.uid();
alter table daily_logs           alter column user_id set not null, alter column user_id set default auth.uid();
alter table daily_mental_states  alter column user_id set not null, alter column user_id set default auth.uid();
alter table daily_exercise       alter column user_id set not null, alter column user_id set default auth.uid();
alter table daily_recovery       alter column user_id set not null, alter column user_id set default auth.uid();
alter table daily_supplements    alter column user_id set not null, alter column user_id set default auth.uid();
alter table meals                alter column user_id set not null, alter column user_id set default auth.uid();
alter table meal_items           alter column user_id set not null, alter column user_id set default auth.uid();
alter table health_events        alter column user_id set not null, alter column user_id set default auth.uid();
alter table health_event_photos  alter column user_id set not null, alter column user_id set default auth.uid();
alter table weekly_photos        alter column user_id set not null, alter column user_id set default auth.uid();
alter table periods              alter column user_id set not null, alter column user_id set default auth.uid();
alter table masters              alter column user_id set not null, alter column user_id set default auth.uid();
alter table settings             alter column user_id set not null, alter column user_id set default auth.uid();
alter table agent_insights       alter column user_id set not null, alter column user_id set default auth.uid();
alter table specialist_qa        alter column user_id set not null, alter column user_id set default auth.uid();
alter table signals              alter column user_id set not null, alter column user_id set default auth.uid();
alter table profile              alter column user_id set not null, alter column user_id set default auth.uid();
alter table profile_conditions   alter column user_id set not null, alter column user_id set default auth.uid();
alter table medications          alter column user_id set not null, alter column user_id set default auth.uid();
alter table gemini_call_log      alter column user_id set not null, alter column user_id set default auth.uid();
alter table signal_pattern_log   alter column user_id set not null, alter column user_id set default auth.uid();

-- ============================================================================
-- END — after this runs cleanly, the app should keep working exactly as
-- before (no RLS yet). Let me know once it's done and I'll start the code
-- refactor (Step 4).
-- ============================================================================
