// app/history/page.tsx
'use client'

import { useEffect, useState } from 'react'
import {
  getRecentLogs, getMentalStates, getMeals, getExercise, getRecovery,
  getActivePeriod, getAllHealthEvents,
} from '../../lib/db'
import type { DailyLog, Meal, Period, HealthEvent } from '../../types'

interface DayRow {
  log: DailyLog
  mentalStates: string[]
  meals: Meal[]
  exercise: string[]
  recovery: string[]
  period: Period | null
  events: HealthEvent[]
}

export default function HistoryPage() {
  const [rows, setRows] = useState<DayRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [logs, allEvents] = await Promise.all([
        getRecentLogs(30),
        getAllHealthEvents(),
      ])

      const enriched = await Promise.all(
        logs.map(async (log) => {
          const [mentalStates, meals, exercise, recovery, period] = await Promise.all([
            getMentalStates(log.log_date),
            getMeals(log.log_date),
            getExercise(log.log_date),
            getRecovery(log.log_date),
            getActivePeriod(log.log_date),
          ])
          // Health events active on this date
          const events = allEvents.filter((e) =>
            e.start_date <= log.log_date && (!e.end_date || e.end_date >= log.log_date)
          )
          return { log, mentalStates, meals, exercise, recovery, period, events }
        })
      )
      setRows(enriched)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F8FC] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F8FC] pb-28">
      <div className="px-5 pt-10 pb-6">
        <p className="text-xs font-semibold tracking-widest text-blue-600 uppercase mb-1">
          History
        </p>
        <h1 className="text-3xl font-bold text-slate-900">Past 30 Days</h1>
      </div>

      {rows.length === 0 && (
        <div className="px-5 text-center text-slate-400 mt-16">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-medium">No check-ins yet.</p>
          <p className="text-sm mt-1">Start your first one from Check-in.</p>
        </div>
      )}

      <div className="px-4 space-y-3">
        {rows.map((row) => <DayCard key={row.log.id} row={row} />)}
      </div>
    </div>
  )
}

function DayCard({ row }: { row: DayRow }) {
  const { log, mentalStates, meals, exercise, recovery, period, events } = row
  const [expanded, setExpanded] = useState(false)

  const date = new Date(log.log_date + 'T00:00:00')

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button type="button" className="w-full flex items-center justify-between px-5 py-4"
        onClick={() => setExpanded((e) => !e)}>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center bg-blue-50 rounded-xl px-3 py-1.5 min-w-[44px]">
            <span className="text-[11px] text-blue-600 font-semibold uppercase">
              {date.toLocaleDateString('en-IN', { month: 'short' })}
            </span>
            <span className="text-xl font-bold text-slate-900 leading-none">{date.getDate()}</span>
          </div>

          <div>
            <p className="font-semibold text-[14px] text-slate-900">
              {date.toLocaleDateString('en-IN', { weekday: 'long' })}
            </p>
            <div className="flex flex-wrap gap-1 mt-1">
              {log.weight_kg != null && (
                <Pill text={`${log.weight_kg} kg`} />
              )}
              {log.sleep_hours != null && (
                <Pill text={`${log.sleep_hours} hrs`} />
              )}
              {period && <Pill text="Period" color="red" />}
              {events.length > 0 && <Pill text={`${events.length} event${events.length > 1 ? 's' : ''}`} color="orange" />}
            </div>
          </div>
        </div>

        <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-100 space-y-3 pt-4">
          {log.energy_level && (
            <DetailRow label="Energy" value={['', 'Drained', 'Low', 'Okay', 'Good', 'High'][log.energy_level]} />
          )}
          {log.brain_fog && <DetailRow label="Brain Fog" value="Yes" />}
          {mentalStates.length > 0 && <DetailRow label="Inner State" value={mentalStates.join(' · ')} />}
          {exercise.length > 0 && <DetailRow label="Movement" value={exercise.join(', ')} />}
          {recovery.length > 0 && <DetailRow label="Recovery" value={recovery.join(', ')} />}
          {meals.length > 0 && (
            <DetailRow
              label="Diet"
              value={meals.map((m) => `${m.slot}: ${m.description}`).join(' · ')}
            />
          )}
          {events.map((e) => (
            <DetailRow key={e.id} label="Event" value={`${e.event_type}${e.body_location ? ' · ' + e.body_location : ''}`} accent="orange" />
          ))}
          {log.reflection && <DetailRow label="Reflection" value={log.reflection} />}
        </div>
      )}
    </div>
  )
}

function Pill({ text, color = 'slate' }: { text: string; color?: 'slate' | 'red' | 'orange' }) {
  const colors = {
    slate: 'bg-slate-100 text-slate-500',
    red: 'bg-red-50 text-red-500',
    orange: 'bg-orange-50 text-orange-500',
  }
  return <span className={`text-[10px] px-2 py-0.5 rounded-full ${colors[color]}`}>{text}</span>
}

function DetailRow({ label, value, accent = 'slate' }: { label: string; value: string; accent?: 'slate' | 'orange' }) {
  const colors = { slate: 'text-slate-700', orange: 'text-orange-600' }
  return (
    <div className="flex gap-3">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide w-24 flex-shrink-0 pt-0.5">
        {label}
      </span>
      <span className={`text-sm ${colors[accent]}`}>{value}</span>
    </div>
  )
}