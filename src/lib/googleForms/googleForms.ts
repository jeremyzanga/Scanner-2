import axios from 'axios'

export interface ExtractedFormField {
  entryId: string
  questionTitle: string
  type: 'text' | 'radio' | 'checkbox' | 'unknown'
  options?: string[]
}

export interface FormExtractionResult {
  success: boolean
  formActionUrl: string | null
  fields: ExtractedFormField[]
  corsBlocked: boolean
  error?: string
}

function toViewFormUrl(rawUrl: string): string {
  // Normaliza cualquier URL de Google Forms (edit, viewform, o con /d/e/) a la
  // URL pública "viewform" que expone el HTML con los entry.xxxxx
  try {
    const u = new URL(rawUrl.trim())
    if (!u.hostname.includes('docs.google.com')) return rawUrl
    u.pathname = u.pathname.replace(/\/edit$/, '/viewform').replace(/\/closedform$/, '/viewform')
    if (!u.pathname.endsWith('/viewform')) {
      u.pathname = u.pathname.replace(/\/?$/, '/viewform')
    }
    u.search = ''
    return u.toString()
  } catch {
    return rawUrl
  }
}

function toFormResponseUrl(viewUrl: string): string {
  return viewUrl.replace('/viewform', '/formResponse')
}

/**
 * Intenta extraer automáticamente los entry.xxxxx parseando el HTML público
 * del formulario (contiene un blob JSON embebido `FB_PUBLIC_LOAD_DATA_`).
 * Esto SOLO funciona si el navegador puede hacer fetch cross-origin al
 * dominio docs.google.com, lo cual normalmente Google bloquea por CORS para
 * peticiones hechas desde JS en otro origen. Si falla, se reporta
 * corsBlocked=true para que la UI oriente al usuario hacia el Apps Script.
 */
export async function tryExtractEntryIds(rawFormUrl: string): Promise<FormExtractionResult> {
  const viewUrl = toViewFormUrl(rawFormUrl)

  try {
    const response = await axios.get(viewUrl, { responseType: 'text', timeout: 15000 })
    const html: string = response.data

    const match = html.match(/var FB_PUBLIC_LOAD_DATA_ = (\[.*?\]);/s)
    if (!match) {
      return { success: false, formActionUrl: null, fields: [], corsBlocked: false, error: 'No se encontró la estructura del formulario en el HTML.' }
    }

    const data = JSON.parse(match[1])
    const questionsBlock = data?.[1]?.[1]
    if (!Array.isArray(questionsBlock)) {
      return { success: false, formActionUrl: null, fields: [], corsBlocked: false, error: 'Estructura del formulario inesperada.' }
    }

    const fields: ExtractedFormField[] = []
    for (const q of questionsBlock) {
      const title: string = q?.[1] ?? ''
      const typeCode: number = q?.[3]
      const entryBlock = q?.[4]?.[0]
      const entryId = entryBlock?.[0]
      if (!entryId) continue

      const optionsRaw = entryBlock?.[1]
      const options = Array.isArray(optionsRaw) ? optionsRaw.map((o: any) => o?.[0]).filter(Boolean) : undefined

      fields.push({
        entryId: `entry.${entryId}`,
        questionTitle: title,
        type: typeCode === 2 ? 'radio' : typeCode === 4 ? 'checkbox' : typeCode === 0 ? 'text' : 'unknown',
        options,
      })
    }

    return {
      success: true,
      formActionUrl: toFormResponseUrl(viewUrl),
      fields,
      corsBlocked: false,
    }
  } catch (err: any) {
    return {
      success: false,
      formActionUrl: toFormResponseUrl(viewUrl),
      fields: [],
      corsBlocked: true,
      error: err?.message ?? 'Error de red (probablemente CORS).',
    }
  }
}

/**
 * Envía las respuestas reales al Google Form vía POST estándar (el mismo
 * mecanismo que usa el navegador al enviar el <form> HTML de Google).
 * Se usa mode:'no-cors' porque Google no envía cabeceras CORS en esta ruta:
 * el navegador SÍ ejecuta el POST real (la respuesta llega al backend de
 * Google Forms), pero JS no puede leer el cuerpo de la respuesta. Por eso no
 * hay forma 100% certera de confirmar "200 OK" leyendo la respuesta; se
 * asume éxito si fetch no lanza una excepción de red.
 */
export async function submitToGoogleForm(formActionUrl: string, entries: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
  try {
    const body = new URLSearchParams()
    for (const [entryId, value] of Object.entries(entries)) {
      body.append(entryId, value)
    }

    await fetch(formActionUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Error de conexión al enviar el formulario.' }
  }
}

export function generateAppsScriptFallback(): string {
  return `/**
 * Apps Script de respaldo para extraer los entry.xxxxx de un Google Form
 * cuando el navegador bloquea la extracción automática por CORS.
 *
 * Instrucciones:
 * 1. Ve a script.google.com -> Nuevo proyecto.
 * 2. Pega este código.
 * 3. Reemplaza FORM_ID con el ID de tu formulario (está en la URL, entre /d/ y /edit).
 * 4. Implementar -> Nueva implementación -> Aplicación web.
 *    - Ejecutar como: Yo
 *    - Quién tiene acceso: Cualquiera
 * 5. Copia la URL de la aplicación web y pégala en "Encuesta Scanner AI"
 *    en el paso de configuración de Google Forms, en el campo
 *    "URL de respaldo (Apps Script)".
 */
function doGet() {
  var form = FormApp.openById('FORM_ID');
  var items = form.getItems();
  var result = [];

  items.forEach(function (item) {
    result.push({
      title: item.getTitle(),
      entryId: 'entry.' + item.getId(),
      type: item.getType().toString()
    });
  });

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
`
}
