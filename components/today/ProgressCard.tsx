// components/today/ProgressCard.tsx
'use client'

interface ProgressCardProps {
  completed: number
  total: number
}

const MICROCOPY = [
  "Let's take 2 minutes to check in with you. You matter. 💚",
  "You're showing up for yourself. That counts.",
  "Small steps, big healing.",
  "You're building clarity every day.",
  "Almost there — you've got this.",
  "Thank you for checking in. One day at a time. 🌿",
]

export default function ProgressCard({ completed, total }: ProgressCardProps) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100)
  const msg = MICROCOPY[Math.min(completed, MICROCOPY.length - 1)]

  return (
    <div className="bg-gradient-to-br from-primary-soft to-surface rounded-2xl
      border border-primary/20 px-5 py-4">
      <p className="text-sm text-primary font-medium mb-3">{msg}</p>

      {/* Step dots */}
      <div className="flex gap-1.5 mb-3">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500
            ${i < completed ? 'bg-primary' : 'bg-primary/30'}`} />
        ))}
      </div>

      <p className="text-xs text-primary font-medium">
        {completed === total
          ? '✓ All sections complete'
          : `${completed} of ${total} sections`}
      </p>
    </div>
  )
}