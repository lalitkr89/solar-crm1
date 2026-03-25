import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import Layout from '@/components/layout/Layout'
import { PageHeader, Avatar, Spinner } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import {
  RefreshCw, Activity, PauseCircle, BookOpen,
  UtensilsCrossed, Cookie, Clock, LogIn, LogOut, Users
} from 'lucide-react'
import {
  getAllPresalesToday,
  getAgentLeadStats,
  ATTENDANCE_STATUSES,
  STATUS_MAP,
  fmtSecs,
  fmtTime,
} from '@/lib/attendanceService'

// ─── Status icon map ──────────────────────────────────────────────────────────
const STATUS_ICONS = {
  active:   Activity,
  hold:     PauseCircle,
  training: BookOpen,
  lunch:    UtensilsCrossed,
  snacks:   Cookie,
}

// ─── Live clock for open sessions ────────────────────────────────────────────
function LiveDuration({ since }) {
  const [secs, setSecs] = useState(() =>
    since ? Math.round((Date.now() - new Date(since)) / 1000) : 0
  )
  useEffect(() => {
    if (!since) return
    const t = setInterval(() => setSecs(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [since])
  return <span>{fmtSecs(secs)}</span>
}

// ─── Agent row ────────────────────────────────────────────────────────────────
function AgentRow({ agent, leadStats }) {
  const cfg = agent.currentStatus ? STATUS_MAP[agent.currentStatus] : null
  const Icon = cfg ? STATUS_ICONS[agent.currentStatus] : null

  const totalActive = agent.breakdown?.active ?? 0
  const totalBreak  = (agent.breakdown?.hold ?? 0) +
                      (agent.breakdown?.lunch ?? 0) +
                      (agent.breakdown?.snacks ?? 0)
  const totalDay    = Object.values(agent.breakdown ?? {}).reduce((a, b) => a + b, 0)

  const uniqueLeads   = new Set(leadStats.map(l => l.lead_id)).size
  const totalLeadSecs = leadStats.reduce((a, l) => a + (l.duration_secs ?? 0), 0)

  return (
    <div className="grid gap-4 px-4 py-3 border-b border-slate-100 items-center hover:bg-slate-50/60 transition-colors"
      style={{ gridTemplateColumns: '200px 140px 1fr 140px 140px' }}>

      {/* Agent name */}
      <div className="flex items-center gap-2.5">
        <Avatar name={agent.name} size={30} color="#7F77DD" />
        <div>
          <div className="text-sm font-medium text-slate-800 leading-tight">{agent.name}</div>
          <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
            {agent.loginTime
              ? <><LogIn size={10} /> {fmtTime(agent.loginTime)}</>
              : <span className="text-slate-300">Not logged in</span>
            }
            {agent.logoutTime && <><LogOut size={10} className="ml-1" /> {fmtTime(agent.logoutTime)}</>}
          </div>
        </div>
      </div>

      {/* Current status */}
      <div>
        {cfg && Icon ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
            style={{ background: cfg.bg, color: cfg.color }}>
            <Icon size={11} />
            {cfg.label}
          </span>
        ) : (
          <span className="text-xs text-slate-300 italic">
            {agent.logoutTime ? 'Logged out' : 'Offline'}
          </span>
        )}
        {/* Live timer for current status */}
        {agent.currentStatus && !agent.logoutTime && (
          <div className="text-xs text-slate-400 mt-0.5 pl-0.5">
            {/* Find current open session start — approximate from breakdown */}
            <span className="font-mono">ongoing</span>
          </div>
        )}
      </div>

      {/* Status breakdown bars */}
      <div className="flex flex-col gap-1">
        {ATTENDANCE_STATUSES.map(s => {
          const secs = agent.breakdown?.[s.key] ?? 0
          if (!secs && !agent.loginTime) return null
          const pct = totalDay > 0 ? Math.round((secs / totalDay) * 100) : 0
          const Ic  = STATUS_ICONS[s.key]
          return (
            <div key={s.key} className="flex items-center gap-2">
              <span className="w-14 text-xs text-slate-500 flex items-center gap-1" style={{ color: s.color }}>
                <Ic size={10} /> {s.label}
              </span>
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: s.color }} />
              </div>
              <span className="text-xs font-mono text-slate-500 w-16 text-right">
                {fmtSecs(secs)}
              </span>
            </div>
          )
        })}
        {!agent.loginTime && (
          <span className="text-xs text-slate-300 italic">No activity today</span>
        )}
      </div>

      {/* Lead stats */}
      <div className="text-center">
        <div className="text-lg font-bold text-slate-700">{uniqueLeads}</div>
        <div className="text-xs text-slate-400">leads worked</div>
        {totalLeadSecs > 0 && (
          <div className="text-xs text-slate-400 mt-0.5 font-mono">{fmtSecs(totalLeadSecs)} total</div>
        )}
      </div>

      {/* Active time summary */}
      <div className="text-right">
        <div className="text-sm font-semibold text-green-700">{fmtSecs(totalActive)}</div>
        <div className="text-xs text-slate-400">active</div>
        {totalBreak > 0 && (
          <div className="text-xs text-amber-600 mt-0.5">{fmtSecs(totalBreak)} breaks</div>
        )}
      </div>
    </div>
  )
}

// ─── Summary stats cards ──────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = '#378ADD' }) {
  return (
    <div className="card p-4">
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      <div className="text-sm font-medium text-slate-600 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AttendancePage() {
  const { isSuperAdmin, isManager, profile } = useAuth()
  const [agents,     setAgents]     = useState([])
  const [leadStats,  setLeadStats]  = useState({}) // userId → []
  const [loading,    setLoading]    = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)
  const today = format(new Date(), 'EEEE, dd MMM yyyy')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await getAllPresalesToday()
      setAgents(rows)

      // Load lead stats per agent
      const stats = {}
      await Promise.all(rows.map(async a => {
        stats[a.id] = await getAgentLeadStats(a.id)
      }))
      setLeadStats(stats)
      setLastRefresh(new Date())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    // Auto-refresh every 60s
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [load])

  // Summary counts
  const online    = agents.filter(a => a.currentStatus).length
  const active    = agents.filter(a => a.currentStatus === 'active').length
  const onBreak   = agents.filter(a => ['hold','lunch','snacks'].includes(a.currentStatus)).length
  const training  = agents.filter(a => a.currentStatus === 'training').length
  const offline   = agents.filter(a => !a.currentStatus).length

  return (
    <Layout>
      <PageHeader
        title="Presales Attendance"
        subtitle={today}
      >
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-xs text-slate-400">
              Updated {format(lastRefresh, 'hh:mm:ss a')}
            </span>
          )}
          <button onClick={load} className="btn" disabled={loading}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </PageHeader>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <StatCard label="Online" value={online} sub={`of ${agents.length} agents`} color="#7F77DD" />
        <StatCard label="Active" value={active} sub="On calls" color="#16a34a" />
        <StatCard label="On Break" value={onBreak} sub="Hold/Lunch/Snacks" color="#d97706" />
        <StatCard label="Training" value={training} sub="In session" color="#7c3aed" />
        <StatCard label="Offline" value={offline} sub="Not logged in" color="#94a3b8" />
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {/* Header */}
        <div className="grid gap-4 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide"
          style={{ gridTemplateColumns: '200px 140px 1fr 140px 140px' }}>
          <span className="flex items-center gap-1"><Users size={11} /> Agent</span>
          <span>Current Status</span>
          <span>Today's Breakdown</span>
          <span className="text-center">Lead Activity</span>
          <span className="text-right">Time Summary</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size={22} />
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-16 text-sm text-slate-400">
            No presales agents found
          </div>
        ) : (
          agents.map(agent => (
            <AgentRow
              key={agent.id}
              agent={agent}
              leadStats={leadStats[agent.id] ?? []}
            />
          ))
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 flex-wrap">
        {ATTENDANCE_STATUSES.map(s => {
          const Ic = STATUS_ICONS[s.key]
          return (
            <span key={s.key} className="flex items-center gap-1.5 text-xs"
              style={{ color: s.color }}>
              <Ic size={12} /> {s.label}
            </span>
          )
        })}
        <span className="text-xs text-slate-400 ml-auto">
          <Clock size={11} className="inline mr-1" />
          Auto-refreshes every 60s
        </span>
      </div>
    </Layout>
  )
}
