// app/consent/page.tsx
// One-time interstitial shown right after a first-ever sign-in, before the
// person can reach the rest of the app — see middleware.ts for the redirect
// logic that sends them here (and never again, once user_consent has a row
// for their account).
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function ConsentPage() {
  const router = useRouter()
  const [consented, setConsented] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleContinue = async () => {
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('user_consent').insert({})
    if (error) {
      setError('Something went wrong — please try again.')
      setSaving(false)
      return
    }
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-[#F7F8FC] flex items-center justify-center px-6">
      <div className="w-full max-w-sm bg-white rounded-3xl border border-slate-100 shadow-sm px-6 py-10">
        <p className="text-xs font-semibold tracking-widest text-blue-600 uppercase mb-2 text-center">
          Flarewise
        </p>

        <div className="text-left bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 mb-5">
          <p className="text-xs font-semibold text-slate-700 mb-2">Data Consent</p>
          <p className="text-xs text-slate-500 leading-5 mb-2">
            Flarewise is an early-stage prototype built by one person. Here&apos;s what happens to your data:
          </p>
          <ul className="text-xs text-slate-500 leading-5 space-y-1.5 mb-2">
            <li><span className="font-medium text-slate-600">What&apos;s collected:</span> Symptoms, flares, diet, sleep, stress, and cycle data you log.</li>
            <li><span className="font-medium text-slate-600">What it&apos;s used for:</span> Generating personal flare/symptom hypotheses for you, and improving Flarewise using anonymized, aggregated patterns across users.</li>
            <li><span className="font-medium text-slate-600">Who sees it:</span> Only you and me (the builder), while actively developing this prototype.</li>
            <li><span className="font-medium text-slate-600">Not medical advice:</span> This is not a diagnosis or medical device. Please discuss any insights with your doctor before changing treatment, diet, or medication.</li>
            <li><span className="font-medium text-slate-600">Your control:</span> Email flarewise.app@gmail.com anytime to delete your account and data — no questions asked.</li>
          </ul>
          <label className="flex items-start gap-2.5 mt-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consented}
              onChange={(e) => setConsented(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
            />
            <span className="text-xs text-slate-600 leading-5">
              I understand this is an early prototype, not medical advice, and I consent to my data being used as described above.
            </span>
          </label>
        </div>

        <button
          type="button"
          onClick={handleContinue}
          disabled={saving || !consented}
          className="w-full h-12 rounded-2xl bg-blue-600 text-white text-sm font-semibold
            flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
        >
          {saving ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>Continue →</>
          )}
        </button>

        {error && <p className="text-xs text-red-500 mt-4 text-center">{error}</p>}
      </div>
    </div>
  )
}
