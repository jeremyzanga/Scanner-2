/**
 * Una plantilla calibrada guarda, para cada página física, el tamaño canónico
 * al que se corrige la perspectiva (canonicalWidth x canonicalHeight en px)
 * y, para cada opción de cada campo, un punto (x,y) en COORDENADAS RELATIVAS
 * (0..1 respecto al ancho/alto canónico). Esto hace que la calibración sea
 * independiente de la resolución exacta de la foto tomada en producción,
 * siempre que la corrección de perspectiva la lleve al mismo tamaño canónico.
 */

export interface CalibratedPoint {
  /** id de la opción (para single-choice) o del campo (para texto manuscrito) */
  targetId: string
  /** 0..1 relativo al ancho canónico de la página */
  x: number
  /** 0..1 relativo al alto canónico de la página */
  y: number
}

export interface PageCalibration {
  pageNumber: 1 | 2 | 3 | 4
  canonicalWidth: number
  canonicalHeight: number
  points: CalibratedPoint[]
  /** Para campos de texto manuscrito: caja delimitadora relativa para recortar y pasar a OCR */
  textBoxes: {
    targetId: string
    x: number
    y: number
    width: number
    height: number
  }[]
  /**
   * Imagen de referencia (comprimida, JPEG base64) usada como "plantilla" para
   * la alineación por características (ORB). El espacio de coordenadas
   * canónico ES el de esta imagen: canonicalWidth/Height son su ancho/alto.
   * Sin esta imagen no se puede alinear una foto nueva por features, solo por
   * el fallback de detección de bordes.
   */
  referenceImageDataUrl: string
  calibratedAt: string
}

export interface CalibrationTemplate {
  version: 1
  pages: Partial<Record<1 | 2 | 3 | 4, PageCalibration>>
}

export const EMPTY_TEMPLATE: CalibrationTemplate = { version: 1, pages: {} }

export function isPageCalibrated(template: CalibrationTemplate, page: 1 | 2 | 3 | 4): boolean {
  const cal = template.pages[page]
  return !!cal && cal.points.length > 0
}

export function isTemplateComplete(template: CalibrationTemplate): boolean {
  return [1, 2, 3, 4].every((p) => isPageCalibrated(template, p as 1 | 2 | 3 | 4))
}
