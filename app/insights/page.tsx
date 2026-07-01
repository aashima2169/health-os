// app/insights/page.tsx
// UPDATED: now has two independent sections:
// 1. Health Intelligence (daily logs, period-toggle) — unchanged
// 2. Blood Report Analysis (A4b) — new section at the bottom
'use client'

import { useEffect, useState } from 'react'

type Period = 'week' | 'this_month' | 'last_month' | 'month' | 'quarter' | 'year'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'week',       label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'month',      label: '30 Days' },
  { key: 'quarter',    label: 'Quarterly' },
  { key: 'year',       label: 'Yearly' },
]

interface HealthInsight {
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
    hypothesis: string; what_to_change: string
    suggested_duration_days: number; confidence: number
  }[]
  questions_for_doctor: string[]
  overall_confidence: number
  limitations: string
}

interface BloodMarker {
  name: string; value: number; unit: string; reference?: string
  status: string; plain_language: string
  change?: string; previous_value?: number
}

interface BloodSystem {
  system: string
  markers: BloodMarker[]
  system_summary: string
}

interface BloodInsight {
  has_data: boolean
  message?: string
  latest_date?: string
  previous_date?: string
  overall_summary?: string
  by_system?: BloodSystem[]
  flags?: { marker: string; status: string; note: string; suggest_doctor_discussion: boolean }[]
  improved?: string[]
  worsened?: string[]
  stable?: string[]
  questions_for_doctor?: string[]
  report_count?: number
  confidence?: number
  disclaimer?: string
}

export default function InsightsPage() {
  const [period, setPeriod] = useState<Period>('week')
  const [healthData, setHealthData]   = useState<HealthInsight | null>(null)
  const [loadingHealth, setLoadingHealth] = useState(true)
  const [errorHealth, setErrorHealth] = useState(false)

  const [bloodData, setBloodData]   = useState<BloodInsight | null>(null)
  const [loadingBlood, setLoadingBlood] = useState(true)
  const [errorBlood, setErrorBlood] = useState(false)
  const [bloodExpanded, setBloodExpanded] = useState(false)

  async function loadHealth(p: Period) {
    setLoadingHealth(true); setErrorHealth(false)
    try {
      const res = await fetch(`/api/agents/health-intelligence?period=${p}`)
      if (!res.ok) throw new Error()
      setHealthData(await res.json())
    } catch { setErrorHealth(true) }
    finally { setLoadingHealth(false) }
  }

  async function loadBlood() {
    setLoadingBlood(true); setErrorBlood(false)
    try {
      const res = await fetch('/api/agents/blood-analysis')
      if (!res.ok) throw new Error()
      setBloodData(await res.json())
    } catch { setErrorBlood(true) }
    finally { setLoadingBlood(false) }
  }

  useEffect(() => { loadHealth(period) }, [period])
  useEffect(() => { loadBlood() }, [])

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
          onClick={() => { loadHealth(period); loadBlood() }}
          disabled={loadingHealth && loadingBlood}
          className="text-sm text-blue-600 font-medium disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {/* ── SECTION 1: Health Intelligence ───────────────────── */}
      <div className="px-4 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {PERIODS.map((p) => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all
                ${period === p.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 space-y-3">
        {loadingHealth && <LoadingCard message="Analysing your check-ins…" />}
        {errorHealth && !loadingHealth && (
          <ErrorCard message="Couldn't load health insights." onRetry={() => loadHealth(period)} />
        )}

        {!loadingHealth && !errorHealth && healthData && (
          <>
            {healthData.overall_confidence === 0 && healthData.patterns?.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-8 text-center">
                <p className="text-4xl mb-3">📊</p>
                <p className="font-medium text-slate-700">{healthData.summary}</p>
                <p className="text-xs text-slate-400 mt-2">{healthData.limitations}</p>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">📅</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white
                      bg-blue-600 px-2 py-0.5 rounded-full">
                      {PERIODS.find((p) => p.key === period)?.label}
                    </span>
                    {healthData.data_quality && (
                      <span className="text-[10px] text-slate-400">
                        {healthData.data_quality.score}/100 data quality
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{healthData.summary}</p>
                </div>

                {(healthData.what_keeps_happening || healthData.what_triggers_it || healthData.what_helps) && (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-5 space-y-4">
                    {healthData.what_keeps_happening && <InsightRow icon="🔁" label="What keeps happening" text={healthData.what_keeps_happening} />}
                    {healthData.what_triggers_it && <InsightRow icon="⚡" label="What triggers it" text={healthData.what_triggers_it} />}
                    {healthData.what_helps && <InsightRow icon="🌿" label="What helps" text={healthData.what_helps} />}
                  </div>
                )}

                {healthData.patterns?.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-5">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-lg">🔍</span>
                      <p className="font-semibold text-slate-900">Patterns Detected</p>
                    </div>
                    <div className="space-y-4">
                      {healthData.patterns.map((p, i) => (
                        <div key={i} className="border-t border-slate-50 pt-4 first:border-0 first:pt-0">
                          <p className="text-sm text-slate-700 leading-relaxed">{p.observation}</p>
                          <p className="text-xs text-slate-400 mt-1 italic">{p.hypothesis}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] text-slate-400">{p.evidence}</span>
                            <span className="text-[10px] font-semibold text-blue-500">{p.confidence}% confidence</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {healthData.what_to_observe_next?.length > 0 && (
                  <ListCard icon="👀" title="What to Observe Next" items={healthData.what_to_observe_next} />
                )}
                {healthData.experiments_to_consider?.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-5">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-lg">🧪</span>
                      <p className="font-semibold text-slate-900">Experiments to Consider</p>
                    </div>
                    <div className="space-y-4">
                      {healthData.experiments_to_consider.map((e, i) => (
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
                {healthData.questions_for_doctor?.length > 0 && (
                  <ListCard icon="👩‍⚕️" title="Questions for Your Doctor" items={healthData.questions_for_doctor} />
                )}
              </>
            )}
          </>
        )}

        {/* ── SECTION 2: Blood Report Analysis ─────────────── */}
        <div className="w-full h-px bg-slate-200 my-2" />

        <button
          type="button"
          onClick={() => setBloodExpanded((e) => !e)}
          className="w-full flex items-center justify-between bg-white rounded-2xl
            border border-slate-100 shadow-sm px-5 py-4"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">🩸</span>
            <div className="text-left">
              <p className="font-semibold text-[15px] text-slate-900">Blood Report Analysis</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {loadingBlood
                  ? 'Loading…'
                  : bloodData?.has_data
                    ? `${bloodData.report_count} report${bloodData.report_count !== 1 ? 's' : ''} · tap to expand`
                    : 'No reports yet'}
              </p>
            </div>
          </div>
          <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${bloodExpanded ? 'rotate-180' : ''}`}
            viewBox="0 0 16 16" fill="none">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {bloodExpanded && (
          <>
            {loadingBlood && <LoadingCard message="Analysing your blood reports…" />}
            {errorBlood && !loadingBlood && (
              <ErrorCard message="Couldn't load blood analysis." onRetry={loadBlood} />
            )}
            {!loadingBlood && !errorBlood && bloodData && (
              <>
                {!bloodData.has_data ? (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-6 text-center">
                    <p className="text-sm text-slate-500">{bloodData.message}</p>
                  </div>
                ) : (
                  <>
                    {/* Summary + comparison dates */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-5">
                      {bloodData.previous_date && (
                        <p className="text-xs text-slate-400 mb-2">
                          Comparing {bloodData.previous_date} → {bloodData.latest_date}
                        </p>
                      )}
                      <p className="text-sm text-slate-700 leading-relaxed">{bloodData.overall_summary}</p>
                    </div>

                    {/* Changed since last report */}
                    {bloodData.previous_date && (
                      <div className="grid grid-cols-2 gap-3">
                        {bloodData.improved && bloodData.improved.length > 0 && (
                          <div className="bg-green-50 border border-green-100 rounded-2xl px-4 py-4">
                            <p className="text-xs font-semibold text-green-700 mb-2">📈 Improved</p>
                            {bloodData.improved.map((m) => (
                              <p key={m} className="text-xs text-green-700">{m}</p>
                            ))}
                          </div>
                        )}
                        {bloodData.worsened && bloodData.worsened.length > 0 && (
                          <div className="bg-orange-50 border border-orange-100 rounded-2xl px-4 py-4">
                            <p className="text-xs font-semibold text-orange-700 mb-2">📉 Needs Attention</p>
                            {bloodData.worsened.map((m) => (
                              <p key={m} className="text-xs text-orange-700">{m}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* By system */}
                    {bloodData.by_system?.map((sys) => (
                      <div key={sys.system} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100">
                          <p className="font-semibold text-slate-900 text-[15px]">{sys.system}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{sys.system_summary}</p>
                        </div>
                        <div className="px-5 pb-4 pt-2 space-y-3">
                          {sys.markers.map((m) => (
                            <div key={m.name} className="border-t border-slate-50 pt-3 first:border-0 first:pt-1">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                    m.status === 'normal' ? 'bg-green-400'
                                    : m.status.includes('borderline') ? 'bg-yellow-400'
                                    : 'bg-orange-400'
                                  }`} />
                                  <span className="text-sm font-medium text-slate-800">{m.name}</span>
                                  {m.change && m.change !== 'stable' && m.change !== 'new' && (
                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                      m.change === 'improved' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'
                                    }`}>
                                      {m.change === 'improved' ? '↑' : '↓'}
                                    </span>
                                  )}
                                </div>
                                <div className="text-right">
                                  <span className={`text-sm font-semibold ${
                                    m.status === 'normal' ? 'text-slate-900' : 'text-orange-500'
                                  }`}>
                                    {m.value} {m.unit}
                                  </span>
                                  {m.reference && (
                                    <p className="text-[10px] text-slate-400">{m.reference}</p>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-slate-500 leading-relaxed pl-3.5">{m.plain_language}</p>
                              {m.previous_value !== undefined && (
                                <p className="text-[10px] text-slate-400 pl-3.5 mt-0.5">
                                  Previous: {m.previous_value} {m.unit}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* Flags */}
                    {bloodData.flags && bloodData.flags.filter((f) => f.suggest_doctor_discussion).length > 0 && (
                      <div className="bg-orange-50 border border-orange-100 rounded-2xl px-5 py-4">
                        <p className="text-xs font-semibold text-orange-700 mb-2">⚠️ Worth discussing with your doctor</p>
                        {bloodData.flags
                          .filter((f) => f.suggest_doctor_discussion)
                          .map((f, i) => (
                            <p key={i} className="text-xs text-orange-700 mt-1">· {f.marker}: {f.note}</p>
                          ))}
                      </div>
                    )}

                    {/* Doctor questions */}
                    {bloodData.questions_for_doctor && bloodData.questions_for_doctor.length > 0 && (
                      <ListCard icon="👩‍⚕️" title="Questions for Your Doctor" items={bloodData.questions_for_doctor} />
                    )}

                    {bloodData.disclaimer && (
                      <p className="text-center text-[10px] text-slate-300 pb-2">{bloodData.disclaimer}</p>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}

        <p className="text-center text-[10px] text-slate-300 pt-2 pb-4">
          Powered by Gemini · Not medical advice
        </p>
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

function LoadingCard({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-8
      flex flex-col items-center gap-3">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  )
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-5 text-center">
      <p className="text-red-500 font-medium text-sm">{message}</p>
      <button onClick={onRetry} className="mt-3 text-sm text-blue-600 font-medium">Try again</button>
    </div>
  )
}