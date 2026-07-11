// app/insights/page.tsx
// REWORKED:
// 1. Specialist board is now TABS (Physician/Dermatologist/Psychologist/
//    Gut/Nutritionist/TCM/Lab Details) instead of a vertical accordion —
//    vertical reading of 6 specialists was hard to scan.
// 2. Blood Report Analysis folded in as a "Lab Details" tab alongside the
//    other specialists, rather than a separate top-level section — the
//    Physician specialist already summarizes the same blood data, so a
//    fully separate section duplicated it.
// 3. New "Questions For You" section: specialists' questions_for_this_
//    specialty are answerable directly. Answers save via /api/agents/
//    questions and automatically feed back into the next analysis.
// 4. Generating/polling logic unchanged from before — status: 'generating'
//    responses poll every 5s, cached data stays visible with an "Updating"
//    badge instead of blanking.
'use client'

import { useEffect, useRef, useState } from 'react'

type Period = 'week' | 'this_month' | 'last_month' | 'month' | 'quarter' | 'year'
type AgentStatus = 'success' | 'generating' | 'error'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'week',       label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'month',      label: '30 Days' },
  { key: 'quarter',    label: 'Quarterly' },
  { key: 'year',       label: 'Yearly' },
]

const POLL_INTERVAL_MS = 5000

// ─── Health Intelligence (A3 consolidator) ────────────────────────

interface CrossSpecialtyInsight {
  insight: string
  specialists: string[]
  evidence: string
  confidence: number
  other_possible_explanation?: string
}

interface SpecialistCard {
  status?: 'success' | 'generating' | 'error'
  has_data?: boolean
  [key: string]: any
}

interface BoardSection {
  physician?: SpecialistCard
  dermatologist?: SpecialistCard
  psychologist?: SpecialistCard
  gutMicrobiomeDoctor?: SpecialistCard
  nutritionist?: SpecialistCard
  tcmPractitioner?: SpecialistCard
}

interface HealthInsight {
  status?: AgentStatus
  generated_at?: string | null
  has_data?: boolean
  period?: Period
  summary?: string
  biggest_change?: string
  what_deserves_attention_this_week?: string
  to_do?: string[]
  to_check?: string[]
  cross_specialty_insights?: CrossSpecialtyInsight[]
  points_of_agreement?: string[]
  points_of_divergence?: string[]
  questions_worth_exploring_with_your_doctor?: string[]
  specialist_confidence_summary?: string[]
  board?: BoardSection
}

// ─── Blood Report Analysis (A1) — now the "Lab Details" tab ────────

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
  status?: AgentStatus
  generated_at?: string | null
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

// ─── Questions For You ──────────────────────────────────────────────

interface SpecialistQuestion {
  id: string
  agent_id: string
  question: string
  answer: string | null
  answered_at: string | null
  created_at: string
}

const SPECIALIST_TABS: { key: keyof BoardSection | 'lab'; icon: string; label: string; agentId: string }[] = [
  { key: 'physician', icon: '🩺', label: 'Physician', agentId: 'A3a' },
  { key: 'dermatologist', icon: '🧴', label: 'Dermatologist', agentId: 'A3b' },
  { key: 'psychologist', icon: '🧠', label: 'Psychologist', agentId: 'A3c' },
  { key: 'gutMicrobiomeDoctor', icon: '🦠', label: 'Gut', agentId: 'A3d' },
  { key: 'nutritionist', icon: '🥗', label: 'Nutritionist', agentId: 'A3f' },
  { key: 'tcmPractitioner', icon: '☯️', label: 'TCM', agentId: 'A3e' },
  { key: 'lab', icon: '🩸', label: 'Lab Details', agentId: 'A1' },
]

export default function InsightsPage() {
  const [period, setPeriod] = useState<Period>('week')

  const [healthData, setHealthData] = useState<HealthInsight | null>(null)
  const [healthStatus, setHealthStatus] = useState<AgentStatus>('generating')
  const [activeTab, setActiveTab] = useState<string>('physician')

  const [bloodData, setBloodData] = useState<BloodInsight | null>(null)
  const [bloodStatus, setBloodStatus] = useState<AgentStatus>('generating')

  const [questions, setQuestions] = useState<SpecialistQuestion[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  const healthPollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bloodPollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const healthRequestId = useRef(0)
  const bloodRequestId = useRef(0)

  async function loadHealth(p: Period) {
    const requestId = ++healthRequestId.current
    if (healthPollTimer.current) clearTimeout(healthPollTimer.current)

    try {
      const res = await fetch(`/api/agents/health-intelligence?period=${p}`)
      if (requestId !== healthRequestId.current) return
      if (!res.ok) throw new Error()
      const json = await res.json()

      const status: AgentStatus = json.status ?? 'success'
      setHealthStatus(status)

      if (status === 'success') {
        setHealthData(json)
      } else if (status === 'generating') {
        setHealthData((prev) => ({ ...(prev ?? {}), ...json, has_data: prev?.has_data ?? json.has_data }))
        healthPollTimer.current = setTimeout(() => loadHealth(p), POLL_INTERVAL_MS)
      }
    } catch {
      if (requestId === healthRequestId.current) setHealthStatus('error')
    }
  }

  async function loadBlood() {
    const requestId = ++bloodRequestId.current
    if (bloodPollTimer.current) clearTimeout(bloodPollTimer.current)

    try {
      const res = await fetch('/api/agents/blood-analysis')
      if (requestId !== bloodRequestId.current) return
      if (!res.ok) throw new Error()
      const json = await res.json()

      const status: AgentStatus = json.status ?? 'success'
      setBloodStatus(status)

      if (status === 'success') {
        setBloodData(json)
      } else if (status === 'generating') {
        bloodPollTimer.current = setTimeout(() => loadBlood(), POLL_INTERVAL_MS)
      }
    } catch {
      if (requestId === bloodRequestId.current) setBloodStatus('error')
    }
  }

  async function loadQuestions() {
    try {
      const res = await fetch('/api/agents/questions')
      if (!res.ok) return
      const json = await res.json()
      setQuestions(json.questions ?? [])
    } catch {
      // silent — this section is supplementary, not worth an error card
    }
  }

  // The actual "Refresh" action. loadHealth/loadBlood only ever GET — if a
  // 'success' result is already cached, GET correctly trusts it and skips
  // regenerating, which means a plain reload can NEVER force a fresh run.
  // This calls the force-regenerate POST endpoints first, then starts
  // polling via the normal GET/poll cycle to reflect progress.
  async function forceRefresh() {
    setHealthStatus('generating')
    setBloodStatus('generating')
    try {
      await Promise.all([
        fetch(`/api/agents/health-intelligence?period=${period}`, { method: 'POST' }),
        fetch('/api/agents/blood-analysis', { method: 'POST' }),
      ])
    } catch {
      // even if the POST itself fails to reach the server, still poll —
      // the GET routes have their own staleness/bootstrap fallback
    }
    loadHealth(period)
    loadBlood()
  }

  async function saveAnswer(q: SpecialistQuestion) {
    const draft = drafts[q.id]
    if (draft === undefined || draft.trim() === '') return
    setSavingId(q.id)
    try {
      await fetch('/api/agents/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: q.agent_id, question: q.question, answer: draft.trim() }),
      })
      setQuestions((prev) => prev.map((x) => x.id === q.id ? { ...x, answer: draft.trim(), answered_at: new Date().toISOString() } : x))
    } catch {
      // leave draft in place so the person can retry
    } finally {
      setSavingId(null)
    }
  }

  useEffect(() => {
    loadHealth(period)
    return () => { if (healthPollTimer.current) clearTimeout(healthPollTimer.current) }
  }, [period])

  useEffect(() => {
    loadBlood()
    loadQuestions()
    return () => { if (bloodPollTimer.current) clearTimeout(bloodPollTimer.current) }
  }, [])

  const healthBusy = healthStatus === 'generating'
  const bloodBusy = bloodStatus === 'generating'

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
          onClick={forceRefresh}
          disabled={healthBusy && bloodBusy}
          className="text-sm text-blue-600 font-medium disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

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
        {healthBusy && !healthData && <LoadingCard message="Running the specialist board…" />}
        {healthStatus === 'error' && (
          <ErrorCard message="Couldn't load health insights." onRetry={() => loadHealth(period)} />
        )}

        {healthData && (
          <>
            {healthBusy && <UpdatingBadge label="Updating insights…" />}

            {/* ── SPECIALIST TABS — rendered first, independent of whether
                the consolidator has finished. Each specialist's data shows
                as soon as IT completes, not gated behind the final
                combined result. This is what was broken before: this
                section used to live inside the has_data check below,
                which stayed false (undefined, actually) for the entire
                time the consolidator was still running, hiding specialist
                data that had already arrived. ────────────────────── */}
            {healthData.board && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="flex gap-1 overflow-x-auto px-3 pt-3 pb-1 border-b border-slate-100">
                  {SPECIALIST_TABS.map((tab) => {
                    const card = tab.key === 'lab' ? null : healthData.board?.[tab.key as keyof BoardSection]
                    const dotStatus = tab.key === 'lab' ? bloodStatus : (card?.status ?? (card?.has_data ? 'success' : 'generating'))
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all
                          ${activeTab === tab.key ? 'bg-blue-50 text-blue-700' : 'text-slate-500'}`}
                      >
                        <span>{tab.icon}</span>
                        <span>{tab.label}</span>
                        <StatusDot status={dotStatus} />
                      </button>
                    )
                  })}
                </div>

                <div className="p-5">
                  {SPECIALIST_TABS.filter((t) => t.key === activeTab).map((tab) => {
                    if (tab.key === 'lab') {
                      return <LabDetailsPanel key="lab" bloodData={bloodData} bloodBusy={bloodBusy} bloodStatus={bloodStatus} onRetry={loadBlood} />
                    }
                    const card = healthData.board?.[tab.key as keyof BoardSection]
                    if (!card) return <p key={tab.key} className="text-xs text-slate-400">Not started yet.</p>
                    if (card.status === 'generating' || (!card.has_data && !card.error)) {
                      return (
                        <div key={tab.key} className="flex items-center gap-2 py-4">
                          <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                          <p className="text-xs text-slate-400">Still working on this one…</p>
                        </div>
                      )
                    }
                    if (card.has_data === false) {
                      return <p key={tab.key} className="text-xs text-slate-400">Hit a snag — will retry on the next refresh.</p>
                    }
                    return <SpecialistFields key={tab.key} card={card} />
                  })}
                </div>
              </div>
            )}

            {!healthData.board && !healthData.summary ? (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-8 text-center">
                <p className="text-4xl mb-3">📊</p>
                <p className="font-medium text-slate-700">
                  {healthData.summary ?? 'Getting started — check back in a moment.'}
                </p>
              </div>
            ) : (
              <>
                {healthData.summary && (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg">📅</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white
                        bg-blue-600 px-2 py-0.5 rounded-full">
                        {PERIODS.find((p) => p.key === period)?.label}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      <BoldText text={healthData.summary} />
                    </p>
                  </div>
                )}

                {(healthData.biggest_change || healthData.what_deserves_attention_this_week) && (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-5 space-y-4">
                    {healthData.biggest_change && (
                      <InsightRow icon="⚡" label="Biggest Change" text={healthData.biggest_change} />
                    )}
                    {healthData.what_deserves_attention_this_week && (
                      <InsightRow icon="🎯" label="What Deserves Attention" text={healthData.what_deserves_attention_this_week} />
                    )}
                  </div>
                )}

                {healthData.to_do && healthData.to_do.length > 0 && (
                  <div className="bg-green-50 border border-green-100 rounded-2xl px-5 py-4">
                    <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-2">✅ To Do</p>
                    <ul className="space-y-1.5">
                      {healthData.to_do.map((item, i) => (
                        <li key={i} className="flex gap-2 text-xs text-green-800 leading-relaxed">
                          <span className="text-green-500 flex-shrink-0">•</span>
                          <span><BoldText text={item} /></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {healthData.to_check && healthData.to_check.length > 0 && (
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4">
                    <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">👁️ To Check</p>
                    <ul className="space-y-1.5">
                      {healthData.to_check.map((item, i) => (
                        <li key={i} className="flex gap-2 text-xs text-amber-800 leading-relaxed">
                          <span className="text-amber-500 flex-shrink-0">•</span>
                          <span><BoldText text={item} /></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {healthData.cross_specialty_insights && healthData.cross_specialty_insights.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-5">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-lg">🔗</span>
                      <p className="font-semibold text-slate-900">Cross-Specialty Insights</p>
                    </div>
                    <div className="space-y-4">
                      {healthData.cross_specialty_insights.map((ins, i) => (
                        <div key={i} className="border-t border-slate-50 pt-4 first:border-0 first:pt-0">
                          <p className="text-sm text-slate-700 leading-relaxed"><BoldText text={ins.insight} /></p>
                          {ins.specialists?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {ins.specialists.map((s) => (
                                <span key={s} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                                  {s}
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="text-xs text-slate-500 mt-2">
                            <span className="font-semibold text-slate-600">Evidence: </span>
                            {ins.evidence}
                          </p>
                          {ins.other_possible_explanation && (
                            <p className="text-[11px] text-slate-400 mt-1">
                              <span className="font-semibold">Could also be: </span>
                              {ins.other_possible_explanation}
                            </p>
                          )}
                          <span className="text-[10px] font-semibold text-blue-500 mt-1 inline-block">
                            {ins.confidence}% confidence
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {healthData.points_of_agreement && healthData.points_of_agreement.length > 0 && (
                  <ListCard icon="🤝" title="Where the Board Agreed" items={healthData.points_of_agreement} />
                )}
                {healthData.points_of_divergence && healthData.points_of_divergence.length > 0 && (
                  <ListCard icon="🔀" title="Where Reads Diverged" items={healthData.points_of_divergence} />
                )}
                {healthData.questions_worth_exploring_with_your_doctor && healthData.questions_worth_exploring_with_your_doctor.length > 0 && (
                  <ListCard icon="👩‍⚕️" title="Questions for Your Doctor" items={healthData.questions_worth_exploring_with_your_doctor} />
                )}
              </>
            )}
          </>
        )}

        {/* ── QUESTIONS FOR YOU ─────────────────────────────── */}
        {questions.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">💬</span>
              <p className="font-semibold text-slate-900">Questions For You</p>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Your answers feed directly into the next analysis — no need to answer them all at once.
            </p>
            <div className="space-y-4">
              {questions.map((q) => (
                <div key={q.id} className="border-t border-slate-50 pt-4 first:border-0 first:pt-0">
                  <p className="text-sm text-slate-700 leading-relaxed mb-2">{q.question}</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      defaultValue={q.answer ?? ''}
                      onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                      placeholder="Your answer…"
                      className="flex-1 text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-400"
                    />
                    <button
                      onClick={() => saveAnswer(q)}
                      disabled={savingId === q.id}
                      className="text-xs font-semibold text-blue-600 px-3 disabled:opacity-40"
                    >
                      {savingId === q.id ? '…' : 'Save'}
                    </button>
                  </div>
                  {q.answered_at && drafts[q.id] === undefined && (
                    <p className="text-[10px] text-green-600 mt-1">✓ Answered</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-[10px] text-slate-300 pt-2 pb-4">
          Powered by Gemini · Not medical advice
        </p>
      </div>
    </div>
  )
}

// ─── Lab Details panel (folded-in blood analysis) ───────────────────

function LabDetailsPanel({ bloodData, bloodBusy, bloodStatus, onRetry }: {
  bloodData: BloodInsight | null; bloodBusy: boolean; bloodStatus: AgentStatus; onRetry: () => void
}) {
  if (bloodBusy && !bloodData) return <LoadingCard message="Analysing your blood reports…" />
  if (bloodStatus === 'error') return <ErrorCard message="Couldn't load blood analysis." onRetry={onRetry} />
  if (!bloodData) return <p className="text-xs text-slate-400">No data yet.</p>
  if (!bloodData.has_data) return <p className="text-xs text-slate-400">{bloodData.message}</p>

  return (
    <div className="space-y-4">
      {bloodBusy && <UpdatingBadge label="Updating lab details…" />}

      {bloodData.previous_date && (
        <p className="text-xs text-slate-400">
          Comparing {bloodData.previous_date} → {bloodData.latest_date}
        </p>
      )}
      <p className="text-sm text-slate-700 leading-relaxed">{bloodData.overall_summary}</p>

      {bloodData.previous_date && (bloodData.improved?.length || bloodData.worsened?.length) ? (
        <div className="grid grid-cols-2 gap-3">
          {bloodData.improved && bloodData.improved.length > 0 && (
            <div className="bg-green-50 border border-green-100 rounded-2xl px-4 py-4">
              <p className="text-xs font-semibold text-green-700 mb-2">📈 Improved</p>
              {bloodData.improved.map((m) => <p key={m} className="text-xs text-green-700">{m}</p>)}
            </div>
          )}
          {bloodData.worsened && bloodData.worsened.length > 0 && (
            <div className="bg-orange-50 border border-orange-100 rounded-2xl px-4 py-4">
              <p className="text-xs font-semibold text-orange-700 mb-2">📉 Needs Attention</p>
              {bloodData.worsened.map((m) => <p key={m} className="text-xs text-orange-700">{m}</p>)}
            </div>
          )}
        </div>
      ) : null}

      {bloodData.by_system?.map((sys) => (
        <div key={sys.system} className="border border-slate-100 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="font-semibold text-slate-900 text-sm">{sys.system}</p>
            <p className="text-xs text-slate-400 mt-0.5">{sys.system_summary}</p>
          </div>
          <div className="px-4 pb-3 pt-2 space-y-3">
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
                    <span className={`text-sm font-semibold ${m.status === 'normal' ? 'text-slate-900' : 'text-orange-500'}`}>
                      {m.value} {m.unit}
                    </span>
                    {m.reference && <p className="text-[10px] text-slate-400">{m.reference}</p>}
                  </div>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed pl-3.5">{m.plain_language}</p>
                {m.previous_value !== undefined && (
                  <p className="text-[10px] text-slate-400 pl-3.5 mt-0.5">Previous: {m.previous_value} {m.unit}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {bloodData.flags && bloodData.flags.filter((f) => f.suggest_doctor_discussion).length > 0 && (
        <div className="bg-orange-50 border border-orange-100 rounded-2xl px-4 py-4">
          <p className="text-xs font-semibold text-orange-700 mb-2">⚠️ Worth discussing with your doctor</p>
          {bloodData.flags.filter((f) => f.suggest_doctor_discussion).map((f, i) => (
            <p key={i} className="text-xs text-orange-700 mt-1">· {f.marker}: {f.note}</p>
          ))}
        </div>
      )}

      {bloodData.questions_for_doctor && bloodData.questions_for_doctor.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Questions for Your Doctor</p>
          {bloodData.questions_for_doctor.map((q, i) => (
            <p key={i} className="text-xs text-slate-600 mb-1">→ {q}</p>
          ))}
        </div>
      )}

      {bloodData.disclaimer && (
        <p className="text-center text-[10px] text-slate-300 pt-2">{bloodData.disclaimer}</p>
      )}
    </div>
  )
}

// ─── Shared rendering helpers ────────────────────────────────────────

function BoldText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>
      )}
    </>
  )
}

function RenderValue({ value, compact = false }: { value: any; compact?: boolean }) {
  if (value === null || value === undefined || value === '') return null

  if (typeof value === 'string') {
    return <p className="text-xs text-slate-600 leading-relaxed"><BoldText text={value} /></p>
  }
  if (typeof value === 'number') {
    return <p className="text-xs text-slate-600">{value}</p>
  }
  if (typeof value === 'boolean') {
    return <p className="text-xs text-slate-600">{value ? 'Yes' : 'No'}</p>
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return null
    return (
      <ul className="space-y-2">
        {value.map((item, i) => (
          <li key={i} className="flex gap-2 text-xs text-slate-600 leading-relaxed">
            <span className="text-blue-400 flex-shrink-0 mt-0.5">•</span>
            {typeof item === 'object' && item !== null ? (
              <div className="flex-1"><ObjectFields obj={item} compact /></div>
            ) : (
              <span className="flex-1"><BoldText text={String(item)} /></span>
            )}
          </li>
        ))}
      </ul>
    )
  }
  if (typeof value === 'object') {
    return <ObjectFields obj={value} />
  }
  return null
}

function ObjectFields({ obj, compact = false }: { obj: Record<string, any>; compact?: boolean }) {
  const entries = Object.entries(obj).filter(
    ([k, v]) => v !== undefined && v !== null && v !== '' && !['has_data', 'status', 'error', 'cached'].includes(k)
  )
  if (entries.length === 0) return null

  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      {entries.map(([key, val]) => (
        <div key={key}>
          {!compact && (
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">
              {key.replace(/_/g, ' ')}
            </p>
          )}
          {compact && typeof val === 'string' ? (
            <p className="text-xs text-slate-600 leading-relaxed">
              <span className="font-semibold text-slate-700">{key.replace(/_/g, ' ')}: </span>
              <BoldText text={val} />
            </p>
          ) : (
            <RenderValue value={val} compact={compact} />
          )}
        </div>
      ))}
    </div>
  )
}

function SpecialistFields({ card }: { card: SpecialistCard }) {
  const entries = Object.entries(card).filter(
    ([key, val]) => !['has_data', 'status', 'error', 'cached'].includes(key) && val !== undefined && val !== null && val !== ''
  )
  return (
    <div className="space-y-4">
      {entries.map(([key, val]) => (
        <div key={key}>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
            {key.replace(/_/g, ' ')}
          </p>
          <RenderValue value={val} />
        </div>
      ))}
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  if (status === 'success') return <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
  if (status === 'error') return <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
  return <span className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-pulse" />
}

function InsightRow({ icon, label, text }: { icon: string; label: string; text: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">{icon}</span>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-sm text-slate-700 leading-relaxed pl-6"><BoldText text={text} /></p>
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

function UpdatingBadge({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      <p className="text-xs text-blue-500 font-medium">{label}</p>
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