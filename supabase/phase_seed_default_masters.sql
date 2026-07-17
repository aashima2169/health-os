-- ============================================================================
-- Seed a generic starter template into masters/meal_items for every NEW
-- sign-up, via a trigger on auth.users. Existing accounts are untouched —
-- this only fires going forward. Users can edit/add/remove everything
-- afterward via Settings (Customise Lists) exactly as before.
-- ============================================================================

create or replace function public.seed_default_masters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into masters (user_id, category, value, is_default, sort_order)
  values
    -- Inner States
    (new.id, 'mental_state', 'Calm', true, 1),
    (new.id, 'mental_state', 'Anxious', true, 2),
    (new.id, 'mental_state', 'Stressed', true, 3),
    (new.id, 'mental_state', 'Energized', true, 4),
    (new.id, 'mental_state', 'Tired', true, 5),
    (new.id, 'mental_state', 'Overwhelmed', true, 6),
    (new.id, 'mental_state', 'Content', true, 7),
    (new.id, 'mental_state', 'Irritable', true, 8),
    (new.id, 'mental_state', 'Foggy', true, 9),
    (new.id, 'mental_state', 'Hopeful', true, 10),

    -- Movement Types
    (new.id, 'exercise_type', 'Walking', true, 1),
    (new.id, 'exercise_type', 'Yoga', true, 2),
    (new.id, 'exercise_type', 'Strength Training', true, 3),
    (new.id, 'exercise_type', 'Running', true, 4),
    (new.id, 'exercise_type', 'Cycling', true, 5),
    (new.id, 'exercise_type', 'Swimming', true, 6),
    (new.id, 'exercise_type', 'Stretching', true, 7),
    (new.id, 'exercise_type', 'Rest Day', true, 8),

    -- Recovery Activities
    (new.id, 'recovery_activity', 'Meditation', true, 1),
    (new.id, 'recovery_activity', 'Deep Breathing', true, 2),
    (new.id, 'recovery_activity', 'Nap', true, 3),
    (new.id, 'recovery_activity', 'Journaling', true, 4),
    (new.id, 'recovery_activity', 'Warm Bath', true, 5),
    (new.id, 'recovery_activity', 'Time Outdoors', true, 6),
    (new.id, 'recovery_activity', 'Reading', true, 7),
    (new.id, 'recovery_activity', 'Massage', true, 8),

    -- Supplements
    (new.id, 'supplement', 'Vitamin D', true, 1),
    (new.id, 'supplement', 'Vitamin B12', true, 2),
    (new.id, 'supplement', 'Iron', true, 3),
    (new.id, 'supplement', 'Omega-3', true, 4),
    (new.id, 'supplement', 'Magnesium', true, 5),
    (new.id, 'supplement', 'Probiotic', true, 6),
    (new.id, 'supplement', 'Multivitamin', true, 7),

    -- Outside Food Reasons
    (new.id, 'outside_reason', 'No time to cook', true, 1),
    (new.id, 'outside_reason', 'Social outing', true, 2),
    (new.id, 'outside_reason', 'Work event', true, 3),
    (new.id, 'outside_reason', 'Travel', true, 4),
    (new.id, 'outside_reason', 'Stressed', true, 5),
    (new.id, 'outside_reason', 'Craving', true, 6),
    (new.id, 'outside_reason', 'Family gathering', true, 7),

    -- Health Event Types
    (new.id, 'health_event_type', 'Flare-up', true, 1),
    (new.id, 'health_event_type', 'Rash', true, 2),
    (new.id, 'health_event_type', 'Joint pain', true, 3),
    (new.id, 'health_event_type', 'Headache', true, 4),
    (new.id, 'health_event_type', 'Fatigue spike', true, 5),
    (new.id, 'health_event_type', 'Digestive issue', true, 6),
    (new.id, 'health_event_type', 'Bloating', true, 7),

    -- Body Locations
    (new.id, 'body_location', 'Face', true, 1),
    (new.id, 'body_location', 'Scalp', true, 2),
    (new.id, 'body_location', 'Hands', true, 3),
    (new.id, 'body_location', 'Elbows', true, 4),
    (new.id, 'body_location', 'Knees', true, 5),
    (new.id, 'body_location', 'Stomach', true, 6),
    (new.id, 'body_location', 'Back', true, 7),
    (new.id, 'body_location', 'Chest', true, 8),
    (new.id, 'body_location', 'Neck', true, 9),
    (new.id, 'body_location', 'Legs', true, 10)
  on conflict (user_id, category, value) do nothing;

  insert into meal_items (user_id, slot, item_name, sort_order)
  values
    -- Breakfast
    (new.id, 'breakfast', 'Oatmeal', 1),
    (new.id, 'breakfast', 'Eggs', 2),
    (new.id, 'breakfast', 'Toast', 3),
    (new.id, 'breakfast', 'Smoothie', 4),
    (new.id, 'breakfast', 'Fruit', 5),
    (new.id, 'breakfast', 'Yogurt', 6),

    -- Lunch
    (new.id, 'lunch', 'Rice & Dal', 1),
    (new.id, 'lunch', 'Salad', 2),
    (new.id, 'lunch', 'Sandwich', 3),
    (new.id, 'lunch', 'Soup', 4),
    (new.id, 'lunch', 'Grilled Chicken', 5),
    (new.id, 'lunch', 'Vegetables', 6),

    -- Dinner
    (new.id, 'dinner', 'Rice & Curry', 1),
    (new.id, 'dinner', 'Roti & Sabzi', 2),
    (new.id, 'dinner', 'Pasta', 3),
    (new.id, 'dinner', 'Grilled Fish', 4),
    (new.id, 'dinner', 'Stir-fry', 5),
    (new.id, 'dinner', 'Soup', 6),

    -- Snacks
    (new.id, 'snacks', 'Nuts', 1),
    (new.id, 'snacks', 'Fruit', 2),
    (new.id, 'snacks', 'Yogurt', 3),
    (new.id, 'snacks', 'Crackers', 4),
    (new.id, 'snacks', 'Tea/Coffee', 5),
    (new.id, 'snacks', 'Dark Chocolate', 6)
  on conflict (user_id, slot, item_name) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_seed_masters on auth.users;
create trigger on_auth_user_created_seed_masters
  after insert on auth.users
  for each row execute function public.seed_default_masters();
