import { useState } from 'react'

interface ImageComparisonProps {
  originalUrl: string
  correctedUrl: string
}

export function ImageComparison({ originalUrl, correctedUrl }: ImageComparisonProps) {
  const [showOriginal, setShowOriginal] = useState(false)

  return (
    <div>
      <div className="mb-2 flex gap-1.5">
        <button
          onClick={() => setShowOriginal(false)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium ${!showOriginal ? 'bg-ink-900 text-paper-50 dark:bg-paper-100 dark:text-ink-950' : 'bg-ink-900/5 text-ink-900/50 dark:bg-paper-100/10 dark:text-paper-100/50'}`}
        >
          Corregida
        </button>
        <button
          onClick={() => setShowOriginal(true)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium ${showOriginal ? 'bg-ink-900 text-paper-50 dark:bg-paper-100 dark:text-ink-950' : 'bg-ink-900/5 text-ink-900/50 dark:bg-paper-100/10 dark:text-paper-100/50'}`}
        >
          Original
        </button>
      </div>
      <img
        src={showOriginal ? originalUrl : correctedUrl}
        alt={showOriginal ? 'Imagen original' : 'Imagen corregida'}
        className="w-full rounded-xl border border-ink-900/8 dark:border-paper-100/10"
      />
    </div>
  )
}
