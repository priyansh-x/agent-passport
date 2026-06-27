import { Routes, Route, NavLink } from 'react-router-dom'
import { Shield, LayoutDashboard, ScrollText, Plus } from 'lucide-react'
import { PassportList } from './pages/PassportList'
import { AuditLog } from './pages/AuditLog'
import { ConsentScreen } from './pages/ConsentScreen'

function NavItem({ to, icon: Icon, label }: { to: string; icon: typeof Shield; label: string }) {
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

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-200">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={18} strokeWidth={2.5} />
            <span className="font-semibold text-sm tracking-tight">agent passport</span>
          </div>
          <span className="text-xs text-neutral-400 font-mono">local authority</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <nav className="flex gap-1 mb-10">
          <NavItem to="/" icon={LayoutDashboard} label="Passports" />
          <NavItem to="/audit" icon={ScrollText} label="Audit Log" />
          <NavItem to="/consent" icon={Plus} label="Issue" />
        </nav>

        <Routes>
          <Route path="/" element={<PassportList />} />
          <Route path="/audit" element={<AuditLog />} />
          <Route path="/consent" element={<ConsentScreen />} />
        </Routes>
      </div>
    </div>
  )
}
