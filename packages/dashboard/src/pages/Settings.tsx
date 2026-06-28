import { useEffect, useState } from 'react'
import { Settings as SettingsIcon, Server, Key, Copy, Check, RefreshCw, ExternalLink } from 'lucide-react'

interface ServerHealth {
  status: string
  version?: string
  uptime?: number
}

export function Settings() {
  const [health, setHealth] = useState<ServerHealth | null>(null)
  const [serverUrl, setServerUrl] = useState('http://localhost:3100')
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    checkHealth()
  }, [])

  async function checkHealth() {
    try {
      const res = await fetch('/health')
      if (res.ok) {
        const data = await res.json()
        setHealth(data)
      } else {
        setHealth(null)
      }
    } catch {
      setHealth(null)
    }
  }

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  function formatUptime(ms: number) {
    const s = Math.floor(ms / 1000)
    if (s < 60) return `${s}s`
    if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    return `${h}h ${m}m`
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center">
          <SettingsIcon size={20} className="text-neutral-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Settings</h2>
          <p className="text-xs text-neutral-400">Authority server configuration</p>
        </div>
      </div>

      {/* Server Status */}
      <div className="rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 bg-neutral-50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Server size={15} />
            Authority Server
          </div>
          <button
            onClick={checkHealth}
            className="text-xs text-neutral-400 hover:text-neutral-600 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-500">Status</span>
            {health ? (
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium">Connected</span>
            ) : (
              <span className="text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-600 font-medium">Disconnected</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-500">Endpoint</span>
            <code className="text-xs font-mono text-neutral-600 bg-neutral-50 px-2 py-0.5 rounded">{serverUrl}</code>
          </div>
          {health?.uptime != null && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-500">Uptime</span>
              <span className="text-xs text-neutral-600">{formatUptime(health.uptime)}</span>
            </div>
          )}
          {!health && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs text-amber-700">
                Cannot reach the authority server. Start it with:
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="text-xs font-mono bg-white px-2 py-1 rounded border border-amber-200 text-amber-800 flex-1">
                  npx @passport-agent/server
                </code>
                <button
                  onClick={() => copyText('npx @passport-agent/server', 'start')}
                  className="p-1.5 text-amber-600 hover:text-amber-800 cursor-pointer"
                >
                  {copied === 'start' ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Reference */}
      <div className="rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 bg-neutral-50">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Key size={15} />
            API Reference
          </div>
        </div>
        <div className="divide-y divide-neutral-100">
          {[
            { method: 'POST', path: '/v1/passports', desc: 'Issue a new passport' },
            { method: 'GET', path: '/v1/passports', desc: 'List all passports' },
            { method: 'GET', path: '/v1/passports/:id', desc: 'Get passport details' },
            { method: 'POST', path: '/v1/passports/:id/authorize', desc: 'Authorize an action' },
            { method: 'POST', path: '/v1/passports/:id/revoke', desc: 'Revoke passport + children' },
            { method: 'GET', path: '/v1/passports/:id/audit', desc: 'Get audit log for passport' },
            { method: 'GET', path: '/v1/audit?limit=100', desc: 'Get global audit log' },
          ].map((ep) => (
            <div key={ep.path + ep.method} className="px-5 py-3 flex items-center gap-3">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                ep.method === 'GET' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
              }`}>
                {ep.method}
              </span>
              <code className="text-xs font-mono text-neutral-700 flex-1">{ep.path}</code>
              <span className="text-xs text-neutral-400">{ep.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SDK Install */}
      <div className="rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 bg-neutral-50">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ExternalLink size={15} />
            Quick Start
          </div>
        </div>
        <div className="px-5 py-4 space-y-3">
          {[
            { label: 'Install SDK', cmd: 'npm install @passport-agent/sdk' },
            { label: 'Start server', cmd: 'npx @passport-agent/server' },
            { label: 'MCP plugin', cmd: 'npm install @passport-agent/mcp' },
          ].map((item) => (
            <div key={item.cmd} className="flex items-center justify-between">
              <span className="text-xs text-neutral-500">{item.label}</span>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono text-neutral-600 bg-neutral-50 px-2 py-1 rounded">{item.cmd}</code>
                <button
                  onClick={() => copyText(item.cmd, item.cmd)}
                  className="p-1 text-neutral-300 hover:text-neutral-600 cursor-pointer"
                >
                  {copied === item.cmd ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
