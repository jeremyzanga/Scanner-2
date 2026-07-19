import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardCopy, Link2, Loader2, RefreshCw } from 'lucide-react'
import { loadGoogleFormsConfig, saveGoogleFormsConfig, GoogleFormsFieldMapping } from '../lib/storage'
import { tryExtractEntryIds, generateAppsScriptFallback, ExtractedFormField } from '../lib/googleForms/googleForms'
import { getAllFields } from '../types/survey'

export default function SettingsPage() {
  const [config, setConfig] = useState(() => loadGoogleFormsConfig())
  const [formUrl, setFormUrl] = useState(config.formUrl)
  const [extracting, setExtracting] = useState(false)
  const [extractedFields, setExtractedFields] = useState<ExtractedFormField[]>([])
  const [corsBlocked, setCorsBlocked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [appsScriptUrl, setAppsScriptUrl] = useState('')
  const [copied, setCopied] = useState(false)

  const surveyFields = getAllFields()

  async function handleExtract() {
    setExtracting(true)
    setError(null)
    setCorsBlocked(false)

    const result = await tryExtractEntryIds(formUrl)

    if (result.success) {
      setExtractedFields(result.fields)
      const newConfig = {
        ...config,
        formUrl,
        formActionUrl: result.formActionUrl,
        lastSyncedAt: new Date().toISOString(),
      }
      setConfig(newConfig)
      saveGoogleFormsConfig(newConfig)
    } else {
      setCorsBlocked(result.corsBlocked)
      setError(result.error ?? 'No se pudieron extraer los campos automáticamente.')
      // Igual guardamos la action URL calculada por si el usuario completa el mapeo manualmente / vía Apps Script
      setConfig((prev) => ({ ...prev, formUrl, formActionUrl: result.formActionUrl }))
    }

    setExtracting(false)
  }

  async function handleAppsScriptFetch() {
    if (!appsScriptUrl) return
    setExtracting(true)
    setError(null)
    try {
      const res = await fetch(appsScriptUrl)
      const data = (await res.json()) as { title: string; entryId: string; type: string }[]
      const mapped: ExtractedFormField[] = data.map((d) => ({
        entryId: d.entryId,
        questionTitle: d.title,
        type: d.type.toLowerCase().includes('multiple') ? 'radio' : d.type.toLowerCase().includes('text') ? 'text' : 'unknown',
      }))
      setExtractedFields(mapped)
      setCorsBlocked(false)
    } catch (err: any) {
      setError('No se pudo contactar el Apps Script: ' + (err?.message ?? 'error desconocido'))
    } finally {
      setExtracting(false)
    }
  }

  function updateMapping(fieldId: string, entryId: string) {
    const others = config.mappings.filter((m) => m.fieldId !== fieldId)
    const mapping: GoogleFormsFieldMapping = { fieldId, entryId }
    const next = { ...config, mappings: entryId ? [...others, mapping] : others }
    setConfig(next)
    saveGoogleFormsConfig(next)
  }

  function copyAppsScript() {
    navigator.clipboard.writeText(generateAppsScriptFallback())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">Google Forms</h1>
        <p className="mt-1 text-sm text-ink-900/55 dark:text-paper-100/55">
          Pega la URL de tu formulario y la app intentará detectar automáticamente los identificadores entry.xxxxx de cada pregunta.
        </p>
      </div>

      <div className="card p-5">
        <label className="field-label mb-1.5 block">URL del Google Forms</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={formUrl}
            onChange={(e) => setFormUrl(e.target.value)}
            placeholder="https://docs.google.com/forms/d/e/.../viewform"
            className="flex-1 rounded-lg border border-ink-900/15 bg-white px-3 py-2 text-sm dark:border-paper-100/15 dark:bg-ink-800"
          />
          <button onClick={handleExtract} disabled={!formUrl || extracting} className="btn-primary">
            {extracting ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
            Detectar campos
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-signal-amber/30 bg-signal-amber/10 p-3 text-sm text-signal-amber">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">{corsBlocked ? 'El navegador bloqueó la lectura automática (CORS)' : 'No se pudo completar la detección'}</p>
              <p className="mt-0.5 text-ink-900/60 dark:text-paper-100/60">{error}</p>
              {corsBlocked && (
                <p className="mt-1 text-ink-900/60 dark:text-paper-100/60">
                  Esto es una restricción del navegador de Google, no un error de la app. Usa el Apps Script de respaldo abajo para completar la detección automáticamente.
                </p>
              )}
            </div>
          </div>
        )}

        {extractedFields.length > 0 && (
          <div className="mt-4 flex items-center gap-2 text-sm text-signal-teal">
            <CheckCircle2 size={16} />
            {extractedFields.length} campos detectados. Guardados automáticamente.
          </div>
        )}
      </div>

      {corsBlocked && (
        <div className="card mt-5 p-5">
          <h2 className="font-medium">Respaldo con Google Apps Script</h2>
          <p className="mt-1 text-sm text-ink-900/55 dark:text-paper-100/55">
            Copia este script, pégalo en{' '}
            <a href="https://script.google.com" target="_blank" rel="noreferrer" className="underline">
              script.google.com
            </a>
            , reemplaza <code className="rounded bg-ink-900/5 px-1 dark:bg-paper-100/10">FORM_ID</code> por el ID de tu formulario y despliégalo como aplicación web.
          </p>
          <button onClick={copyAppsScript} className="btn-secondary mt-3">
            <ClipboardCopy size={14} /> {copied ? 'Copiado' : 'Copiar script'}
          </button>

          <div className="mt-4">
            <label className="field-label mb-1.5 block">URL de la aplicación web desplegada</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={appsScriptUrl}
                onChange={(e) => setAppsScriptUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="flex-1 rounded-lg border border-ink-900/15 bg-white px-3 py-2 text-sm dark:border-paper-100/15 dark:bg-ink-800"
              />
              <button onClick={handleAppsScriptFetch} disabled={!appsScriptUrl || extracting} className="btn-primary">
                <RefreshCw size={14} /> Obtener campos
              </button>
            </div>
          </div>
        </div>
      )}

      {extractedFields.length > 0 && (
        <div className="card mt-5 p-5">
          <h2 className="font-medium">Mapeo de preguntas</h2>
          <p className="mt-1 text-sm text-ink-900/55 dark:text-paper-100/55">
            Relaciona cada pregunta de tu encuesta con la pregunta correspondiente detectada en el Google Forms.
          </p>

          <div className="mt-4 divide-y divide-ink-900/6 dark:divide-paper-100/8">
            {surveyFields.map((f) => {
              const current = config.mappings.find((m) => m.fieldId === f.id)?.entryId ?? ''
              return (
                <div key={f.id} className="flex flex-col gap-1.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm sm:max-w-[55%]">{f.question}</p>
                  <select
                    value={current}
                    onChange={(e) => updateMapping(f.id, e.target.value)}
                    className="min-w-[220px] rounded-lg border border-ink-900/15 bg-white px-3 py-1.5 text-sm dark:border-paper-100/15 dark:bg-ink-800"
                  >
                    <option value="">— No enviar —</option>
                    {extractedFields.map((ef) => (
                      <option key={ef.entryId} value={ef.entryId}>
                        {ef.questionTitle || ef.entryId}
                      </option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
