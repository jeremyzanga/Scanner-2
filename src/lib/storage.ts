import { CalibrationTemplate, EMPTY_TEMPLATE } from '../types/calibration'

const KEYS = {
  calibration: 'esa:calibration-template',
  googleFormsConfig: 'esa:google-forms-config',
  submittedCodes: 'esa:submitted-codes',
  theme: 'esa:theme',
} as const

// ---------------------------------------------------------------------------
// Calibración
// ---------------------------------------------------------------------------
export function loadCalibrationTemplate(): CalibrationTemplate {
  try {
    const raw = localStorage.getItem(KEYS.calibration)
    if (!raw) return structuredClone(EMPTY_TEMPLATE)
    return JSON.parse(raw) as CalibrationTemplate
  } catch {
    return structuredClone(EMPTY_TEMPLATE)
  }
}

export function saveCalibrationTemplate(template: CalibrationTemplate): void {
  localStorage.setItem(KEYS.calibration, JSON.stringify(template))
}

// ---------------------------------------------------------------------------
// Config de Google Forms
// ---------------------------------------------------------------------------
export interface GoogleFormsFieldMapping {
  /** id de nuestro campo/opción interno -> entry.xxxxx del Google Form */
  fieldId: string
  entryId: string
  /** Para single-choice: mapeo opción -> valor de texto exacto que espera el Form */
  optionValues?: Record<string, string>
}

export interface GoogleFormsConfig {
  formUrl: string
  formActionUrl: string | null
  mappings: GoogleFormsFieldMapping[]
  lastSyncedAt: string | null
}

const EMPTY_FORMS_CONFIG: GoogleFormsConfig = {
  formUrl: '',
  formActionUrl: null,
  mappings: [],
  lastSyncedAt: null,
}

export function loadGoogleFormsConfig(): GoogleFormsConfig {
  try {
    const raw = localStorage.getItem(KEYS.googleFormsConfig)
    if (!raw) return structuredClone(EMPTY_FORMS_CONFIG)
    return JSON.parse(raw) as GoogleFormsConfig
  } catch {
    return structuredClone(EMPTY_FORMS_CONFIG)
  }
}

export function saveGoogleFormsConfig(config: GoogleFormsConfig): void {
  localStorage.setItem(KEYS.googleFormsConfig, JSON.stringify(config))
}

// ---------------------------------------------------------------------------
// Códigos de encuesta ya enviados (para detectar duplicados)
// ---------------------------------------------------------------------------
export function getSubmittedCodes(): string[] {
  try {
    const raw = localStorage.getItem(KEYS.submittedCodes)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function isCodeAlreadySubmitted(code: string): boolean {
  return getSubmittedCodes().includes(code.trim())
}

export function markCodeAsSubmitted(code: string): void {
  const codes = getSubmittedCodes()
  const trimmed = code.trim()
  if (!codes.includes(trimmed)) {
    codes.push(trimmed)
    localStorage.setItem(KEYS.submittedCodes, JSON.stringify(codes))
  }
}

export function removeSubmittedCode(code: string): void {
  const codes = getSubmittedCodes().filter((c) => c !== code.trim())
  localStorage.setItem(KEYS.submittedCodes, JSON.stringify(codes))
}

// ---------------------------------------------------------------------------
// Tema
// ---------------------------------------------------------------------------
export type ThemePreference = 'light' | 'dark'

export function loadTheme(): ThemePreference {
  const raw = localStorage.getItem(KEYS.theme)
  if (raw === 'light' || raw === 'dark') return raw
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function saveTheme(theme: ThemePreference): void {
  localStorage.setItem(KEYS.theme, theme)
}
