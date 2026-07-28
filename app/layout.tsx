// app/layout.tsx
import type { Metadata } from 'next'
import { Inter, Fraunces, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import BottomNav from '../components/layout/BottomNav'

const inter = Inter({ subsets: ['latin'] })

// Display serif for page/card titles only — gives the app warmth instead
// of reading as a generic sans-everywhere SaaS dashboard. Body text and UI
// chrome stay on Inter above; this is deliberately used sparingly.
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  weight: ['500', '600', '700'],
})

// Monospace for numbers — weight, sleep hours, lab values, streaks,
// confidence scores — so data reads as measured and scans apart from
// narrative prose.
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-plex-mono',
  weight: ['400', '500'],
})

export const metadata: Metadata = {
  title: 'Flarewise',
  description: 'Understand your flares and patterns over time',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${fraunces.variable} ${plexMono.variable} bg-bg antialiased`}>
        <div className="max-w-lg mx-auto relative min-h-screen">
          {children}
          <BottomNav />
        </div>
      </body>
    </html>
  )
}