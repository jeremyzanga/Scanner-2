// Detección de marcas (X, aspas, círculos rellenos) por POSICIÓN FIJA.
// No usa IA generativa: para cada opción calibrada, recorta una pequeña
// región cuadrada (ROI) alrededor del punto calibrado sobre la imagen ya
// binarizada (Otsu, blanco=fondo, negro=tinta) y calcula qué fracción de
// píxeles son "tinta" (oscuros). La opción con mayor densidad dentro de su
// fila gana. Si hay ambigüedad (dos marcas fuertes, o ninguna clara) se
// marca como baja confianza para que la UI pida revisión manual.

export interface OptionInkReading {
  targetId: string
  inkRatio: number // 0..1
}

export interface RowDetectionResult {
  fieldId: string
  selectedOptionId: string | null
  confidence: number // 0..1
  ambiguous: boolean // true si hay 2+ marcas fuertes o ninguna
  readings: OptionInkReading[]
}

const ROI_HALF_SIZE_RATIO = 0.014 // proporción del ancho de la página usada como radio de muestreo
const MARK_THRESHOLD = 0.16 // fracción mínima de píxeles oscuros para considerar "marcado"
const AMBIGUOUS_GAP = 0.08 // si la 2da mejor opción está a menos de este margen de la 1ra, es ambigua

function measureInkRatio(cv: any, ocrMat: any, xRel: number, yRel: number): number {
  const w = ocrMat.cols
  const h = ocrMat.rows
  const half = Math.round(w * ROI_HALF_SIZE_RATIO)

  const cx = Math.round(xRel * w)
  const cy = Math.round(yRel * h)

  const x0 = Math.max(0, cx - half)
  const y0 = Math.max(0, cy - half)
  const x1 = Math.min(w, cx + half)
  const y1 = Math.min(h, cy + half)
  if (x1 <= x0 || y1 <= y0) return 0

  const roi = ocrMat.roi(new cv.Rect(x0, y0, x1 - x0, y1 - y0))
  // ocrMat está binarizado: 255 = blanco (fondo), 0 = negro (tinta)
  const totalPixels = roi.rows * roi.cols
  const nonZero = cv.countNonZero(roi)
  const darkPixels = totalPixels - nonZero
  roi.delete()

  return totalPixels > 0 ? darkPixels / totalPixels : 0
}

export function detectRowMark(
  cv: any,
  ocrMat: any,
  fieldId: string,
  options: { targetId: string; x: number; y: number }[]
): RowDetectionResult {
  const readings: OptionInkReading[] = options.map((o) => ({
    targetId: o.targetId,
    inkRatio: measureInkRatio(cv, ocrMat, o.x, o.y),
  }))

  const sorted = [...readings].sort((a, b) => b.inkRatio - a.inkRatio)
  const top = sorted[0]
  const second = sorted[1]

  if (!top || top.inkRatio < MARK_THRESHOLD) {
    return { fieldId, selectedOptionId: null, confidence: 0, ambiguous: true, readings }
  }

  const ambiguous = !!second && top.inkRatio - second.inkRatio < AMBIGUOUS_GAP && second.inkRatio >= MARK_THRESHOLD

  // Confianza: qué tan por encima del umbral y qué tan separado del 2do lugar
  const separationScore = second ? Math.min(1, (top.inkRatio - second.inkRatio) / AMBIGUOUS_GAP) : 1
  const intensityScore = Math.min(1, top.inkRatio / 0.5)
  const confidence = ambiguous ? 0.35 : Math.min(1, 0.5 * separationScore + 0.5 * intensityScore)

  return {
    fieldId,
    selectedOptionId: ambiguous ? null : top.targetId,
    confidence,
    ambiguous,
    readings,
  }
}
