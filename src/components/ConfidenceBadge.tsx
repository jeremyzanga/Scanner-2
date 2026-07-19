interface ConfidenceBadgeProps {
  confidence: number // 0..1
  ambiguous?: boolean
}

export function ConfidenceBadge({ confidence, ambiguous }: ConfidenceBadgeProps) {
  const pct = Math.round(confidence * 100)
  const color = ambiguous
    ? 'bg-signal-rust'
    : confidence >= 0.75
    ? 'bg-signal-teal'
    : confidence >= 0.45
    ? 'bg-signal-amber'
    : 'bg-signal-rust'

  const text = ambiguous ? 'Revisar' : `${pct}%`

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-900/5 px-2 py-0.5 text-[11px] font-medium text-ink-900/70 dark:bg-paper-100/10 dark:text-paper-100/70">
      <span className={`confidence-dot ${color}`} />
      {text}
    </span>
  )
}
