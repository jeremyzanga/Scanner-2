import React, { createContext, useContext, useState, useCallback } from 'react'
import { PageScanResult } from '../lib/scanPipeline'

interface ScanSessionState {
  results: Record<number, PageScanResult>
  setPageResult: (result: PageScanResult) => void
  reset: () => void
  isComplete: boolean
}

const ScanSessionContext = createContext<ScanSessionState | null>(null)

export function ScanSessionProvider({ children }: { children: React.ReactNode }) {
  const [results, setResults] = useState<Record<number, PageScanResult>>({})

  const setPageResult = useCallback((result: PageScanResult) => {
    setResults((prev) => ({ ...prev, [result.pageNumber]: result }))
  }, [])

  const reset = useCallback(() => setResults({}), [])

  const isComplete = [1, 2, 3, 4].every((p) => !!results[p])

  return (
    <ScanSessionContext.Provider value={{ results, setPageResult, reset, isComplete }}>
      {children}
    </ScanSessionContext.Provider>
  )
}

export function useScanSession(): ScanSessionState {
  const ctx = useContext(ScanSessionContext)
  if (!ctx) throw new Error('useScanSession debe usarse dentro de ScanSessionProvider')
  return ctx
}
