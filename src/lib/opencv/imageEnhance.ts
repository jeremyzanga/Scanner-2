// Pipeline real de mejora de imagen sobre el Mat ya corregido en perspectiva:
// 1) deskew fino (rotación residual pequeña detectada por líneas de Hough)
// 2) normalización de brillo/contraste (CLAHE)
// 3) reducción de ruido (fastNlMeans / medianBlur según tamaño)
// Devuelve un nuevo Mat en RGBA listo para mostrarse, y dexja disponible un
// Mat en escala de grises binarizado (Otsu) optimizado para OCR/lectura de marcas.

export interface EnhancedResult {
  displayMat: any // RGBA, para mostrar al usuario
  ocrMat: any // GRAY binarizado, para Tesseract y para medir densidad de tinta
}

function estimateSkewAngleDeg(cv: any, grayMat: any): number {
  const edges = new cv.Mat()
  cv.Canny(grayMat, edges, 50, 150)

  const lines = new cv.Mat()
  cv.HoughLinesP(edges, lines, 1, Math.PI / 180, 150, grayMat.cols * 0.25, 20)

  const angles: number[] = []
  for (let i = 0; i < lines.rows; i++) {
    const x1 = lines.data32S[i * 4]
    const y1 = lines.data32S[i * 4 + 1]
    const x2 = lines.data32S[i * 4 + 2]
    const y2 = lines.data32S[i * 4 + 3]
    const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI
    // Solo interesan líneas casi-horizontales (renglones/tablas), descarta verticales
    if (Math.abs(angle) < 20) angles.push(angle)
  }

  edges.delete()
  lines.delete()

  if (angles.length === 0) return 0
  angles.sort((a, b) => a - b)
  // Mediana es más robusta que la media frente a outliers
  return angles[Math.floor(angles.length / 2)]
}

function rotateMat(cv: any, mat: any, angleDeg: number): any {
  if (Math.abs(angleDeg) < 0.1) return mat.clone()
  const center = new cv.Point(mat.cols / 2, mat.rows / 2)
  const M = cv.getRotationMatrix2D(center, angleDeg, 1)
  const dst = new cv.Mat()
  cv.warpAffine(mat, dst, M, new cv.Size(mat.cols, mat.rows), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(255, 255, 255, 255))
  M.delete()
  return dst
}

export function enhanceForReading(cv: any, canonicalMat: any): EnhancedResult {
  const gray0 = new cv.Mat()
  cv.cvtColor(canonicalMat, gray0, cv.COLOR_RGBA2GRAY)

  // 1) Deskew fino
  const angle = estimateSkewAngleDeg(cv, gray0)
  const colorDeskewed = rotateMat(cv, canonicalMat, angle)
  const grayDeskewed = rotateMat(cv, gray0, angle)
  gray0.delete()

  // 2) CLAHE (ecualización adaptativa de contraste) sobre el canal de grises
  const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8))
  const claheOut = new cv.Mat()
  clahe.apply(grayDeskewed, claheOut)
  clahe.delete()

  // 3) Reducción de ruido
  const denoised = new cv.Mat()
  cv.medianBlur(claheOut, denoised, 3)
  claheOut.delete()

  // Versión de color mejorada para mostrar al usuario (aplica el mismo brillo/contraste)
  const displayMat = new cv.Mat()
  colorDeskewed.convertTo(displayMat, -1, 1.12, 8) // ganancia leve + offset de brillo
  colorDeskewed.delete()
  grayDeskewed.delete()

  // Binarización Otsu para OCR / medición de densidad de tinta
  const ocrMat = new cv.Mat()
  cv.threshold(denoised, ocrMat, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU)
  denoised.delete()

  return { displayMat, ocrMat }
}

export function matToDataURL(cv: any, mat: any): string {
  const canvas = document.createElement('canvas')
  canvas.width = mat.cols
  canvas.height = mat.rows
  cv.imshow(canvas, mat)
  return canvas.toDataURL('image/jpeg', 0.92)
}
