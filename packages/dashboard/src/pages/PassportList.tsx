import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type PassportData } from '../lib/api'
import { Shield, ShieldOff, Clock, User, ChevronRight, ChevronDown, Copy, Check, GitBranch } from 'lucide-react'
import { StatsOverview } from '../components/StatsOverview'

interface PassportWithStatus {
  passport: PassportData
  revoked: boolean
}

export function PassportList() {
  const navigate = useNavigate()
  const [passports, setPassports] = useState<PassportWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    loadPassports()
  }, [])

  async function loadPassports() {
    try {
      setLoading(true)
      const data = await api.listPassports()
      if (data.passports) {
        const detailed = await Promise.all(
          data.passports.map(async (p) => {
            try {
              const d = await api.getPassport(p.id)
              return d
            } catch {
              return { passport: p, revoked: false }
            }
          })
        )
        setPassports(detailed)
      } else {
        setPassports([])
      }
    } catch {
      setError('Could not connect to passport authority. Is the server running on :3100?')
    } finally {
      setLoading(false)
    }
  }

  async function handleRevoke(id: string) {
    await api.revokePassport(id)
    loadPassports()
  }

  function copyId(id: string) {
    navigator.clipboard.writeText(id)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  if (loading) {
    return <div className="text-neutral-400 text-sm">Loading...</div>
  }

  if (error) {
    return (
      <div className="rounded-xl border border-neutral-200 p-12 text-center">
        <Shield size={32} className="mx-auto mb-4 text-neutral-300" />
        <p className="text-sm text-neutral-500 mb-2">{error}</p>
        <code className="text-xs text-neutral-400 bg-neutral-50 px-2 py-1 rounded">npx @passport-agent/server</code>
      </div>
    )
  }

  if (passports.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-200 p-16 text-center">
        <Shield size={32} className="mx-auto mb-4 text-neutral-300" />
        <p className="text-sm text-neutral-500 mb-1">No passports issued yet</p>
        <p className="text-xs text-neutral-400">Issue one from the "Issue" tab or via the API</p>
      </div>
    )
  }

  const children = passports.filter(({ passport }) => passport.parentId)

  function getChildren(parentId: string): PassportWithStatus[] {
    return children.filter(({ passport }) => passport.parentId === parentId)
  }

  return (
    <div className="space-y-3">
      <StatsOverview />
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Active Passports</h2>
        <span className="text-xs text-neutral-400">{passports.length} total</span>
      </div>

      {passports.map(({ passport: p, revoked }) => {
        const expired = Date.now() > p.exp
        const active = !revoked && !expired
        const isExpanded = expanded === p.id
        const delegatedChildren = getChildren(p.id)
        const remaining = p.limits.maxSpend - p.limits.spent
        const spentPct = p.limits.maxSpend > 0 ? (p.limits.spent / p.limits.maxSpend) * 100 : 0

        return (
          <div key={p.id}>
            <div
              className={`rounded-xl border p-5 transition-colors cursor-pointer ${
                active ? 'border-neutral-200 hover:border-neutral-300' : 'border-neutral-100 bg-neutral-50 opacity-60'
              } ${isExpanded ? 'rounded-b-none border-b-0' : ''}`}
              onClick={() => setExpanded(isExpanded ? null : p.id)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {active ? (
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <Shield size={16} className="text-emerald-600" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center">
                      <ShieldOff size={16} className="text-neutral-400" />
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-sm">{p.sub}</div>
                    <div className="text-xs text-neutral-400 font-mono">{p.id.slice(0, 12)}...</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {delegatedChildren.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 flex items-center gap-1">
                      <GitBranch size={10} />
                      {delegatedChildren.length} delegated
                    </span>
                  )}
                  {revoked && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600">revoked</span>
                  )}
                  {expired && !revoked && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">expired</span>
                  )}
                  {active && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRevoke(p.id); }}
                      className="text-xs px-3 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      Revoke
                    </button>
                  )}
                  {isExpanded ? <ChevronDown size={16} className="text-neutral-400" /> : <ChevronRight size={16} className="text-neutral-400" />}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <div className="flex items-center gap-1 text-neutral-400 mb-1">
                    <User size={12} />
                    Principal
                  </div>
                  <div className="text-neutral-700 font-mono">{p.principal}</div>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-neutral-400 mb-1">
                    <Clock size={12} />
                    Expires
                  </div>
                  <div className="text-neutral-700">{new Date(p.exp).toLocaleString()}</div>
                </div>
                <div>
                  {p.limits.maxSpend > 0 && (
                    <>
                      <div className="text-neutral-400 mb-1">Budget</div>
                      <div className="text-neutral-700">
                        ${remaining} / ${p.limits.maxSpend} {p.limits.currency}
                      </div>
                      <div className="mt-1 h-1 rounded-full bg-neutral-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${Math.min(spentPct, 100)}%` }}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.permissions.map((perm) => (
                  <span key={perm.action} className="text-xs px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600 font-mono">
                    {perm.action}
                  </span>
                ))}
              </div>

              {p.parentId && (
                <div className="mt-3 flex items-center gap-1 text-xs text-neutral-400">
                  <ChevronRight size={12} />
                  Delegated from {p.parentId.slice(0, 12)}...
                </div>
              )}
            </div>

            {/* Expanded Detail Panel */}
            {isExpanded && (
              <div className={`rounded-b-xl border border-t-0 border-neutral-200 bg-neutral-50 px-5 py-4 space-y-4 ${!active ? 'opacity-60' : ''}`}>
                {/* Full ID + View Details */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-xs text-neutral-400 mb-1">Passport ID</div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono text-neutral-600 bg-white px-2 py-1 rounded border border-neutral-200 flex-1 break-all">{p.id}</code>
                      <button onClick={(e) => { e.stopPropagation(); copyId(p.id); }} className="p-1.5 text-neutral-400 hover:text-neutral-600 cursor-pointer">
                        {copied === p.id ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/passports/${p.id}`); }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 transition-colors cursor-pointer ml-3 mt-4"
                  >
                    View Details →
                  </button>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-neutral-400">Issued at</span>
                    <div className="text-neutral-700 mt-0.5">{new Date(p.iat).toLocaleString()}</div>
                  </div>
                  <div>
                    <span className="text-neutral-400">Expires at</span>
                    <div className="text-neutral-700 mt-0.5">{new Date(p.exp).toLocaleString()}</div>
                  </div>
                  <div>
                    <span className="text-neutral-400">Agent</span>
                    <div className="text-neutral-700 font-mono mt-0.5">{p.sub}</div>
                  </div>
                  <div>
                    <span className="text-neutral-400">Principal</span>
                    <div className="text-neutral-700 font-mono mt-0.5">{p.principal}</div>
                  </div>
                </div>

                {/* Delegation Chain */}
                {(p.parentId || delegatedChildren.length > 0) && (
                  <div>
                    <div className="text-xs text-neutral-400 mb-2 flex items-center gap-1">
                      <GitBranch size={12} />
                      Delegation Chain
                    </div>
                    <div className="space-y-1.5">
                      {p.parentId && (
                        <div className="flex items-center gap-2 text-xs">
                          <div className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
                          <span className="text-neutral-400">Parent:</span>
                          <code className="font-mono text-neutral-600">{p.parentId.slice(0, 20)}...</code>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-neutral-500 font-medium">This passport</span>
                        <code className="font-mono text-neutral-400">{p.id.slice(0, 20)}...</code>
                      </div>
                      {delegatedChildren.map(({ passport: child, revoked: childRevoked }) => (
                        <div key={child.id} className="flex items-center gap-2 text-xs ml-4">
                          <div className={`w-1.5 h-1.5 rounded-full ${childRevoked ? 'bg-red-400' : 'bg-blue-400'}`} />
                          <span className="text-neutral-400">Child:</span>
                          <code className="font-mono text-neutral-600">{child.sub}</code>
                          <code className="font-mono text-neutral-400">{child.id.slice(0, 12)}...</code>
                          {childRevoked && <span className="text-[10px] text-red-500">revoked</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Permissions Detail */}
                <div>
                  <div className="text-xs text-neutral-400 mb-2">Permissions ({p.permissions.length})</div>
                  <div className="space-y-1">
                    {p.permissions.map((perm) => (
                      <div key={perm.action} className="flex items-center gap-2 text-xs bg-white px-3 py-2 rounded-lg border border-neutral-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <code className="font-mono text-neutral-700">{perm.action}</code>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
