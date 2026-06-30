// app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import BottomNav from '../components/layout/BottomNav'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Health OS',
  description: 'Your personal health operating system',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#F4F6FB] antialiased`}>
        <div className="max-w-lg mx-auto relative min-h-screen">
          {children}
          <BottomNav />
        </div>
      </body>
    </html>
  )
}