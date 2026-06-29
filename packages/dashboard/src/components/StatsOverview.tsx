import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Shield, CheckCircle, DollarSign, GitBranch } from 'lucide-react'

interface Stats {
  passports: { total: number; active: number; revoked: number }
  authorizations: { total: number; allowed: number; denied: number }
  spend: { total: number }
  delegations: number
}

export function StatsOverview() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    api.getStats().then(setStats).catch(() => {})
  }, [])

  if (!stats) return null

  const cards = [
    {
      label: 'Passports',
      value: stats.passports.active,
      sub: `${stats.passports.total} total · ${stats.passports.revoked} revoked`,
      icon: Shield,
      color: 'text-teal-600 bg-teal-50',
    },
    {
      label: 'Authorizations',
      value: stats.authorizations.total,
      sub: `${stats.authorizations.allowed} allowed · ${stats.authorizations.denied} denied`,
      icon: CheckCircle,
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      label: 'Total Spent',
      value: `$${stats.spend.total.toFixed(2)}`,
      sub: 'across all passports',
      icon: DollarSign,
      color: 'text-amber-600 bg-amber-50',
    },
    {
      label: 'Delegations',
      value: stats.delegations,
      sub: 'active delegation chains',
      icon: GitBranch,
      color: 'text-blue-600 bg-blue-50',
    },
  ]

  return (
    <div className="grid grid-cols-4 gap-4 mb-8">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-neutral-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${card.color}`}>
              <card.icon size={14} />
            </div>
            <span className="text-xs text-neutral-400 font-medium">{card.label}</span>
          </div>
          <div className="text-2xl font-semibold mb-1">{card.value}</div>
          <div className="text-xs text-neutral-400">{card.sub}</div>
        </div>
      ))}
    </div>
  )
}
