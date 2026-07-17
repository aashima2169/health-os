// app/today/page.tsx
// FIXES IN THIS VERSION:
// 1. Breathing (deep/shallow) + Grounding wired back into BodySection
// 2. Weekly photo banner now only shows once per week (tracked via localStorage
//    of "last dismissed/seen week"), not every single day
// 3. saveCheckIn already overwrites same-day data correctly (see lib/db.ts —
//    upsert on log_date + delete-then-insert on child tables). No changes needed
//    there, but confirmed working as intended for multiple check-ins per day.
// 4. NEW: dedicated tongue-photo reminder, separate from the general weekly
//    photo banner above. Shows ONLY on Saturdays (habit-forming weekly
//    cadence), and only if this week's tongue photo hasn't been uploaded
//    yet. Dismissible per-week, tracked separately from the general banner
//    so dismissing one doesn't dismiss the other.
'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { todayISO, formatDisplay, mondayOfWeek } from '../../lib/date'
import {
  getLog, getMentalStates, getExercise,
  getRecovery, getSupplements, getMeals, mealsToDietState, setMeals, saveCheckIn,
  getWeeklyPhotos,
} from '../../lib/db'
import ProgressCard       from '../../components/today/ProgressCard'
import BodySection        from '../../components/today/BodySection'
import InnerStateSection  from '../../components/today/InnerStateSection'
import MovementSection    from '../../components/today/MovementSection'
import RecoverySection    from '../../components/today/RecoverySection'
import SupplementsSection from '../../components/today/SupplementsSection'
import DietSection        from '../../components/today/DietSection'
import type { DietState, BreathingType } from '../../types'

const TOTAL_SECTIONS = 6
const PHOTO_REMINDER_KEY = 'healthos_weekly_photo_reminder_week'
const TONGUE_REMINDER_KEY = 'healthos_tongue_photo_reminder_week'

const BLANK_DIET: DietState = {
  breakfast: { location: 'home', outside_reason: '', description: '' },
  lunch:     { location: 'home', outside_reason: '', description: '' },
  dinner:    { location: 'home', outside_reason: '', description: '' },
  snacks:    { location: 'home', outside_reason: '', description: '' },
}

const SAVE_MICROCOPY = [
  'Thank you for checking in.',
  "You've got this.",
  'One day at a time.',
  "You're doing great.",
]

function TodayPageInner() {
  const searchParams = useSearchParams()
  const date = searchParams.get('date') ?? todayISO()
  const isToday = date === todayISO()

  const [weight, setWeight]               = useState<number | ''>('')
  const [sleep, setSleep]                 = useState<number | ''>('')
  const [energy, setEnergy]               = useState<number | null>(null)
  const [brainFog, setBrainFog]           = useState(false)
  const [watchedSunrise, setWatchedSunrise] = useState(false)
  const [watchedSunset, setWatchedSunset] = useState(false)
  const [breathing, setBreathing]         = useState<BreathingType | null>(null)
  const [mentalStates, setMentalStates]   = useState<string[]>([])
  const [exerciseTypes, setExerciseTypes] = useState<string[]>([])
  const [recovery, setRecovery]           = useState<string[]>([])
  const [supplements, setSupplements]     = useState<string[]>([])
  const [diet, setDiet]                   = useState<DietState>(BLANK_DIET)

  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  // General weekly photo reminder — only shows once per calendar week
  const [showPhotoReminder, setShowPhotoReminder] = useState(false)
  const [weeklyPhotoCount, setWeeklyPhotoCount] = useState(0)

  // Tongue-specific reminder — Saturdays only, tracked independently of
  // the general banner above so dismissing one doesn't dismiss the other.
  const [showTongueReminder, setShowTongueReminder] = useState(false)

  useEffect(() => {
    async function load() {
      const currentWeek = mondayOfWeek()

      const [log, states, ex, rec, sups, meals, weeklyPhotos] = await Promise.all([
        getLog(date), getMentalStates(date), getExercise(date),
        getRecovery(date), getSupplements(date), getMeals(date),
        getWeeklyPhotos(currentWeek),
      ])

      if (log) {
        if (log.weight_kg != null)   setWeight(log.weight_kg)
        if (log.sleep_hours != null) setSleep(log.sleep_hours)
        if (log.energy_level != null) setEnergy(log.energy_level)
        setBrainFog(log.brain_fog)
        setWatchedSunrise(log.watched_sunrise)
        setWatchedSunset(log.watched_sunset)
        if (log.breathing) setBreathing(log.breathing as BreathingType)
      }
      setMentalStates(states)
      setExerciseTypes(ex)
      setRecovery(rec)
      setSupplements(sups)
      setDiet(mealsToDietState(meals))
      setWeeklyPhotoCount(weeklyPhotos.length)

      // These are nudges about the current week, not about whichever day
      // is being edited — don't show them while editing a past day.
      if (isToday) {
        // General reminder: only if this week's photos aren't all done, and
        // we haven't already shown/dismissed it for this week.
        const lastShownWeek = localStorage.getItem(PHOTO_REMINDER_KEY)
        if (weeklyPhotos.length < 4 && lastShownWeek !== currentWeek) {
          setShowPhotoReminder(true)
        }

        // Tongue reminder: Saturdays only, and only if this week's tongue
        // photo hasn't been uploaded yet, and not already dismissed this week.
        const isSaturday = new Date().getDay() === 6
        const tongueDoneThisWeek = weeklyPhotos.some((p) => p.photo_type === 'tongue')
        const lastShownTongueWeek = localStorage.getItem(TONGUE_REMINDER_KEY)
        if (isSaturday && !tongueDoneThisWeek && lastShownTongueWeek !== currentWeek) {
          setShowTongueReminder(true)
        }
      }

      setLoading(false)
    }
    load()
  }, [date, isToday])

  const dismissPhotoReminder = () => {
    localStorage.setItem(PHOTO_REMINDER_KEY, mondayOfWeek())
    setShowPhotoReminder(false)
  }

  const dismissTongueReminder = () => {
    localStorage.setItem(TONGUE_REMINDER_KEY, mondayOfWeek())
    setShowTongueReminder(false)
  }

  const save = useCallback(async () => {
    setSaving(true)
    try {
      await Promise.all([
        saveCheckIn({
          log_date: date,
          weight_kg: weight === '' ? null : weight,
          sleep_hours: sleep === '' ? null : sleep,
          energy_level: energy,
          brain_fog: brainFog,
          watched_sunrise: watchedSunrise,
          watched_sunset: watchedSunset,
          breathing,
          mental_states: mentalStates,
          exercise_types: exerciseTypes,
          recovery_activities: recovery,
          supplements,
          supplements_taken: supplements.length > 0,
        }),
        setMeals(date, diet),
      ])
      const msg = SAVE_MICROCOPY[Math.floor(Math.random() * SAVE_MICROCOPY.length)]
      setSavedMsg(msg)
      setTimeout(() => setSavedMsg(''), 3000)
    } finally {
      setSaving(false)
    }
  }, [date, weight, sleep, energy, brainFog, watchedSunrise, watchedSunset, breathing,
      mentalStates, exerciseTypes, recovery, supplements, diet])

  const dietFilled = Object.values(diet).some((s) => s.description.trim())
  const completedSections = [
    (weight !== '' && Number(weight) > 0) || (sleep !== '' && Number(sleep) > 0) || energy !== null,
    mentalStates.length > 0,
    exerciseTypes.length > 0,
    recovery.length > 0,
    supplements.length > 0,
    dietFilled,
  ].filter(Boolean).length

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'

  if (loading) return (
    <div className="min-h-screen bg-[#F7F8FC] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F7F8FC] pb-32">

      {/* Header */}
      <div className="px-5 pt-10 pb-5">
        <p className="text-xs font-semibold tracking-widest text-blue-600 uppercase mb-1">
          {isToday ? 'Daily Check-in' : 'Editing a Past Day'}
        </p>
        <h1 className="text-3xl font-bold text-slate-900">
          {isToday ? `${greeting} 👋` : 'Editing'}
        </h1>
        <p className="text-slate-400 text-sm mt-1">{formatDisplay(date)}</p>
      </div>

      {/* Saved toast */}
      {savedMsg && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-slate-900 text-white text-sm font-medium px-5 py-2.5 rounded-full shadow-xl">
            {savedMsg}
          </div>
        </div>
      )}

      <div className="px-4 space-y-3">
        <ProgressCard completed={completedSections} total={TOTAL_SECTIONS} />

        {/* Tongue photo reminder — Saturdays only, builds a weekly habit */}
        {showTongueReminder && (
          <div className="bg-rose-50 border border-rose-100 rounded-2xl px-4 py-3.5 flex items-center gap-3">
            <Link href="/health-events" className="flex items-center gap-3 flex-1">
              <span className="text-xl flex-shrink-0">👅</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-rose-800">
                  Saturday tongue photo
                </p>
                <p className="text-xs text-rose-500 mt-0.5">
                  Same day each week helps the TCM reading stay comparable
                </p>
              </div>
            </Link>
            <button
              onClick={dismissTongueReminder}
              className="text-rose-300 hover:text-rose-500 flex-shrink-0 p-1"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}

        {/* Weekly photo reminder — appears once a week, dismissible */}
        {showPhotoReminder && (
          <div className="bg-purple-50 border border-purple-100 rounded-2xl px-4 py-3.5 flex items-center gap-3">
            <Link href="/health-events" className="flex items-center gap-3 flex-1">
              <span className="text-xl flex-shrink-0">📸</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-purple-800">
                  Weekly photos {weeklyPhotoCount > 0 ? `· ${weeklyPhotoCount}/4 done` : ''}
                </p>
                <p className="text-xs text-purple-500 mt-0.5">
                  Tongue, skin, and any flare — takes a minute
                </p>
              </div>
            </Link>
            <button
              onClick={dismissPhotoReminder}
              className="text-purple-300 hover:text-purple-500 flex-shrink-0 p-1"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}

        <InnerStateSection selected={mentalStates} onChange={setMentalStates} />

        <BodySection
          weight={weight} sleep={sleep} energy={energy}
          brainFog={brainFog} watchedSunrise={watchedSunrise} watchedSunset={watchedSunset}
          breathing={breathing}
          onWeightChange={setWeight} onSleepChange={setSleep} onEnergyChange={setEnergy}
          onBrainFogChange={setBrainFog} onSunriseChange={setWatchedSunrise} onSunsetChange={setWatchedSunset}
          onBreathingChange={setBreathing}
        />
        <MovementSection  selected={exerciseTypes} onChange={setExerciseTypes} />
        <RecoverySection  selected={recovery}      onChange={setRecovery} />
        <SupplementsSection selected={supplements} onChange={setSupplements} />
        <DietSection diet={diet} onChange={setDiet} />

        {/* Save */}
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="w-full h-14 rounded-2xl bg-blue-600 text-white font-semibold
            text-[15px] shadow-md shadow-blue-200 active:scale-[0.98]
            transition-transform duration-100 disabled:opacity-60 mt-2
            flex items-center justify-center gap-1.5"
        >
          {saving ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Saving…</span>
            </>
          ) : (
            <span>Save Check-in</span>
          )}
        </button>

        <p className="text-center text-[11px] text-slate-300 pt-1">
          {isToday
            ? "You can check in multiple times a day — each save updates today's entry."
            : `Each save updates the entry for ${formatDisplay(date)}.`}
        </p>
      </div>
    </div>
  )
}

export default function TodayPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F7F8FC] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <TodayPageInner />
    </Suspense>
  )
}