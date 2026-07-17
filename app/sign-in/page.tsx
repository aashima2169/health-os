// app/sign-in/page.tsx
'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function SignInPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [consented, setConsented] = useState(false)

  const handleSignIn = async () => {
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) throw error
    } catch (err) {
      setError('Something went wrong — please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F8FC] flex items-center justify-center px-6">
      <div className="w-full max-w-sm bg-white rounded-3xl border border-slate-100 shadow-sm px-6 py-10 text-center">
        <p className="text-xs font-semibold tracking-widest text-blue-600 uppercase mb-2">
          Flarewise
        </p>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Your health journey, understood</h1>
        <p className="text-sm text-slate-500 leading-5 mb-8">
          Sign in to continue tracking patterns over time.
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
          onClick={handleSignIn}
          disabled={loading || !consented}
          className="w-full h-12 rounded-2xl border border-slate-200 bg-white text-slate-700
            text-sm font-semibold flex items-center justify-center gap-3
            hover:border-slate-300 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 20 20">
                <path fill="#4285F4" d="M19.6 10.23c0-.68-.06-1.32-.17-1.94H10v3.67h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.9-1.75 2.99-4.32 2.99-7.25Z" />
                <path fill="#34A853" d="M10 20c2.7 0 4.96-.9 6.61-2.42l-3.23-2.5c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.75-5.59-4.11H1.07v2.59A10 10 0 0 0 10 20Z" />
                <path fill="#FBBC05" d="M4.41 11.93A5.98 5.98 0 0 1 4.09 10c0-.67.12-1.32.32-1.93V5.48H1.07A10 10 0 0 0 0 10c0 1.61.39 3.14 1.07 4.52l3.34-2.59Z" />
                <path fill="#EA4335" d="M10 3.96c1.47 0 2.79.5 3.83 1.49l2.87-2.87C14.95.99 12.7 0 10 0 6.09 0 2.71 2.24 1.07 5.48l3.34 2.59C5.2 5.71 7.4 3.96 10 3.96Z" />
              </svg>
              Continue with Google
            </>
          )}
        </button>

        {error && <p className="text-xs text-red-500 mt-4">{error}</p>}

        <p className="text-xs text-slate-300 mt-8 leading-4">
          Your health journey stays private to your account.
        </p>
      </div>
    </div>
  )
}
