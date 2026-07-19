import { ConfidenceBadge } from './ConfidenceBadge'
import { SurveyField } from '../types/survey'
import { FieldExtraction } from '../lib/scanPipeline'

interface FieldReviewRowProps {
  field: SurveyField
  extraction: FieldExtraction | undefined
  onChangeOption: (optionId: string | null) => void
  onChangeText: (text: string) => void
  disabled?: boolean
}

export function FieldReviewRow({ field, extraction, onChangeOption, onChangeText, disabled }: FieldReviewRowProps) {
  if (!extraction && !field.dependsOn) return null

  return (
    <div className={`flex flex-col gap-2 border-b border-ink-900/6 py-3 last:border-0 dark:border-paper-100/8 sm:flex-row sm:items-center sm:justify-between ${disabled ? 'opacity-40' : ''}`}>
      <p className="text-sm leading-snug sm:max-w-[55%]">{field.question}</p>

      <div className="flex items-center gap-2">
        {extraction && <ConfidenceBadge confidence={extraction.confidence} ambiguous={extraction.ambiguous} />}

        {field.kind === 'single-choice' ? (
          <select
            disabled={disabled}
            value={extraction?.selectedOptionId ?? ''}
            onChange={(e) => onChangeOption(e.target.value || null)}
            className={`min-w-[180px] rounded-lg border px-3 py-1.5 text-sm ${
              extraction?.ambiguous
                ? 'border-signal-rust/40 bg-signal-rust/5'
                : 'border-ink-900/15 bg-white dark:border-paper-100/15 dark:bg-ink-800'
            }`}
          >
            <option value="">— Sin marcar —</option>
            {field.options?.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            disabled={disabled}
            type="text"
            inputMode="numeric"
            value={extraction?.textValue ?? ''}
            onChange={(e) => onChangeText(e.target.value)}
            placeholder="—"
            className={`w-24 rounded-lg border px-3 py-1.5 text-right font-mono text-sm ${
              extraction?.ambiguous
                ? 'border-signal-rust/40 bg-signal-rust/5'
                : 'border-ink-900/15 bg-white dark:border-paper-100/15 dark:bg-ink-800'
            }`}
          />
        )}
      </div>
    </div>
  )
}
