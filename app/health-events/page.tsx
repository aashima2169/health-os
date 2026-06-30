// app/health-events/page.tsx
// UPDATED: now 3 tabs — Events, Periods, Photos (weekly acne/tongue/flare/body)
'use client'

import { useEffect, useRef, useState } from 'react'
import {
  getAllHealthEvents, upsertHealthEvent, deleteHealthEvent,
  uploadEventPhoto, getEventPhotos, getMasters,
  getAllPeriods, upsertPeriod, deletePeriod, getActivePeriod,
  getWeeklyPhotos, uploadWeeklyPhoto, getAllWeeklyPhotoWeeks,
} from '../../lib/db'
import { todayISO, cycleDayOf, daysBetween, addDays, mondayOfWeek, formatShort } from '../../lib/date'
import SeveritySlider from '../../components/shared/SeveritySlider'
import Chip from '../../components/shared/Chip'
import BloodReportsTab from '../../components/health-events/BloodReportsTab'
import type { HealthEvent, HealthEventPhoto, Period, WeeklyPhoto, WeeklyPhotoType } from '../../types'

type Tab = 'events' | 'periods' | 'photos' | 'blood'

export default function HealthEventsPage() {
  const [tab, setTab] = useState<Tab>('events')

  return (
    <div className="min-h-screen bg-[#F7F8FC] pb-28">
      <div className="px-5 pt-10 pb-5">
        <p className="text-xs font-semibold tracking-widest text-blue-600 uppercase mb-1">
          Health Events
        </p>
        <h1 className="text-3xl font-bold text-slate-900">Events & Cycle</h1>
        <p className="text-sm text-slate-400 mt-1">Flares, periods, photos, blood reports</p>
      </div>

      {/* Tab switcher */}
      <div className="px-4 mb-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-1 flex shadow-sm overflow-x-auto">
          <button
            onClick={() => setTab('events')}
            className={`flex-1 h-10 rounded-xl text-xs font-semibold transition-all whitespace-nowrap px-2
              ${tab === 'events' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500'}`}
          >
            ⚡ Events
          </button>
          <button
            onClick={() => setTab('periods')}
            className={`flex-1 h-10 rounded-xl text-xs font-semibold transition-all whitespace-nowrap px-2
              ${tab === 'periods' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500'}`}
          >
            🌸 Periods
          </button>
          <button
            onClick={() => setTab('photos')}
            className={`flex-1 h-10 rounded-xl text-xs font-semibold transition-all whitespace-nowrap px-2
              ${tab === 'photos' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500'}`}
          >
            📸 Photos
          </button>
          <button
            onClick={() => setTab('blood')}
            className={`flex-1 h-10 rounded-xl text-xs font-semibold transition-all whitespace-nowrap px-2
              ${tab === 'blood' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500'}`}
          >
            🩸 Blood
          </button>
        </div>
      </div>

      {tab === 'events' && <EventsTab />}
      {tab === 'periods' && <PeriodsTab />}
      {tab === 'photos' && <PhotosTab />}
      {tab === 'blood' && <BloodReportsTab />}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// EVENTS TAB (flares, migraines, etc. — photo upload built in)
// ════════════════════════════════════════════════════════════

function EventsTab() {
  const [events, setEvents]           = useState<HealthEvent[]>([])
  const [eventTypes, setEventTypes]   = useState<string[]>([])
  const [bodyLocations, setBodyLocations] = useState<string[]>([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)

  const [eventType, setEventType]     = useState('')
  const [customType, setCustomType]   = useState('')
  const [startDate, setStartDate]     = useState('')
  const [endDate, setEndDate]         = useState('')
  const [severity, setSeverity]       = useState<number | null>(null)
  const [status, setStatus]           = useState<'new' | 'existing'>('new')
  const [bodyLocation, setBodyLocation] = useState('')
  const [notes, setNotes]             = useState('')
  const [saving, setSaving]           = useState(false)

  useEffect(() => {
    Promise.all([
      getAllHealthEvents(),
      getMasters('health_event_type'),
      getMasters('body_location'),
    ]).then(([evts, types, locs]) => {
      setEvents(evts); setEventTypes(types); setBodyLocations(locs); setLoading(false)
    })
  }, [])

  const resetForm = () => {
    setEventType(''); setCustomType(''); setStartDate(''); setEndDate('')
    setSeverity(null); setStatus('new'); setBodyLocation(''); setNotes('')
    setShowForm(false)
  }

  const handleSave = async () => {
    if (!startDate) return
    setSaving(true)
    const type = eventType === 'custom' ? customType : eventType
    try {
      const { data } = await upsertHealthEvent({
        event_type: type, start_date: startDate, end_date: endDate || null,
        severity, status, body_location: bodyLocation || null, notes: notes || null,
      }) as any
      setEvents((prev) => [data, ...prev.filter((e) => e.id !== data.id)])
      resetForm()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this health event?')) return
    await deleteHealthEvent(id)
    setEvents((prev) => prev.filter((e) => e.id !== id))
  }

  const today = todayISO()

  return (
    <div className="px-4 space-y-3">
      <button
        onClick={() => setShowForm((s) => !s)}
        className="w-full h-12 rounded-2xl border-2 border-dashed border-blue-200
          text-blue-600 text-sm font-semibold flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none">
          <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Log a health event
      </button>

      {showForm && (
        <div className="bg-white rounded-2xl border border-blue-100 shadow-sm px-5 py-5">
          <p className="font-semibold text-slate-900 mb-4">Log Health Event</p>

          <div className="mb-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              What happened?
            </p>
            <div className="flex flex-wrap gap-2">
              {eventTypes.map((t) => (
                <Chip key={t} label={t} selected={eventType === t}
                  onToggle={() => setEventType(eventType === t ? '' : t)} />
              ))}
              <Chip label="✏️ Custom" selected={eventType === 'custom'}
                onToggle={() => setEventType(eventType === 'custom' ? '' : 'custom')} />
            </div>
            {eventType === 'custom' && (
              <input
                type="text" value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                placeholder="Describe the event…"
                className="mt-3 w-full h-11 px-4 rounded-xl border border-slate-200
                  bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          <div className="mb-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Status
            </p>
            <div className="flex gap-2">
              {(['new', 'existing'] as const).map((s) => (
                <button key={s} type="button" onClick={() => setStatus(s)}
                  className={`flex-1 h-10 rounded-xl text-sm font-semibold capitalize
                    transition-all ${status === s
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-50 border border-slate-200 text-slate-600'}`}>
                  {s === 'new' ? '🆕 New' : '🔄 Existing'}
                </button>
              ))}
            </div>
          </div>

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

          <div className="mb-4">
            <SeveritySlider value={severity} onChange={setSeverity} />
          </div>

          <div className="mb-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Body location (optional)
            </p>
            <div className="flex flex-wrap gap-2">
              {bodyLocations.map((loc) => (
                <Chip key={loc} label={loc} size="sm"
                  selected={bodyLocation === loc}
                  onToggle={() => setBodyLocation(bodyLocation === loc ? '' : loc)} />
              ))}
            </div>
          </div>

          <div className="mb-4">
            <p className="text-xs font-medium text-slate-500 mb-1.5">Notes (optional)</p>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Any details worth remembering…" rows={2}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50
                text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <p className="text-xs text-slate-400 mb-4 bg-slate-50 rounded-xl px-3 py-2.5">
            📸 You can add photos of the flare right after saving — the event card
            below will have a photo upload button once it's created.
          </p>

          <div className="flex gap-2">
            <button onClick={resetForm}
              className="flex-1 h-12 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving || !startDate}
              className="flex-1 h-12 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Event'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-medium text-slate-700">No events logged yet</p>
          <p className="text-sm text-slate-400 mt-1">Tap above to log a flare, migraine, or any health event.</p>
        </div>
      ) : (
        events.map((event) => (
          <EventCard key={event.id} event={event} onDelete={() => handleDelete(event.id)} />
        ))
      )}
    </div>
  )
}

function EventCard({ event, onDelete }: { event: HealthEvent; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(true)   // open by default so photo upload is visible immediately
  const fileRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<HealthEventPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const loadPhotos = async () => { setPhotos(await getEventPhotos(event.id)); setLoaded(true) }
  useEffect(() => { if (expanded && !loaded) loadPhotos() }, [expanded])

  const handlePhotoUpload = async (file: File) => {
    setUploading(true)
    try {
      const p = await uploadEventPhoto(event.id, file, todayISO())
      setPhotos((prev) => [...prev, p])
    } finally {
      setUploading(false)
    }
  }

  const startDisplay = new Date(event.start_date + 'T00:00:00')
    .toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  const SEVERITY_LABELS = ['', 'Mild', 'Low', 'Moderate', 'High', 'Severe']
  const SEVERITY_COLORS = ['', 'text-green-600', 'text-lime-600', 'text-yellow-600',
    'text-orange-600', 'text-red-600']

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button type="button" onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
            <span className="text-lg">⚡</span>
          </div>
          <div className="text-left">
            <p className="font-semibold text-[15px] text-slate-900">{event.event_type}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-400">{startDisplay}</span>
              {event.severity && (
                <span className={`text-xs font-semibold ${SEVERITY_COLORS[event.severity]}`}>
                  · {SEVERITY_LABELS[event.severity]}
                </span>
              )}
              {event.status === 'new' && (
                <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">
                  New
                </span>
              )}
              {photos.length > 0 && (
                <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full font-medium">
                  📸 {photos.length}
                </span>
              )}
            </div>
          </div>
        </div>
        <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200
          ${expanded ? 'rotate-180' : ''}`} viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-3">
          {event.body_location && <DetailRow label="Location" value={event.body_location} />}
          {event.end_date && (
            <DetailRow label="Ended" value={new Date(event.end_date + 'T00:00:00')
              .toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} />
          )}
          {event.notes && <DetailRow label="Notes" value={event.notes} />}

          {/* Photo upload — this is where flare photos go */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Photos
            </p>
            <div className="flex gap-2 flex-wrap">
              {photos.map((p) => (
                <a key={p.id} href={p.photo_url} target="_blank" rel="noopener noreferrer">
                  <img src={p.photo_url} alt="event photo"
                    className="w-16 h-16 object-cover rounded-xl border border-slate-200" />
                </a>
              ))}
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="w-16 h-16 rounded-xl border-2 border-dashed border-blue-200
                  flex flex-col items-center justify-center gap-0.5 text-blue-400
                  hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-50">
                {uploading ? (
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none">
                      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <span className="text-[9px] font-medium">Add</span>
                  </>
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f) }} />
            </div>
          </div>

          <button onClick={onDelete} className="text-xs text-red-400 font-medium pt-1">
            Delete event
          </button>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// PERIODS TAB
// ════════════════════════════════════════════════════════════

function PeriodsTab() {
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
      setPeriods(all); setActive(act); setLoading(false)
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
    ? addDays(lastPeriodStart, avgCycleLength) : null

  return (
    <div className="px-4 space-y-3">
      <button
        onClick={() => setShowForm((s) => !s)}
        className="w-full h-12 rounded-2xl border-2 border-dashed border-rose-200
          text-rose-600 text-sm font-semibold flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none">
          <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Log a period
      </button>

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
                : '—'}
            />
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-2xl border border-rose-100 shadow-sm px-5 py-5">
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

      {!loading && periods.length === 0 && !showForm && (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🌸</p>
          <p className="font-medium text-slate-700">No periods logged yet</p>
          <p className="text-sm text-slate-400 mt-1">Tap above to log your first period.</p>
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
                  : 'Ongoing'}
              </p>
            </div>
            <button onClick={() => handleDelete(p.id)} className="text-xs text-red-400 font-medium">
              Delete
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// PHOTOS TAB (weekly acne / tongue / flare / body)
// ════════════════════════════════════════════════════════════

const PHOTO_TYPES: { key: WeeklyPhotoType; label: string; emoji: string; hint: string }[] = [
  { key: 'acne',   label: 'Cheeks / Skin', emoji: '🫧', hint: 'Same angle each week' },
  { key: 'tongue', label: 'Tongue',        emoji: '👅', hint: 'Morning, before food/drink' },
  { key: 'flare',  label: 'Active Flare',  emoji: '🔥', hint: 'If you have an active flare' },
  { key: 'body',   label: 'Body',          emoji: '🪞', hint: 'Optional — consistent lighting' },
]

function PhotosTab() {
  const currentWeek = mondayOfWeek()
  const [selectedWeek, setSelectedWeek] = useState(currentWeek)
  const [allWeeks, setAllWeeks]         = useState<string[]>([])
  const [photos, setPhotos]             = useState<WeeklyPhoto[]>([])
  const [uploading, setUploading]       = useState<WeeklyPhotoType | null>(null)
  const [loading, setLoading]           = useState(true)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    getAllWeeklyPhotoWeeks().then((weeks) => {
      setAllWeeks(weeks.includes(currentWeek) ? weeks : [currentWeek, ...weeks])
    })
  }, [])

  useEffect(() => {
    setLoading(true)
    getWeeklyPhotos(selectedWeek).then((p) => { setPhotos(p); setLoading(false) })
  }, [selectedWeek])

  const handleUpload = async (type: WeeklyPhotoType, file: File) => {
    setUploading(type)
    try {
      const p = await uploadWeeklyPhoto(selectedWeek, type, file)
      setPhotos((prev) => [...prev.filter((x) => x.photo_type !== type), p])
      if (!allWeeks.includes(selectedWeek)) setAllWeeks((prev) => [selectedWeek, ...prev])
    } finally {
      setUploading(null)
    }
  }

  const weekLabel = (iso: string) => `${formatShort(iso)} – ${formatShort(addDays(iso, 6))}`
  const photoFor = (type: WeeklyPhotoType) => photos.find((p) => p.photo_type === type)

  return (
    <div className="px-4 space-y-4">
      {/* Week selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {allWeeks.map((w) => (
          <button key={w} onClick={() => setSelectedWeek(w)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold
              transition-all ${selectedWeek === w
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600'}`}>
            {w === currentWeek ? 'This week' : weekLabel(w)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {PHOTO_TYPES.map(({ key, label, emoji, hint }) => {
            const existing = photoFor(key)
            const isUploading = uploading === key

            return (
              <div key={key} className="bg-white rounded-2xl border border-slate-100
                shadow-sm overflow-hidden">
                {existing ? (
                  <div className="relative">
                    <img src={existing.photo_url} alt={label}
                      className="w-full aspect-square object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-2">
                      <p className="text-white text-xs font-semibold">{emoji} {label}</p>
                    </div>
                    <button onClick={() => fileRefs.current[key]?.click()}
                      className="absolute top-2 right-2 w-7 h-7 bg-white/90 rounded-full
                        flex items-center justify-center shadow">
                      <svg className="w-3.5 h-3.5 text-slate-700" viewBox="0 0 14 14" fill="none">
                        <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <button onClick={() => fileRefs.current[key]?.click()} disabled={isUploading}
                    className="w-full aspect-square flex flex-col items-center justify-center
                      gap-2 p-4 hover:bg-slate-50 transition-colors">
                    {isUploading ? (
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent
                        rounded-full animate-spin" />
                    ) : (
                      <>
                        <span className="text-3xl">{emoji}</span>
                        <p className="text-sm font-semibold text-slate-700">{label}</p>
                        <p className="text-[10px] text-slate-400 text-center">{hint}</p>
                        <div className="mt-1 w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                          <svg className="w-4 h-4 text-blue-600" viewBox="0 0 16 16" fill="none">
                            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </div>
                      </>
                    )}
                  </button>
                )}
                <input ref={(el) => { fileRefs.current[key] = el }}
                  type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleUpload(key, f)
                    if (e.target) e.target.value = ''
                  }} />
              </div>
            )
          })}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
        <p className="text-xs text-blue-700 font-medium">
          💡 Take tongue photos first thing in the morning, before eating or drinking.
          Same lighting and angle each week makes comparison far more meaningful.
        </p>
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide w-20 flex-shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-sm text-slate-700">{value}</span>
    </div>
  )
}