// app/sign-in/page.tsx
'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function SignInPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    <div className="min-h-screen bg-bg flex items-center justify-center px-6">
      <div className="w-full max-w-sm bg-surface rounded-3xl border border-line shadow-sm px-6 py-10 text-center">
        <p className="text-xs font-semibold tracking-widest text-primary uppercase mb-2">
          Flarewise
        </p>
        <h1 className="text-2xl font-bold text-ink mb-2">Your health journey, understood</h1>
        <p className="text-sm text-ink-soft leading-5 mb-8">
          Sign in to continue tracking patterns over time.
        </p>

        <button
          type="button"
          onClick={handleSignIn}
          disabled={loading}
          className="w-full h-12 rounded-2xl border border-line bg-surface text-ink
            text-sm font-semibold flex items-center justify-center gap-3
            hover:border-line transition-colors disabled:opacity-50"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-line border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 20 20">
                <path fill="#4285F4" d="M19.6 10.23c0-.68-.06-1.32-.17-1.94H10v3.67h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.9-1.75 2.99-4.32 2.99-7.25Z" />
                <path fill="#34A853" d="M10 20c2.7 0 4.96-.9 6.61-2.42l-3.23-2.5c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.75-5.59-4.11H1.07v2.59A10 10 0 0 0 0 10c0 1.61.39 3.14 1.07 4.52l3.34-2.59Z" />
                <path fill="#FBBC05" d="M4.41 11.93A5.98 5.98 0 0 1 4.09 10c0-.67.12-1.32.32-1.93V5.48H1.07A10 10 0 0 0 0 10c0 1.61.39 3.14 1.07 4.52l3.34-2.59Z" />
                <path fill="#EA4335" d="M10 3.96c1.47 0 2.79.5 3.83 1.49l2.87-2.87C14.95.99 12.7 0 10 0 6.09 0 2.71 2.24 1.07 5.48l3.34 2.59Z" />
              </svg>
              Continue with Google
            </>
          )}
        </button>

        {error && <p className="text-xs text-flare mt-4">{error}</p>}

        <p className="text-xs text-ink-faint mt-8 leading-4">
          Your health journey stays private to your account.
        </p>
      </div>
    </div>
  )
}
