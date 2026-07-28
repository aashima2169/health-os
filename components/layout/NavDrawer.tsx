// components/layout/NavDrawer.tsx
// Bottom-sheet navigation drawer, opened from BottomNav's Settings tab.
// Holds everything that isn't a primary tab: Profile, About, list
// customisation, and Sign Out — the app's "more" menu.
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

interface NavDrawerProps {
  open: boolean
  onClose: () => void
}

const ITEMS: { href: string; emoji: string; label: string; subtitle: string }[] = [
  { href: '/profile', emoji: '🧑', label: 'Your Profile', subtitle: 'Demographics, conditions, medications' },
  { href: '/about', emoji: '💬', label: 'About Flarewise', subtitle: 'Why this exists' },
  { href: '/settings', emoji: '🛠️', label: 'Customise Lists', subtitle: 'Edit the options you pick from day to day' },
]

export default function NavDrawer({ open, onClose }: NavDrawerProps) {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    await supabase.auth.signOut()
    onClose()
    router.push('/sign-in')
  }

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-ink/30 z-40 transition-opacity duration-200
          ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto
          bg-surface rounded-t-3xl shadow-lg px-4 pt-3 pb-8
          transition-transform duration-200 ease-out
          ${open ? 'translate-y-0' : 'translate-y-full pointer-events-none'}`}
      >
        <div className="w-10 h-1 bg-line rounded-full mx-auto mb-4" />

        <div className="space-y-2">
          {ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="flex items-center justify-between bg-surface-alt rounded-2xl px-4 py-3.5"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{item.emoji}</span>
                <div>
                  <p className="font-semibold text-[15px] text-ink">{item.label}</p>
                  <p className="text-xs text-ink-faint">{item.subtitle}</p>
                </div>
              </div>
              <svg className="w-4 h-4 text-ink-faint" viewBox="0 0 16 16" fill="none">
                <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          ))}

          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full bg-surface-alt rounded-2xl px-4 py-3.5 text-left text-sm
              font-semibold text-flare disabled:opacity-50"
          >
            {signingOut ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>
      </div>
    </>
  )
}
