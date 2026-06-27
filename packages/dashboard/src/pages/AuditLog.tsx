import { useEffect, useState } from 'react'
import { api, type AuditEntry } from '../lib/api'
import { CheckCircle2, XCircle, ScrollText } from 'lucide-react'

export function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getAuditLog().then((data) => {
      setEntries(data.entries ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="text-neutral-400 text-sm">Loading...</div>
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-200 p-16 text-center">
        <ScrollText size={32} className="mx-auto mb-4 text-neutral-300" />
        <p className="text-sm text-neutral-500 mb-1">No audit entries yet</p>
        <p className="text-xs text-neutral-400">Actions will appear here once passports are used</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Audit Log</h2>
        <span className="text-xs text-neutral-400">{entries.length} entries</span>
      </div>

      <div className="rounded-xl border border-neutral-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 bg-neutral-50">
              <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">Action</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">Passport</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">Time</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">Reason</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => (
              <tr key={i} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50 transition-colors">
                <td className="px-4 py-3">
                  {entry.allowed ? (
                    <CheckCircle2 size={16} className="text-emerald-500" />
                  ) : (
                    <XCircle size={16} className="text-red-500" />
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{entry.action}</td>
                <td className="px-4 py-3 font-mono text-xs text-neutral-400">
                  {entry.passport_id?.slice(0, 12) ?? '—'}...
                </td>
                <td className="px-4 py-3 text-xs text-neutral-500">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </td>
                <td className="px-4 py-3 text-xs text-neutral-400 max-w-48 truncate">
                  {entry.reason ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
