import { useRef } from 'react'
import { Camera, CheckCircle2, ImageUp } from 'lucide-react'

interface PageUploadSlotProps {
  pageNumber: number
  title: string
  description: string
  file: File | null
  previewUrl: string | null
  onSelect: (file: File) => void
  disabled?: boolean
}

export function PageUploadSlot({ pageNumber, title, description, file, previewUrl, onSelect, disabled }: PageUploadSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="card flex flex-col overflow-hidden">
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="group relative flex aspect-[3/4] w-full items-center justify-center bg-ink-900/[0.03] dark:bg-paper-100/[0.04]"
      >
        {previewUrl ? (
          <img src={previewUrl} alt={`Página ${pageNumber}`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-ink-900/35 dark:text-paper-100/35">
            <ImageUp size={28} strokeWidth={1.5} />
            <span className="text-xs font-medium">Toca para subir foto</span>
          </div>
        )}

        {file && (
          <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-signal-teal text-paper-50">
            <CheckCircle2 size={14} />
          </div>
        )}

        <div className="absolute inset-0 hidden items-center justify-center bg-ink-950/40 group-hover:flex">
          <span className="flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-ink-900">
            <Camera size={13} /> {file ? 'Cambiar foto' : 'Tomar / subir foto'}
          </span>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onSelect(f)
          }}
        />
      </button>

      <div className="p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-signal-teal">Página {pageNumber}</p>
        <p className="text-sm font-medium leading-snug">{title}</p>
        <p className="mt-0.5 text-xs leading-snug text-ink-900/50 dark:text-paper-100/50">{description}</p>
      </div>
    </div>
  )
}
