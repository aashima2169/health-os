// lib/db.ts
// Every function takes an optional `client` as its last parameter,
// defaulting to the browser singleton (lib/supabase.ts). Client pages call
// these with no changes and get the correctly-session-bound browser client.
// Server-side callers (API routes) pass a request-scoped client from
// lib/supabaseServer.ts explicitly — required once RLS is enforcing
// auth.uid() = user_id on every table.
//
// NOTE: flares are NOT a separate table — they're logged as health_events
// (Events tab), already covered by getAllHealthEvents / getFullHistory's
// healthEvents field.

import { supabase } from './supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DailyLog, Meal, MealSlot, MealLocation, DietState,
  Period, HealthEvent, HealthEventPhoto, WeeklyPhoto,
  BloodReport, MasterCategory, CheckInPayload,
  Profile, ProfileCondition, Medication,
} from '../types'

// ─── MASTERS ──────────────────────────────────────────────────

export async function getMasters(category: MasterCategory, client: SupabaseClient = supabase): Promise<string[]> {
  const { data } = await client
    .from('masters').select('value').eq('category', category).order('sort_order')
  return (data ?? []).map((r) => r.value)
}

export async function addMaster(category: MasterCategory, value: string, client: SupabaseClient = supabase) {
  const { data: ex } = await client
    .from('masters').select('sort_order').eq('category', category)
    .order('sort_order', { ascending: false }).limit(1)
  const sort_order = ex && ex.length > 0 ? ex[0].sort_order + 1 : 1
  return client.from('masters').insert({ category, value, sort_order, is_default: false })
}

export async function deleteMaster(category: MasterCategory, value: string, client: SupabaseClient = supabase) {
  return client.from('masters').delete().eq('category', category).eq('value', value)
}

// ─── DAILY LOG ────────────────────────────────────────────────

export async function getLog(date: string, client: SupabaseClient = supabase): Promise<DailyLog | null> {
  const { data } = await client
    .from('daily_logs').select('*').eq('log_date', date).maybeSingle()
  return data
}

export async function getRecentLogs(days = 30, client: SupabaseClient = supabase): Promise<DailyLog[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)
  const { data } = await client
    .from('daily_logs').select('*')
    .gte('log_date', since.toISOString().split('T')[0])
    .order('log_date', { ascending: false })
  return data ?? []
}

export async function upsertLog(payload: Partial<DailyLog> & { log_date: string }, client: SupabaseClient = supabase) {
  return client
    .from('daily_logs').upsert(payload, { onConflict: 'user_id,log_date' }).select().single()
}

// ─── MENTAL STATES ────────────────────────────────────────────

export async function getMentalStates(date: string, client: SupabaseClient = supabase): Promise<string[]> {
  const { data } = await client
    .from('daily_mental_states').select('state').eq('log_date', date)
  return (data ?? []).map((r) => r.state)
}

export async function setMentalStates(date: string, states: string[], client: SupabaseClient = supabase) {
  await client.from('daily_mental_states').delete().eq('log_date', date)
  if (!states.length) return
  return client.from('daily_mental_states')
    .insert(states.map((state) => ({ log_date: date, state })))
}

// ─── EXERCISE / MOVEMENT ──────────────────────────────────────

export async function getExercise(date: string, client: SupabaseClient = supabase): Promise<string[]> {
  const { data } = await client
    .from('daily_exercise').select('exercise_type').eq('log_date', date)
  return (data ?? []).map((r) => r.exercise_type)
}

export async function setExercise(date: string, types: string[], client: SupabaseClient = supabase) {
  await client.from('daily_exercise').delete().eq('log_date', date)
  if (!types.length) return
  return client.from('daily_exercise')
    .insert(types.map((exercise_type) => ({ log_date: date, exercise_type })))
}

// ─── RECOVERY ACTIVITIES ──────────────────────────────────────

export async function getRecovery(date: string, client: SupabaseClient = supabase): Promise<string[]> {
  const { data } = await client
    .from('daily_recovery').select('activity').eq('log_date', date)
  return (data ?? []).map((r) => r.activity)
}

export async function setRecovery(date: string, activities: string[], client: SupabaseClient = supabase) {
  await client.from('daily_recovery').delete().eq('log_date', date)
  if (!activities.length) return
  return client.from('daily_recovery')
    .insert(activities.map((activity) => ({ log_date: date, activity })))
}

// ─── SUPPLEMENTS (daily taken) ─────────────────────────────────

export async function getSupplements(date: string, client: SupabaseClient = supabase): Promise<string[]> {
  const { data } = await client
    .from('daily_supplements').select('supplement').eq('log_date', date)
  return (data ?? []).map((r) => r.supplement)
}

export async function setSupplements(date: string, supplements: string[], client: SupabaseClient = supabase) {
  await client.from('daily_supplements').delete().eq('log_date', date)
  if (!supplements.length) return
  return client.from('daily_supplements')
    .insert(supplements.map((supplement) => ({ log_date: date, supplement })))
}

// ─── MEALS (daily diet entries) ────────────────────────────────

export async function getMeals(date: string, client: SupabaseClient = supabase): Promise<Meal[]> {
  const { data } = await client
    .from('meals').select('*').eq('log_date', date).order('slot')
  return data ?? []
}

export function mealsToDietState(meals: Meal[]): DietState {
  const blank = () => ({ location: 'home' as MealLocation, outside_reason: '', description: '' })
  const state: DietState = {
    breakfast: blank(), lunch: blank(), dinner: blank(), snacks: blank(),
  }
  for (const m of meals) {
    state[m.slot] = {
      location: m.location,
      outside_reason: m.outside_reason ?? '',
      description: m.description ?? '',
    }
  }
  return state
}

export async function setMeals(date: string, diet: DietState, client: SupabaseClient = supabase) {
  const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snacks']
  const rows = SLOTS.filter((s) => diet[s].description.trim()).map((slot) => ({
    log_date: date,
    slot,
    location: diet[slot].location,
    outside_reason: diet[slot].location === 'outside' && diet[slot].outside_reason
      ? diet[slot].outside_reason : null,
    description: diet[slot].description.trim() || null,
  }))
  await client.from('meals').delete().eq('log_date', date)
  if (!rows.length) return
  return client.from('meals').insert(rows)
}

export async function getOutsideReasons(client: SupabaseClient = supabase): Promise<string[]> {
  return getMasters('outside_reason', client)
}

// ─── MEAL ITEMS (quick-add master list for Diet section) ──────

export async function getMealItems(slot: MealSlot, client: SupabaseClient = supabase): Promise<string[]> {
  const { data } = await client
    .from('meal_items')
    .select('item_name')
    .eq('slot', slot)
    .order('sort_order')
  return (data ?? []).map((r) => r.item_name)
}

export async function getAllMealItems(client: SupabaseClient = supabase): Promise<Record<MealSlot, string[]>> {
  const { data } = await client
    .from('meal_items')
    .select('slot, item_name')
    .order('sort_order')

  const result: Record<MealSlot, string[]> = {
    breakfast: [], lunch: [], dinner: [], snacks: [],
  }
  for (const row of data ?? []) {
    result[row.slot as MealSlot].push(row.item_name)
  }
  return result
}

export async function addMealItem(slot: MealSlot, itemName: string, client: SupabaseClient = supabase) {
  const { data: existing } = await client
    .from('meal_items')
    .select('sort_order')
    .eq('slot', slot)
    .order('sort_order', { ascending: false })
    .limit(1)
  const sort_order = existing && existing.length > 0 ? existing[0].sort_order + 1 : 1

  return client.from('meal_items').insert({ slot, item_name: itemName, sort_order })
}

export async function deleteMealItem(slot: MealSlot, itemName: string, client: SupabaseClient = supabase) {
  return client.from('meal_items').delete().eq('slot', slot).eq('item_name', itemName)
}

// ─── FULL CHECK-IN SAVE ───────────────────────────────────────

export async function saveCheckIn(payload: CheckInPayload, client: SupabaseClient = supabase) {
  const {
    log_date, weight_kg, sleep_hours, energy_level, brain_fog,
    watched_sunrise, watched_sunset, breathing, grounding_done,
    supplements_taken, reflection, notes,
    mental_states = [], exercise_types = [], recovery_activities = [], supplements = [],
  } = payload

  await client.from('daily_logs').upsert({
    log_date, weight_kg, sleep_hours, energy_level, brain_fog,
    watched_sunrise, watched_sunset, breathing, grounding_done,
    supplements_taken: supplements_taken ?? supplements.length > 0,
    reflection, notes,
  }, { onConflict: 'user_id,log_date' })

  await Promise.all([
    setMentalStates(log_date, mental_states, client),
    setExercise(log_date, exercise_types, client),
    setRecovery(log_date, recovery_activities, client),
    setSupplements(log_date, supplements, client),
  ])
}

// ─── PERIODS ──────────────────────────────────────────────────

export async function getAllPeriods(client: SupabaseClient = supabase): Promise<Period[]> {
  const { data } = await client
    .from('periods').select('*').order('start_date', { ascending: false })
  return data ?? []
}

export async function getActivePeriod(date: string, client: SupabaseClient = supabase): Promise<Period | null> {
  const { data } = await client
    .from('periods').select('*')
    .lte('start_date', date)
    .or(`end_date.is.null,end_date.gte.${date}`)
    .maybeSingle()
  return data
}

export async function upsertPeriod(period: Partial<Period> & { start_date: string }, client: SupabaseClient = supabase) {
  return client.from('periods').upsert(period).select().single()
}

export async function deletePeriod(id: string, client: SupabaseClient = supabase) {
  return client.from('periods').delete().eq('id', id)
}

// ─── HEALTH EVENTS ────────────────────────────────────────────

export async function getAllHealthEvents(client: SupabaseClient = supabase): Promise<HealthEvent[]> {
  const { data } = await client
    .from('health_events').select('*').order('start_date', { ascending: false })
  return data ?? []
}

export async function getHealthEvent(id: string, client: SupabaseClient = supabase): Promise<HealthEvent | null> {
  const { data } = await client
    .from('health_events').select('*').eq('id', id).maybeSingle()
  return data
}

export async function upsertHealthEvent(event: Partial<HealthEvent> & { event_type: string; start_date: string }, client: SupabaseClient = supabase) {
  return client.from('health_events').upsert(event).select().single()
}

export async function deleteHealthEvent(id: string, client: SupabaseClient = supabase) {
  return client.from('health_events').delete().eq('id', id)
}

export async function getEventPhotos(eventId: string, client: SupabaseClient = supabase): Promise<HealthEventPhoto[]> {
  const { data } = await client
    .from('health_event_photos').select('*').eq('health_event_id', eventId)
    .order('taken_at')
  return data ?? []
}

export async function uploadEventPhoto(
  eventId: string, file: File, takenAt: string, notes?: string, client: SupabaseClient = supabase
): Promise<HealthEventPhoto> {
  const fileName = `${eventId}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`
  const { data: s, error: se } = await client.storage
    .from('health-event-photos').upload(fileName, file, { contentType: file.type })
  if (se) throw se
  const { data: urlData } = client.storage.from('health-event-photos').getPublicUrl(s.path)
  const { data, error } = await client.from('health_event_photos')
    .insert({ health_event_id: eventId, photo_url: urlData.publicUrl, taken_at: takenAt, notes })
    .select().single()
  if (error) throw error
  return data
}

// ─── WEEKLY PHOTOS ────────────────────────────────────────────

export async function getWeeklyPhotos(weekOf: string, client: SupabaseClient = supabase): Promise<WeeklyPhoto[]> {
  const { data } = await client
    .from('weekly_photos').select('*').eq('week_of', weekOf)
  return data ?? []
}

export async function getAllWeeklyPhotoWeeks(client: SupabaseClient = supabase): Promise<string[]> {
  const { data } = await client
    .from('weekly_photos').select('week_of').order('week_of', { ascending: false })
  return [...new Set((data ?? []).map((r) => r.week_of))]
}

export async function uploadWeeklyPhoto(
  weekOf: string, photoType: string, file: File, notes?: string, client: SupabaseClient = supabase
): Promise<WeeklyPhoto> {
  const fileName = `${weekOf}/${photoType}_${Date.now()}.${file.name.split('.').pop()}`
  const { data: s, error: se } = await client.storage
    .from('weekly-photos').upload(fileName, file, { contentType: file.type })
  if (se) throw se
  const { data: urlData } = client.storage.from('weekly-photos').getPublicUrl(s.path)
  const { data, error } = await client.from('weekly_photos')
    .upsert({ week_of: weekOf, photo_type: photoType, photo_url: urlData.publicUrl, notes },
      { onConflict: 'user_id,week_of,photo_type' })
    .select().single()
  if (error) throw error
  return data
}

// Most recent tongue photo at or before a given week — used by the TCM
// Practitioner specialist so it actually sees the photo instead of
// reasoning from lifestyle logs alone.
export async function getLatestTonguePhoto(beforeOrOnWeekOf: string, client: SupabaseClient = supabase): Promise<WeeklyPhoto | null> {
  return getLatestWeeklyPhotoByType('tongue', beforeOrOnWeekOf, client)
}

// Generic version — used by Dermatologist for acne/flare photos, same
// pattern as the tongue photo fetch for TCM.
export async function getLatestWeeklyPhotoByType(photoType: string, beforeOrOnWeekOf: string, client: SupabaseClient = supabase): Promise<WeeklyPhoto | null> {
  const { data } = await client
    .from('weekly_photos')
    .select('*')
    .eq('photo_type', photoType)
    .lte('week_of', beforeOrOnWeekOf)
    .order('week_of', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

// No week-boundary ceiling at all — just the single most recent photo of
// this type, period. The "beforeOrOnWeekOf" ceiling on the function above
// is a likely source of silent exclusion bugs (server-computed "current
// week" via timezone-sensitive date math not matching when/how a photo
// was actually uploaded), and for a specialist that just wants the latest
// available photo, that ceiling adds risk without real benefit.
export async function getMostRecentWeeklyPhotoByType(photoType: string, client: SupabaseClient = supabase): Promise<WeeklyPhoto | null> {
  const { data } = await client
    .from('weekly_photos')
    .select('*')
    .eq('photo_type', photoType)
    .order('week_of', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

// ─── BLOOD REPORTS ────────────────────────────────────────────

export async function getAllBloodReports(client: SupabaseClient = supabase): Promise<BloodReport[]> {
  const { data } = await client
    .from('blood_reports').select('*').order('report_date', { ascending: false })
  return data ?? []
}

// ─── FULL HISTORY (for AI agents) ────────────────────────────

export async function getFullHistory(days = 90, client: SupabaseClient = supabase) {
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceISO = since.toISOString().split('T')[0]

  const [logs, mentalStates, meals, exercise, recovery, supplements, healthEvents, periods] =
    await Promise.all([
      client.from('daily_logs').select('*').gte('log_date', sinceISO).order('log_date'),
      client.from('daily_mental_states').select('*').gte('log_date', sinceISO),
      client.from('meals').select('*').gte('log_date', sinceISO),
      client.from('daily_exercise').select('*').gte('log_date', sinceISO),
      client.from('daily_recovery').select('*').gte('log_date', sinceISO),
      client.from('daily_supplements').select('*').gte('log_date', sinceISO),
      client.from('health_events').select('*').gte('start_date', sinceISO),
      client.from('periods').select('*').gte('start_date', sinceISO),
    ])

  return {
    logs: logs.data ?? [],
    mentalStates: mentalStates.data ?? [],
    meals: meals.data ?? [],
    exercise: exercise.data ?? [],
    recovery: recovery.data ?? [],
    supplements: supplements.data ?? [],
    healthEvents: healthEvents.data ?? [],
    periods: periods.data ?? [],
  }
}

// ─── PROFILE ──────────────────────────────────────────────────
// RLS scopes these to the signed-in user, so no explicit id/user_id filter
// is needed — there's at most one row visible per user.

export async function getProfile(client: SupabaseClient = supabase): Promise<Profile | null> {
  const { data } = await client
    .from('profile').select('*').maybeSingle()
  return data
}

export async function upsertProfile(payload: Partial<Profile>, client: SupabaseClient = supabase) {
  return client
    .from('profile').upsert(payload, { onConflict: 'user_id' }).select().single()
}

export async function getConditions(client: SupabaseClient = supabase): Promise<ProfileCondition[]> {
  const { data } = await client
    .from('profile_conditions').select('*').order('created_at', { ascending: false })
  return data ?? []
}

export async function addCondition(payload: Partial<ProfileCondition> & { condition_name: string }, client: SupabaseClient = supabase) {
  return client.from('profile_conditions').insert(payload).select().single()
}

export async function deleteCondition(id: string, client: SupabaseClient = supabase) {
  return client.from('profile_conditions').delete().eq('id', id)
}

export async function getAllMedications(client: SupabaseClient = supabase): Promise<Medication[]> {
  const { data } = await client
    .from('medications').select('*').order('start_date', { ascending: false })
  return data ?? []
}

export async function upsertMedication(payload: Partial<Medication> & { name: string }, client: SupabaseClient = supabase) {
  return client.from('medications').upsert(payload).select().single()
}

export async function deleteMedication(id: string, client: SupabaseClient = supabase) {
  return client.from('medications').delete().eq('id', id)
}
