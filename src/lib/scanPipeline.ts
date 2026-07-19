import { loadOpenCV } from './opencv/loadOpenCV'
import { alignToReference } from './opencv/featureAlignment'
import { enhanceForReading, matToDataURL } from './opencv/imageEnhance'
import { detectRowMark, RowDetectionResult } from './markDetection'
import { cropMatToCanvas, readNumericField } from './ocr/tesseractOcr'
import { PageCalibration } from '../types/calibration'
import { SurveyPageTemplate } from '../types/survey'

export type ScanStage =
  | 'loading-engine'
  | 'detecting-sheet'
  | 'correcting-image'
  | 'reading-text'
  | 'detecting-marks'
  | 'validating'
  | 'done'

export interface ScanProgressEvent {
  page: number
  stage: ScanStage
  percent: number // 0..100, progreso GLOBAL de esta página
  label: string
}

export interface FieldExtraction {
  fieldId: string
  kind: 'single-choice' | 'handwritten-text' | 'handwritten-number'
  selectedOptionId: string | null
  textValue: string | null
  confidence: number
  ambiguous: boolean
  rawReadings?: RowDetectionResult['readings']
}

export interface PageScanResult {
  pageNumber: number
  originalImageDataUrl: string
  correctedImageDataUrl: string
  sheetConfidence: number
  alignmentMethod: 'feature-matching' | 'edge-fallback'
  fields: FieldExtraction[]
}

const STAGE_WEIGHTS: { stage: ScanStage; label: string; weight: number }[] = [
  { stage: 'loading-engine', label: 'Cargando motor de visión', weight: 5 },
  { stage: 'detecting-sheet', label: 'Alineando con la plantilla calibrada', weight: 15 },
  { stage: 'correcting-image', label: 'Corrigiendo imagen', weight: 20 },
  { stage: 'reading-text', label: 'Leyendo texto', weight: 20 },
  { stage: 'detecting-marks', label: 'Detectando respuestas', weight: 25 },
  { stage: 'validating', label: 'Validando', weight: 15 },
]

function cumulativePercent(stage: ScanStage): number {
  let acc = 0
  for (const s of STAGE_WEIGHTS) {
    if (s.stage === stage) return acc
    acc += s.weight
  }
  return 100
}

async function loadImageToMat(cv: any, file: File): Promise<{ mat: any; dataUrl: string }> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)
  const mat = cv.imread(canvas)
  return { mat, dataUrl: canvas.toDataURL('image/jpeg', 0.9) }
}

async function loadDataUrlToMat(cv: any, dataUrl: string): Promise<any> {
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('No se pudo cargar la imagen de referencia calibrada.'))
    img.src = dataUrl
  })
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  return cv.imread(canvas)
}

export async function scanPage(
  file: File,
  pageTemplate: SurveyPageTemplate,
  calibration: PageCalibration,
  onProgress: (e: ScanProgressEvent) => void
): Promise<PageScanResult> {
  const page = pageTemplate.pageNumber
  const emit = (stage: ScanStage, extra = 0) =>
    onProgress({
      page,
      stage,
      percent: Math.min(99, cumulativePercent(stage) + extra),
      label: STAGE_WEIGHTS.find((s) => s.stage === stage)?.label ?? stage,
    })

  emit('loading-engine')
  const cv = await loadOpenCV()

  emit('detecting-sheet')
  const { mat: srcMat, dataUrl: originalImageDataUrl } = await loadImageToMat(cv, file)
  const referenceMat = await loadDataUrlToMat(cv, calibration.referenceImageDataUrl)
  const alignment = alignToReference(cv, referenceMat, srcMat, calibration.canonicalWidth, calibration.canonicalHeight)
  referenceMat.delete()

  emit('correcting-image')
  const { displayMat, ocrMat } = enhanceForReading(cv, alignment.warped)
  const correctedImageDataUrl = matToDataURL(cv, displayMat)

  // ------------------------------------------------------------------
  // OCR de campos manuscritos (edad, código de encuesta)
  // ------------------------------------------------------------------
  emit('reading-text')
  const textFields = pageTemplate.fields.filter((f) => f.kind !== 'single-choice')
  const fields: FieldExtraction[] = []

  for (let i = 0; i < textFields.length; i++) {
    const f = textFields[i]
    const box = calibration.textBoxes.find((b) => b.targetId === f.id)
    if (!box) {
      fields.push({ fieldId: f.id, kind: f.kind, selectedOptionId: null, textValue: null, confidence: 0, ambiguous: true })
      continue
    }
    const canvas = cropMatToCanvas(cv, ocrMat, box)
    const result = await readNumericField(canvas)
    fields.push({
      fieldId: f.id,
      kind: f.kind,
      selectedOptionId: null,
      textValue: result.text || null,
      confidence: result.confidence,
      ambiguous: result.text.length === 0,
    })
    emit('reading-text', Math.round(((i + 1) / Math.max(1, textFields.length)) * STAGE_WEIGHTS[3].weight))
  }

  // ------------------------------------------------------------------
  // Detección de marcas por posición fija
  // ------------------------------------------------------------------
  emit('detecting-marks')
  const choiceFields = pageTemplate.fields.filter((f) => f.kind === 'single-choice')

  for (let i = 0; i < choiceFields.length; i++) {
    const f = choiceFields[i]
    const optionPoints = (f.options ?? []).map((opt) => {
      const p = calibration.points.find((pt) => pt.targetId === opt.id)
      return { targetId: opt.id, x: p?.x ?? 0, y: p?.y ?? 0 }
    })
    const detection = detectRowMark(cv, ocrMat, f.id, optionPoints)
    fields.push({
      fieldId: f.id,
      kind: 'single-choice',
      selectedOptionId: detection.selectedOptionId,
      textValue: null,
      confidence: detection.confidence,
      ambiguous: detection.ambiguous,
      rawReadings: detection.readings,
    })
    emit('detecting-marks', Math.round(((i + 1) / Math.max(1, choiceFields.length)) * STAGE_WEIGHTS[4].weight))
  }

  emit('validating')
  // Validación simple: campos dependientes (ej. 5a) se ignoran si su condición no se cumple
  for (const f of pageTemplate.fields) {
    if (f.dependsOn) {
      const parent = fields.find((x) => x.fieldId === f.dependsOn!.fieldId)
      const applies = parent?.selectedOptionId === f.dependsOn.requiredOptionId
      if (!applies) {
        const entry = fields.find((x) => x.fieldId === f.id)
        if (entry) {
          entry.ambiguous = false
          entry.confidence = 1
          entry.selectedOptionId = null
        }
      }
    }
  }

  srcMat.delete()
  alignment.warped.delete()
  displayMat.delete()
  ocrMat.delete()

  onProgress({ page, stage: 'done', percent: 100, label: 'Página procesada' })

  return {
    pageNumber: page,
    originalImageDataUrl,
    correctedImageDataUrl,
    sheetConfidence: alignment.confidence,
    alignmentMethod: alignment.method,
    fields,
  }
}
