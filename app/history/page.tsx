// app/history/page.tsx
// Redesigned onto the shared Card system (see plan: Flarewise visual
// design system). Data fetching is unchanged — getRecentLogs(30) already
// gave us everything the new trend charts need (weight_kg, sleep_hours,
// log_date per day), this just also renders it as three small, single-
// series charts instead of only a flat day list. Adherence, weight, and
// sleep are three different units/scales, so — per this project's
// dataviz skill — each gets its own small chart rather than being
// combined onto one shared axis.
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Moon, Scale, Flame } from 'lucide-react'
import {
  getRecentLogs, getMentalStates, getMeals, getExercise, getRecovery,
  getActivePeriod, getAllHealthEvents,
} from '../../lib/db'
import { todayISO, addDays } from '../../lib/date'
import Card from '../../components/shared/Card'
import type { DailyLog, Meal, Period, HealthEvent } from '../../types'

const ADHERENCE_WINDOW_DAYS = 30

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
        getRecentLogs(ADHERENCE_WINDOW_DAYS),
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
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg pb-28">
      <div className="px-5 pt-10 pb-6">
        <p className="text-xs font-semibold tracking-widest text-primary uppercase mb-1">
          History
        </p>
        <h1 className="font-display text-3xl font-semibold text-ink">Past 30 Days</h1>
      </div>

      {rows.length === 0 && (
        <div className="px-5 text-center mt-16">
          <p className="font-display text-xl font-semibold text-ink mb-2">Your history starts here</p>
          <p className="text-sm text-ink-faint max-w-xs mx-auto leading-5">
            Nothing logged yet — once you check in for the first time, your patterns will start building up on this page.
          </p>
          <Link
            href="/today"
            className="inline-block mt-5 text-sm font-semibold text-primary bg-primary-soft rounded-full px-5 py-2.5"
          >
            Log your first check-in →
          </Link>
        </div>
      )}

      {rows.length > 0 && (
        <div className="px-4 space-y-3 mb-5">
          <AdherenceCard rows={rows} />
          <div className="grid grid-cols-2 gap-3">
            <TrendMini
              icon={Scale}
              label="Weight"
              unit="kg"
              rows={rows}
              field="weight_kg"
            />
            <TrendMini
              icon={Moon}
              label="Sleep"
              unit="hrs"
              rows={rows}
              field="sleep_hours"
            />
          </div>
        </div>
      )}

      <div className="px-4 space-y-3">
        {rows.map((row) => <DayCard key={row.log.id} row={row} />)}
      </div>
    </div>
  )
}

// ─── Adherence — a compact 30-day grid, filled square = logged that day.
// The habit-tracker visual language on purpose: showing accumulated
// consistency is what makes it feel worth continuing, not just a number.

function AdherenceCard({ rows }: { rows: DayRow[] }) {
  const loggedDates = new Set(rows.map((r) => r.log.log_date))
  const today = todayISO()
  const days = Array.from({ length: ADHERENCE_WINDOW_DAYS }, (_, i) => {
    const date = addDays(today, -(ADHERENCE_WINDOW_DAYS - 1 - i))
    return { date, logged: loggedDates.has(date) }
  })

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Flame size={16} className="text-primary" />
          <p className="font-display font-semibold text-ink">Adherence</p>
        </div>
        <p className="text-sm font-data text-ink">
          <span className="text-primary font-semibold">{rows.length}</span>
          <span className="text-ink-faint">/{ADHERENCE_WINDOW_DAYS} days</span>
        </p>
      </div>
      <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(15, minmax(0, 1fr))' }}>
        {days.map((d) => (
          <div
            key={d.date}
            title={d.date}
            className={`aspect-square rounded-[3px] ${d.logged ? 'bg-primary' : 'bg-surface-alt'}`}
          />
        ))}
      </div>
    </Card>
  )
}

// ─── Weight / sleep trend — single series each, own scale, so each is its
// own small chart rather than combined onto one axis.

function TrendMini({ icon: Icon, label, unit, rows, field }: {
  icon: typeof Scale
  label: string
  unit: string
  rows: DayRow[]
  field: 'weight_kg' | 'sleep_hours'
}) {
  const points = [...rows]
    .filter((r) => r.log[field] != null)
    .sort((a, b) => a.log.log_date.localeCompare(b.log.log_date))
    .map((r) => ({
      date: new Date(r.log.log_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: r.log[field] as number,
    }))

  return (
    <Card>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon size={14} className="text-primary" />
        <p className="text-xs font-semibold text-ink">{label}</p>
      </div>
      {points.length < 2 ? (
        <p className="text-xs text-ink-faint py-6 text-center">Not enough data yet</p>
      ) : (
        <div style={{ width: '100%', height: 90 }}>
          <ResponsiveContainer>
            <LineChart data={points} margin={{ top: 5, right: 5, left: -28, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--color-ink-faint)' }} axisLine={{ stroke: 'var(--color-line)' }} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: 'var(--color-ink-faint)' }} axisLine={false} tickLine={false} width={28} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: '1px solid var(--color-line)', fontSize: 12, background: 'var(--color-surface)' }}
                formatter={(value) => [`${value} ${unit}`, label]}
              />
              <Line type="monotone" dataKey="value" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 2.5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}

function DayCard({ row }: { row: DayRow }) {
  const { log, mentalStates, meals, exercise, recovery, period, events } = row
  const [expanded, setExpanded] = useState(false)

  const date = new Date(log.log_date + 'T00:00:00')

  return (
    <div className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">
      <button type="button" className="w-full flex items-center justify-between px-5 py-4"
        onClick={() => setExpanded((e) => !e)}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex flex-col items-center bg-primary-soft rounded-xl px-3 py-1.5 min-w-[44px] flex-shrink-0">
            <span className="text-[11px] text-primary font-semibold uppercase">
              {date.toLocaleDateString('en-IN', { month: 'short' })}
            </span>
            <span className="text-xl font-bold text-ink leading-none font-data">{date.getDate()}</span>
          </div>

          <div className="flex-1 min-w-0 text-left">
            <p className="font-semibold text-[14px] text-ink text-left">
              {date.toLocaleDateString('en-IN', { weekday: 'long' })}
            </p>
            <div className="flex flex-wrap gap-1 mt-1 justify-start">
              {log.weight_kg != null && (
                <Pill text={`${log.weight_kg} kg`} />
              )}
              {log.sleep_hours != null && (
                <Pill text={`${log.sleep_hours} hrs`} />
              )}
              {period && <Pill text="Period" color="flare" />}
              {events.length > 0 && <Pill text={`${events.length} event${events.length > 1 ? 's' : ''}`} color="caution" />}
            </div>
          </div>
        </div>

        <svg className={`w-4 h-4 text-ink-faint transition-transform duration-200 flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
          viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-line space-y-3 pt-4">
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
            <DetailRow key={e.id} label="Event" value={`${e.event_type}${e.body_location ? ' · ' + e.body_location : ''}`} accent="caution" />
          ))}

          <Link
            href={`/today?date=${log.log_date}`}
            className="inline-block text-xs font-semibold text-primary pt-1"
          >
            Edit this day →
          </Link>
        </div>
      )}
    </div>
  )
}

function Pill({ text, color = 'neutral' }: { text: string; color?: 'neutral' | 'flare' | 'caution' }) {
  const colors = {
    neutral: 'bg-surface-alt text-ink-soft',
    flare: 'bg-flare-soft text-flare',
    caution: 'bg-caution-soft text-caution',
  }
  return <span className={`text-[10px] px-2 py-0.5 rounded-full ${colors[color]}`}>{text}</span>
}

function DetailRow({ label, value, accent = 'ink' }: { label: string; value: string; accent?: 'ink' | 'caution' }) {
  const colors = { ink: 'text-ink', caution: 'text-caution' }
  return (
    <div className="flex gap-3 text-left">
      <span className="text-xs font-semibold text-ink-faint uppercase tracking-wide w-24 flex-shrink-0 pt-0.5 text-left">
        {label}
      </span>
      <span className={`text-sm text-left ${colors[accent]}`}>{value}</span>
    </div>
  )
}
