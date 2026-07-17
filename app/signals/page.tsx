// app/signals/page.tsx
// Signals — the patient-facing investigation surface. Answers "why is this
// happening," never "what does each specialist think": no specialist tabs,
// no internal terminology, just persistent hypotheses that gain or lose
// confidence as more data comes in. Polling pattern mirrors Insights'
// (see app/insights/page.tsx) but is implemented independently — Insights
// is not touched by this feature.
//
// Also holds the history/accuracy view inline (stats strip + filter chips
// + the full list, not just active) — deliberately not a separate route,
// so there's no navigation hop to see what Signals has found over time.
'use client'

import { useEffect, useRef, useState } from 'react'
import SignalCard from '../../components/signals/SignalCard'
import SignalHistoryRow from '../../components/signals/SignalHistoryRow'
import { getAllSignals } from '../../lib/agents/signalsStore'
import { Signal, SignalStatus } from '../../types/signals'

type Status = 'success' | 'generating' | 'error'
type FilterKey = 'all' | SignalStatus

const POLL_INTERVAL_MS = 5000

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'resolved', label: 'Confirmed' },
  { key: 'dismissed', label: 'Dismissed' },
  { key: 'needs_more_data', label: 'Needs more data' },
]

export default function SignalsPage() {
  const [allSignals, setAllSignals] = useState<Signal[]>([])
  const [status, setStatus] = useState<Status>('generating')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterKey>('all')

  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestId = useRef(0)

  async function load() {
    const id = ++requestId.current
    if (pollTimer.current) clearTimeout(pollTimer.current)

    try {
      const [res, all] = await Promise.all([
        fetch('/api/agents/signals'),
        getAllSignals(),
      ])
      if (id !== requestId.current) return
      if (!res.ok) throw new Error()
      const json = await res.json()

      const nextStatus: Status = json.status ?? 'success'
      setStatus(nextStatus)
      setAllSignals(all)

      if (nextStatus === 'generating') {
        pollTimer.current = setTimeout(() => load(), POLL_INTERVAL_MS)
      }
    } catch {
      if (id === requestId.current) setStatus('error')
    }
  }

  async function refresh() {
    setStatus('generating')
    try {
      await fetch('/api/agents/signals', { method: 'POST' })
    } catch {
      // even if the POST itself fails to reach the server, still poll —
      // the GET route has its own staleness/bootstrap fallback
    }
    load()
  }

  async function handleStatusChange(signalId: string, next: 'resolved' | 'dismissed' | 'active') {
    setBusyId(signalId)
    try {
      await fetch(`/api/agents/signals/${signalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      setAllSignals(await getAllSignals())
    } finally {
      setBusyId(null)
    }
  }

  useEffect(() => {
    load()

    // If a regeneration finished (e.g. triggered from another tab, or this
    // one was just left open) while this page was in the background, a
    // plain "poll only while generating" loop never notices — status had
    // already settled to 'success' before the update landed. Re-fetching
    // on tab focus/visibility catches that without spending a new Gemini
    // call (it's just a GET of whatever's already saved).
    function onVisible() {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [])

  const busy = status === 'generating'

  const total = allSignals.length
  const resolvedCount = allSignals.filter((s) => s.status === 'resolved').length
  const dismissedCount = allSignals.filter((s) => s.status === 'dismissed').length
  const activeCount = allSignals.filter((s) => s.status === 'active' || s.status === 'needs_more_data').length
  const reviewedCount = resolvedCount + dismissedCount

  const filtered = filter === 'all' ? allSignals : allSignals.filter((s) => s.status === filter)

  return (
    <div className="min-h-screen bg-[#F7F8FC] pb-28">
      <div className="px-5 pt-10 pb-5 flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold tracking-widest text-blue-600 uppercase mb-1">
            Health Journey
          </p>
          <h1 className="text-3xl font-bold text-slate-900">Signals</h1>
        </div>
        <button
          onClick={refresh}
          disabled={busy}
          className="text-sm text-blue-600 font-medium disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      <div className="px-4">
        {total > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-4">
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-xl font-bold text-slate-900">{total}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Found</p>
              </div>
              <div>
                <p className="text-xl font-bold text-emerald-600">{resolvedCount}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Confirmed</p>
              </div>
              <div>
                <p className="text-xl font-bold text-slate-400">{dismissedCount}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Dismissed</p>
              </div>
              <div>
                <p className="text-xl font-bold text-blue-600">{activeCount}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Investigating</p>
              </div>
            </div>
            {reviewedCount > 0 && (
              <p className="text-xs text-slate-500 text-center mt-3 pt-3 border-t border-slate-100">
                You&apos;ve confirmed {resolvedCount} of {reviewedCount} reviewed patterns ({Math.round((resolvedCount / reviewedCount) * 100)}%)
              </p>
            )}
          </div>
        )}

        {total > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all
                  ${filter === f.key ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {busy && total === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center">
            <p className="text-sm text-slate-500">Looking for patterns across your data…</p>
          </div>
        )}

        {status === 'error' && total === 0 && (
          <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-6 text-center">
            <p className="text-sm text-red-500 mb-3">Couldn&apos;t load your patterns.</p>
            <button onClick={load} className="text-sm text-blue-600 font-medium">Try again</button>
          </div>
        )}

        {!busy && status !== 'error' && total === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center">
            <p className="text-sm text-slate-500">Nothing stands out yet. Keep logging — patterns usually take a few weeks to emerge.</p>
          </div>
        )}

        {total > 0 && filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center">
            <p className="text-sm text-slate-500">Nothing in this filter yet.</p>
          </div>
        )}

        <div className="space-y-3">
          {filtered.map((signal) =>
            signal.status === 'active' || signal.status === 'needs_more_data' ? (
              <SignalCard
                key={signal.id}
                signal={signal}
                onStatusChange={handleStatusChange}
                busy={busyId === signal.id}
              />
            ) : (
              <SignalHistoryRow
                key={signal.id}
                signal={signal}
                onReopen={(id) => handleStatusChange(id, 'active')}
                busy={busyId === signal.id}
              />
            )
          )}
        </div>

        {busy && total > 0 && (
          <p className="text-xs text-slate-400 text-center mt-3">Checking for updates…</p>
        )}

        <p className="text-xs text-slate-400 text-center mt-6 leading-4">
          Signals are AI-generated hypotheses based on your own logged data. They are not medical advice — always discuss anything concerning with a doctor.
        </p>
      </div>
    </div>
  )
}
