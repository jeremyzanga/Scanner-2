// Detección real de los bordes de la hoja y corrección de perspectiva
// usando OpenCV: escala de grises -> blur -> Canny -> contornos -> el
// contorno de 4 vértices más grande se asume que es la hoja. Si no se
// encuentra un cuadrilátero confiable, se usa el rectángulo completo de la
// imagen como fallback (para no romper el flujo), y se marca lowConfidence.

export interface DetectedSheet {
  corners: [number, number][] // 4 puntos en orden: TL, TR, BR, BL
  confidence: number // 0..1, heurística según qué tan "rectangular" es el contorno
}

function orderCorners(pts: [number, number][]): [number, number][] {
  // Ordena 4 puntos como TL, TR, BR, BL usando suma y diferencia de coordenadas
  const sums = pts.map((p) => p[0] + p[1])
  const diffs = pts.map((p) => p[1] - p[0])
  const tl = pts[sums.indexOf(Math.min(...sums))]
  const br = pts[sums.indexOf(Math.max(...sums))]
  const tr = pts[diffs.indexOf(Math.min(...diffs))]
  const bl = pts[diffs.indexOf(Math.max(...diffs))]
  return [tl, tr, br, bl]
}

export function detectSheet(cv: any, srcMat: any): DetectedSheet {
  const gray = new cv.Mat()
  const blurred = new cv.Mat()
  const edged = new cv.Mat()
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()

  try {
    cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY)
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0)
    cv.Canny(blurred, edged, 50, 150)

    // Dilata un poco para cerrar bordes rotos antes de buscar contornos
    const kernel = cv.Mat.ones(3, 3, cv.CV_8U)
    cv.dilate(edged, edged, kernel)
    kernel.delete()

    cv.findContours(edged, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE)

    const imageArea = srcMat.cols * srcMat.rows
    let best: { pts: [number, number][]; area: number } | null = null

    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i)
      const peri = cv.arcLength(cnt, true)
      const approx = new cv.Mat()
      cv.approxPolyDP(cnt, approx, 0.02 * peri, true)

      if (approx.rows === 4) {
        const area = Math.abs(cv.contourArea(approx))
        // La hoja debe ocupar una fracción razonable de la foto
        if (area > imageArea * 0.2 && (!best || area > best.area)) {
          const pts: [number, number][] = []
          for (let j = 0; j < 4; j++) {
            pts.push([approx.data32S[j * 2], approx.data32S[j * 2 + 1]])
          }
          best = { pts, area }
        }
      }
      approx.delete()
      cnt.delete()
    }

    if (best) {
      return {
        corners: orderCorners(best.pts),
        confidence: Math.min(1, best.area / imageArea),
      }
    }

    // Fallback: usar toda la imagen (sin recorte) con confianza baja
    return {
      corners: [
        [0, 0],
        [srcMat.cols, 0],
        [srcMat.cols, srcMat.rows],
        [0, srcMat.rows],
      ],
      confidence: 0.15,
    }
  } finally {
    gray.delete()
    blurred.delete()
    edged.delete()
    contours.delete()
    hierarchy.delete()
  }
}

/** Aplica warpPerspective para llevar la hoja detectada a un lienzo canónico WxH */
export function warpToCanonical(
  cv: any,
  srcMat: any,
  corners: [number, number][],
  targetWidth: number,
  targetHeight: number
): any {
  const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, corners.flat())
  const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0, 0,
    targetWidth, 0,
    targetWidth, targetHeight,
    0, targetHeight,
  ])

  const M = cv.getPerspectiveTransform(srcTri, dstTri)
  const dst = new cv.Mat()
  cv.warpPerspective(srcMat, dst, M, new cv.Size(targetWidth, targetHeight), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar())

  srcTri.delete()
  dstTri.delete()
  M.delete()

  return dst
}
