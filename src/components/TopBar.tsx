import { NavLink } from 'react-router-dom'
import { Moon, Sun, ScanLine, Settings2, SlidersHorizontal } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'

const NAV_ITEMS = [
  { to: '/', label: 'Escanear', icon: ScanLine },
  { to: '/calibracion', label: 'Calibración', icon: SlidersHorizontal },
  { to: '/configuracion', label: 'Google Forms', icon: Settings2 },
]

export function TopBar() {
  const { theme, toggle } = useTheme()

  return (
    <header className="sticky top-0 z-30 border-b border-ink-900/8 bg-paper-50/90 backdrop-blur dark:border-paper-100/10 dark:bg-ink-950/90">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-signal-teal text-paper-50">
            <ScanLine size={18} strokeWidth={2.25} />
          </div>
          <div>
            <p className="font-display text-[15px] font-semibold leading-tight">Encuesta Scanner AI</p>
            <p className="hidden text-[11px] leading-tight text-ink-900/45 dark:text-paper-100/45 sm:block">
              Digitalización automática de encuestas
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-ink-900 text-paper-50 dark:bg-paper-100 dark:text-ink-950'
                    : 'text-ink-900/60 hover:bg-ink-900/5 dark:text-paper-100/60 dark:hover:bg-paper-100/10'
                }`
              }
            >
              <Icon size={15} />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
          <button
            onClick={toggle}
            aria-label="Cambiar tema"
            className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-ink-900/60 hover:bg-ink-900/5 dark:text-paper-100/60 dark:hover:bg-paper-100/10"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </nav>
      </div>
    </header>
  )
}
