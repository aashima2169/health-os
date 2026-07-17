-- ============================================================================
-- Signals: add possible_explanations (competing explanations per pattern).
-- Additive, safe default — existing rows just get an empty array.
-- ============================================================================

alter table signals
  add column if not exists possible_explanations jsonb not null default '[]'::jsonb;
