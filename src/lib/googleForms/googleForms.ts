import axios from "axios";

export interface ExtractedFormField {
  entryId: string;
  questionTitle: string;
  type: "radio" | "checkbox" | "text" | "unknown";
  options?: string[];
}

export interface FormExtractionResult {
  success: boolean;
  formActionUrl: string | null;
  fields: ExtractedFormField[];
  corsBlocked: boolean;
  error?: string;
}


function toViewFormUrl(url: string): string {
  if (url.includes("/edit")) {
    return url.replace("/edit", "/viewform");
  }

  return url;
}


function toFormResponseUrl(viewUrl: string): string {
  return viewUrl.replace("/viewform", "/formResponse");
}


/**
 * Extrae automáticamente los entry.xxxxx de un Google Form
 */
export async function tryExtractEntryIds(
  rawFormUrl: string
): Promise<FormExtractionResult> {

  const viewUrl = toViewFormUrl(rawFormUrl);

  try {

    const response = await axios.get(viewUrl, {
      responseType: "text",
      timeout: 15000
    });

    const html: string = response.data;


    const match = html.match(
      /var FB_PUBLIC_LOAD_DATA_ = (\[.*?\]);/s
    );


    if (!match) {
      return {
        success: false,
        formActionUrl: null,
        fields: [],
        corsBlocked: false,
        error: "No se encontró la estructura del formulario."
      };
    }


    const data = JSON.parse(match[1]);

    const questionsBlock = data?.[1]?.[1];


    if (!Array.isArray(questionsBlock)) {
      return {
        success:false,
        formActionUrl:null,
        fields:[],
        corsBlocked:false,
        error:"Estructura inesperada del formulario."
      };
    }


    const fields: ExtractedFormField[] = [];


    for (const q of questionsBlock) {

      const title = q?.[1] ?? "";

      const typeCode = q?.[3];

      const entryBlock = q?.[4]?.[0];

      const entryId = entryBlock?.[0];


      if (!entryId) continue;


      fields.push({
        entryId:`entry.${entryId}`,
        questionTitle:title,
        type:
          typeCode === 2
            ? "radio"
            : typeCode === 4
            ? "checkbox"
            : typeCode === 0
            ? "text"
            : "unknown"
      });

    }


    return {
      success:true,
      formActionUrl:toFormResponseUrl(viewUrl),
      fields,
      corsBlocked:false
    };


  } catch(error:any){

    return {
      success:false,
      formActionUrl:toFormResponseUrl(viewUrl),
      fields:[],
      corsBlocked:true,
      error:error?.message ?? "Error desconocido"
    };

  }
}


/**
 * Envía respuestas al Google Form
 */
export async function submitToGoogleForm(
  formActionUrl:string,
  entries:Record<string,string>
):Promise<{ok:boolean; error?:string}> {

  try {

    const body = new URLSearchParams();


    Object.entries(entries).forEach(([key,value])=>{
      body.append(key,value);
    });


    await fetch(formActionUrl,{
      method:"POST",
      mode:"no-cors",
      headers:{
        "Content-Type":
        "application/x-www-form-urlencoded"
      },
      body:body.toString()
    });


    return {
      ok:true
    };


  }catch(error:any){

  return {
    ok:false,
    error:error.message
  };

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