// app/about/page.tsx
'use client'

import Link from 'next/link'

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-bg pb-28">
      <div className="px-5 pt-10 pb-6">
        <Link href="/settings" className="inline-flex items-center gap-1 text-xs text-ink-faint mb-4">
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
            <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Settings
        </Link>
        <p className="text-xs font-semibold tracking-widest text-primary uppercase mb-1">
          About
        </p>
        <h1 className="text-3xl font-bold text-ink">Why I&apos;m Building Flarewise</h1>
      </div>

      <div className="px-4">
        <div className="bg-surface rounded-2xl border border-line shadow-sm px-5 py-6">
          <div className="text-sm text-ink-soft leading-6 space-y-4">
            <p>I&apos;ve lived with an autoimmune condition for over 22 years.</p>

            <p>
              In that time, I&apos;ve heard some version of the same thing from nearly every doctor:
              &ldquo;There&apos;s no cure — you just have to manage it.&rdquo; I&apos;ve tried elimination diets,
              supplements, stress reduction, and more rounds of blood work than I can count. Some days
              my body still flares, and I still don&apos;t fully know why.
            </p>

            <p>
              What I did notice, after years of paying close attention, is that my flares aren&apos;t
              random. They follow patterns — a hard workout in humid weather, timing tied to my cycle,
              a stretch of poor sleep. But no single doctor was ever looking at all of it together.
              Each specialist saw their own piece — the gut doctor, the dermatologist, the
              nutritionist — never the whole picture.
            </p>

            <p>
              So I started tracking everything myself: symptoms, diet, sleep, stress, exercise, cycle.
              And because reading my own data still wasn&apos;t enough to see what was actually
              connected, I built a system to help me find the patterns I couldn&apos;t always see on
              my own.
            </p>

            <p>
              I&apos;m a product manager by trade, with over a decade building software — but this
              isn&apos;t a side project I&apos;m squeezing in. It&apos;s the thing I keep coming back
              to, because I built it out of my own exhaustion with generic advice that never accounted
              for how different every body actually is. I&apos;ve talked to enough people living with
              chronic and autoimmune conditions to know I&apos;m not the only one.
            </p>

            <p>
              This is still early. I&apos;m one person building this, testing it first on my own data
              before asking anyone else to trust me with theirs. If you&apos;re living with a chronic
              or autoimmune condition and tired of being told to &ldquo;just manage it,&rdquo; I&apos;d
              love for you to try this with me — and tell me honestly if it&apos;s actually useful, or
              if it&apos;s missing the mark.
            </p>

            <p className="text-ink font-medium">— Aashima</p>
          </div>
        </div>
      </div>
    </div>
  )
}
