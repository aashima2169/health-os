// app/periods/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { getAllPeriods, upsertPeriod, deletePeriod, getActivePeriod } from '../../lib/db'
import { todayISO, cycleDayOf, daysBetween, addDays } from '../../lib/date'
import type { Period } from '../../types'

export default function PeriodsPage() {
  const [periods, setPeriods]       = useState<Period[]>([])
  const [active, setActive]         = useState<Period | null>(null)
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [startDate, setStartDate]   = useState('')
  const [endDate, setEndDate]       = useState('')
  const [saving, setSaving]         = useState(false)

  const today = todayISO()

  useEffect(() => {
    Promise.all([getAllPeriods(), getActivePeriod(today)]).then(([all, act]) => {
      setPeriods(all)
      setActive(act)
      setLoading(false)
    })
  }, [])

  const handleSave = async () => {
    if (!startDate) return
    setSaving(true)
    try {
      const { data } = await upsertPeriod({
        start_date: startDate, end_date: endDate || null,
      }) as any
      setPeriods((prev) => [data, ...prev.filter((p) => p.id !== data.id)])
      if (!endDate) setActive(data)
      setShowForm(false)
      setStartDate(''); setEndDate('')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this period record?')) return
    await deletePeriod(id)
    setPeriods((prev) => prev.filter((p) => p.id !== id))
    if (active?.id === id) setActive(null)
  }

  // Cycle analysis
  const completed = periods.filter((p) => p.end_date)
  const cycleLengths = completed.slice(0, -1).map((p, i) => {
    const next = completed[i + 1]
    return next ? daysBetween(next.start_date, p.start_date) : null
  }).filter(Boolean) as number[]

  const avgCycleLength = cycleLengths.length
    ? Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length)
    : null

  const lastPeriodStart = periods[0]?.start_date
  const expectedNext = lastPeriodStart && avgCycleLength
    ? addDays(lastPeriodStart, avgCycleLength)
    : null

  return (
    <div className="min-h-screen bg-[#F7F8FC] pb-28">
      <div className="px-5 pt-10 pb-6 flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold tracking-widest text-blue-600 uppercase mb-1">
            Cycle
          </p>
          <h1 className="text-3xl font-bold text-slate-900">Period Tracking</h1>
        </div>
        <button onClick={() => setShowForm((s) => !s)}
          className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center
            shadow-md shadow-blue-200">
          <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="none">
            <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="px-4 space-y-3">

        {/* Active period banner */}
        {active && (
          <div className="bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-100
            rounded-2xl px-5 py-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🌸</span>
              <p className="font-semibold text-rose-800">Period in progress</p>
            </div>
            <p className="text-sm text-rose-600">
              Day {cycleDayOf(active.start_date)} · Started{' '}
              {new Date(active.start_date + 'T00:00:00').toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short',
              })}
            </p>
            <button
              onClick={async () => {
                await upsertPeriod({ ...active, end_date: today })
                const updated = { ...active, end_date: today }
                setPeriods((prev) => prev.map((p) => p.id === active.id ? updated : p))
                setActive(null)
              }}
              className="mt-3 text-xs font-semibold text-rose-600 border border-rose-200
                px-3 py-1.5 rounded-full bg-white"
            >
              Mark as ended today
            </button>
          </div>
        )}

        {/* Cycle summary */}
        {avgCycleLength && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4">
            <p className="font-semibold text-slate-900 mb-3">Cycle Summary</p>
            <div className="grid grid-cols-3 gap-3">
              <StatBox label="Avg cycle" value={`${avgCycleLength}d`} />
              <StatBox label="Periods logged" value={String(periods.length)} />
              <StatBox
                label="Next expected"
                value={expectedNext
                  ? new Date(expectedNext + 'T00:00:00').toLocaleDateString('en-IN',
                    { day: 'numeric', month: 'short' })
                  : '—'
                }
              />
            </div>
          </div>
        )}

        {/* Add period form */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-blue-100 shadow-sm px-5 py-5">
            <p className="font-semibold text-slate-900 mb-4">Log Period</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1.5">Start date *</p>
                <input type="date" value={startDate} max={today}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-slate-50
                    text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1.5">End date</p>
                <input type="date" value={endDate} min={startDate} max={today}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-slate-50
                    text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Leave end date empty if your period is still ongoing.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)}
                className="flex-1 h-12 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving || !startDate}
                className="flex-1 h-12 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {/* History */}
        {!loading && periods.length === 0 && !showForm && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🌸</p>
            <p className="font-medium text-slate-700">No periods logged yet</p>
            <p className="text-sm text-slate-400 mt-1">Tap + to log your first period.</p>
          </div>
        )}

        {periods.map((p) => {
          const start = new Date(p.start_date + 'T00:00:00')
          const end = p.end_date ? new Date(p.end_date + 'T00:00:00') : null
          const duration = end ? daysBetween(p.start_date, p.end_date!) + 1 : null
          return (
            <div key={p.id} className="bg-white rounded-2xl border border-slate-100
              shadow-sm px-5 py-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900 text-[15px]">
                  {start.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {end
                    ? `Ended ${end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · ${duration} days`
                    : 'Ongoing'
                  }
                </p>
              </div>
              <button onClick={() => handleDelete(p.id)} className="text-xs text-red-400 font-medium">
                Delete
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-xl px-3 py-3 text-center">
      <p className="text-lg font-bold text-slate-900">{value}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{label}</p>
    </div>
  )
}