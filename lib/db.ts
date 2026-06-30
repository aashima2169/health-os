// lib/db.ts — FULL FILE, REPLACE YOUR EXISTING lib/db.ts ENTIRELY WITH THIS
// This consolidates every db function used across the app into one file
// so there are no more cross-file import mismatches.

import { supabase } from './supabase'
import type {
  DailyLog, Meal, MealSlot, MealLocation, DietState,
  Period, HealthEvent, HealthEventPhoto, WeeklyPhoto,
  BloodReport, MasterCategory, CheckInPayload,
} from '../types'

// ─── MASTERS ──────────────────────────────────────────────────

export async function getMasters(category: MasterCategory): Promise<string[]> {
  const { data } = await supabase
    .from('masters').select('value').eq('category', category).order('sort_order')
  return (data ?? []).map((r) => r.value)
}

export async function addMaster(category: MasterCategory, value: string) {
  const { data: ex } = await supabase
    .from('masters').select('sort_order').eq('category', category)
    .order('sort_order', { ascending: false }).limit(1)
  const sort_order = ex && ex.length > 0 ? ex[0].sort_order + 1 : 1
  return supabase.from('masters').insert({ category, value, sort_order, is_default: false })
}

export async function deleteMaster(category: MasterCategory, value: string) {
  return supabase.from('masters').delete().eq('category', category).eq('value', value)
}

// ─── DAILY LOG ────────────────────────────────────────────────

export async function getLog(date: string): Promise<DailyLog | null> {
  const { data } = await supabase
    .from('daily_logs').select('*').eq('log_date', date).maybeSingle()
  return data
}

export async function getRecentLogs(days = 30): Promise<DailyLog[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)
  const { data } = await supabase
    .from('daily_logs').select('*')
    .gte('log_date', since.toISOString().split('T')[0])
    .order('log_date', { ascending: false })
  return data ?? []
}

export async function upsertLog(payload: Partial<DailyLog> & { log_date: string }) {
  return supabase
    .from('daily_logs').upsert(payload, { onConflict: 'log_date' }).select().single()
}

// ─── MENTAL STATES ────────────────────────────────────────────

export async function getMentalStates(date: string): Promise<string[]> {
  const { data } = await supabase
    .from('daily_mental_states').select('state').eq('log_date', date)
  return (data ?? []).map((r) => r.state)
}

export async function setMentalStates(date: string, states: string[]) {
  await supabase.from('daily_mental_states').delete().eq('log_date', date)
  if (!states.length) return
  return supabase.from('daily_mental_states')
    .insert(states.map((state) => ({ log_date: date, state })))
}

// ─── EXERCISE / MOVEMENT ──────────────────────────────────────

export async function getExercise(date: string): Promise<string[]> {
  const { data } = await supabase
    .from('daily_exercise').select('exercise_type').eq('log_date', date)
  return (data ?? []).map((r) => r.exercise_type)
}

export async function setExercise(date: string, types: string[]) {
  await supabase.from('daily_exercise').delete().eq('log_date', date)
  if (!types.length) return
  return supabase.from('daily_exercise')
    .insert(types.map((exercise_type) => ({ log_date: date, exercise_type })))
}

// ─── RECOVERY ACTIVITIES ──────────────────────────────────────

export async function getRecovery(date: string): Promise<string[]> {
  const { data } = await supabase
    .from('daily_recovery').select('activity').eq('log_date', date)
  return (data ?? []).map((r) => r.activity)
}

export async function setRecovery(date: string, activities: string[]) {
  await supabase.from('daily_recovery').delete().eq('log_date', date)
  if (!activities.length) return
  return supabase.from('daily_recovery')
    .insert(activities.map((activity) => ({ log_date: date, activity })))
}

// ─── SUPPLEMENTS (daily taken) ─────────────────────────────────

export async function getSupplements(date: string): Promise<string[]> {
  const { data } = await supabase
    .from('daily_supplements').select('supplement').eq('log_date', date)
  return (data ?? []).map((r) => r.supplement)
}

export async function setSupplements(date: string, supplements: string[]) {
  await supabase.from('daily_supplements').delete().eq('log_date', date)
  if (!supplements.length) return
  return supabase.from('daily_supplements')
    .insert(supplements.map((supplement) => ({ log_date: date, supplement })))
}

// ─── MEALS (daily diet entries) ────────────────────────────────

export async function getMeals(date: string): Promise<Meal[]> {
  const { data } = await supabase
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

export async function setMeals(date: string, diet: DietState) {
  const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snacks']
  const rows = SLOTS.filter((s) => diet[s].description.trim()).map((slot) => ({
    log_date: date,
    slot,
    location: diet[slot].location,
    outside_reason: diet[slot].location === 'outside' && diet[slot].outside_reason
      ? diet[slot].outside_reason : null,
    description: diet[slot].description.trim() || null,
  }))
  await supabase.from('meals').delete().eq('log_date', date)
  if (!rows.length) return
  return supabase.from('meals').insert(rows)
}

export async function getOutsideReasons(): Promise<string[]> {
  return getMasters('outside_reason')
}

// ─── MEAL ITEMS (quick-add master list for Diet section) ──────
// These were previously in a separate lib/db.meal-items.ts file.
// They now live here so all imports resolve from '../../lib/db'.

export async function getMealItems(slot: MealSlot): Promise<string[]> {
  const { data } = await supabase
    .from('meal_items')
    .select('item_name')
    .eq('slot', slot)
    .order('sort_order')
  return (data ?? []).map((r) => r.item_name)
}

export async function getAllMealItems(): Promise<Record<MealSlot, string[]>> {
  const { data } = await supabase
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

export async function addMealItem(slot: MealSlot, itemName: string) {
  const { data: existing } = await supabase
    .from('meal_items')
    .select('sort_order')
    .eq('slot', slot)
    .order('sort_order', { ascending: false })
    .limit(1)
  const sort_order = existing && existing.length > 0 ? existing[0].sort_order + 1 : 1

  return supabase.from('meal_items').insert({ slot, item_name: itemName, sort_order })
}

export async function deleteMealItem(slot: MealSlot, itemName: string) {
  return supabase.from('meal_items').delete().eq('slot', slot).eq('item_name', itemName)
}

// ─── FULL CHECK-IN SAVE ───────────────────────────────────────

export async function saveCheckIn(payload: CheckInPayload) {
  const {
    log_date, weight_kg, sleep_hours, energy_level, brain_fog,
    watched_sunrise, watched_sunset, breathing, grounding_done,
    supplements_taken, reflection, notes,
    mental_states = [], exercise_types = [], recovery_activities = [], supplements = [],
  } = payload
 
  await supabase.from('daily_logs').upsert({
    log_date, weight_kg, sleep_hours, energy_level, brain_fog,
    watched_sunrise, watched_sunset, breathing, grounding_done,
    supplements_taken: supplements_taken ?? supplements.length > 0,
    reflection, notes,
  }, { onConflict: 'log_date' })
 
  await Promise.all([
    setMentalStates(log_date, mental_states),
    setExercise(log_date, exercise_types),
    setRecovery(log_date, recovery_activities),
    setSupplements(log_date, supplements),
  ])
}

// ─── PERIODS ──────────────────────────────────────────────────

export async function getAllPeriods(): Promise<Period[]> {
  const { data } = await supabase
    .from('periods').select('*').order('start_date', { ascending: false })
  return data ?? []
}

export async function getActivePeriod(date: string): Promise<Period | null> {
  const { data } = await supabase
    .from('periods').select('*')
    .lte('start_date', date)
    .or(`end_date.is.null,end_date.gte.${date}`)
    .maybeSingle()
  return data
}

export async function upsertPeriod(period: Partial<Period> & { start_date: string }) {
  return supabase.from('periods').upsert(period).select().single()
}

export async function deletePeriod(id: string) {
  return supabase.from('periods').delete().eq('id', id)
}

// ─── HEALTH EVENTS ────────────────────────────────────────────

export async function getAllHealthEvents(): Promise<HealthEvent[]> {
  const { data } = await supabase
    .from('health_events').select('*').order('start_date', { ascending: false })
  return data ?? []
}

export async function getHealthEvent(id: string): Promise<HealthEvent | null> {
  const { data } = await supabase
    .from('health_events').select('*').eq('id', id).maybeSingle()
  return data
}

export async function upsertHealthEvent(event: Partial<HealthEvent> & { event_type: string; start_date: string }) {
  return supabase.from('health_events').upsert(event).select().single()
}

export async function deleteHealthEvent(id: string) {
  return supabase.from('health_events').delete().eq('id', id)
}

export async function getEventPhotos(eventId: string): Promise<HealthEventPhoto[]> {
  const { data } = await supabase
    .from('health_event_photos').select('*').eq('health_event_id', eventId)
    .order('taken_at')
  return data ?? []
}

export async function uploadEventPhoto(
  eventId: string, file: File, takenAt: string, notes?: string
): Promise<HealthEventPhoto> {
  const fileName = `${eventId}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`
  const { data: s, error: se } = await supabase.storage
    .from('health-event-photos').upload(fileName, file, { contentType: file.type })
  if (se) throw se
  const { data: urlData } = supabase.storage.from('health-event-photos').getPublicUrl(s.path)
  const { data, error } = await supabase.from('health_event_photos')
    .insert({ health_event_id: eventId, photo_url: urlData.publicUrl, taken_at: takenAt, notes })
    .select().single()
  if (error) throw error
  return data
}

// ─── WEEKLY PHOTOS ────────────────────────────────────────────

export async function getWeeklyPhotos(weekOf: string): Promise<WeeklyPhoto[]> {
  const { data } = await supabase
    .from('weekly_photos').select('*').eq('week_of', weekOf)
  return data ?? []
}

export async function getAllWeeklyPhotoWeeks(): Promise<string[]> {
  const { data } = await supabase
    .from('weekly_photos').select('week_of').order('week_of', { ascending: false })
  return [...new Set((data ?? []).map((r) => r.week_of))]
}

export async function uploadWeeklyPhoto(
  weekOf: string, photoType: string, file: File, notes?: string
): Promise<WeeklyPhoto> {
  const fileName = `${weekOf}/${photoType}_${Date.now()}.${file.name.split('.').pop()}`
  const { data: s, error: se } = await supabase.storage
    .from('weekly-photos').upload(fileName, file, { contentType: file.type })
  if (se) throw se
  const { data: urlData } = supabase.storage.from('weekly-photos').getPublicUrl(s.path)
  const { data, error } = await supabase.from('weekly_photos')
    .upsert({ week_of: weekOf, photo_type: photoType, photo_url: urlData.publicUrl, notes },
      { onConflict: 'week_of,photo_type' })
    .select().single()
  if (error) throw error
  return data
}

// ─── BLOOD REPORTS ────────────────────────────────────────────

export async function getAllBloodReports(): Promise<BloodReport[]> {
  const { data } = await supabase
    .from('blood_reports').select('*').order('report_date', { ascending: false })
  return data ?? []
}

// ─── FULL HISTORY (for AI agents) ────────────────────────────

export async function getFullHistory(days = 90) {
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceISO = since.toISOString().split('T')[0]

  const [logs, mentalStates, meals, exercise, recovery, supplements, healthEvents, periods] =
    await Promise.all([
      supabase.from('daily_logs').select('*').gte('log_date', sinceISO).order('log_date'),
      supabase.from('daily_mental_states').select('*').gte('log_date', sinceISO),
      supabase.from('meals').select('*').gte('log_date', sinceISO),
      supabase.from('daily_exercise').select('*').gte('log_date', sinceISO),
      supabase.from('daily_recovery').select('*').gte('log_date', sinceISO),
      supabase.from('daily_supplements').select('*').gte('log_date', sinceISO),
      supabase.from('health_events').select('*').gte('start_date', sinceISO),
      supabase.from('periods').select('*').gte('start_date', sinceISO),
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