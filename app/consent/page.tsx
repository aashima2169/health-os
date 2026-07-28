// app/consent/page.tsx
// One-time flow shown right after a first-ever sign-in, before the person
// can reach the rest of the app — see middleware.ts for the redirect logic
// that sends them here (and never again, once user_consent has a row for
// their account). Three brief tutorial slides, then the actual consent
// step — all gated by the same single DB insert at the end, so no new
// persistence mechanism was needed for the tutorial part.
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Compass, ClipboardCheck, Sparkles } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const SLIDES = [
  {
    icon: Compass,
    title: 'Welcome to Flarewise',
    body: "This isn't a symptom tracker. It's an investigation engine — built to help you understand why chronic symptoms happen, by reasoning across months of what you log.",
  },
  {
    icon: ClipboardCheck,
    title: 'Check in daily',
    body: 'A couple of minutes a day — sleep, mood, movement, diet, anything that feels off. The more consistently you log, the clearer your own patterns become.',
  },
  {
    icon: Sparkles,
    title: 'Discover your patterns',
    body: "Signals looks across weeks of your data to surface possible connections worth investigating. Always hypotheses, never diagnoses — you're always the one who decides what they mean.",
  },
]

const TOTAL_STEPS = SLIDES.length + 1 // + the consent step

export default function ConsentPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [consented, setConsented] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleContinue = async () => {
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('user_consent').insert({})
    // 23505 = unique_violation — a row for this account already exists
    // (e.g. a prior attempt succeeded but a redirect hiccup brought them
    // back here). That's not a failure, it just means they're already
    // consented — proceed exactly as if this insert had succeeded.
    if (error && error.code !== '23505') {
      setError('Something went wrong — please try again.')
      setSaving(false)
      return
    }
    router.push('/')
  }

  const onLastSlide = step === SLIDES.length
  const slide = SLIDES[step]

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-6">
      <div className="w-full max-w-sm bg-surface rounded-3xl border border-line shadow-sm px-6 py-10">
        <p className="text-xs font-semibold tracking-widest text-primary uppercase mb-2 text-center">
          Flarewise
        </p>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 mb-6">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-6 bg-primary' : i < step ? 'w-1.5 bg-primary/40' : 'w-1.5 bg-line'
              }`}
            />
          ))}
        </div>

        {!onLastSlide ? (
          <>
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-primary-soft flex items-center justify-center mb-5">
                <slide.icon size={26} className="text-primary" />
              </div>
              <h1 className="font-display text-xl font-semibold text-ink mb-2">{slide.title}</h1>
              <p className="text-sm text-ink-soft leading-6">{slide.body}</p>
            </div>

            <div className="flex gap-2">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="h-12 px-5 rounded-2xl border border-line text-ink-soft text-sm font-semibold"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="flex-1 h-12 rounded-2xl bg-primary text-white text-sm font-semibold"
              >
                {step === SLIDES.length - 1 ? "Let's go" : 'Next'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-left bg-surface-alt border border-line rounded-2xl px-4 py-4 mb-5">
              <p className="text-xs font-semibold text-ink mb-2">Data Consent</p>
              <p className="text-xs text-ink-soft leading-5 mb-2">
                Flarewise is an early-stage prototype built by one person. Here&apos;s what happens to your data:
              </p>
              <ul className="text-xs text-ink-soft leading-5 space-y-1.5 mb-2">
                <li><span className="font-medium text-ink">What&apos;s collected:</span> Symptoms, flares, diet, sleep, stress, and cycle data you log.</li>
                <li><span className="font-medium text-ink">What it&apos;s used for:</span> Generating personal flare/symptom hypotheses for you, and improving Flarewise using anonymized, aggregated patterns across users.</li>
                <li><span className="font-medium text-ink">Who sees it:</span> Only you and me (the builder), while actively developing this prototype.</li>
                <li><span className="font-medium text-ink">Not medical advice:</span> This is not a diagnosis or medical device. Please discuss any insights with your doctor before changing treatment, diet, or medication.</li>
                <li><span className="font-medium text-ink">Your control:</span> Email flarewise.app@gmail.com anytime to delete your account and data — no questions asked.</li>
              </ul>
              <label className="flex items-start gap-2.5 mt-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consented}
                  onChange={(e) => setConsented(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-line text-primary focus:ring-primary flex-shrink-0"
                />
                <span className="text-xs text-ink-soft leading-5">
                  I understand this is an early prototype, not medical advice, and I consent to my data being used as described above.
                </span>
              </label>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="h-12 px-5 rounded-2xl border border-line text-ink-soft text-sm font-semibold"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleContinue}
                disabled={saving || !consented}
                className="flex-1 h-12 rounded-2xl bg-primary text-white text-sm font-semibold
                  flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
              >
                {saving ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>Continue →</>
                )}
              </button>
            </div>

            {error && <p className="text-xs text-flare mt-4 text-center">{error}</p>}
          </>
        )}
      </div>
    </div>
  )
}
