// app/weekly-photos/page.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { getWeeklyPhotos, uploadWeeklyPhoto, getAllWeeklyPhotoWeeks } from '../../lib/db'
import { mondayOfWeek, formatShort, addDays } from '../../lib/date'
import type { WeeklyPhoto, WeeklyPhotoType } from '../../types'

const PHOTO_TYPES: { key: WeeklyPhotoType; label: string; emoji: string; hint: string }[] = [
  { key: 'acne',   label: 'Acne',         emoji: '🫧', hint: 'Face, same angle each week' },
  { key: 'tongue', label: 'Tongue',        emoji: '👅', hint: 'Morning, before food/drink' },
  { key: 'flare',  label: 'Active Flare',  emoji: '🔥', hint: 'If you have an active flare' },
  { key: 'body',   label: 'Body',          emoji: '🪞', hint: 'Optional — consistent lighting' },
]

export default function WeeklyPhotosPage() {
  const [currentWeek] = useState(mondayOfWeek())
  const [selectedWeek, setSelectedWeek] = useState(mondayOfWeek())
  const [allWeeks, setAllWeeks]         = useState<string[]>([])
  const [photos, setPhotos]             = useState<WeeklyPhoto[]>([])
  const [uploading, setUploading]       = useState<WeeklyPhotoType | null>(null)
  const [loading, setLoading]           = useState(true)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    getAllWeeklyPhotoWeeks().then((weeks) => {
      const withCurrent = weeks.includes(currentWeek)
        ? weeks : [currentWeek, ...weeks]
      setAllWeeks(withCurrent)
    })
  }, [])

  useEffect(() => {
    setLoading(true)
    getWeeklyPhotos(selectedWeek).then((p) => {
      setPhotos(p)
      setLoading(false)
    })
  }, [selectedWeek])

  const handleUpload = async (type: WeeklyPhotoType, file: File) => {
    setUploading(type)
    try {
      const p = await uploadWeeklyPhoto(selectedWeek, type, file)
      setPhotos((prev) => [...prev.filter((x) => x.photo_type !== type), p])
      if (!allWeeks.includes(selectedWeek)) {
        setAllWeeks((prev) => [selectedWeek, ...prev])
      }
    } finally {
      setUploading(null)
    }
  }

  const weekLabel = (iso: string) => {
    const end = addDays(iso, 6)
    return `${formatShort(iso)} – ${formatShort(end)}`
  }

  const photoFor = (type: WeeklyPhotoType) =>
    photos.find((p) => p.photo_type === type)

  return (
    <div className="min-h-screen bg-[#F7F8FC] pb-28">
      <div className="px-5 pt-10 pb-6">
        <p className="text-xs font-semibold tracking-widest text-blue-600 uppercase mb-1">
          Weekly
        </p>
        <h1 className="text-3xl font-bold text-slate-900">Health Photos</h1>
        <p className="text-sm text-slate-400 mt-1">
          Consistent weekly photos reveal patterns over time.
        </p>
      </div>

      <div className="px-4 space-y-4">

        {/* Week selector */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {allWeeks.map((w) => (
            <button
              key={w}
              onClick={() => setSelectedWeek(w)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold
                transition-all ${selectedWeek === w
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600'}`}
            >
              {w === currentWeek ? 'This week' : weekLabel(w)}
            </button>
          ))}
        </div>

        {/* Photo grid */}
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
                      <img
                        src={existing.photo_url} alt={label}
                        className="w-full aspect-square object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <p className="text-white text-xs font-semibold">{emoji} {label}</p>
                      </div>
                      {/* Replace photo */}
                      <button
                        onClick={() => fileRefs.current[key]?.click()}
                        className="absolute top-2 right-2 w-7 h-7 bg-white/90 rounded-full
                          flex items-center justify-center shadow"
                      >
                        <svg className="w-3.5 h-3.5 text-slate-700" viewBox="0 0 14 14" fill="none">
                          <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileRefs.current[key]?.click()}
                      disabled={isUploading}
                      className="w-full aspect-square flex flex-col items-center justify-center
                        gap-2 p-4 hover:bg-slate-50 transition-colors"
                    >
                      {isUploading ? (
                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent
                          rounded-full animate-spin" />
                      ) : (
                        <>
                          <span className="text-3xl">{emoji}</span>
                          <p className="text-sm font-semibold text-slate-700">{label}</p>
                          <p className="text-[10px] text-slate-400 text-center">{hint}</p>
                          <div className="mt-1 w-8 h-8 rounded-full bg-blue-50 flex items-center
                            justify-center">
                            <svg className="w-4 h-4 text-blue-600" viewBox="0 0 16 16" fill="none">
                              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                          </div>
                        </>
                      )}
                    </button>
                  )}
                  <input
                    ref={(el) => { fileRefs.current[key] = el }}
                    type="file" accept="image/*" className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleUpload(key, f)
                      if (e.target) e.target.value = ''
                    }}
                  />
                </div>
              )
            })}
          </div>
        )}

        {/* Tip */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
          <p className="text-xs text-blue-700 font-medium">
            💡 Tip: Take tongue photos first thing in the morning, before eating or drinking.
            Same lighting and angle each week makes comparison much more meaningful.
          </p>
        </div>
      </div>
    </div>
  )
}