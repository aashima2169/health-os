// lib/db.meals.ts
// Add these functions to your existing lib/db.ts
// (or import from here if you prefer to split the file)

import { supabase } from './supabase'
import type { Meal, MealSlot, MealLocation, DietState } from '../types'

// ─── GET meals for a date ─────────────────────────────────────

export async function getMeals(date: string): Promise<Meal[]> {
  const { data } = await supabase
    .from('meals')
    .select('*')
    .eq('log_date', date)
    .order('slot')
  return data ?? []
}

// Convert DB rows → DietState for the form
export function mealsToDietState(meals: Meal[]): DietState {
  const blank = (): { location: MealLocation; outside_reason: string; description: string } => ({
    location: 'home',
    outside_reason: '',
    description: '',
  })

  const state: DietState = {
    breakfast: blank(),
    lunch: blank(),
    dinner: blank(),
    snacks: blank(),
  }

  for (const meal of meals) {
    state[meal.slot] = {
      location: meal.location,
      outside_reason: meal.outside_reason ?? '',
      description: meal.description ?? '',
    }
  }

  return state
}

// ─── UPSERT meals for a date ──────────────────────────────────

export async function setMeals(date: string, diet: DietState) {
  const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snacks']

  // Only upsert slots that have content
  const rows = SLOTS.filter(
    (slot) => diet[slot].description.trim() !== ''
  ).map((slot) => ({
    log_date: date,
    slot,
    location: diet[slot].location,
    outside_reason:
      diet[slot].location === 'outside' && diet[slot].outside_reason
        ? diet[slot].outside_reason
        : null,
    description: diet[slot].description.trim() || null,
  }))

  // Delete existing, then insert fresh (simpler than upsert with unique constraint)
  await supabase.from('meals').delete().eq('log_date', date)
  if (rows.length === 0) return
  return supabase.from('meals').insert(rows)
}

// ─── GET meals for a date range (for AI context) ─────────────

export async function getMealsInRange(from: string, to: string): Promise<Meal[]> {
  const { data } = await supabase
    .from('meals')
    .select('*')
    .gte('log_date', from)
    .lte('log_date', to)
    .order('log_date')
  return data ?? []
}

// ─── GET outside_reason master list ──────────────────────────

export async function getOutsideReasons(): Promise<string[]> {
  const { data } = await supabase
    .from('masters')
    .select('value')
    .eq('category', 'outside_reason')
    .order('sort_order')
  return (data ?? []).map((r) => r.value)
}