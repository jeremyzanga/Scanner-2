import { useMemo, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, MousePointerClick, RotateCcw, Save, Upload } from 'lucide-react'
import { SURVEY_TEMPLATE, SurveyField } from '../types/survey'
import { CalibratedPoint, CalibrationTemplate, PageCalibration } from '../types/calibration'
import { loadCalibrationTemplate, saveCalibrationTemplate } from '../lib/storage'

// Un "objetivo" de calibración es o bien una opción de single-choice (1 clic)
// o bien un campo de texto manuscrito (2 clics: esquina superior-izq y
// esquina inferior-der del cuadro donde está escrito el número).
type CalibrationTarget =
  | { kind: 'option'; fieldId: string; targetId: string; label: string }
  | { kind: 'textbox-start' | 'textbox-end'; fieldId: string; targetId: string; label: string }

function buildTargets(fields: SurveyField[]): CalibrationTarget[] {
  const targets: CalibrationTarget[] = []
  for (const f of fields) {
    if (f.kind === 'single-choice') {
      for (const opt of f.options ?? []) {
        targets.push({ kind: 'option', fieldId: f.id, targetId: opt.id, label: `${f.question} → ${opt.label}` })
      }
    } else {
      targets.push({ kind: 'textbox-start', fieldId: f.id, targetId: f.id, label: `${f.question} (esquina superior-izquierda)` })
      targets.push({ kind: 'textbox-end', fieldId: f.id, targetId: f.id, label: `${f.question} (esquina inferior-derecha)` })
    }
  }
  return targets
}

function compressImageToDataUrl(img: HTMLImageElement, maxDim = 1600, quality = 0.85): string {
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.naturalWidth * scale)
  canvas.height = Math.round(img.naturalHeight * scale)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

export default function CalibrationPage() {
  const [activePage, setActivePage] = useState<1 | 2 | 3 | 4>(1)
  const [template, setTemplate] = useState<CalibrationTemplate>(() => loadCalibrationTemplate())
  const [refImage, setRefImage] = useState<HTMLImageElement | null>(null)
  const [refImageUrl, setRefImageUrl] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  const pageTemplate = SURVEY_TEMPLATE.find((p) => p.pageNumber === activePage)!
  const targets = useMemo(() => buildTargets(pageTemplate.fields), [pageTemplate])

  const existingCal: PageCalibration | undefined = template.pages[activePage]
  const [points, setPoints] = useState<CalibratedPoint[]>(existingCal?.points ?? [])
  const [textBoxes, setTextBoxes] = useState<PageCalibration['textBoxes']>(existingCal?.textBoxes ?? [])
  const [pendingStart, setPendingStart] = useState<{ x: number; y: number } | null>(null)
  const [cursor, setCursor] = useState(0)

  function switchPage(p: 1 | 2 | 3 | 4) {
    setActivePage(p)
    const cal = template.pages[p]
    setPoints(cal?.points ?? [])
    setTextBoxes(cal?.textBoxes ?? [])
    setCursor(0)
    setPendingStart(null)
    setRefImage(null)
    setRefImageUrl(null)
  }

  function handleImageUpload(file: File) {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      setRefImage(img)
      setRefImageUrl(url)
    }
    img.src = url
  }

  function handleClick(e: React.MouseEvent<HTMLImageElement>) {
    if (!imgRef.current || cursor >= targets.length) return
    const rect = imgRef.current.getBoundingClientRect()
    const xRel = (e.clientX - rect.left) / rect.width
    const yRel = (e.clientY - rect.top) / rect.height
    const target = targets[cursor]

    if (target.kind === 'option') {
      setPoints((prev) => [...prev.filter((p) => p.targetId !== target.targetId), { targetId: target.targetId, x: xRel, y: yRel }])
      setCursor((c) => c + 1)
    } else if (target.kind === 'textbox-start') {
      setPendingStart({ x: xRel, y: yRel })
      setCursor((c) => c + 1)
    } else if (target.kind === 'textbox-end' && pendingStart) {
      const x = Math.min(pendingStart.x, xRel)
      const y = Math.min(pendingStart.y, yRel)
      const width = Math.abs(xRel - pendingStart.x)
      const height = Math.abs(yRel - pendingStart.y)
      setTextBoxes((prev) => [...prev.filter((b) => b.targetId !== target.targetId), { targetId: target.targetId, x, y, width, height }])
      setPendingStart(null)
      setCursor((c) => c + 1)
    }
  }

  function undo() {
    if (cursor === 0) return
    const prevTarget = targets[cursor - 1]
    if (prevTarget.kind === 'option') {
      setPoints((prev) => prev.filter((p) => p.targetId !== prevTarget.targetId))
    } else if (prevTarget.kind === 'textbox-end') {
      setTextBoxes((prev) => prev.filter((b) => b.targetId !== prevTarget.targetId))
    } else if (prevTarget.kind === 'textbox-start') {
      setPendingStart(null)
    }
    setCursor((c) => c - 1)
  }

  function handleSave() {
    if (!refImage) return
    const compressedDataUrl = compressImageToDataUrl(refImage)

    // Recalculamos dimensiones sobre la imagen YA comprimida: es la que se
    // usará como plantilla de referencia en tiempo de escaneo, así que el
    // espacio canónico debe coincidir con sus píxeles reales. Los puntos
    // clicados son relativos (0..1), así que siguen siendo válidos.
    const tempImg = new Image()
    tempImg.onload = () => {
      const newCal: PageCalibration = {
        pageNumber: activePage,
        canonicalWidth: tempImg.naturalWidth,
        canonicalHeight: tempImg.naturalHeight,
        points,
        textBoxes,
        referenceImageDataUrl: compressedDataUrl,
        calibratedAt: new Date().toISOString(),
      }
      const newTemplate: CalibrationTemplate = { ...template, pages: { ...template.pages, [activePage]: newCal } }
      setTemplate(newTemplate)
      saveCalibrationTemplate(newTemplate)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
    }
    tempImg.src = compressedDataUrl
  }

  const isPageDone = cursor >= targets.length
  const currentTarget = targets[cursor]

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">Calibración de plantilla</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-900/55 dark:text-paper-100/55">
          Sube la foto de referencia de cada página y haz clic en el centro de cada casilla/círculo, en el orden que se te pide.
          Esto se hace una sola vez: la app usará estas coordenadas relativas para leer todas las encuestas futuras.
        </p>
      </div>

      <div className="mb-5 flex gap-1.5">
        {[1, 2, 3, 4].map((p) => {
          const done = !!template.pages[p as 1 | 2 | 3 | 4]?.points.length
          return (
            <button
              key={p}
              onClick={() => switchPage(p as 1 | 2 | 3 | 4)}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                activePage === p
                  ? 'bg-ink-900 text-paper-50 dark:bg-paper-100 dark:text-ink-950'
                  : 'bg-ink-900/5 text-ink-900/60 hover:bg-ink-900/10 dark:bg-paper-100/10 dark:text-paper-100/60'
              }`}
            >
              Página {p}
              {done && <Check size={13} />}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="card overflow-hidden">
          {!refImageUrl ? (
            <label className="flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-2 text-ink-900/35 dark:text-paper-100/35">
              <Upload size={28} strokeWidth={1.5} />
              <span className="text-sm font-medium">Subir foto de referencia de la página {activePage}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleImageUpload(f)
                }}
              />
            </label>
          ) : (
            <div className="relative">
              <img
                ref={imgRef}
                src={refImageUrl}
                alt={`Referencia página ${activePage}`}
                onClick={handleClick}
                className="w-full cursor-crosshair select-none"
              />
              {points.map((p) => (
                <div
                  key={p.targetId}
                  className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-signal-teal bg-signal-teal/40"
                  style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                />
              ))}
              {textBoxes.map((b) => (
                <div
                  key={b.targetId}
                  className="pointer-events-none absolute border-2 border-signal-amber bg-signal-amber/15"
                  style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.width * 100}%`, height: `${b.height * 100}%` }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            {isPageDone ? (
              <div className="flex items-start gap-2.5 text-signal-teal">
                <Check size={18} className="mt-0.5 flex-shrink-0" />
                <p className="text-sm font-medium">Todos los puntos de esta página fueron marcados. Guarda para continuar.</p>
              </div>
            ) : (
              <>
                <p className="field-label mb-1.5">Marca ahora</p>
                <p className="flex items-start gap-2 text-sm font-medium leading-snug">
                  <MousePointerClick size={16} className="mt-0.5 flex-shrink-0 text-signal-teal" />
                  {currentTarget?.label}
                </p>
                <p className="mt-2 text-xs text-ink-900/45 dark:text-paper-100/45">
                  {cursor + 1} de {targets.length}
                </p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-900/8 dark:bg-paper-100/10">
                  <div className="h-full rounded-full bg-signal-teal" style={{ width: `${(cursor / targets.length) * 100}%` }} />
                </div>
              </>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={undo} disabled={cursor === 0} className="btn-secondary flex-1">
              <RotateCcw size={14} /> Deshacer
            </button>
            <button onClick={handleSave} disabled={!refImage || points.length === 0} className="btn-primary flex-1">
              <Save size={14} /> {savedFlash ? 'Guardado' : 'Guardar'}
            </button>
          </div>

          <div className="flex justify-between text-xs text-ink-900/40 dark:text-paper-100/40">
            <button
              disabled={activePage === 1}
              onClick={() => switchPage((activePage - 1) as 1 | 2 | 3 | 4)}
              className="flex items-center gap-1 disabled:opacity-30"
            >
              <ChevronLeft size={14} /> Anterior
            </button>
            <button
              disabled={activePage === 4}
              onClick={() => switchPage((activePage + 1) as 1 | 2 | 3 | 4)}
              className="flex items-center gap-1 disabled:opacity-30"
            >
              Siguiente <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
