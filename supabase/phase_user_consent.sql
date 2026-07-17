-- ============================================================================
-- One-time, per-account data consent. Recorded once after first sign-in,
-- checked by middleware.ts on every request thereafter — never asked again
-- for that account, on any device.
-- ============================================================================

create table if not exists user_consent (
  user_id uuid primary key references auth.users(id) default auth.uid(),
  consented_at timestamptz not null default now()
);

alter table user_consent enable row level security;

drop policy if exists "select own consent" on user_consent;
create policy "select own consent" on user_consent for select using (auth.uid() = user_id);

drop policy if exists "insert own consent" on user_consent;
create policy "insert own consent" on user_consent for insert with check (auth.uid() = user_id);
