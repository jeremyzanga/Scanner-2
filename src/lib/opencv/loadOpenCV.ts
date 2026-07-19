// Carga real del runtime de OpenCV.js (WASM) usando el paquete npm
// @techstark/opencv-js, que expone la misma API global `cv` que el build
// oficial de opencv.js pero empaquetado para bundlers modernos (Vite/ESM).
//
// La carga es asíncrona porque el módulo WASM debe compilarse/inicializarse
// en el navegador. Este loader memoiza la promesa para que toda la app
// comparta una única instancia inicializada.

let cvPromise: Promise<any> | null = null

export function loadOpenCV(): Promise<any> {
  if (cvPromise) return cvPromise

  cvPromise = new Promise((resolve, reject) => {
    import('@techstark/opencv-js')
      .then((mod) => {
        const cv = (mod as any).default ?? mod
        // opencv-js resuelve el módulo cuando el runtime WASM termina de
        // inicializar, exponiendo cv.onRuntimeInitialized o ya viene listo.
        if (cv && typeof cv.getBuildInformation === 'function') {
          resolve(cv)
          return
        }
        if (cv && typeof cv.then === 'function') {
          // algunas versiones exportan una promesa
          cv.then(resolve).catch(reject)
          return
        }
        cv.onRuntimeInitialized = () => resolve(cv)
      })
      .catch(reject)
  })

  return cvPromise
}
