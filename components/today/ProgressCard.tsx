// components/today/ProgressCard.tsx
'use client'

interface ProgressCardProps {
  completed: number
  total: number
}

const MICROCOPY = [
  "Let's take 2 minutes to check in with you. You matter. 💙",
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
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl
      border border-blue-100 px-5 py-4">
      <p className="text-sm text-blue-700 font-medium mb-3">{msg}</p>

      {/* Step dots */}
      <div className="flex gap-1.5 mb-3">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500
            ${i < completed ? 'bg-blue-600' : 'bg-blue-200'}`} />
        ))}
      </div>

      <p className="text-xs text-blue-500 font-medium">
        {completed === total
          ? '✓ All sections complete'
          : `${completed} of ${total} sections`}
      </p>
    </div>
  )
}