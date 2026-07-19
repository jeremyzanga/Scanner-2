import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Loader2, Send, XCircle } from 'lucide-react'
import { useScanSession } from '../hooks/useScanSession'
import { SURVEY_TEMPLATE, getFieldById } from '../types/survey'
import { FieldExtraction } from '../lib/scanPipeline'
import { FieldReviewRow } from '../components/FieldReviewRow'
import { ImageComparison } from '../components/ImageComparison'
import { isCodeAlreadySubmitted, loadGoogleFormsConfig, markCodeAsSubmitted } from '../lib/storage'
import { submitToGoogleForm } from '../lib/googleForms/googleForms'

type SubmitStatus = 'idle' | 'sending' | 'success' | 'error' | 'invalid-form'

export default function ReviewPage() {
  const navigate = useNavigate()
  const { results, isComplete } = useScanSession()
  const [activePage, setActivePage] = useState<1 | 2 | 3 | 4>(1)

  const [edited, setEdited] = useState<Record<number, Record<string, FieldExtraction>>>(() => {
    const initial: Record<number, Record<string, FieldExtraction>> = {}
    for (const p of [1, 2, 3, 4]) {
      const res = results[p]
      if (!res) continue
      initial[p] = Object.fromEntries(res.fields.map((f) => [f.fieldId, f]))
    }
    return initial
  })

  const [status, setStatus] = useState<SubmitStatus>('idle')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false)

  const formsConfig = useMemo(() => loadGoogleFormsConfig(), [])

  if (!isComplete) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <AlertTriangle className="mx-auto mb-3 text-signal-amber" size={28} />
        <p className="font-medium">No hay ninguna encuesta escaneada todavía</p>
        <button onClick={() => navigate('/')} className="btn-primary mt-4">
          Ir a Escanear
        </button>
      </div>
    )
  }

  const codeField = edited[1]?.['codigo_encuesta']
  const surveyCode = codeField?.textValue?.trim() ?? ''
  const isDuplicate = surveyCode.length > 0 && isCodeAlreadySubmitted(surveyCode)

  function updateOption(page: number, fieldId: string, optionId: string | null) {
    setEdited((prev) => ({
      ...prev,
      [page]: {
        ...prev[page],
        [fieldId]: { ...prev[page][fieldId], selectedOptionId: optionId, ambiguous: false, confidence: 1 },
      },
    }))
  }

  function updateText(page: number, fieldId: string, text: string) {
    setEdited((prev) => ({
      ...prev,
      [page]: {
        ...prev[page],
        [fieldId]: { ...prev[page][fieldId], textValue: text, ambiguous: false, confidence: 1 },
      },
    }))
  }

  async function handleSubmit() {
    setStatusMessage(null)

    if (!surveyCode) {
      setStatus('error')
      setStatusMessage('No se pudo leer el código de encuesta. Escríbelo manualmente en la Página 1 antes de enviar.')
      return
    }

    if (isDuplicate && !duplicateConfirmed) {
      setStatus('error')
      setStatusMessage('Esta encuesta ya fue enviada anteriormente.')
      return
    }

    if (!formsConfig.formActionUrl || formsConfig.mappings.length === 0) {
      setStatus('invalid-form')
      setStatusMessage('No hay un Google Forms configurado todavía. Ve a "Google Forms" y pega la URL de tu formulario.')
      return
    }

    setStatus('sending')

    const entries: Record<string, string> = {}
    for (const mapping of formsConfig.mappings) {
      const field = getFieldById(mapping.fieldId)
      if (!field) continue

      const pageNumber = SURVEY_TEMPLATE.find((p) => p.fields.some((f) => f.id === mapping.fieldId))?.pageNumber
      if (!pageNumber) continue
      const extraction = edited[pageNumber]?.[mapping.fieldId]
      if (!extraction) continue

      if (field.kind === 'single-choice') {
        if (!extraction.selectedOptionId) continue
        const label = mapping.optionValues?.[extraction.selectedOptionId] ?? field.options?.find((o) => o.id === extraction.selectedOptionId)?.label
        if (label) entries[mapping.entryId] = label
      } else {
        if (extraction.textValue) entries[mapping.entryId] = extraction.textValue
      }
    }

    const result = await submitToGoogleForm(formsConfig.formActionUrl, entries)

    if (result.ok) {
      markCodeAsSubmitted(surveyCode)
      setStatus('success')
      setStatusMessage('Enviado correctamente.')
    } else {
      setStatus('error')
      setStatusMessage(result.error ?? 'Error de conexión.')
    }
  }

  const pageTemplate = SURVEY_TEMPLATE.find((p) => p.pageNumber === activePage)!
  const pageResult = results[activePage]

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">Revisión</h1>
          <p className="mt-1 text-sm text-ink-900/55 dark:text-paper-100/55">
            Código de encuesta detectado:{' '}
            <span className="font-mono font-medium">{surveyCode || '—'}</span>
          </p>
        </div>

        {isDuplicate && (
          <div className="flex items-center gap-2 rounded-lg border border-signal-rust/30 bg-signal-rust/10 px-3 py-2 text-sm text-signal-rust">
            <AlertTriangle size={15} />
            Esta encuesta ya fue enviada anteriormente.
            <label className="ml-2 flex items-center gap-1.5 text-xs font-medium">
              <input type="checkbox" checked={duplicateConfirmed} onChange={(e) => setDuplicateConfirmed(e.target.checked)} />
              Enviar de todas formas
            </label>
          </div>
        )}
      </div>

      <div className="mb-5 flex gap-1.5">
        {[1, 2, 3, 4].map((p) => (
          <button
            key={p}
            onClick={() => setActivePage(p as 1 | 2 | 3 | 4)}
            className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
              activePage === p
                ? 'bg-ink-900 text-paper-50 dark:bg-paper-100 dark:text-ink-950'
                : 'bg-ink-900/5 text-ink-900/60 hover:bg-ink-900/10 dark:bg-paper-100/10 dark:text-paper-100/60'
            }`}
          >
            Página {p}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        {pageResult && (
          <div>
            <ImageComparison originalUrl={pageResult.originalImageDataUrl} correctedUrl={pageResult.correctedImageDataUrl} />
            {pageResult.sheetConfidence < 0.4 && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-signal-rust/30 bg-signal-rust/10 p-3 text-xs text-signal-rust">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                <span>
                  {pageResult.alignmentMethod === 'edge-fallback'
                    ? 'No se encontraron suficientes coincidencias con la plantilla calibrada; se usó un método de respaldo menos preciso. Revisa esta página con cuidado o vuelve a tomar la foto con mejor luz/enfoque.'
                    : 'Alineación con confianza baja. Revisa esta página con cuidado.'}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="card p-4 sm:p-5">
          {pageTemplate.fields.map((field) => (
            <FieldReviewRow
              key={field.id}
              field={field}
              extraction={edited[activePage]?.[field.id]}
              onChangeOption={(optId) => updateOption(activePage, field.id, optId)}
              onChangeText={(text) => updateText(activePage, field.id, text)}
              disabled={
                !!field.dependsOn &&
                edited[activePage]?.[field.dependsOn.fieldId]?.selectedOptionId !== field.dependsOn.requiredOptionId
              }
            />
          ))}
        </div>
      </div>

      {statusMessage && (
        <div
          className={`mt-6 flex items-center gap-2.5 rounded-xl p-4 text-sm ${
            status === 'success'
              ? 'border border-signal-teal/30 bg-signal-teal/10 text-signal-teal'
              : 'border border-signal-rust/30 bg-signal-rust/10 text-signal-rust'
          }`}
        >
          {status === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {statusMessage}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button onClick={handleSubmit} disabled={status === 'sending'} className="btn-primary">
          {status === 'sending' ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Enviando...
            </>
          ) : (
            <>
              <Send size={16} /> Enviar a Google Forms
            </>
          )}
        </button>
      </div>
    </div>
  )
}
