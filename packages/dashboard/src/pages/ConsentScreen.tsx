import { useState, useMemo } from 'react'
import { api } from '../lib/api'
import { Shield, Check, X, Plus, Trash2, AlertTriangle, Info, Clock, DollarSign } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const SCOPE_INFO: Record<string, { description: string; risk: 'low' | 'medium' | 'high' }> = {
  'read': { description: 'Read-only access to resources', risk: 'low' },
  'write': { description: 'Create and modify resources', risk: 'medium' },
  'delete': { description: 'Permanently remove resources', risk: 'high' },
  'admin': { description: 'Full administrative access', risk: 'high' },
  '*': { description: 'Unrestricted access to everything', risk: 'high' },
  'email:read': { description: 'Read email messages', risk: 'low' },
  'email:send': { description: 'Send emails on your behalf', risk: 'medium' },
  'calendar:read': { description: 'View calendar events', risk: 'low' },
  'calendar:write': { description: 'Create and modify calendar events', risk: 'medium' },
  'payment:charge': { description: 'Make payments and charges', risk: 'high' },
  'files:read': { description: 'Read files and documents', risk: 'low' },
  'files:write': { description: 'Upload and modify files', risk: 'medium' },
  'files:delete': { description: 'Delete files permanently', risk: 'high' },
}

function getScopeInfo(perm: string): { description: string; risk: 'low' | 'medium' | 'high' } {
  if (SCOPE_INFO[perm]) return SCOPE_INFO[perm]
  if (perm.endsWith(':*')) return { description: `Full access to ${perm.split(':')[0]}`, risk: 'high' }
  if (perm.endsWith(':read')) return { description: `Read access to ${perm.split(':')[0]}`, risk: 'low' }
  if (perm.endsWith(':write')) return { description: `Write access to ${perm.split(':')[0]}`, risk: 'medium' }
  if (perm.endsWith(':delete')) return { description: `Delete access to ${perm.split(':')[0]}`, risk: 'high' }
  return { description: `Access to ${perm}`, risk: 'medium' }
}

const riskColors = {
  low: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Low risk' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Medium risk' },
  high: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'High risk' },
}

export function ConsentScreen() {
  const navigate = useNavigate()
  const [principal, setPrincipal] = useState('')
  const [agent, setAgent] = useState('')
  const [permissions, setPermissions] = useState<string[]>([''])
  const [maxSpend, setMaxSpend] = useState('0')
  const [expiresInHours, setExpiresInHours] = useState('24')
  const [submitting, setSubmitting] = useState(false)
  const [issued, setIssued] = useState<string | null>(null)

  const validPerms = useMemo(() => permissions.filter((p) => p.trim() !== ''), [permissions])

  const overallRisk = useMemo(() => {
    if (validPerms.length === 0) return null
    const risks = validPerms.map((p) => getScopeInfo(p).risk)
    if (risks.includes('high')) return 'high'
    if (risks.includes('medium')) return 'medium'
    return 'low'
  }, [validPerms])

  const hasHighSpend = parseFloat(maxSpend) > 500
  const hasLongExpiry = parseFloat(expiresInHours) > 168 // > 1 week

  function addPermission() {
    setPermissions([...permissions, ''])
  }

  function removePermission(index: number) {
    setPermissions(permissions.filter((_, i) => i !== index))
  }

  function updatePermission(index: number, value: string) {
    const updated = [...permissions]
    updated[index] = value
    setPermissions(updated)
  }

  async function handleApprove() {
    if (!principal || !agent || validPerms.length === 0) return

    setSubmitting(true)
    try {
      const result = await api.issuePassport({
        principal,
        agent,
        permissions: validPerms,
        limits: { maxSpend: parseFloat(maxSpend) || 0 },
        expiresIn: (parseFloat(expiresInHours) || 24) * 60 * 60 * 1000,
      })
      setIssued(result.id)
    } catch {
      alert('Failed to issue passport. Is the server running?')
    } finally {
      setSubmitting(false)
    }
  }

  if (issued) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <Check size={24} className="text-emerald-600" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Passport Issued</h2>
          <p className="text-sm text-neutral-600 mb-4">
            <span className="font-medium">{agent}</span> is now authorized to act on behalf of <span className="font-medium">{principal}</span>
          </p>
          <code className="text-xs bg-white px-3 py-1.5 rounded-lg border border-emerald-200 font-mono text-neutral-600 block mb-6 break-all">
            {issued}
          </code>
          <button
            onClick={() => navigate('/')}
            className="text-sm px-4 py-2 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            View Passports
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Consent Card */}
      <div className="rounded-xl border border-neutral-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-neutral-100 bg-neutral-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center">
              <Shield size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Issue Agent Passport</h2>
              <p className="text-xs text-neutral-400">Authorize an agent to act on your behalf</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-5">
          {/* Principal */}
          <div>
            <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider block mb-1.5">
              Principal (who is authorizing)
            </label>
            <input
              type="text"
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
              placeholder="user:alice@company.com"
              className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-200 focus:outline-none focus:border-neutral-400 font-mono placeholder:text-neutral-300 transition-colors"
            />
          </div>

          {/* Agent */}
          <div>
            <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider block mb-1.5">
              Agent (who is being authorized)
            </label>
            <input
              type="text"
              value={agent}
              onChange={(e) => setAgent(e.target.value)}
              placeholder="agent:booking-bot"
              className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-200 focus:outline-none focus:border-neutral-400 font-mono placeholder:text-neutral-300 transition-colors"
            />
          </div>

          {/* Permissions with scope info */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Permissions
              </label>
              <button
                onClick={addPermission}
                className="text-xs text-neutral-400 hover:text-neutral-600 flex items-center gap-1 cursor-pointer"
              >
                <Plus size={12} /> Add
              </button>
            </div>
            <div className="space-y-2">
              {permissions.map((perm, i) => {
                const info = perm.trim() ? getScopeInfo(perm.trim()) : null
                const rc = info ? riskColors[info.risk] : null
                return (
                  <div key={i}>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={perm}
                        onChange={(e) => updatePermission(i, e.target.value)}
                        placeholder="calendar:read"
                        className="flex-1 px-3 py-2 text-sm rounded-lg border border-neutral-200 focus:outline-none focus:border-neutral-400 font-mono placeholder:text-neutral-300 transition-colors"
                      />
                      {permissions.length > 1 && (
                        <button
                          onClick={() => removePermission(i)}
                          className="p-2 text-neutral-300 hover:text-red-500 transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    {info && rc && (
                      <div className={`mt-1 flex items-center gap-2 px-2.5 py-1.5 rounded-md ${rc.bg} border ${rc.border}`}>
                        <Info size={12} className={rc.text} />
                        <span className={`text-xs ${rc.text}`}>{info.description}</span>
                        <span className={`text-xs ${rc.text} ml-auto font-medium`}>{rc.label}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Limits */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider block mb-1.5">
                <DollarSign size={10} className="inline -mt-0.5" /> Spend Limit (USD)
              </label>
              <input
                type="number"
                value={maxSpend}
                onChange={(e) => setMaxSpend(e.target.value)}
                min="0"
                className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-200 focus:outline-none focus:border-neutral-400 font-mono transition-colors"
              />
              {hasHighSpend && (
                <div className="mt-1 flex items-center gap-1.5 text-xs text-amber-600">
                  <AlertTriangle size={11} />
                  High spend limit
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider block mb-1.5">
                <Clock size={10} className="inline -mt-0.5" /> Expires in (hours)
              </label>
              <input
                type="number"
                value={expiresInHours}
                onChange={(e) => setExpiresInHours(e.target.value)}
                min="1"
                className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-200 focus:outline-none focus:border-neutral-400 font-mono transition-colors"
              />
              {hasLongExpiry && (
                <div className="mt-1 flex items-center gap-1.5 text-xs text-amber-600">
                  <AlertTriangle size={11} />
                  Expires in {Math.round(parseFloat(expiresInHours) / 24)} days
                </div>
              )}
            </div>
          </div>

          {/* Risk summary */}
          {overallRisk && (
            <div className={`rounded-lg border p-3 ${riskColors[overallRisk].bg} ${riskColors[overallRisk].border}`}>
              <div className="flex items-center gap-2 mb-1">
                {overallRisk === 'high' ? (
                  <AlertTriangle size={14} className={riskColors[overallRisk].text} />
                ) : (
                  <Info size={14} className={riskColors[overallRisk].text} />
                )}
                <span className={`text-xs font-semibold ${riskColors[overallRisk].text}`}>
                  {overallRisk === 'high' ? 'High-risk authorization' : overallRisk === 'medium' ? 'Review before approving' : 'Low-risk authorization'}
                </span>
              </div>
              <p className={`text-xs ${riskColors[overallRisk].text} opacity-80`}>
                {overallRisk === 'high'
                  ? 'This passport includes high-risk permissions. The agent will be able to perform destructive or financial actions.'
                  : overallRisk === 'medium'
                    ? 'This passport includes write permissions. The agent can modify resources on your behalf.'
                    : 'This passport includes only read permissions. The agent cannot modify any resources.'}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50 flex justify-end gap-3">
          <button
            onClick={() => navigate('/')}
            className="text-sm px-4 py-2 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-white transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <X size={14} />
            Cancel
          </button>
          <button
            onClick={handleApprove}
            disabled={submitting || !principal || !agent || validPerms.length === 0}
            className="text-sm px-4 py-2 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Check size={14} />
            {submitting ? 'Issuing...' : 'Approve & Issue'}
          </button>
        </div>
      </div>

      {/* Info */}
      <p className="text-center text-xs text-neutral-400 mt-6">
        This passport will be cryptographically signed and can be revoked at any time.
      </p>
    </div>
  )
}
