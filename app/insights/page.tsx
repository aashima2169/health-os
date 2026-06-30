// app/insights/page.tsx
// REDESIGNED: single insights section with a period toggle instead of
// separate weekly/monthly blocks.
'use client'

import { useEffect, useState } from 'react'

type Period = 'week' | 'this_month' | 'last_month' | 'month' | 'quarter' | 'year'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'week',       label: 'Weekly' },
  { key: 'this_month',  label: 'This Month' },
  { key: 'last_month',  label: 'Last Month' },
  { key: 'month',       label: '30 Days' },
  { key: 'quarter',     label: 'Quarterly' },
  { key: 'year',        label: 'Yearly' },
]

interface InsightData {
  summary: string
  data_quality: { score: number; gaps: string[]; note: string }
  patterns: {
    observation: string; hypothesis: string; evidence: string
    confidence: number; worth_experimenting: boolean
  }[]
  what_keeps_happening: string
  what_triggers_it: string
  what_helps: string
  what_to_observe_next: string[]
  experiments_to_consider: {
    hypothesis: string; what_to_change: string; how_to_measure: string
    suggested_duration_days: number; confidence: number
  }[]
  questions_for_doctor: string[]
  overall_confidence: number
  limitations: string
}

export default function InsightsPage() {
  const [period, setPeriod] = useState<Period>('week')
  const [data, setData]     = useState<InsightData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(false)

  async function load(p: Period) {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/agents/health-intelligence?period=${p}`)
      if (!res.ok) throw new Error('failed')
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(period) }, [period])

  return (
    <div className="min-h-screen bg-[#F7F8FC] pb-28">
      <div className="px-5 pt-10 pb-5 flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold tracking-widest text-blue-600 uppercase mb-1">
            AI Insights
          </p>
          <h1 className="text-3xl font-bold text-slate-900">Your Patterns</h1>
        </div>
        <button
          type="button" onClick={() => load(period)} disabled={loading}
          className="text-sm text-blue-600 font-medium disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {/* Period toggle */}
      <div className="px-4 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all
                ${period === p.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 space-y-3">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-400">Analysing your data…</p>
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-6 text-center">
            <p className="text-red-500 font-medium">Couldn't load insights</p>
            <p className="text-sm text-red-400 mt-1">Check your Gemini API key in .env.local</p>
            <button onClick={() => load(period)} className="mt-4 text-sm text-blue-600 font-medium">
              Try again
            </button>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* Insufficient data state */}
            {data.overall_confidence === 0 && data.patterns.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-8 text-center">
                <p className="text-4xl mb-3">📊</p>
                <p className="font-medium text-slate-700">{data.summary}</p>
                <p className="text-xs text-slate-400 mt-2">{data.limitations}</p>
              </div>
            ) : (
              <>
                {/* Single summary card */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">📅</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white
                      bg-blue-600 px-2 py-0.5 rounded-full">
                      {PERIODS.find((p) => p.key === period)?.label}
                    </span>
                    {data.data_quality && (
                      <span className="text-[10px] text-slate-400">
                        Data quality: {data.data_quality.score}/100
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{data.summary}</p>
                </div>

                {/* What keeps happening / triggers / helps */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-5 space-y-4">
                  <InsightRow icon="🔁" label="What keeps happening" text={data.what_keeps_happening} />
                  <InsightRow icon="⚡" label="What triggers it" text={data.what_triggers_it} />
                  <InsightRow icon="🌿" label="What helps" text={data.what_helps} />
                </div>

                {/* Patterns */}
                {data.patterns?.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-5">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-lg">🔍</span>
                      <p className="font-semibold text-slate-900">Patterns Detected</p>
                    </div>
                    <div className="space-y-4">
                      {data.patterns.map((p, i) => (
                        <div key={i} className="border-t border-slate-50 pt-4 first:border-0 first:pt-0">
                          <p className="text-sm text-slate-700 leading-relaxed">{p.observation}</p>
                          <p className="text-xs text-slate-400 mt-1 italic">{p.hypothesis}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] text-slate-400">{p.evidence}</span>
                            <span className="text-[10px] font-semibold text-blue-500">
                              {p.confidence}% confidence
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* What to observe next */}
                {data.what_to_observe_next?.length > 0 && (
                  <ListCard icon="👀" title="What to Observe Next" items={data.what_to_observe_next} />
                )}

                {/* Experiments to consider */}
                {data.experiments_to_consider?.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-5">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-lg">🧪</span>
                      <p className="font-semibold text-slate-900">Experiments to Consider</p>
                    </div>
                    <div className="space-y-4">
                      {data.experiments_to_consider.map((e, i) => (
                        <div key={i} className="border-t border-slate-50 pt-4 first:border-0 first:pt-0">
                          <p className="text-sm font-medium text-slate-800">{e.hypothesis}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            Change: {e.what_to_change} · {e.suggested_duration_days} days
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Questions for doctor */}
                {data.questions_for_doctor?.length > 0 && (
                  <ListCard icon="👩‍⚕️" title="Questions for Your Doctor" items={data.questions_for_doctor} />
                )}

                <p className="text-center text-xs text-slate-300 pt-2 pb-4">
                  Powered by Gemini · Not medical advice · {data.limitations}
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function InsightRow({ icon, label, text }: { icon: string; label: string; text: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">{icon}</span>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-sm text-slate-700 leading-relaxed pl-6">{text}</p>
    </div>
  )
}

function ListCard({ icon, title, items }: { icon: string; title: string; items: string[] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">{icon}</span>
        <p className="font-semibold text-slate-900">{title}</p>
      </div>
      <div className="space-y-2.5">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2.5">
            <span className="text-blue-400 flex-shrink-0">→</span>
            <p className="text-sm text-slate-700 leading-relaxed">{item}</p>
          </div>
        ))}
      </div>
    </div>
  )
}