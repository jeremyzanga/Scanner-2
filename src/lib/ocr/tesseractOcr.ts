import { createWorker, Worker } from 'tesseract.js'

// Worker singleton reutilizado durante toda la sesión de escaneo para no
// pagar el costo de inicialización (carga de modelo) en cada campo.
let workerPromise: Promise<Worker> | null = null

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('spa', undefined, {
      logger: () => {}, // el progreso granular se reporta desde el pipeline, no aquí
    }).then(async (worker) => {
      // Los campos que leemos (edad, código) son solo dígitos: restringir el
      // whitelist de caracteres mejora sustancialmente la precisión del OCR
      // manuscrito frente a dejar el vocabulario completo del español.
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789',
        tessedit_pageseg_mode: '7' as any, // PSM.SINGLE_LINE
      })
      return worker
    })
  }
  return workerPromise
}

export interface OcrFieldResult {
  text: string
  confidence: number // 0..1 normalizado (Tesseract da 0..100)
}

/** Recibe un canvas/ImageData ya recortado a la región del campo y devuelve el texto leído */
export async function readNumericField(source: HTMLCanvasElement): Promise<OcrFieldResult> {
  const worker = await getWorker()
  const { data } = await worker.recognize(source)
  const cleaned = (data.text || '').replace(/[^0-9]/g, '').trim()
  return {
    text: cleaned,
    confidence: Math.max(0, Math.min(1, (data.confidence ?? 0) / 100)),
  }
}

export async function terminateOcr(): Promise<void> {
  if (workerPromise) {
    const worker = await workerPromise
    await worker.terminate()
    workerPromise = null
  }
}

/** Recorta una región relativa (0..1) de un Mat de OpenCV y la vuelca a un canvas para Tesseract */
export function cropMatToCanvas(cv: any, mat: any, box: { x: number; y: number; width: number; height: number }): HTMLCanvasElement {
  const w = mat.cols
  const h = mat.rows
  const rect = new cv.Rect(
    Math.max(0, Math.round(box.x * w)),
    Math.max(0, Math.round(box.y * h)),
    Math.max(1, Math.round(box.width * w)),
    Math.max(1, Math.round(box.height * h))
  )
  const roi = mat.roi(rect)
  const canvas = document.createElement('canvas')
  canvas.width = roi.cols
  canvas.height = roi.rows
  cv.imshow(canvas, roi)
  roi.delete()
  return canvas
}
