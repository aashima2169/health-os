// components/layout/BottomNav.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  {
    href: '/today', label: 'Check-in',
    icon: (a: boolean) => (
      <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="3" width="14" height="14" rx="3" stroke={a ? '#2563EB' : '#94a3b8'} strokeWidth="1.6" />
        <path d="M7 10l2 2 4-4" stroke={a ? '#2563EB' : '#94a3b8'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/history', label: 'History',
    icon: (a: boolean) => (
      <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
        <path d="M10 6v4l2.5 2.5" stroke={a ? '#2563EB' : '#94a3b8'} strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="10" cy="10" r="7" stroke={a ? '#2563EB' : '#94a3b8'} strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    href: '/health-events', label: 'Events',
    icon: (a: boolean) => (
      <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
        <path d="M11 2L4 12h5l-1 6 7-10h-5l1-6z" stroke={a ? '#2563EB' : '#94a3b8'} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/insights', label: 'Insights',
    icon: (a: boolean) => (
      <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
        <path d="M3 14l4-4 3 3 4-5 3 3" stroke={a ? '#2563EB' : '#94a3b8'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/settings', label: 'Settings',
    icon: (a: boolean) => (
      <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="2.5" stroke={a ? '#2563EB' : '#94a3b8'} strokeWidth="1.6" />
        <path d="M10 3v1.5M10 15.5V17M3 10h1.5M15.5 10H17M4.93 4.93l1.06 1.06M14.01 14.01l1.06 1.06M4.93 15.07l1.06-1.06M14.01 5.99l1.06-1.06"
          stroke={a ? '#2563EB' : '#94a3b8'} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 z-50">
      <div className="max-w-lg mx-auto flex">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href)
          return (
            <Link key={tab.href} href={tab.href}
              className="flex-1 flex flex-col items-center justify-center py-3 gap-1">
              {tab.icon(active)}
              <span className={`text-[10px] font-medium ${active ? 'text-blue-600' : 'text-slate-400'}`}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}