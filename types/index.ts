// types/index.ts — v3
export type BreathingType = 'deep' | 'shallow'
export type FlareStatus = 'new' | 'existing'
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snacks'
export type MealLocation = 'home' | 'outside'
export type WeeklyPhotoType = 'acne' | 'tongue' | 'flare' | 'body'

// ─── DAILY LOG (expanded) ─────────────────────────────────────
export interface DailyLog {
  id: string
  log_date: string
  weight_kg: number | null
  sleep_hours: number | null
  energy_level: number | null       // 1–5
  brain_fog: boolean
  watched_sunrise: boolean
  watched_sunset: boolean
  breathing: BreathingType | null
  grounding_done: boolean           // kept for backward compat
  exercised: boolean
  creative_done: boolean
  supplements_taken: boolean
  reflection: string | null         // one-line reflection
  notes: string | null
  created_at: string
  updated_at: string
}

// ─── MEAL ─────────────────────────────────────────────────────
export interface Meal {
  id: string
  log_date: string
  slot: MealSlot
  location: MealLocation
  outside_reason: string | null
  description: string | null
  created_at: string
  updated_at: string
}

export interface MealSlotState {
  location: MealLocation
  outside_reason: string
  description: string
}

export type DietState = Record<MealSlot, MealSlotState>

// ─── HEALTH EVENTS ────────────────────────────────────────────
export interface HealthEvent {
  id: string
  event_type: string
  start_date: string
  end_date: string | null
  severity: number | null           // 1–5
  status: FlareStatus
  body_location: string | null
  notes: string | null
  created_at: string
}

export interface HealthEventPhoto {
  id: string
  health_event_id: string
  photo_url: string
  taken_at: string
  notes: string | null
  created_at: string
}

// ─── WEEKLY PHOTOS ────────────────────────────────────────────
export interface WeeklyPhoto {
  id: string
  week_of: string
  photo_type: WeeklyPhotoType
  photo_url: string
  notes: string | null
  created_at: string
}

// ─── PERIOD ───────────────────────────────────────────────────
export interface Period {
  id: string
  start_date: string
  end_date: string | null
  created_at: string
}

// ─── BLOOD REPORT ─────────────────────────────────────────────
export interface BloodReport {
  id: string
  report_date: string
  file_url: string | null
  markers: Record<string, { value: number; unit: string; reference?: string }> | null
  notes: string | null
  created_at: string
}

// ─── MASTER ───────────────────────────────────────────────────
export interface Master {
  id: string
  category: MasterCategory
  value: string
  is_default: boolean
  sort_order: number
}

export type MasterCategory =
  | 'mental_state'
  | 'food_category'
  | 'body_location'
  | 'exercise_type'
  | 'supplement'
  | 'creative_activity'
  | 'outside_reason'
  | 'recovery_activity'
  | 'health_event_type'

// ─── CHECK-IN PAYLOAD ─────────────────────────────────────────
export interface CheckInPayload {
  log_date: string
  weight_kg?: number | null
  sleep_hours?: number | null
  energy_level?: number | null
  brain_fog?: boolean
  watched_sunrise?: boolean
  watched_sunset?: boolean
  breathing?: BreathingType | null
  supplements_taken?: boolean
  reflection?: string | null
  notes?: string | null
  mental_states?: string[]
  exercise_types?: string[]
  recovery_activities?: string[]
  supplements?: string[]
  meals?: {
    slot: MealSlot
    location: MealLocation
    outside_reason?: string | null
    description?: string | null
  }[]
}

export interface InsightResponse {
  weekly: string
  monthly: string
  patterns: string[]
  recommendations: string[]
}