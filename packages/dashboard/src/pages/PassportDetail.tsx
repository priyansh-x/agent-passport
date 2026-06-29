import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type PassportData, type AuditEntry, type TreeNode } from '../lib/api'
import {
  Shield, ShieldOff, ArrowLeft, Copy, Check, Clock, User,
  GitBranch, ScrollText, AlertTriangle, CheckCircle, XCircle, Key,
} from 'lucide-react'

interface Introspection {
  active: boolean
  id: string
  sub: string
  principal: string
  permissions: { action: string }[]
  limits: { maxSpend: number; currency: string; spent: number; remaining: number }
  revoked: boolean
  expired: boolean
  parentId: string | null
}

interface Validation {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export function PassportDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [passport, setPassport] = useState<PassportData | null>(null)
  const [introspection, setIntrospection] = useState<Introspection | null>(null)
  const [validation, setValidation] = useState<Validation | null>(null)
  const [tree, setTree] = useState<TreeNode | null>(null)
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState<'overview' | 'tree' | 'audit' | 'token'>('overview')

  useEffect(() => {
    if (!id) return
    loadAll(id)
  }, [id])

  async function loadAll(passportId: string) {
    try {
      setLoading(true)
      const [detail, intro, val, treeData, auditData] = await Promise.all([
        api.getPassport(passportId),
        api.getIntrospection(passportId),
        api.getValidation(passportId).catch(() => null),
        api.getTree(passportId).catch(() => null),
        api.getAuditLog(passportId),
      ])
      setPassport(detail.passport)
      setIntrospection(intro)
      setValidation(val)
      setTree(treeData)
      setAudit(auditData.entries)
    } catch {
      setError('Failed to load passport details')
    } finally {
      setLoading(false)
    }
  }

  async function loadToken() {
    if (!id) return
    const data = await api.getToken(id)
    setToken(data.token)
  }

  async function handleRevoke() {
    if (!id) return
    await api.revokePassport(id)
    loadAll(id)
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <div className="text-neutral-400 text-sm">Loading...</div>
  if (error || !passport || !introspection) {
    return (
      <div className="text-center py-16">
        <ShieldOff size={32} className="mx-auto mb-4 text-neutral-300" />
        <p className="text-sm text-neutral-500">{error ?? 'Passport not found'}</p>
        <button onClick={() => navigate('/')} className="mt-4 text-xs text-neutral-400 hover:text-neutral-600 cursor-pointer">
          ← Back to list
        </button>
      </div>
    )
  }

  const active = introspection.active
  const remaining = introspection.limits.remaining
  const spentPct = introspection.limits.maxSpend > 0
    ? (introspection.limits.spent / introspection.limits.maxSpend) * 100
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/')} className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 cursor-pointer">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
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
              <h1 className="text-lg font-semibold">{passport.sub}</h1>
              <div className="flex items-center gap-2">
                <code className="text-xs text-neutral-400 font-mono">{id}</code>
                <button onClick={() => copyText(id!)} className="text-neutral-300 hover:text-neutral-500 cursor-pointer">
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {introspection.revoked && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-600 font-medium">Revoked</span>
          )}
          {introspection.expired && !introspection.revoked && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 font-medium">Expired</span>
          )}
          {active && (
            <>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 font-medium">Active</span>
              <button
                onClick={handleRevoke}
                className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              >
                Revoke
              </button>
            </>
          )}
        </div>
      </div>

      {/* Validation Banner */}
      {validation && !validation.valid && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="flex items-center gap-2 text-sm text-red-700 font-medium mb-1">
            <XCircle size={14} />
            Validation Failed
          </div>
          {validation.errors.map((e, i) => (
            <div key={i} className="text-xs text-red-600 ml-5">• {e}</div>
          ))}
        </div>
      )}
      {validation && validation.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-2 text-sm text-amber-700 font-medium mb-1">
            <AlertTriangle size={14} />
            Warnings
          </div>
          {validation.warnings.map((w, i) => (
            <div key={i} className="text-xs text-amber-600 ml-5">• {w}</div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-neutral-200">
        {(['overview', 'tree', 'audit', 'token'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); if (t === 'token' && !token) loadToken(); }}
            className={`px-4 py-2 text-sm capitalize transition-colors cursor-pointer ${
              tab === t ? 'border-b-2 border-neutral-900 text-neutral-900 font-medium' : 'text-neutral-400 hover:text-neutral-600'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-6">
            <InfoCard icon={User} label="Principal" value={passport.principal} mono />
            <InfoCard icon={Clock} label="Issued" value={new Date(passport.iat).toLocaleString()} />
            <InfoCard icon={Clock} label="Expires" value={new Date(passport.exp).toLocaleString()} />
            {passport.parentId && (
              <div>
                <div className="text-xs text-neutral-400 mb-1 flex items-center gap-1"><GitBranch size={12} /> Parent</div>
                <button
                  onClick={() => navigate(`/passports/${passport.parentId}`)}
                  className="text-xs font-mono text-blue-600 hover:underline cursor-pointer"
                >
                  {passport.parentId}
                </button>
              </div>
            )}
          </div>

          {/* Budget */}
          {introspection.limits.maxSpend > 0 && (
            <div className="rounded-xl border border-neutral-200 p-5">
              <div className="text-xs text-neutral-400 mb-3">Budget</div>
              <div className="flex items-end justify-between mb-2">
                <div>
                  <span className="text-2xl font-semibold">${remaining}</span>
                  <span className="text-sm text-neutral-400 ml-1">remaining</span>
                </div>
                <div className="text-xs text-neutral-400">
                  ${introspection.limits.spent} / ${introspection.limits.maxSpend} {introspection.limits.currency}
                </div>
              </div>
              <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${spentPct > 80 ? 'bg-red-500' : spentPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(spentPct, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Permissions */}
          <div>
            <div className="text-xs text-neutral-400 mb-3">Permissions ({passport.permissions.length})</div>
            <div className="grid grid-cols-2 gap-2">
              {passport.permissions.map((perm) => (
                <div key={perm.action} className="flex items-center gap-2 text-sm bg-neutral-50 px-4 py-2.5 rounded-lg border border-neutral-200">
                  <CheckCircle size={13} className="text-emerald-500" />
                  <code className="font-mono text-neutral-700">{perm.action}</code>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'tree' && (
        <div className="rounded-xl border border-neutral-200 p-5">
          {tree ? (
            <TreeView node={tree} currentId={id!} onNavigate={(nid) => navigate(`/passports/${nid}`)} />
          ) : (
            <div className="text-center py-8 text-sm text-neutral-400">No delegation tree available</div>
          )}
        </div>
      )}

      {tab === 'audit' && (
        <div className="space-y-2">
          {audit.length === 0 ? (
            <div className="text-center py-8 text-sm text-neutral-400">
              <ScrollText size={24} className="mx-auto mb-2 text-neutral-300" />
              No audit entries yet
            </div>
          ) : (
            audit.map((entry, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-neutral-200 text-sm">
                {entry.allowed ? (
                  <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />
                ) : (
                  <XCircle size={14} className="text-red-500 flex-shrink-0" />
                )}
                <code className="font-mono text-neutral-700 flex-1">{entry.action}</code>
                {entry.reason && <span className="text-xs text-neutral-400">{entry.reason}</span>}
                <span className="text-xs text-neutral-400">{new Date(entry.timestamp).toLocaleTimeString()}</span>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'token' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-neutral-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <Key size={12} />
                Compact Token
              </div>
              {token && (
                <button
                  onClick={() => copyText(token)}
                  className="text-xs text-neutral-400 hover:text-neutral-600 flex items-center gap-1 cursor-pointer"
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  Copy
                </button>
              )}
            </div>
            {token ? (
              <code className="text-xs font-mono text-neutral-600 bg-neutral-50 p-3 rounded-lg block break-all leading-relaxed">
                {token}
              </code>
            ) : (
              <div className="text-sm text-neutral-400">Loading token...</div>
            )}
          </div>
          <p className="text-xs text-neutral-400">
            Use this token in the <code className="bg-neutral-100 px-1 rounded">x-agent-passport</code> header or as a <code className="bg-neutral-100 px-1 rounded">Bearer</code> token.
          </p>
        </div>
      )}
    </div>
  )
}

function InfoCard({ icon: Icon, label, value, mono }: { icon: typeof User; label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-neutral-400 mb-1 flex items-center gap-1"><Icon size={12} /> {label}</div>
      <div className={`text-sm text-neutral-700 ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  )
}

function TreeView({ node, currentId, onNavigate, depth = 0 }: { node: TreeNode; currentId: string; onNavigate: (id: string) => void; depth?: number }) {
  const isCurrent = node.id === currentId
  return (
    <div className={depth > 0 ? 'ml-6 mt-2' : ''}>
      <div
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
          isCurrent ? 'bg-blue-50 border border-blue-200' : 'hover:bg-neutral-50 cursor-pointer'
        } ${node.revoked ? 'opacity-50' : ''}`}
        onClick={() => !isCurrent && onNavigate(node.id)}
      >
        {depth > 0 && (
          <div className="flex items-center gap-1 text-neutral-300">
            <div className="w-4 border-t border-neutral-300" />
            <GitBranch size={12} />
          </div>
        )}
        <div className={`w-2 h-2 rounded-full ${node.revoked ? 'bg-red-400' : 'bg-emerald-400'}`} />
        <span className="font-mono font-medium">{node.agent}</span>
        <span className="text-xs text-neutral-400">{node.id.slice(0, 8)}...</span>
        <div className="flex-1" />
        <div className="flex gap-1">
          {node.permissions.map((p) => (
            <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500 font-mono">{p}</span>
          ))}
        </div>
        {node.maxSpend > 0 && (
          <span className="text-[10px] text-neutral-400">${node.maxSpend}</span>
        )}
        {node.revoked && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-500">revoked</span>
        )}
      </div>
      {node.children.map((child) => (
        <TreeView key={child.id} node={child} currentId={currentId} onNavigate={onNavigate} depth={depth + 1} />
      ))}
    </div>
  )
}
