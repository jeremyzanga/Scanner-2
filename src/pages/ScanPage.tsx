import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Loader2 } from 'lucide-react'
import { PageUploadSlot } from '../components/PageUploadSlot'
import { ProgressBar } from '../components/ProgressBar'
import { SURVEY_TEMPLATE } from '../types/survey'
import { loadCalibrationTemplate } from '../lib/storage'
import { CalibrationTemplate, isTemplateComplete } from '../types/calibration'
import { scanPage, ScanProgressEvent } from '../lib/scanPipeline'
import { useScanSession } from '../hooks/useScanSession'

interface FileState {
  file: File | null
  previewUrl: string | null
}

export default function ScanPage() {
  const navigate = useNavigate()
  const { setPageResult, reset } = useScanSession()
  const [files, setFiles] = useState<Record<number, FileState>>({
    1: { file: null, previewUrl: null },
    2: { file: null, previewUrl: null },
    3: { file: null, previewUrl: null },
    4: { file: null, previewUrl: null },
  })
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState<ScanProgressEvent | null>(null)
  const [error, setError] = useState<string | null>(null)

  const template: CalibrationTemplate = useMemo(() => loadCalibrationTemplate(), [isProcessing])
  const calibrationReady = isTemplateComplete(template)

  const allFilesSelected = [1, 2, 3, 4].every((p) => !!files[p].file)

  function handleSelect(pageNumber: number, file: File) {
    const previewUrl = URL.createObjectURL(file)
    setFiles((prev) => ({ ...prev, [pageNumber]: { file, previewUrl } }))
  }

  async function handleProcess() {
    setError(null)
    if (!calibrationReady) {
      setError('Primero debes calibrar las 4 páginas en la sección "Calibración". La app necesita saber dónde está cada casilla antes de poder leerlas.')
      return
    }

    setIsProcessing(true)
    reset()

    try {
      for (const pageTemplate of SURVEY_TEMPLATE) {
        const pageNumber = pageTemplate.pageNumber
        const file = files[pageNumber].file
        const calibration = template.pages[pageNumber]
        if (!file || !calibration) continue

        const result = await scanPage(file, pageTemplate, calibration, (e) => setProgress(e))
        setPageResult(result)
      }
      navigate('/revision')
    } catch (err: any) {
      setError(err?.message ?? 'Ocurrió un error procesando las imágenes.')
    } finally {
      setIsProcessing(false)
      setProgress(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">Escanear encuesta</h1>
        <p className="mt-1 text-sm text-ink-900/55 dark:text-paper-100/55">
          Sube las 4 fotos en orden. La app corrige perspectiva, lee las respuestas por posición fija y te muestra todo para revisión antes de enviar.
        </p>
      </div>

      {!calibrationReady && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-signal-amber/30 bg-signal-amber/10 p-4">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-signal-amber" />
          <div className="text-sm">
            <p className="font-medium">Aún falta calibrar la plantilla</p>
            <p className="mt-0.5 text-ink-900/60 dark:text-paper-100/60">
              Antes de escanear encuestas reales, ve a{' '}
              <button onClick={() => navigate('/calibracion')} className="font-medium underline underline-offset-2">
                Calibración
              </button>{' '}
              y marca la posición de cada casilla en las 4 páginas de referencia. Solo se hace una vez.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {SURVEY_TEMPLATE.map((p) => (
          <PageUploadSlot
            key={p.pageNumber}
            pageNumber={p.pageNumber}
            title={p.title}
            description={p.description}
            file={files[p.pageNumber].file}
            previewUrl={files[p.pageNumber].previewUrl}
            onSelect={(f) => handleSelect(p.pageNumber, f)}
            disabled={isProcessing}
          />
        ))}
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-signal-rust/30 bg-signal-rust/10 p-4 text-sm text-signal-rust">
          {error}
        </div>
      )}

      {isProcessing && progress && (
        <div className="card mt-6 p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Loader2 size={15} className="animate-spin" />
            Procesando página {progress.page} de 4
          </p>
          <ProgressBar percent={progress.percent} label={progress.label} />
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button
          className="btn-primary"
          disabled={!allFilesSelected || isProcessing}
          onClick={handleProcess}
        >
          {isProcessing ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Procesando...
            </>
          ) : (
            <>
              Procesar 4 páginas <ArrowRight size={16} />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
