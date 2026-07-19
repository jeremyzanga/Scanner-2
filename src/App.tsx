import { Routes, Route } from 'react-router-dom'
import { TopBar } from './components/TopBar'
import { ScanSessionProvider } from './hooks/useScanSession'
import ScanPage from './pages/ScanPage'
import CalibrationPage from './pages/CalibrationPage'
import ReviewPage from './pages/ReviewPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <ScanSessionProvider>
      <div className="min-h-screen bg-paper-50 dark:bg-ink-950">
        <TopBar />
        <main>
          <Routes>
            <Route path="/" element={<ScanPage />} />
            <Route path="/calibracion" element={<CalibrationPage />} />
            <Route path="/revision" element={<ReviewPage />} />
            <Route path="/configuracion" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </ScanSessionProvider>
  )
}
