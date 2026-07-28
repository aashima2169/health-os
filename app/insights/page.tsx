// app/insights/page.tsx
// Redesigned onto the shared Card/Tag system (see plan: Flarewise visual
// design system, Phase 2). Data fetching, polling, and every API contract
// below is UNCHANGED from the previous version — this is a rendering
// rebuild only. The generic RenderValue/ObjectFields key-dumper is gone,
// replaced by actual designed sections plus one real blood-marker trend
// chart (built per this project's dataviz skill: categorical lines
// validated for CVD-safety, direct end labels, muted gridlines, hover
// tooltip, one axis).
'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Stethoscope, Sparkles, Brain, Wind, Leaf, Compass, FlaskConical,
  CheckCircle2, Eye, Link2, Handshake, Shuffle, Stethoscope as DoctorIcon,
  MessageCircle, TrendingUp, AlertCircle,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import Card from '../../components/shared/Card'
import Tag from '../../components/shared/Tag'

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

// Chart line colors — validated separately from the app's muted UI
// palette (which is intentionally low-chroma and fails categorical CVD
// checks). See dataviz skill: node scripts/validate_palette.js
// "#1baf7a,#4a3aa7,#eb6834" --mode light — passes all checks (WARN on
// contrast for the green against white, mitigated by direct labels below).
const CHART_LINE_COLORS = ['#1baf7a', '#4a3aa7', '#eb6834']

// ─── Health Intelligence (A3 consolidator) ────────────────────────

interface CrossSpecialtyInsight {
  insight: string
  specialists: string[]
  evidence: string
  confidence: number
  other_possible_explanation?: string
}

interface SpecialistCard {
  status?: 'success' | 'generating' | 'error' | 'not_generated'
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

// ─── Blood Report Analysis (A1) — "Lab Details" tab ────────

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

// ─── Raw blood report history — for the trend chart only ─────────

interface RawBloodReport {
  id: string
  report_date: string
  markers: Record<string, { value: number; unit: string; reference?: string }> | null
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

const SPECIALIST_TABS: { key: keyof BoardSection | 'lab'; icon: typeof Stethoscope; label: string; agentId: string }[] = [
  { key: 'physician', icon: Stethoscope, label: 'Physician', agentId: 'A3a' },
  { key: 'dermatologist', icon: Sparkles, label: 'Dermatologist', agentId: 'A3b' },
  { key: 'psychologist', icon: Brain, label: 'Psychologist', agentId: 'A3c' },
  { key: 'gutMicrobiomeDoctor', icon: Wind, label: 'Gut', agentId: 'A3d' },
  { key: 'nutritionist', icon: Leaf, label: 'Nutritionist', agentId: 'A3f' },
  { key: 'tcmPractitioner', icon: Compass, label: 'TCM', agentId: 'A3e' },
  { key: 'lab', icon: FlaskConical, label: 'Lab Details', agentId: 'A1' },
]

export default function InsightsPage() {
  const [period, setPeriod] = useState<Period>('week')

  const [healthData, setHealthData] = useState<HealthInsight | null>(null)
  const [healthStatus, setHealthStatus] = useState<AgentStatus>('generating')
  const [activeTab, setActiveTab] = useState<string>('physician')

  const [bloodData, setBloodData] = useState<BloodInsight | null>(null)
  const [bloodStatus, setBloodStatus] = useState<AgentStatus>('generating')
  const [bloodHistory, setBloodHistory] = useState<RawBloodReport[]>([])

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

  // Raw report history, for the trend chart only — same GET endpoint the
  // Blood Reports page already uses, no new API surface.
  async function loadBloodHistory() {
    try {
      const res = await fetch('/api/blood-reports')
      if (!res.ok) return
      const json = await res.json()
      setBloodHistory(json.reports ?? [])
    } catch {
      // chart is supplementary — silent failure, rest of the page still works
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
    loadBloodHistory()
    loadQuestions()
    return () => { if (bloodPollTimer.current) clearTimeout(bloodPollTimer.current) }
  }, [])

  const healthBusy = healthStatus === 'generating'
  const bloodBusy = bloodStatus === 'generating'

  return (
    <div className="min-h-screen bg-bg pb-28">
      <div className="px-5 pt-10 pb-5 flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold tracking-widest text-intelligence uppercase mb-1">
            AI Insights
          </p>
          <h1 className="font-display text-3xl font-semibold text-ink">Your Patterns</h1>
        </div>
        <button
          onClick={forceRefresh}
          disabled={healthBusy && bloodBusy}
          className="text-sm text-primary font-medium disabled:opacity-50"
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
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-surface border border-line text-ink-soft'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 space-y-3">
        <BloodTrendChart history={bloodHistory} flags={bloodData?.flags} />

        {healthBusy && !healthData && <LoadingCard message="Running the specialist board…" />}
        {healthStatus === 'error' && (
          <ErrorCard message="Couldn't load health insights." onRetry={() => loadHealth(period)} />
        )}

        {healthData && (
          <>
            {healthBusy && <UpdatingBadge label="Updating insights…" />}

            {/* Specialist tabs — rendered as soon as the board data arrives,
                independent of whether the consolidator has finished, so
                each specialist's read shows the moment IT completes. */}
            {healthData.board && (
              <Card className="!p-0 overflow-hidden">
                <div className="flex gap-1 overflow-x-auto px-3 pt-3 pb-1 border-b border-line">
                  {SPECIALIST_TABS.map((tab) => {
                    const card = tab.key === 'lab' ? null : healthData.board?.[tab.key as keyof BoardSection]
                    const dotStatus = tab.key === 'lab' ? bloodStatus : (card?.status ?? (card?.has_data ? 'success' : 'not_generated'))
                    const Icon = tab.icon
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all
                          ${activeTab === tab.key ? 'bg-intelligence-soft text-intelligence' : 'text-ink-faint'}`}
                      >
                        <Icon size={13} />
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
                    if (!card || card.status === 'not_generated') {
                      return (
                        <p key={tab.key} className="text-xs text-ink-faint py-2">
                          Not generated yet — tap Refresh above to check for patterns.
                        </p>
                      )
                    }
                    if (card.status === 'generating') {
                      return (
                        <div key={tab.key} className="flex items-center gap-2 py-4">
                          <div className="w-3 h-3 border-2 border-intelligence/40 border-t-transparent rounded-full animate-spin" />
                          <p className="text-xs text-ink-faint">Still working on this one…</p>
                        </div>
                      )
                    }
                    if (card.has_data === false) {
                      return <p key={tab.key} className="text-xs text-ink-faint">Hit a snag — will retry on the next refresh.</p>
                    }
                    return <SpecialistFields key={tab.key} card={card} />
                  })}
                </div>
              </Card>
            )}

            {!healthData.board && !healthData.summary ? (
              <Card className="text-center py-8">
                <Sparkles className="mx-auto mb-3 text-ink-faint" size={28} />
                <p className="font-medium text-ink-soft">
                  {healthData.summary ?? 'Getting started — check back in a moment.'}
                </p>
              </Card>
            ) : (
              <>
                {healthData.summary && (
                  <Card tone="intelligence">
                    <div className="flex items-center gap-2 mb-3">
                      <Tag tone="intelligence">{PERIODS.find((p) => p.key === period)?.label}</Tag>
                    </div>
                    <p className="font-display text-lg leading-snug text-ink">
                      <BoldText text={healthData.summary} />
                    </p>
                  </Card>
                )}

                {(healthData.biggest_change || healthData.what_deserves_attention_this_week) && (
                  <Card className="space-y-4">
                    {healthData.biggest_change && (
                      <InsightRow icon={TrendingUp} label="Biggest Change" text={healthData.biggest_change} />
                    )}
                    {healthData.what_deserves_attention_this_week && (
                      <InsightRow icon={Eye} label="What Deserves Attention" text={healthData.what_deserves_attention_this_week} />
                    )}
                  </Card>
                )}

                {healthData.to_do && healthData.to_do.length > 0 && (
                  <Card tone="default" className="border-primary/25">
                    <p className="text-xs font-bold text-primary uppercase tracking-wide mb-2">To Do</p>
                    <ul className="space-y-1.5">
                      {healthData.to_do.map((item, i) => (
                        <li key={i} className="flex gap-2 text-xs text-ink-soft leading-relaxed">
                          <CheckCircle2 size={13} className="flex-shrink-0 mt-0.5 text-primary" />
                          <span><BoldText text={item} /></span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
                {healthData.to_check && healthData.to_check.length > 0 && (
                  <Card tone="caution">
                    <p className="text-xs font-bold text-caution uppercase tracking-wide mb-2">To Check</p>
                    <ul className="space-y-1.5">
                      {healthData.to_check.map((item, i) => (
                        <li key={i} className="flex gap-2 text-xs text-ink-soft leading-relaxed">
                          <Eye size={13} className="flex-shrink-0 mt-0.5 text-caution" />
                          <span><BoldText text={item} /></span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}

                {healthData.cross_specialty_insights && healthData.cross_specialty_insights.length > 0 && (
                  <Card tone="intelligence">
                    <div className="flex items-center gap-2 mb-4">
                      <Link2 size={16} className="text-intelligence" />
                      <p className="font-display font-semibold text-ink">Cross-Specialty Insights</p>
                    </div>
                    <div className="space-y-4">
                      {healthData.cross_specialty_insights.map((ins, i) => (
                        <div key={i} className="border-t border-intelligence/15 pt-4 first:border-0 first:pt-0">
                          <p className="text-sm text-ink leading-relaxed"><BoldText text={ins.insight} /></p>
                          {ins.specialists?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {ins.specialists.map((s) => <Tag key={s} tone="intelligence">{s}</Tag>)}
                            </div>
                          )}
                          <p className="text-xs text-ink-soft mt-2">
                            <span className="font-semibold">Evidence: </span>
                            {ins.evidence}
                          </p>
                          {ins.other_possible_explanation && (
                            <p className="text-[11px] text-ink-faint mt-1">
                              <span className="font-semibold">Could also be: </span>
                              {ins.other_possible_explanation}
                            </p>
                          )}
                          <span className="text-[10px] font-semibold text-intelligence mt-1 inline-block font-data">
                            {ins.confidence}% confidence
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {healthData.points_of_agreement && healthData.points_of_agreement.length > 0 && (
                  <ListCard icon={Handshake} title="Where the Board Agreed" items={healthData.points_of_agreement} />
                )}
                {healthData.points_of_divergence && healthData.points_of_divergence.length > 0 && (
                  <ListCard icon={Shuffle} title="Where Reads Diverged" items={healthData.points_of_divergence} />
                )}
                {healthData.questions_worth_exploring_with_your_doctor && healthData.questions_worth_exploring_with_your_doctor.length > 0 && (
                  <ListCard icon={DoctorIcon} title="Questions for Your Doctor" items={healthData.questions_worth_exploring_with_your_doctor} />
                )}
              </>
            )}
          </>
        )}

        {/* ── QUESTIONS FOR YOU ─────────────────────────────── */}
        {questions.length > 0 && (
          <Card>
            <div className="flex items-center gap-2 mb-1">
              <MessageCircle size={16} className="text-primary" />
              <p className="font-display font-semibold text-ink">Questions For You</p>
            </div>
            <p className="text-xs text-ink-faint mb-4">
              Your answers feed directly into the next analysis — no need to answer them all at once.
            </p>
            <div className="space-y-4">
              {questions.map((q) => (
                <div key={q.id} className="border-t border-line pt-4 first:border-0 first:pt-0">
                  <p className="text-sm text-ink leading-relaxed mb-2">{q.question}</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      defaultValue={q.answer ?? ''}
                      onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                      placeholder="Your answer…"
                      className="flex-1 text-xs px-3 py-2 rounded-xl border border-line bg-surface-alt focus:outline-none focus:border-primary"
                    />
                    <button
                      onClick={() => saveAnswer(q)}
                      disabled={savingId === q.id}
                      className="text-xs font-semibold text-primary px-3 disabled:opacity-40"
                    >
                      {savingId === q.id ? '…' : 'Save'}
                    </button>
                  </div>
                  {q.answered_at && drafts[q.id] === undefined && (
                    <p className="text-[10px] text-primary mt-1">✓ Answered</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        <p className="text-center text-[10px] text-ink-faint pt-2 pb-4">
          Powered by Gemini · Not medical advice
        </p>
      </div>
    </div>
  )
}

// ─── Blood marker trend chart ─────────────────────────────────────
// Only rendered when there's a real trend to show: at least one flagged
// (abnormal/borderline) marker with 2+ historical data points. A single
// data point isn't a trend, and normal markers don't need a chart — this
// is meant to answer "is the thing worth watching moving?", not to be a
// dashboard of every number ever logged.

function BloodTrendChart({ history, flags }: {
  history: RawBloodReport[]
  flags?: { marker: string; status: string; note: string; suggest_doctor_discussion: boolean }[]
}) {
  if (history.length < 2) return null

  const flaggedNames = (flags ?? []).map((f) => f.marker)
  if (flaggedNames.length === 0) return null

  const sorted = [...history].sort((a, b) => a.report_date.localeCompare(b.report_date))

  // One series per flagged marker, each built ONLY from reports where that
  // specific marker actually appears — different markers get uploaded on
  // different dates, so a shared date axis across all of them would show
  // every report's date regardless of relevance. Capped at 3, matching the
  // validated chart-line palette.
  const series = flaggedNames.slice(0, 3).map((name) => {
    const points = sorted
      .map((r) => {
        const key = Object.keys(r.markers ?? {}).find((k) => k.toLowerCase() === name.toLowerCase())
        if (!key) return null
        return {
          date: new Date(r.report_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }),
          value: r.markers![key].value,
          unit: r.markers![key].unit,
        }
      })
      .filter((p): p is { date: string; value: number; unit: string } => p !== null)
    return { name, points, unit: points[points.length - 1]?.unit ?? '' }
  }).filter((s) => s.points.length >= 2) // a single point isn't a trend

  if (series.length === 0) return null

  return (
    <Card>
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp size={16} className="text-caution" />
        <p className="font-display font-semibold text-ink">Worth Watching</p>
      </div>
      <p className="text-xs text-ink-faint mb-4">Markers flagged outside range, tracked across your uploaded reports.</p>

      {/* Small multiples — each marker has its own scale (g/dL, µg/dL,
          mg/dL, ... are not comparable on one shared axis), so this is
          several small single-series charts, not one combined chart. A
          single series needs no legend — the title names it. */}
      <div className="space-y-5">
        {series.map((s, i) => (
          <div key={s.name}>
            <p className="text-xs font-semibold text-ink mb-1">
              {s.name} <span className="text-ink-faint font-normal font-data">({s.unit})</span>
            </p>
            <div style={{ width: '100%', height: 120 }}>
              <ResponsiveContainer>
                <LineChart data={s.points} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-ink-faint)' }} axisLine={{ stroke: 'var(--color-line)' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--color-ink-faint)' }} axisLine={false} tickLine={false} width={34} domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: '1px solid var(--color-line)', fontSize: 12, background: 'var(--color-surface)' }}
                    formatter={(value) => [`${value} ${s.unit}`, s.name]}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={CHART_LINE_COLORS[i % CHART_LINE_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ─── Lab Details panel (folded-in blood analysis) ───────────────────

function LabDetailsPanel({ bloodData, bloodBusy, bloodStatus, onRetry }: {
  bloodData: BloodInsight | null; bloodBusy: boolean; bloodStatus: AgentStatus; onRetry: () => void
}) {
  if (bloodBusy && !bloodData) return <LoadingCard message="Analysing your blood reports…" />
  if (bloodStatus === 'error') return <ErrorCard message="Couldn't load blood analysis." onRetry={onRetry} />
  if (!bloodData) return <p className="text-xs text-ink-faint">No data yet.</p>
  if (!bloodData.has_data) return <p className="text-xs text-ink-faint">{bloodData.message}</p>

  return (
    <div className="space-y-4">
      {bloodBusy && <UpdatingBadge label="Updating lab details…" />}

      {bloodData.previous_date && (
        <p className="text-xs text-ink-faint">
          Comparing {bloodData.previous_date} → {bloodData.latest_date}
        </p>
      )}
      <p className="text-sm text-ink leading-relaxed">{bloodData.overall_summary}</p>

      {bloodData.previous_date && (bloodData.improved?.length || bloodData.worsened?.length) ? (
        <div className="grid grid-cols-2 gap-3">
          {bloodData.improved && bloodData.improved.length > 0 && (
            <div className="bg-primary-soft rounded-2xl px-4 py-4">
              <p className="text-xs font-semibold text-primary mb-2">Improved</p>
              {bloodData.improved.map((m) => <p key={m} className="text-xs text-primary">{m}</p>)}
            </div>
          )}
          {bloodData.worsened && bloodData.worsened.length > 0 && (
            <div className="bg-flare-soft rounded-2xl px-4 py-4">
              <p className="text-xs font-semibold text-flare mb-2">Needs Attention</p>
              {bloodData.worsened.map((m) => <p key={m} className="text-xs text-flare">{m}</p>)}
            </div>
          )}
        </div>
      ) : null}

      {bloodData.by_system?.map((sys) => (
        <div key={sys.system} className="border border-line rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-line">
            <p className="font-semibold text-ink text-sm">{sys.system}</p>
            <p className="text-xs text-ink-faint mt-0.5">{sys.system_summary}</p>
          </div>
          <div className="px-4 pb-3 pt-2 space-y-3">
            {sys.markers.map((m) => (
              <div key={m.name} className="border-t border-line/60 pt-3 first:border-0 first:pt-1">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      m.status === 'normal' ? 'bg-primary'
                      : m.status.includes('borderline') ? 'bg-caution'
                      : 'bg-flare'
                    }`} />
                    <span className="text-sm font-medium text-ink">{m.name}</span>
                    {m.change && m.change !== 'stable' && m.change !== 'new' && (
                      <Tag tone={m.change === 'improved' ? 'data' : 'flare'} className="!px-1.5 !py-0">
                        {m.change === 'improved' ? '↑' : '↓'}
                      </Tag>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-semibold font-data ${m.status === 'normal' ? 'text-ink' : 'text-flare'}`}>
                      {m.value} {m.unit}
                    </span>
                    {m.reference && <p className="text-[10px] text-ink-faint font-data">{m.reference}</p>}
                  </div>
                </div>
                <p className="text-xs text-ink-soft leading-relaxed pl-3.5">{m.plain_language}</p>
                {m.previous_value !== undefined && (
                  <p className="text-[10px] text-ink-faint pl-3.5 mt-0.5 font-data">Previous: {m.previous_value} {m.unit}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {bloodData.flags && bloodData.flags.filter((f) => f.suggest_doctor_discussion).length > 0 && (
        <div className="bg-caution-soft rounded-2xl px-4 py-4">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertCircle size={14} className="text-caution" />
            <p className="text-xs font-semibold text-caution">Worth discussing with your doctor</p>
          </div>
          {bloodData.flags.filter((f) => f.suggest_doctor_discussion).map((f, i) => (
            <p key={i} className="text-xs text-caution mt-1">· {f.marker}: {f.note}</p>
          ))}
        </div>
      )}

      {bloodData.questions_for_doctor && bloodData.questions_for_doctor.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-ink-faint uppercase tracking-wide mb-2">Questions for Your Doctor</p>
          {bloodData.questions_for_doctor.map((q, i) => (
            <p key={i} className="text-xs text-ink-soft mb-1">→ {q}</p>
          ))}
        </div>
      )}

      {bloodData.disclaimer && (
        <p className="text-center text-[10px] text-ink-faint pt-2">{bloodData.disclaimer}</p>
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
          ? <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>
      )}
    </>
  )
}

function RenderValue({ value, compact = false }: { value: any; compact?: boolean }) {
  if (value === null || value === undefined || value === '') return null

  if (typeof value === 'string') {
    return <p className="text-xs text-ink-soft leading-relaxed"><BoldText text={value} /></p>
  }
  if (typeof value === 'number') {
    return <p className="text-xs text-ink-soft font-data">{value}</p>
  }
  if (typeof value === 'boolean') {
    return <p className="text-xs text-ink-soft">{value ? 'Yes' : 'No'}</p>
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return null
    return (
      <ul className="space-y-2">
        {value.map((item, i) => (
          <li key={i} className="flex gap-2 text-xs text-ink-soft leading-relaxed">
            <span className="text-intelligence flex-shrink-0 mt-0.5">•</span>
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
            <p className="text-[10px] font-bold text-ink-faint uppercase tracking-wide mb-0.5">
              {key.replace(/_/g, ' ')}
            </p>
          )}
          {compact && typeof val === 'string' ? (
            <p className="text-xs text-ink-soft leading-relaxed">
              <span className="font-semibold text-ink">{key.replace(/_/g, ' ')}: </span>
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
          <p className="text-[10px] font-bold text-ink-faint uppercase tracking-wide mb-1">
            {key.replace(/_/g, ' ')}
          </p>
          <RenderValue value={val} />
        </div>
      ))}
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  if (status === 'success') return <span className="w-1.5 h-1.5 rounded-full bg-primary" />
  if (status === 'error') return <span className="w-1.5 h-1.5 rounded-full bg-flare" />
  if (status === 'not_generated') return <span className="w-1.5 h-1.5 rounded-full bg-line" />
  return <span className="w-1.5 h-1.5 rounded-full bg-intelligence/50 animate-pulse" />
}

function InsightRow({ icon: Icon, label, text }: { icon: typeof TrendingUp; label: string; text: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className="text-intelligence" />
        <p className="text-xs font-semibold text-ink-soft uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-sm text-ink leading-relaxed pl-6"><BoldText text={text} /></p>
    </div>
  )
}

function ListCard({ icon: Icon, title, items }: { icon: typeof Handshake; title: string; items: string[] }) {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <Icon size={16} className="text-intelligence" />
        <p className="font-display font-semibold text-ink">{title}</p>
      </div>
      <div className="space-y-2.5">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2.5">
            <span className="text-intelligence flex-shrink-0">→</span>
            <p className="text-sm text-ink leading-relaxed">{item}</p>
          </div>
        ))}
      </div>
    </Card>
  )
}

function LoadingCard({ message }: { message: string }) {
  return (
    <Card className="flex flex-col items-center gap-3 py-8">
      <div className="w-6 h-6 border-2 border-intelligence border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-ink-faint">{message}</p>
    </Card>
  )
}

function UpdatingBadge({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <div className="w-3 h-3 border-2 border-intelligence/50 border-t-transparent rounded-full animate-spin" />
      <p className="text-xs text-intelligence font-medium">{label}</p>
    </div>
  )
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card tone="flare" className="text-center">
      <p className="text-flare font-medium text-sm">{message}</p>
      <button onClick={onRetry} className="mt-3 text-sm text-primary font-medium">Try again</button>
    </Card>
  )
}
