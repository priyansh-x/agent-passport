import { Routes, Route, NavLink } from 'react-router-dom'
import { LayoutDashboard, ScrollText, Plus, Settings as SettingsIcon } from 'lucide-react'
import { PassportList } from './pages/PassportList'
import { AuditLog } from './pages/AuditLog'
import { ConsentScreen } from './pages/ConsentScreen'
import { Settings } from './pages/Settings'
import { PassportDetail } from './pages/PassportDetail'

function NavItem({ to, icon: Icon, label }: { to: string; icon: typeof LayoutDashboard; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
          isActive ? 'bg-neutral-100 text-neutral-900 font-medium' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50'
        }`
      }
    >
      <Icon size={16} />
      {label}
    </NavLink>
  )
}

function ShieldLogo() {
  return (
    <svg width="18" height="22" viewBox="-7 -9.5 14 15" fill="none">
      <path
        d="M0,-8.5 C1.2,-8.5 6,-6.8 6,-3.4 L6,0 C3.6,1.275 1.2,3.4 0,4.25 C-1.2,3.4 -3.6,1.275 -6,0 L-6,-3.4 C-6,-6.8 -1.2,-8.5 0,-8.5Z"
        stroke="#18181b" strokeWidth="0.8" fill="none"
      />
      <path
        d="M0,-5.8 C0.8,-5.8 4,-4.64 4,-2.32 L4,0 C2.4,0.87 0.8,2.32 0,2.9 C-0.8,2.32 -2.4,0.87 -4,0 L-4,-2.32 C-4,-4.64 -0.8,-5.8 0,-5.8Z"
        stroke="#18181b" strokeWidth="0.5" strokeOpacity="0.3" fill="none"
      />
    </svg>
  )
}

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-200">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldLogo />
            <span className="font-semibold text-sm tracking-tight font-mono">agent passport</span>
          </div>
          <span className="text-xs text-neutral-400 font-mono">local authority</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <nav className="flex gap-1 mb-10">
          <NavItem to="/" icon={LayoutDashboard} label="Passports" />
          <NavItem to="/audit" icon={ScrollText} label="Audit Log" />
          <NavItem to="/consent" icon={Plus} label="Issue" />
          <NavItem to="/settings" icon={SettingsIcon} label="Settings" />
        </nav>

        <Routes>
          <Route path="/" element={<PassportList />} />
          <Route path="/passports/:id" element={<PassportDetail />} />
          <Route path="/audit" element={<AuditLog />} />
          <Route path="/consent" element={<ConsentScreen />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
    </div>
  )
}
