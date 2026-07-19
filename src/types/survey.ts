/**
 * Modelo de dominio de "Encuesta salud integral".
 * La encuesta física tiene 4 páginas fotografiables:
 *   Página 1: Información general (encabezado, preguntas 1-6) + Escala I, filas 1 a 9
 *   Página 2: Escala I, filas 10 a 21 (sufrimiento 10-11, alimentación 12-17, autoeficacia 18-21)
 *   Página 3: "Durante el último mes..." hasta "No poder detener o controlar la preocupación"
 *   Página 4: "¿Te sientes en paz contigo mismo(a)?" hasta "¿Cómo calificarías tu nivel de estrés?"
 *
 * Las COORDENADAS de cada campo NO están hardcodeadas en este archivo: viven
 * en la plantilla de calibración (ver calibration.ts) porque dependen de la
 * resolución/encuadre exacto con el que se fotografía la hoja física. Este
 * archivo solo define la ESTRUCTURA (qué preguntas existen y qué opciones
 * tiene cada una), que es fija porque la encuesta siempre es la misma.
 */

export type FieldKind = 'single-choice' | 'handwritten-text' | 'handwritten-number'

export interface ChoiceOption {
  id: string
  label: string
}

export interface SurveyField {
  id: string
  kind: FieldKind
  question: string
  /** Solo para single-choice: opciones excluyentes de este campo/fila */
  options?: ChoiceOption[]
  /** Si es true, el campo puede depender de otro (ej. 5a depende de 5) */
  dependsOn?: { fieldId: string; requiredOptionId: string }
}

export interface SurveyPageTemplate {
  pageNumber: 1 | 2 | 3 | 4
  title: string
  /** Descripción corta para mostrar en la UI de carga/calibración */
  description: string
  fields: SurveyField[]
}

// ---------------------------------------------------------------------------
// Helper para generar filas de escala tipo Likert (evita repetir boilerplate)
// ---------------------------------------------------------------------------
function likertRow(
  idPrefix: string,
  n: number,
  question: string,
  optionLabels: string[]
): SurveyField {
  return {
    id: `${idPrefix}_${n}`,
    kind: 'single-choice',
    question,
    options: optionLabels.map((label, i) => ({ id: `${idPrefix}_${n}_o${i}`, label })),
  }
}

const CIERTO_EN_MI = ['No es cierto en mi caso', 'Poco cierto en mí', 'Medianamente cierto en mí', 'Bastante cierto en mí', 'Totalmente cierto en mí']
const NUNCA_SIEMPRE_5 = ['Nunca', 'Rara Vez', 'Algunas veces', 'Casi siempre', 'Siempre']

// ---------------------------------------------------------------------------
// PÁGINA 1 — Información general + Escala I, filas 1 a 9
// ---------------------------------------------------------------------------
const page1: SurveyPageTemplate = {
  pageNumber: 1,
  title: 'Información general + Escala (filas 1-9)',
  description: 'Encabezado "Encuesta salud integral", código en la esquina superior derecha, preguntas 1 a 6, y la Escala I desde la fila 1 hasta la fila 9',
  fields: [
    { id: 'codigo_encuesta', kind: 'handwritten-number', question: 'Código de encuesta (esquina superior derecha)' },
    {
      id: 'sexo',
      kind: 'single-choice',
      question: '1. Sexo',
      options: [
        { id: 'masculino', label: 'Masculino' },
        { id: 'femenino', label: 'Femenino' },
      ],
    },
    { id: 'edad', kind: 'handwritten-number', question: '2. Edad (años)' },
    {
      id: 'nivel_instruccion',
      kind: 'single-choice',
      question: '3. Nivel de instrucción',
      options: [
        { id: 'secundaria', label: 'Secundaria' },
        { id: 'tecnico', label: 'Técnico' },
        { id: 'universitario', label: 'Universitario' },
      ],
    },
    {
      id: 'lugar_nacimiento',
      kind: 'single-choice',
      question: '4. Lugar de nacimiento',
      options: [
        { id: 'costa', label: 'Costa' },
        { id: 'sierra', label: 'Sierra' },
        { id: 'selva', label: 'Selva' },
        { id: 'extranjero', label: 'Extranjero(a)' },
      ],
    },
    {
      id: 'condicion_religiosa',
      kind: 'single-choice',
      question: '5. Condición religiosa',
      options: [
        { id: 'bautizado', label: 'Bautizado' },
        { id: 'no_bautizado', label: 'No bautizado' },
      ],
    },
    {
      id: 'tiempo_bautizado',
      kind: 'single-choice',
      question: '5a. Tiempo de bautizado (aprox.)',
      dependsOn: { fieldId: 'condicion_religiosa', requiredOptionId: 'bautizado' },
      options: [
        { id: 'menos_1', label: 'Menos o igual a 1 año' },
        { id: 'mas_2', label: '2 años o más' },
      ],
    },
    {
      id: 'situacion_civil',
      kind: 'single-choice',
      question: '6. Situación civil',
      options: [
        { id: 'casado', label: 'Casado[a]' },
        { id: 'conviviente', label: 'Conviviente' },
        { id: 'soltero', label: 'Soltero[a]' },
        { id: 'divorciado', label: 'Divorciado[a]' },
        { id: 'viudo', label: 'Viudo[a]' },
      ],
    },

    // --- Escala I, filas 1 a 9 (siguen en la misma hoja física) ---
    likertRow('sufr', 1, 'Mi sufrimiento es un reflejo de la voluntad de Dios.', CIERTO_EN_MI),
    likertRow('sufr', 2, 'Dios está presente en mi sufrimiento', CIERTO_EN_MI),
    likertRow('sufr', 3, 'Dios utiliza mi sufrimiento para cumplir sus propósitos', CIERTO_EN_MI),
    likertRow('sufr', 4, 'Dios es glorificado a través de mi sufrimiento.', CIERTO_EN_MI),
    likertRow('sufr', 5, 'Experimento a Dios a través de mi sufrimiento', CIERTO_EN_MI),
    likertRow('sufr', 6, 'Mi sufrimiento cobra sentido cuando se lo entrego a Dios', CIERTO_EN_MI),
    likertRow('sufr', 7, 'Mi sufrimiento profundiza mi relación con Dios', CIERTO_EN_MI),
    likertRow('sufr', 8, 'Dios me habla a través de mi sufrimiento', CIERTO_EN_MI),
    likertRow('sufr', 9, 'Dios usa la Biblia para hablarme en medio de mi sufrimiento', CIERTO_EN_MI),
  ],
}

// ---------------------------------------------------------------------------
// PÁGINA 2 — Escala I, filas 10 a 21 (sufrimiento 10-11, alimentación 12-17, autoeficacia 18-21)
// ---------------------------------------------------------------------------
const page2: SurveyPageTemplate = {
  pageNumber: 2,
  title: 'Escala (filas 10-21)',
  description: 'Desde la fila 10 ("Mi sufrimiento me hace más semejante a Cristo") hasta la fila 21 ("...seguir con una dieta saludable")',
  fields: [
    likertRow('sufr', 10, 'Mi sufrimiento me hace más semejante a Cristo.', CIERTO_EN_MI),
    likertRow('sufr', 11, 'Mi sufrimiento me une al sufrimiento de Jesucristo', CIERTO_EN_MI),

    likertRow('alim', 12, 'En el lugar donde vivo tengo acceso a mercados o tiendas donde se ofrece una buena variedad de alimentos frescos y en buen estado.', NUNCA_SIEMPRE_5),
    likertRow('alim', 13, 'Cuento con los recursos económicos suficientes para comprar alimentos saludables sin descuidar otras necesidades básicas.', NUNCA_SIEMPRE_5),
    likertRow('alim', 14, 'Puedo guardar, conservar y preparar mis alimentos de forma segura, saludable e higiénica para aprovechar sus nutrientes.', NUNCA_SIEMPRE_5),
    likertRow('alim', 15, 'Mantengo mi alimentación saludable incluso cuando hay alzas de precios, emergencias sanitarias, conflictos sociales o desastres climáticos.', NUNCA_SIEMPRE_5),
    likertRow('alim', 16, 'Puedo elegir mis alimentos entre distintas opciones según su origen, forma de producción o lugar de venta.', NUNCA_SIEMPRE_5),
    likertRow('alim', 17, 'Al elegir mis alimentos, considero que sean buenos para mi salud, respetuosos con el ambiente y justos con quienes los producen.', NUNCA_SIEMPRE_5),

    likertRow('auto', 18, 'Cuando me propongo comer de forma saludable, confío en que puedo lograrlo porque antes ya he superado retos similares en el pasado.', CIERTO_EN_MI),
    likertRow('auto', 19, 'Cuando veo a personas como yo alimentarse de forma saludable, me siento capaz de hacerlo también.', CIERTO_EN_MI),
    likertRow('auto', 20, 'Las palabras de apoyo o motivación de otras personas me hacen sentir más seguro de mi capacidad para mantener una dieta saludable.', CIERTO_EN_MI),
    likertRow('auto', 21, 'Aunque tenga ansiedad o antojos, creo que puedo mantener el control y seguir con una dieta saludable.', CIERTO_EN_MI),
  ],
}

// ---------------------------------------------------------------------------
// PÁGINA 3 — "Durante el último mes..." (1-5) + estrés (6-8) + rumiación (9-11) + PHQ-4 (1-4)
// ---------------------------------------------------------------------------
const NUNCA_SIEMPRE_MES = ['Nunca', 'Pocas veces', 'A veces', 'Muchas veces', 'Siempre']
const PHQ4 = ['Ningún día', 'Varios días', 'Más de la mitad de los días', 'Todos los días']

const page3: SurveyPageTemplate = {
  pageNumber: 3,
  title: 'Estado de ánimo y estrés',
  description: 'Desde "Durante el último mes..." hasta "No poder detener o controlar la preocupación"',
  fields: [
    likertRow('mes', 1, '¿Con qué frecuencia te has sentido muy nervioso?', NUNCA_SIEMPRE_MES),
    likertRow('mes', 2, '¿Con qué frecuencia te has sentido tranquilo y en paz?', NUNCA_SIEMPRE_MES),
    likertRow('mes', 3, '¿Con qué frecuencia te has sentido desanimado o triste?', NUNCA_SIEMPRE_MES),
    likertRow('mes', 4, '¿Con qué frecuencia te has sentido feliz?', NUNCA_SIEMPRE_MES),
    likertRow('mes', 5, '¿Con qué frecuencia te has sentido tan triste que nada lograba animarte?', NUNCA_SIEMPRE_MES),

    likertRow('estres', 6, '¿Con qué frecuencia has experimentado situaciones que te han causado estrés?', ['Nunca', 'Rara vez', 'A veces', 'Casi siempre', 'Siempre']),
    likertRow('estres', 7, 'Cuando has estado estresado(a), ¿qué tan intensa ha sido esa sensación?', ['Muy leve', 'Leve', 'Moderada', 'Intensa', 'Muy intensa']),
    likertRow('estres', 8, 'En promedio, ¿cuánto tiempo suele durar el estrés cada vez que lo experimentas?', ['Nada de tiempo', 'Poco tiempo', 'Algo de tiempo', 'Bastante tiempo', 'Mucho tiempo']),

    likertRow('rum', 9, '¿Con qué frecuencia te sientes deprimido(a) o preocupado(a) por eventos del pasado?', NUNCA_SIEMPRE_MES),
    likertRow('rum', 10, '¿Con qué frecuencia te sientes estresado(a) o tensionado(a) por las situaciones que enfrentas actualmente?', NUNCA_SIEMPRE_MES),
    likertRow('rum', 11, '¿Con qué frecuencia te sientes ansioso(a) o inquieto(a) por el futuro?', NUNCA_SIEMPRE_MES),

    likertRow('phq', 1, 'Poco interés o placer en hacer las cosas.', PHQ4),
    likertRow('phq', 2, 'Sentirse decaído(a), deprimido(a) o sin esperanzas.', PHQ4),
    likertRow('phq', 3, 'Sentirse nervioso, ansioso o al límite.', PHQ4),
    likertRow('phq', 4, 'No poder detener o controlar la preocupación.', PHQ4),
  ],
}

// ---------------------------------------------------------------------------
// PÁGINA 4 — Paz (5-7) + calificación general (8-16) + estrés (17)
// ---------------------------------------------------------------------------
const PAZ = ['Nada en paz', 'Poco en paz', 'Moderadamente en paz', 'Bastante en paz', 'Totalmente en paz']
const PESIMO_EXCELENTE = ['Pésimo', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Muy bueno', 'Excelente']
const PESIMO_MUYALTO = ['Pésimo', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Alto', 'Muy alto']

const page4: SurveyPageTemplate = {
  pageNumber: 4,
  title: 'Paz y bienestar general',
  description: 'Desde "¿Te sientes en paz contigo mismo(a)?" hasta "¿Cómo calificarías tu nivel de estrés?"',
  fields: [
    likertRow('paz', 5, '¿Te sientes en paz contigo mismo(a)?', PAZ),
    likertRow('paz', 6, '¿Te sientes en paz con Dios?', PAZ),
    likertRow('paz', 7, '¿Te sientes en paz con tus semejantes (amigos[a], familiares, hermanos, vecino[as], compañeros de estudio, etc.)?', PAZ),

    likertRow('gen', 8, 'En general, ¿cómo calificarías tu nivel de felicidad?', PESIMO_EXCELENTE),
    likertRow('gen', 9, 'En general, ¿cómo calificarías tus hábitos de alimentación?', PESIMO_EXCELENTE),
    likertRow('gen', 10, 'En general, ¿cómo calificarías tu nivel de bienestar espiritual?', PESIMO_EXCELENTE),
    likertRow('gen', 11, 'En general, ¿cómo calificarías tu nivel de bienestar social?', PESIMO_EXCELENTE),
    likertRow('gen', 12, 'En general, ¿cómo calificarías tu nivel de bienestar psicológico o emocional?', PESIMO_EXCELENTE),
    likertRow('gen', 13, 'En general, ¿cómo calificarías tu bienestar físico o de salud física?', PESIMO_EXCELENTE),
    likertRow('gen', 14, 'En general, ¿cómo calificarías tu situación financiera?', PESIMO_EXCELENTE),
    likertRow('gen', 15, 'En general, ¿cómo calificarías tu nivel de autoestima o amor propio?', PESIMO_EXCELENTE),
    likertRow('gen', 16, 'En general, ¿cómo crees que las demás personas perciben tu nivel de felicidad?', PESIMO_EXCELENTE),

    likertRow('gen', 17, 'En general, ¿cómo calificarías tu nivel de estrés?', PESIMO_MUYALTO),
  ],
}

export const SURVEY_TEMPLATE: SurveyPageTemplate[] = [page1, page2, page3, page4]

export function getAllFields(): SurveyField[] {
  return SURVEY_TEMPLATE.flatMap((p) => p.fields)
}

export function getFieldById(id: string): SurveyField | undefined {
  return getAllFields().find((f) => f.id === id)
}
