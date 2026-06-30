// app/today/page.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
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
import ReflectionSection  from '../../components/today/ReflectionSection'
import type { DietState } from '../../types'

const TODAY = todayISO()
const TOTAL_SECTIONS = 7

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

export default function TodayPage() {
  const [weight, setWeight]               = useState<number | ''>('')
  const [sleep, setSleep]                 = useState<number | ''>('')
  const [energy, setEnergy]               = useState<number | null>(null)
  const [brainFog, setBrainFog]           = useState(false)
  const [watchedSunrise, setWatchedSunrise] = useState(false)
  const [watchedSunset, setWatchedSunset] = useState(false)
  const [mentalStates, setMentalStates]   = useState<string[]>([])
  const [exerciseTypes, setExerciseTypes] = useState<string[]>([])
  const [recovery, setRecovery]           = useState<string[]>([])
  const [supplements, setSupplements]     = useState<string[]>([])
  const [diet, setDiet]                   = useState<DietState>(BLANK_DIET)
  const [reflection, setReflection]       = useState('')

  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [weeklyPhotoCount, setWeeklyPhotoCount] = useState(0)

  useEffect(() => {
    async function load() {
      const [log, states, ex, rec, sups, meals, weeklyPhotos] = await Promise.all([
        getLog(TODAY), getMentalStates(TODAY), getExercise(TODAY),
        getRecovery(TODAY), getSupplements(TODAY), getMeals(TODAY),
        getWeeklyPhotos(mondayOfWeek()),
      ])
      if (log) {
        if (log.weight_kg != null)   setWeight(log.weight_kg)
        if (log.sleep_hours != null) setSleep(log.sleep_hours)
        if (log.energy_level != null) setEnergy(log.energy_level)
        setBrainFog(log.brain_fog)
        setWatchedSunrise(log.watched_sunrise)
        setWatchedSunset(log.watched_sunset)
        if (log.reflection) setReflection(log.reflection)
      }
      setMentalStates(states)
      setExerciseTypes(ex)
      setRecovery(rec)
      setSupplements(sups)
      setDiet(mealsToDietState(meals))
      setWeeklyPhotoCount(weeklyPhotos.length)
      setLoading(false)
    }
    load()
  }, [])

  const save = useCallback(async () => {
    setSaving(true)
    try {
      await Promise.all([
        saveCheckIn({
          log_date: TODAY,
          weight_kg: weight === '' ? null : weight,
          sleep_hours: sleep === '' ? null : sleep,
          energy_level: energy,
          brain_fog: brainFog,
          watched_sunrise: watchedSunrise,
          watched_sunset: watchedSunset,
          reflection,
          mental_states: mentalStates,
          exercise_types: exerciseTypes,
          recovery_activities: recovery,
          supplements,
          supplements_taken: supplements.length > 0,
        }),
        setMeals(TODAY, diet),
      ])
      const msg = SAVE_MICROCOPY[Math.floor(Math.random() * SAVE_MICROCOPY.length)]
      setSavedMsg(msg)
      setTimeout(() => setSavedMsg(''), 3000)
    } finally {
      setSaving(false)
    }
  }, [weight, sleep, energy, brainFog, watchedSunrise, watchedSunset,
      reflection, mentalStates, exerciseTypes, recovery, supplements, diet])

  const dietFilled = Object.values(diet).some((s) => s.description.trim())
  const completedSections = [
    (weight !== '' && Number(weight) > 0) || (sleep !== '' && Number(sleep) > 0) || energy !== null,
    mentalStates.length > 0,
    exerciseTypes.length > 0,
    recovery.length > 0,
    supplements.length > 0,
    dietFilled,
    reflection.trim().length > 0,
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
          Daily Check-in
        </p>
        <h1 className="text-3xl font-bold text-slate-900">{greeting} 👋</h1>
        <p className="text-slate-400 text-sm mt-1">{formatDisplay(TODAY)}</p>
      </div>

      {/* Saved toast */}
      {savedMsg && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-slate-900 text-white text-sm font-medium px-5 py-2.5
            rounded-full shadow-xl">
            {savedMsg}
          </div>
        </div>
      )}

      <div className="px-4 space-y-3">
        <ProgressCard completed={completedSections} total={TOTAL_SECTIONS} />

        {/* Gentle weekly photo nudge — only shows if this week's photos aren't all done */}
        {weeklyPhotoCount < 4 && (
          <Link
            href="/health-events"
            className="block bg-purple-50 border border-purple-100 rounded-2xl px-4 py-3.5
              flex items-center gap-3 active:scale-[0.98] transition-transform"
          >
            <span className="text-xl flex-shrink-0">📸</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-purple-800">
                Weekly photos {weeklyPhotoCount > 0 ? `· ${weeklyPhotoCount}/4 done` : ''}
              </p>
              <p className="text-xs text-purple-500 mt-0.5">
                Tongue, skin, and any flare — takes a minute
              </p>
            </div>
            <svg className="w-4 h-4 text-purple-300 flex-shrink-0" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        )}

        <InnerStateSection selected={mentalStates} onChange={setMentalStates} />

        <BodySection
          weight={weight} sleep={sleep} energy={energy}
          brainFog={brainFog} watchedSunrise={watchedSunrise} watchedSunset={watchedSunset}
          onWeightChange={setWeight} onSleepChange={setSleep} onEnergyChange={setEnergy}
          onBrainFogChange={setBrainFog} onSunriseChange={setWatchedSunrise} onSunsetChange={setWatchedSunset}
        />
        <MovementSection  selected={exerciseTypes} onChange={setExerciseTypes} />
        <RecoverySection  selected={recovery}      onChange={setRecovery} />
        <SupplementsSection selected={supplements} onChange={setSupplements} />
        <DietSection diet={diet} onChange={setDiet} />
        <ReflectionSection reflection={reflection} onChange={setReflection} />

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
              <span className="w-4 h-4 border-2 border-white border-t-transparent
                rounded-full animate-spin" />
              <span>Saving…</span>
            </>
          ) : (
            <span>Save Check-in</span>
          )}
        </button>
      </div>
    </div>
  )
}