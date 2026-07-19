// Alineación de la foto capturada contra la imagen de referencia calibrada,
// usando puntos de interés (ORB) en vez de exigir ver los 4 bordes exactos
// de la hoja. Esto es lo que permite que el usuario tome la foto con
// distinto zoom, ángulo o recorte que la foto de calibración: mientras se
// vea una porción suficientemente grande y nítida del contenido impreso
// (texto, líneas de tabla), el algoritmo encuentra decenas de puntos en
// común entre ambas imágenes y calcula la transformación (homografía) que
// las alinea matemáticamente. Sigue siendo 100% visión por computadora
// clásica, sin IA generativa.
//
// Fallback: si no hay suficientes coincidencias confiables (foto muy
// distinta, muy borrosa, o de una página equivocada), se usa la detección
// de bordes de hoja como respaldo y se marca confianza baja para pedir
// revisión/reintento al usuario.

import { detectSheet, warpToCanonical } from './documentDetection'

export interface AlignmentResult {
  warped: any // Mat RGBA en el tamaño canónico (igual al de la imagen de referencia)
  confidence: number // 0..1
  method: 'feature-matching' | 'edge-fallback'
  goodMatches: number
  inliers: number
}

const DETECTION_MAX_DIM = 1100
const MIN_GOOD_MATCHES = 12
const RATIO_TEST_THRESHOLD = 0.75
const RANSAC_REPROJ_THRESHOLD = 6

function resizeForDetection(cv: any, grayMat: any): { small: any; scale: number } {
  const scale = Math.min(1, DETECTION_MAX_DIM / Math.max(grayMat.cols, grayMat.rows))
  if (scale >= 1) return { small: grayMat.clone(), scale: 1 }
  const small = new cv.Mat()
  cv.resize(grayMat, small, new cv.Size(Math.round(grayMat.cols * scale), Math.round(grayMat.rows * scale)), 0, 0, cv.INTER_AREA)
  return { small, scale }
}

export function alignToReference(
  cv: any,
  referenceMat: any, // RGBA, tal cual se guardó en la calibración
  capturedMat: any, // RGBA, la foto recién tomada
  canonicalWidth: number,
  canonicalHeight: number
): AlignmentResult {
  const grayRef = new cv.Mat()
  const grayCap = new cv.Mat()
  cv.cvtColor(referenceMat, grayRef, cv.COLOR_RGBA2GRAY)
  cv.cvtColor(capturedMat, grayCap, cv.COLOR_RGBA2GRAY)

  const { small: refSmall, scale: refScale } = resizeForDetection(cv, grayRef)
  const { small: capSmall, scale: capScale } = resizeForDetection(cv, grayCap)

  const orb = new cv.ORB(2000)
  const emptyMask = new cv.Mat()

  const kpRef = new cv.KeyPointVector()
  const descRef = new cv.Mat()
  orb.detectAndCompute(refSmall, emptyMask, kpRef, descRef)

  const kpCap = new cv.KeyPointVector()
  const descCap = new cv.Mat()
  orb.detectAndCompute(capSmall, emptyMask, kpCap, descCap)

  let goodMatches: { capIdx: number; refIdx: number }[] = []

  if (descRef.rows > 0 && descCap.rows > 0) {
    const bf = new cv.BFMatcher(cv.NORM_HAMMING, false)
    const knnMatches = new cv.DMatchVectorVector()
    bf.knnMatch(descCap, descRef, knnMatches, 2)

    for (let i = 0; i < knnMatches.size(); i++) {
      const pair = knnMatches.get(i)
      if (pair.size() < 2) continue
      const m0 = pair.get(0)
      const m1 = pair.get(1)
      if (m0.distance < RATIO_TEST_THRESHOLD * m1.distance) {
        goodMatches.push({ capIdx: m0.queryIdx, refIdx: m0.trainIdx })
      }
    }
    bf.delete()
    knnMatches.delete()
  }

  let result: AlignmentResult

  if (goodMatches.length >= MIN_GOOD_MATCHES) {
    const srcCoords: number[] = []
    const dstCoords: number[] = []
    for (const gm of goodMatches) {
      const kp1 = kpCap.get(gm.capIdx)
      const kp2 = kpRef.get(gm.refIdx)
      // Se reescalan de vuelta a resolución completa de cada imagen original
      srcCoords.push(kp1.pt.x / capScale, kp1.pt.y / capScale)
      dstCoords.push(kp2.pt.x / refScale, kp2.pt.y / refScale)
    }

    const srcPts = cv.matFromArray(srcCoords.length / 2, 1, cv.CV_32FC2, srcCoords)
    const dstPts = cv.matFromArray(dstCoords.length / 2, 1, cv.CV_32FC2, dstCoords)
    const mask = new cv.Mat()

    const H = cv.findHomography(srcPts, dstPts, cv.RANSAC, RANSAC_REPROJ_THRESHOLD, mask)

    let inliers = 0
    for (let i = 0; i < mask.rows; i++) if (mask.data[i]) inliers++

    if (!H.empty() && inliers >= MIN_GOOD_MATCHES * 0.5) {
      const warped = new cv.Mat()
      cv.warpPerspective(capturedMat, warped, H, new cv.Size(canonicalWidth, canonicalHeight), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(255, 255, 255, 255))

      const confidence = Math.min(1, inliers / 45)
      result = { warped, confidence, method: 'feature-matching', goodMatches: goodMatches.length, inliers }
    } else {
      result = edgeFallback(cv, capturedMat, canonicalWidth, canonicalHeight, goodMatches.length)
    }

    srcPts.delete()
    dstPts.delete()
    mask.delete()
    H.delete()
  } else {
    result = edgeFallback(cv, capturedMat, canonicalWidth, canonicalHeight, goodMatches.length)
  }

  grayRef.delete()
  grayCap.delete()
  refSmall.delete()
  capSmall.delete()
  emptyMask.delete()
  descRef.delete()
  descCap.delete()
  kpRef.delete()
  kpCap.delete()
  orb.delete()

  return result
}

function edgeFallback(cv: any, capturedMat: any, canonicalWidth: number, canonicalHeight: number, matchesFound: number): AlignmentResult {
  const sheet = detectSheet(cv, capturedMat)
  const warped = warpToCanonical(cv, capturedMat, sheet.corners, canonicalWidth, canonicalHeight)
  return {
    warped,
    confidence: Math.min(0.35, sheet.confidence), // se limita para reflejar que es un método menos confiable
    method: 'edge-fallback',
    goodMatches: matchesFound,
    inliers: 0,
  }
}
