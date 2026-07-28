-- ============================================================================
-- Fictional demo-account seed data. Run AFTER scripts/create-demo-user.mjs
-- has printed the demo user's user_id — paste it into v_demo_user_id below
-- before running. Dates are relative to today (current_date - N) so the
-- demo always looks recent, however long after seeding it's actually used.
--
-- Entirely fictional — nothing here is copied from real logged data.
-- ============================================================================

do $$
declare
  v_demo_user_id uuid := 'a33f88c0-b260-4b34-9754-0455af77e645';
begin

  -- Skip onboarding tutorial + consent screen for demo visitors — they
  -- should land straight on Check-in.
  insert into user_consent (user_id)
  values (v_demo_user_id)
  on conflict (user_id) do nothing;

  -- ── Daily logs, 6 days, most recent = today ──────────────────────
  insert into daily_logs (user_id, log_date, weight_kg, sleep_hours, energy_level, brain_fog, watched_sunrise, watched_sunset, breathing, grounding_done, supplements_taken, notes)
  values
    (v_demo_user_id, current_date,     58.2, 7.5, 4, false, true,  false, 'deep',    true,  true, null),
    (v_demo_user_id, current_date - 1, 58.4, 6.8, 3, false, false, true,  'deep',    false, true, null),
    (v_demo_user_id, current_date - 2, 58.3, 5.5, 2, true,  false, false, 'shallow', false, true, null),
    (v_demo_user_id, current_date - 3, 58.6, 6.2, 3, true,  false, false, 'shallow', false, false, null),
    (v_demo_user_id, current_date - 4, 58.5, 7.0, 4, false, true,  false, 'deep',    true,  true, null),
    (v_demo_user_id, current_date - 5, 58.7, 7.8, 5, false, true,  true,  'deep',    true,  true, null)
  on conflict (user_id, log_date) do nothing;

  insert into daily_mental_states (user_id, log_date, state)
  values
    (v_demo_user_id, current_date,     'Calm'),
    (v_demo_user_id, current_date - 1, 'Content'),
    (v_demo_user_id, current_date - 2, 'Stressed'),
    (v_demo_user_id, current_date - 2, 'Tired'),
    (v_demo_user_id, current_date - 3, 'Overwhelmed'),
    (v_demo_user_id, current_date - 4, 'Hopeful'),
    (v_demo_user_id, current_date - 5, 'Energized');

  insert into daily_exercise (user_id, log_date, exercise_type)
  values
    (v_demo_user_id, current_date,     'Yoga'),
    (v_demo_user_id, current_date - 1, 'Walking'),
    (v_demo_user_id, current_date - 4, 'Strength Training'),
    (v_demo_user_id, current_date - 5, 'Walking');

  insert into daily_recovery (user_id, log_date, activity)
  values
    (v_demo_user_id, current_date,     'Deep Breathing'),
    (v_demo_user_id, current_date - 2, 'Nap'),
    (v_demo_user_id, current_date - 4, 'Time Outdoors'),
    (v_demo_user_id, current_date - 5, 'Meditation');

  insert into daily_supplements (user_id, log_date, supplement)
  values
    (v_demo_user_id, current_date,     'Vitamin D'),
    (v_demo_user_id, current_date - 1, 'Vitamin D'),
    (v_demo_user_id, current_date - 1, 'Magnesium'),
    (v_demo_user_id, current_date - 4, 'Vitamin D'),
    (v_demo_user_id, current_date - 5, 'Vitamin D'),
    (v_demo_user_id, current_date - 5, 'Magnesium');

  insert into meals (user_id, log_date, slot, location, outside_reason, description)
  values
    (v_demo_user_id, current_date, 'breakfast', 'home', null, 'Oatmeal with berries'),
    (v_demo_user_id, current_date, 'lunch', 'home', null, 'Rice & dal, salad'),
    (v_demo_user_id, current_date, 'dinner', 'outside', 'Social outing', 'Grilled chicken, vegetables'),
    (v_demo_user_id, current_date - 2, 'breakfast', 'home', null, 'Toast and eggs'),
    (v_demo_user_id, current_date - 2, 'lunch', 'outside', 'No time to cook', 'Sandwich'),
    (v_demo_user_id, current_date - 2, 'dinner', 'home', null, 'Soup')
  on conflict (user_id, log_date, slot) do nothing;

  -- ── One resolved flare, a few days back ──────────────────────────
  insert into health_events (user_id, event_type, start_date, end_date, severity, status, body_location, notes)
  values (
    v_demo_user_id, 'Flare-up', current_date - 3, current_date - 1, 3, 'new', 'Forearms',
    'Started after a stressful, short-sleep stretch. Resolved within a couple of days.'
  );

  -- ── Starter master lists, same content as the new-signup default
  -- template (phase_seed_default_masters.sql), so Check-in's chip-pickers
  -- aren't empty for demo visitors. Trimmed to the categories actually
  -- exercised by the seeded days above, plus the full standard set.
  insert into masters (user_id, category, value, is_default, sort_order)
  values
    (v_demo_user_id, 'mental_state', 'Calm', true, 1),
    (v_demo_user_id, 'mental_state', 'Anxious', true, 2),
    (v_demo_user_id, 'mental_state', 'Stressed', true, 3),
    (v_demo_user_id, 'mental_state', 'Energized', true, 4),
    (v_demo_user_id, 'mental_state', 'Tired', true, 5),
    (v_demo_user_id, 'mental_state', 'Overwhelmed', true, 6),
    (v_demo_user_id, 'mental_state', 'Content', true, 7),
    (v_demo_user_id, 'mental_state', 'Irritable', true, 8),
    (v_demo_user_id, 'mental_state', 'Foggy', true, 9),
    (v_demo_user_id, 'mental_state', 'Hopeful', true, 10),
    (v_demo_user_id, 'exercise_type', 'Walking', true, 1),
    (v_demo_user_id, 'exercise_type', 'Yoga', true, 2),
    (v_demo_user_id, 'exercise_type', 'Strength Training', true, 3),
    (v_demo_user_id, 'exercise_type', 'Running', true, 4),
    (v_demo_user_id, 'exercise_type', 'Cycling', true, 5),
    (v_demo_user_id, 'exercise_type', 'Swimming', true, 6),
    (v_demo_user_id, 'exercise_type', 'Stretching', true, 7),
    (v_demo_user_id, 'exercise_type', 'Rest Day', true, 8),
    (v_demo_user_id, 'recovery_activity', 'Meditation', true, 1),
    (v_demo_user_id, 'recovery_activity', 'Deep Breathing', true, 2),
    (v_demo_user_id, 'recovery_activity', 'Nap', true, 3),
    (v_demo_user_id, 'recovery_activity', 'Journaling', true, 4),
    (v_demo_user_id, 'recovery_activity', 'Warm Bath', true, 5),
    (v_demo_user_id, 'recovery_activity', 'Time Outdoors', true, 6),
    (v_demo_user_id, 'recovery_activity', 'Reading', true, 7),
    (v_demo_user_id, 'recovery_activity', 'Massage', true, 8),
    (v_demo_user_id, 'supplement', 'Vitamin D', true, 1),
    (v_demo_user_id, 'supplement', 'Vitamin B12', true, 2),
    (v_demo_user_id, 'supplement', 'Iron', true, 3),
    (v_demo_user_id, 'supplement', 'Omega-3', true, 4),
    (v_demo_user_id, 'supplement', 'Magnesium', true, 5),
    (v_demo_user_id, 'supplement', 'Probiotic', true, 6),
    (v_demo_user_id, 'supplement', 'Multivitamin', true, 7),
    (v_demo_user_id, 'outside_reason', 'No time to cook', true, 1),
    (v_demo_user_id, 'outside_reason', 'Social outing', true, 2),
    (v_demo_user_id, 'outside_reason', 'Work event', true, 3),
    (v_demo_user_id, 'outside_reason', 'Travel', true, 4),
    (v_demo_user_id, 'outside_reason', 'Stressed', true, 5),
    (v_demo_user_id, 'outside_reason', 'Craving', true, 6),
    (v_demo_user_id, 'outside_reason', 'Family gathering', true, 7),
    (v_demo_user_id, 'health_event_type', 'Flare-up', true, 1),
    (v_demo_user_id, 'health_event_type', 'Rash', true, 2),
    (v_demo_user_id, 'health_event_type', 'Joint pain', true, 3),
    (v_demo_user_id, 'health_event_type', 'Headache', true, 4),
    (v_demo_user_id, 'health_event_type', 'Fatigue spike', true, 5),
    (v_demo_user_id, 'health_event_type', 'Digestive issue', true, 6),
    (v_demo_user_id, 'health_event_type', 'Bloating', true, 7),
    (v_demo_user_id, 'body_location', 'Face', true, 1),
    (v_demo_user_id, 'body_location', 'Scalp', true, 2),
    (v_demo_user_id, 'body_location', 'Hands', true, 3),
    (v_demo_user_id, 'body_location', 'Elbows', true, 4),
    (v_demo_user_id, 'body_location', 'Knees', true, 5),
    (v_demo_user_id, 'body_location', 'Stomach', true, 6),
    (v_demo_user_id, 'body_location', 'Back', true, 7),
    (v_demo_user_id, 'body_location', 'Chest', true, 8),
    (v_demo_user_id, 'body_location', 'Neck', true, 9),
    (v_demo_user_id, 'body_location', 'Legs', true, 10)
  on conflict (user_id, category, value) do nothing;

  insert into meal_items (user_id, slot, item_name, sort_order)
  values
    (v_demo_user_id, 'breakfast', 'Oatmeal', 1),
    (v_demo_user_id, 'breakfast', 'Eggs', 2),
    (v_demo_user_id, 'breakfast', 'Toast', 3),
    (v_demo_user_id, 'breakfast', 'Smoothie', 4),
    (v_demo_user_id, 'breakfast', 'Fruit', 5),
    (v_demo_user_id, 'breakfast', 'Yogurt', 6),
    (v_demo_user_id, 'lunch', 'Rice & Dal', 1),
    (v_demo_user_id, 'lunch', 'Salad', 2),
    (v_demo_user_id, 'lunch', 'Sandwich', 3),
    (v_demo_user_id, 'lunch', 'Soup', 4),
    (v_demo_user_id, 'lunch', 'Grilled Chicken', 5),
    (v_demo_user_id, 'lunch', 'Vegetables', 6),
    (v_demo_user_id, 'dinner', 'Rice & Curry', 1),
    (v_demo_user_id, 'dinner', 'Roti & Sabzi', 2),
    (v_demo_user_id, 'dinner', 'Pasta', 3),
    (v_demo_user_id, 'dinner', 'Grilled Fish', 4),
    (v_demo_user_id, 'dinner', 'Stir-fry', 5),
    (v_demo_user_id, 'dinner', 'Soup', 6),
    (v_demo_user_id, 'snacks', 'Nuts', 1),
    (v_demo_user_id, 'snacks', 'Fruit', 2),
    (v_demo_user_id, 'snacks', 'Yogurt', 3),
    (v_demo_user_id, 'snacks', 'Crackers', 4),
    (v_demo_user_id, 'snacks', 'Tea/Coffee', 5),
    (v_demo_user_id, 'snacks', 'Dark Chocolate', 6)
  on conflict (user_id, slot, item_name) do nothing;

end $$;
