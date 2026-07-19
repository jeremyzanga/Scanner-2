# Encuesta Scanner AI

Digitalización automática de la "Encuesta salud integral" (4 páginas fotografiables) usando visión por computadora con **posiciones fijas** (sin IA generativa) y envío directo a Google Forms.

## 1. Instalar y correr en local

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`.

La carpeta `reference-images/` incluye las 4 fotos completas (páginas 1 a 4, confirmadas por el usuario) que se usaron para modelar la estructura de preguntas (`src/types/survey.ts`).

**División real de las 4 páginas** (corregida):
- Página 1: información general (preguntas 1-6) + Escala I, filas 1 a 9
- Página 2: Escala I, filas 10 a 21
- Página 3: "Durante el último mes..." hasta "No poder detener o controlar la preocupación"
- Página 4: "¿Te sientes en paz contigo mismo(a)?" hasta "¿Cómo calificarías tu nivel de estrés?"

## 2. Calibrar la plantilla (una sola vez)

Antes de escanear encuestas reales:

1. Ve a la pestaña **Calibración**.
2. Para cada una de las 4 páginas, sube la foto de referencia (una hoja llena de ejemplo, bien encuadrada y nítida).
3. Haz clic en el centro de cada casilla/círculo en el orden que la app te indica. Para los campos manuscritos (edad, código) haz clic en la esquina superior-izquierda y luego inferior-derecha del recuadro donde se escribe.
4. Presiona **Guardar** en cada página.

**Cómo funciona la alineación (importante):** la app **no exige que las fotos futuras coincidan pixel por pixel** con la foto de calibración. En el momento de calibrar, la imagen de referencia se guarda junto con las coordenadas. Al escanear una encuesta nueva, la app usa **coincidencia de puntos característicos (ORB) + homografía**: encuentra decenas de puntos en común entre la foto nueva y la de referencia (letras, esquinas de tabla, etc.) sin importar el ángulo, zoom o recorte con que se tomó la foto, y calcula matemáticamente la transformación que alinea una con otra. Mientras la foto muestre con claridad una porción representativa del contenido impreso, la alineación funciona. Si la foto es demasiado distinta (muy borrosa, de otra página, con muy poca superficie visible), la app cae a un método de respaldo más simple (detección de bordes de la hoja) y marca la confianza como baja para pedirte que la revises o repitas.

Estas coordenadas y la imagen de referencia comprimida quedan guardadas en `localStorage` del navegador. **Si cambias de navegador o borras datos del sitio, tendrás que recalibrar.**

## 3. Configurar Google Forms

1. Ve a **Google Forms**, pega la URL de tu formulario y presiona **Detectar campos**.
2. La app intenta leer el HTML público del formulario para extraer los `entry.xxxxx` automáticamente.
   - **Esto normalmente fallará por CORS** (Google no expone cabeceras CORS en esa ruta para peticiones hechas desde JS de otro origen). Es una restricción del navegador/Google, no un bug de la app.
   - Cuando falla, la app te muestra un script de **Google Apps Script** listo para copiar: despliégalo como aplicación web y pega su URL en el campo correspondiente. Eso sí puede leer los `entry.xxxxx` de forma 100% confiable porque corre del lado de Google, no en el navegador del usuario.
3. Mapea cada pregunta de la encuesta con la pregunta correspondiente del Google Forms.

## 4. Escanear

1. Ve a **Escanear**, sube las 4 fotos en orden.
2. Presiona **Procesar 4 páginas**. Verás una barra de progreso real por etapa (detección de hoja, corrección, OCR, detección de marcas, validación).
3. En **Revisión**, corrige cualquier campo marcado en rojo/amarillo (baja confianza o ambiguo) y presiona **Enviar a Google Forms**.

## Limitaciones reales (léelas antes de usar en producción)

- **OCR de escritura a mano** (edad, código de encuesta): Tesseract.js es razonablemente bueno con dígitos manuscritos claros, pero no es perfecto. Por eso la app siempre muestra el campo para edición manual con su nivel de confianza — no confíes ciegamente en el número leído automáticamente si el badge está en amarillo/rojo.
- **Confirmación de envío a Google Forms**: el envío usa `fetch` con `mode: 'no-cors'` porque es la única forma de hacer un POST real desde el navegador sin backend propio. Esto significa que la app **no puede leer la respuesta HTTP real de Google** (por diseño de CORS) — "Enviado correctamente" indica que la petición de red se realizó sin errores, no una confirmación criptográfica de que Google la procesó. Si necesitas una confirmación 100% verificable, la alternativa es enviar a través del mismo Apps Script (`doPost`) en vez de a `formResponse` directamente.
- **Alineación por características (ORB)**: funciona bien con fotos que muestren una porción clara y enfocada del contenido impreso, aunque el encuadre/ángulo/zoom sea distinto al de calibración. Puede fallar (y caer al método de respaldo, de menor precisión) con fotos muy borrosas, muy oscuras, con reflejos fuertes sobre el papel, o que muestren una porción muy pequeña de la hoja. La UI marca la confianza de cada página escaneada para que sepas cuándo repetir la foto.
- **Disponibilidad de ORB en el build de OpenCV.js**: el paquete `@techstark/opencv-js` normalmente incluye el módulo `features2d` (ORB, BFMatcher) y `calib3d` (`findHomography`). Si al correr `npm run dev` ves un error del tipo `cv.ORB is not a constructor`, significa que ese build en particular no incluye esos módulos — en ese caso hay que compilar un build propio de opencv.js con esos módulos habilitados (ver documentación oficial de OpenCV.js `build_js.py --build_wasm`).
- **Plantilla fija**: si el diseño impreso de la encuesta cambia (aunque sea el interlineado), hay que recalibrar esa página.

## Despliegue en Vercel

### Paso a paso (GitHub + Vercel)

1. Crea un repositorio nuevo en GitHub y sube el proyecto:
   ```bash
   cd encuesta-scanner-ai
   git init
   git add .
   git commit -m "Encuesta Scanner AI"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
   git push -u origin main
   ```
2. Ve a [vercel.com/new](https://vercel.com/new) e importa ese repositorio.
3. Vercel detecta automáticamente que es un proyecto **Vite**: Build Command `npm run build` (o `vite build`), Output Directory `dist`, Install Command `npm install`. No hace falta tocar nada.
4. No se necesitan variables de entorno.
5. Deploy.

### Verificación que se hizo sobre este código antes de entregarlo

No fue posible ejecutar `npm install` en el entorno donde se construyó este proyecto (sin acceso a red), así que en vez de solo "verlo bien", se verificó de estas formas concretas:

- **Transpilación real con esbuild** (el mismo motor que usa Vite) sobre los 25 archivos `.ts`/`.tsx`: cero errores de sintaxis.
- **Bundling real** de todo el grafo de imports desde `src/main.tsx` (con las dependencias externas de npm marcadas como `external`): esto verificó que **todos los imports/exports internos del proyecto coinciden exactamente** — y de hecho encontró y corrigió un bug real (`ScanPage.tsx` importaba `isTemplateComplete` del archivo equivocado).
- Se confirmó con `tsc -b` en modo aislado que la configuración de *project references* (`tsconfig.json` + `tsconfig.app.json` + `tsconfig.node.json`, con `composite: true`) no produce errores de build.
- Se simplificaron las dependencias (se quitó ESLint, no esencial para el deploy) y se ajustaron rangos de versión de paquetes de versión `0.x` (`lucide-react`, `@techstark/opencv-js`) para reducir el riesgo de que `npm install` falle por una versión exacta inexistente en el registro de npm.

Lo que **no** se pudo verificar en este entorno (por falta de red) es el `npm install` real completo y el chequeo de tipos contra las declaraciones exactas de cada librería (`tsc -b` con `node_modules` real). Si al desplegar en Vercel ves un error de build, cópiame el mensaje exacto y lo corrijo de inmediato.

## Arquitectura

```
src/
  types/survey.ts          Estructura de las 4 páginas y sus preguntas (fijo, real)
  types/calibration.ts     Tipos de la plantilla de coordenadas calibradas
  lib/opencv/               Alineación por características (ORB+homografía), fallback por bordes, mejora de imagen
  lib/ocr/                  Wrapper de Tesseract.js
  lib/markDetection.ts      Medición de densidad de tinta por posición fija
  lib/scanPipeline.ts       Orquestador con progreso real por etapas
  lib/googleForms/          Extracción de entry.xxxxx + envío real
  lib/storage.ts            LocalStorage: calibración, config, duplicados
  pages/                    Escanear, Calibración, Revisión, Google Forms
  components/                UI reutilizable
```
