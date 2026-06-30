// app/insights/page.tsx
// Replace your existing app/insights/page.tsx with this file.
'use client'

import { useEffect, useState } from 'react'
import type { InsightResponse } from '../../types'

interface MarkerChange {
  marker: string
  from?: number
  to?: number
  value?: number
  unit: string
  note: string
}

interface BloodComparison {
  summary: string | null
  improved: MarkerChange[]
  worsened: MarkerChange[]
  unchanged: MarkerChange[]
  watch: string[]
  previousDate?: string
  latestDate?: string
  message?: string
}

export default function InsightsPage() {
  const [healthData, setHealthData] = useState<InsightResponse | null>(null)
  const [bloodData, setBloodData] = useState<BloodComparison | null>(null)
  const [loadingHealth, setLoadingHealth] = useState(true)
  const [loadingBlood, setLoadingBlood] = useState(true)
  const [errorHealth, setErrorHealth] = useState(false)
  const [errorBlood, setErrorBlood] = useState(false)

  async function loadHealth() {
    setLoadingHealth(true)
    setErrorHealth(false)
    try {
      const res = await fetch('/api/insights')
      if (!res.ok) throw new Error()
      setHealthData(await res.json())
    } catch {
      setErrorHealth(true)
    } finally {
      setLoadingHealth(false)
    }
  }

  async function loadBlood() {
    setLoadingBlood(true)
    setErrorBlood(false)
    try {
      const res = await fetch('/api/blood-reports/compare')
      if (!res.ok) throw new Error()
      setBloodData(await res.json())
    } catch {
      setErrorBlood(true)
    } finally {
      setLoadingBlood(false)
    }
  }

  useEffect(() => {
    loadHealth()
    loadBlood()
  }, [])

  const formatDate = (iso?: string) =>
    iso
      ? new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : ''

  return (
    <div className="min-h-screen bg-[#F4F6FB] pb-28">
      <div className="px-5 pt-10 pb-6 flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold tracking-widest text-blue-600 uppercase mb-1">
            AI Insights
          </p>
          <h1 className="text-3xl font-bold text-slate-900">Your Patterns</h1>
        </div>
        <button
          type="button"
          onClick={() => { loadHealth(); loadBlood() }}
          disabled={loadingHealth || loadingBlood}
          className="text-sm text-blue-600 font-medium disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      <div className="px-4 space-y-3">

        {/* ── DAILY HEALTH INSIGHTS ─────────────────────────── */}
        <SectionHeader label="Daily Health" />

        {loadingHealth && <LoadingCard message="Analysing your check-ins…" />}
        {errorHealth && (
          <ErrorCard message="Couldn't load health insights." onRetry={loadHealth} />
        )}
        {!loadingHealth && !errorHealth && healthData && (
          <>
            <InsightCard label="This Week" icon="📅" content={healthData.weekly} accent="blue" />
            <InsightCard label="This Month" icon="📆" content={healthData.monthly} accent="indigo" />

            {healthData.patterns.length > 0 && (
              <ListCard
                icon="🔍"
                title="Patterns Detected"
                items={healthData.patterns}
                numbered
              />
            )}
            {healthData.recommendations.length > 0 && (
              <ListCard
                icon="💡"
                title="Recommendations"
                items={healthData.recommendations}
                arrow
              />
            )}
          </>
        )}

        {/* ── BLOOD REPORT COMPARISON ───────────────────────── */}
        <SectionHeader label="Blood Reports" />

        {loadingBlood && <LoadingCard message="Comparing your reports…" />}
        {errorBlood && (
          <ErrorCard message="Couldn't load blood comparison." onRetry={loadBlood} />
        )}

        {!loadingBlood && !errorBlood && bloodData && (
          <>
            {/* No reports or only one */}
            {bloodData.message && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-6 text-center">
                <p className="text-4xl mb-2">🩸</p>
                <p className="text-sm text-slate-500">{bloodData.message}</p>
              </div>
            )}

            {/* Has comparison */}
            {bloodData.summary && (
              <>
                {/* Date range badge */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4">
                  <p className="text-xs text-slate-400 mb-1">Comparing</p>
                  <p className="font-semibold text-slate-900 text-[15px]">
                    {formatDate(bloodData.previousDate)} → {formatDate(bloodData.latestDate)}
                  </p>
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">{bloodData.summary}</p>
                </div>

                {/* Improved */}
                {bloodData.improved?.length > 0 && (
                  <ChangeCard
                    icon="📈"
                    title="Improved"
                    color="green"
                    items={bloodData.improved}
                  />
                )}

                {/* Worsened */}
                {bloodData.worsened?.length > 0 && (
                  <ChangeCard
                    icon="📉"
                    title="Needs Attention"
                    color="orange"
                    items={bloodData.worsened}
                  />
                )}

                {/* Watch list */}
                {bloodData.watch?.length > 0 && (
                  <div className="bg-orange-50 border border-orange-100 rounded-2xl px-5 py-4">
                    <p className="font-semibold text-orange-800 mb-2 text-sm">⚠️ Watch</p>
                    <ul className="space-y-1">
                      {bloodData.watch.map((w, i) => (
                        <li key={i} className="text-sm text-orange-700">
                          · {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Unchanged */}
                {bloodData.unchanged?.length > 0 && (
                  <ChangeCard
                    icon="➡️"
                    title="Stable"
                    color="slate"
                    items={bloodData.unchanged}
                    collapsed
                  />
                )}
              </>
            )}
          </>
        )}

        <p className="text-center text-xs text-slate-300 pt-2 pb-4">
          Powered by Gemini · Not medical advice
        </p>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-xs font-bold uppercase tracking-widest text-slate-400 pt-2 px-1">
      {label}
    </p>
  )
}

function LoadingCard({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-8 flex flex-col items-center gap-3">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  )
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-5 text-center">
      <p className="text-red-500 font-medium text-sm">{message}</p>
      <button onClick={onRetry} className="mt-3 text-sm text-blue-600 font-medium">
        Try again
      </button>
    </div>
  )
}

function InsightCard({
  label, icon, content, accent,
}: {
  label: string; icon: string; content: string; accent: 'blue' | 'indigo'
}) {
  const bg = accent === 'blue' ? 'bg-blue-600' : 'bg-indigo-600'
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{icon}</span>
        <span className={`text-[10px] font-bold uppercase tracking-wider text-white ${bg} px-2 py-0.5 rounded-full`}>
          {label}
        </span>
      </div>
      <p className="text-sm text-slate-700 leading-relaxed">{content}</p>
    </div>
  )
}

function ListCard({
  icon, title, items, numbered, arrow,
}: {
  icon: string; title: string; items: string[]; numbered?: boolean; arrow?: boolean
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">{icon}</span>
        <p className="font-semibold text-slate-900">{title}</p>
      </div>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="flex gap-3">
            {numbered && (
              <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
            )}
            {arrow && <span className="text-blue-400 flex-shrink-0 mt-0.5">→</span>}
            <p className="text-sm text-slate-700 leading-relaxed">{item}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChangeCard({
  icon, title, color, items, collapsed = false,
}: {
  icon: string
  title: string
  color: 'green' | 'orange' | 'slate'
  items: MarkerChange[]
  collapsed?: boolean
}) {
  const [open, setOpen] = useState(!collapsed)

  const colorMap = {
    green: { bg: 'bg-green-50', border: 'border-green-100', text: 'text-green-800', val: 'text-green-700' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-100', text: 'text-orange-800', val: 'text-orange-600' },
    slate: { bg: 'bg-white', border: 'border-slate-100', text: 'text-slate-800', val: 'text-slate-600' },
  }
  const c = colorMap[color]

  return (
    <div className={`${c.bg} border ${c.border} rounded-2xl overflow-hidden`}>
      <button
        type="button"
        className="w-full flex items-center justify-between px-5 py-4"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2">
          <span>{icon}</span>
          <p className={`font-semibold text-sm ${c.text}`}>
            {title} ({items.length})
          </p>
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 16 16" fill="none"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="px-5 pb-4 space-y-3">
          {items.map((item, i) => (
            <div key={i} className="border-t border-black/5 pt-3 first:border-0 first:pt-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className={`text-sm font-semibold ${c.text}`}>{item.marker}</span>
                <span className={`text-sm font-semibold ${c.val}`}>
                  {item.from !== undefined && item.to !== undefined
                    ? `${item.from} → ${item.to} ${item.unit}`
                    : `${item.value} ${item.unit}`}
                </span>
              </div>
              <p className="text-xs text-slate-500">{item.note}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}