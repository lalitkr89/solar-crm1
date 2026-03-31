import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import Layout from '@/components/layout/Layout'
import { PageHeader, Avatar, Spinner } from '@/components/ui'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  addMonths, subMonths, isToday, isFuture, parseISO,
} from 'date-fns'
import {
  RefreshCw, Activity, PauseCircle, BookOpen,
  UtensilsCrossed, Cookie, Clock, LogIn, LogOut,
  Users, Zap, ChevronLeft, ChevronRight, CalendarDays,
} from 'lucide-react'
import {
  getAllPresalesToday,
  getAgentLeadStats,
  ATTENDANCE_STATUSES,
  STATUS_MAP,
  ACTIVITY_LABELS,
  fmtSecs,
  fmtTime,
} from '@/lib/attendanceService'
import { supabase } from '@/lib/supabase'

// ─── Status icon map ──────────────────────────────────────────────────────────
const STATUS_ICONS = {
  active: Activity,
  hold: PauseCircle,
  training: BookOpen,
  lunch: UtensilsCrossed,
  snacks: Cookie,
}

// ─── Attendance record status config ─────────────────────────────────────────
const REC_CFG = {
  P: { bg: '#E1F5EE', text: '#0F6E56', border: '#5DCAA5', label: 'P' },
  H: { bg: '#FAEEDA', text: '#854F0B', border: '#EF9F27', label: 'H' },
  L: { bg: '#FCEBEB', text: '#A32D2D', border: '#F09595', label: 'L' },
  WO: { bg: '#F1EFE8', text: '#5F5E5A', border: '#B4B2A9', label: 'WO' },
  A: { bg: '#FEF9C3', text: '#713F12', border: '#FDE047', label: 'A' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtLoginHours(secs) {
  if (!secs || secs <= 0) return null
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

function calcTotalPresent(records) {
  let total = 0
  for (const r of Object.values(records)) {
    if (r.status === 'P') total += 1
    else if (r.status === 'H') total += 0.5
  }
  return total
}

function calcTotalLoginSecs(records) {
  return Object.values(records).reduce((sum, r) => sum + (r.login_secs ?? 0), 0)
}

// ─── Fetch monthly data ───────────────────────────────────────────────────────
async function fetchMonthlyRecords(year, month) {
  const start = format(startOfMonth(new Date(year, month, 1)), 'yyyy-MM-dd')
  const end = format(endOfMonth(new Date(year, month, 1)), 'yyyy-MM-dd')

  const { data: agents } = await supabase
    .from('users')
    .select('id, name')
    .eq('team', 'presales')
    .eq('is_active', true)
    .order('name')

  if (!agents?.length) return { agents: [], records: {} }

  const agentIds = agents.map(a => a.id)

  // attendance — login_time / logout_time
  const { data: attRows } = await supabase
    .from('attendance')
    .select('user_id, date, login_time, logout_time')
    .in('user_id', agentIds)
    .gte('date', start)
    .lte('date', end)

  // attendance_records — manually marked status + login_secs
  const { data: recRows } = await supabase
    .from('attendance_records')
    .select('user_id, date, status, login_secs')
    .in('user_id', agentIds)
    .gte('date', start)
    .lte('date', end)

  // attendance_sessions — sum of clocked_out total_secs per user per day
  const { data: sessionRows } = await supabase
    .from('attendance_sessions')
    .select('user_id, date, total_secs')
    .in('user_id', agentIds)
    .gte('date', start)
    .lte('date', end)
    .eq('status', 'clocked_out')

  // Build session map: "userId::date" → total secs
  const sessionMap = {}
  sessionRows?.forEach(s => {
    const key = `${s.user_id}::${s.date}`
    sessionMap[key] = (sessionMap[key] ?? 0) + (s.total_secs ?? 0)
  })

  // Build attendance map: userId → date → { login_time, logout_time }
  const attMap = {}
  attRows?.forEach(a => {
    if (!attMap[a.user_id]) attMap[a.user_id] = {}
    attMap[a.user_id][a.date] = a
  })

  // Build records map: userId → date → { status, login_secs }
  const records = {}
  agents.forEach(a => { records[a.id] = {} })

  recRows?.forEach(r => {
    let login_secs = r.login_secs ?? 0

    // If login_secs is 0, try sessions
    if (!login_secs) {
      login_secs = sessionMap[`${r.user_id}::${r.date}`] ?? 0
    }
    // If still 0, try attendance login/logout diff
    if (!login_secs) {
      const att = attMap[r.user_id]?.[r.date]
      if (att?.login_time && att?.logout_time) {
        login_secs = Math.max(0, Math.round(
          (new Date(att.logout_time) - new Date(att.login_time)) / 1000
        ))
      }
    }

    records[r.user_id][r.date] = { status: r.status, login_secs }
  })

  return { agents, records }
}

// ─── Mark attendance modal ────────────────────────────────────────────────────
function MarkModal({ open, agent, date, current, onSave, onClose }) {
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { setStatus(current?.status ?? '') }, [open, current])

  if (!open || !agent || !date) return null

  const OPTIONS = [
    { value: 'P', label: 'Present', desc: '+1 day' },
    { value: 'H', label: 'Half Day', desc: '+0.5 days' },
    { value: 'L', label: 'Leave', desc: '0 days' },
    { value: 'WO', label: 'Week Off', desc: 'Rotational off' },
    { value: 'A', label: 'Absent', desc: '0 days (unplanned)' },
  ]

  async function handleSave() {
    if (!status) return
    setSaving(true)
    await onSave(agent.id, date, status)
    setSaving(false)
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.4)',
    }}>
      <div className="card" style={{ width: 320, padding: '20px 24px' }}>
        <div className="text-sm font-medium text-slate-800 mb-0.5">Mark attendance</div>
        <div className="text-xs text-slate-400 mb-4">
          {agent.name} · {format(parseISO(date), 'd MMM yyyy')}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {OPTIONS.map(o => {
            const cfg = REC_CFG[o.value]
            const active = status === o.value
            return (
              <button
                key={o.value}
                onClick={() => setStatus(o.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
                  border: active
                    ? `1.5px solid ${cfg.border}`
                    : '0.5px solid var(--color-border-tertiary)',
                  background: active ? cfg.bg : 'var(--color-background-secondary)',
                  textAlign: 'left',
                }}
              >
                <span style={{
                  width: 32, height: 22, borderRadius: 4,
                  background: cfg.bg, color: cfg.text,
                  fontSize: 11, fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${cfg.border}`,
                }}>
                  {cfg.label}
                </span>
                <div>
                  <div className="text-sm font-medium text-slate-700">{o.label}</div>
                  <div className="text-xs text-slate-400">{o.desc}</div>
                </div>
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} className="btn flex-1 justify-center">Cancel</button>
          <button
            onClick={handleSave}
            disabled={!status || saving}
            className="btn-primary flex-1 justify-center disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Single day cell: status badge + login hours below ────────────────────────
function DayCell({ rec, isWeekend, isFutureDate, onClick }) {
  const cfg = rec?.status ? REC_CFG[rec.status] : null
  const hours = fmtLoginHours(rec?.login_secs)
  const showWO = !rec?.status && isWeekend && !isFutureDate
  const showHours = hours && (rec?.status === 'P' || rec?.status === 'H')

  return (
    <td
      onClick={!isFutureDate ? onClick : undefined}
      style={{
        padding: '5px 4px',
        textAlign: 'center',
        borderRight: '0.5px solid var(--color-border-tertiary)',
        cursor: isFutureDate ? 'default' : 'pointer',
        minWidth: 52,
        verticalAlign: 'middle',
      }}
    >
      {isFutureDate && !rec?.status ? (
        <span style={{ color: '#E2E8F0', fontSize: 11 }}>—</span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>

          {/* Status badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minWidth: 28, height: 20, borderRadius: 4, padding: '0 3px',
            background: cfg ? cfg.bg : showWO ? REC_CFG.WO.bg : 'transparent',
            color: cfg ? cfg.text : showWO ? REC_CFG.WO.text : '#94A3B8',
            fontSize: 10, fontWeight: 700,
            border: cfg
              ? `0.5px solid ${cfg.border}`
              : showWO ? `0.5px solid ${REC_CFG.WO.border}` : 'none',
          }}>
            {cfg ? cfg.label : showWO ? 'WO' : '·'}
          </div>

          {/* Login hours — shown below status for P and H only */}
          {showHours && (
            <span style={{
              fontSize: 9,
              color: cfg.text,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
              opacity: 0.8,
            }}>
              {hours}
            </span>
          )}

        </div>
      )}
    </td>
  )
}

// ─── Monthly matrix ───────────────────────────────────────────────────────────
function MonthlyMatrix({ monthDate, onMonthChange }) {
  const { profile } = useAuth()
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const days = eachDayOfInterval({
    start: startOfMonth(monthDate),
    end: endOfMonth(monthDate),
  })

  const [agents, setAgents] = useState([])
  const [records, setRecords] = useState({})
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { agents: a, records: r } = await fetchMonthlyRecords(year, month)
    setAgents(a)
    setRecords(r)
    setLoading(false)
  }, [year, month])

  useEffect(() => { load() }, [load])

  async function handleSave(userId, date, status) {
    // Get login_secs: sessions first, then attendance diff
    const { data: sessions } = await supabase
      .from('attendance_sessions')
      .select('total_secs')
      .eq('user_id', userId)
      .eq('date', date)
      .eq('status', 'clocked_out')

    let login_secs = (sessions ?? []).reduce((s, r) => s + (r.total_secs ?? 0), 0)

    if (!login_secs) {
      const { data: att } = await supabase
        .from('attendance')
        .select('login_time, logout_time')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle()
      if (att?.login_time && att?.logout_time) {
        login_secs = Math.max(0, Math.round(
          (new Date(att.logout_time) - new Date(att.login_time)) / 1000
        ))
      }
    }

    // Fall back to whatever was already stored
    if (!login_secs) {
      login_secs = records[userId]?.[date]?.login_secs ?? 0
    }

    await supabase.from('attendance_records').upsert(
      {
        user_id: userId,
        date,
        status,
        login_secs,
        marked_by: profile?.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,date' }
    )

    // Optimistic local update
    setRecords(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [date]: { status, login_secs },
      },
    }))
  }

  const thBase = {
    padding: '6px 4px',
    textAlign: 'center',
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    borderRight: '0.5px solid var(--color-border-tertiary)',
    whiteSpace: 'nowrap',
    minWidth: 52,
  }

  return (
    <>
      {/* Month navigator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => onMonthChange(-1)} className="btn" style={{ padding: '5px 8px' }}>
          <ChevronLeft size={14} />
        </button>
        <span style={{
          fontSize: 15, fontWeight: 500, minWidth: 140, textAlign: 'center',
          color: 'var(--color-text-primary)',
        }}>
          {format(monthDate, 'MMMM yyyy')}
        </span>
        <button
          onClick={() => onMonthChange(1)} className="btn" style={{ padding: '5px 8px' }}
          disabled={monthDate >= startOfMonth(new Date())}
        >
          <ChevronRight size={14} />
        </button>
        <button onClick={load} className="btn" style={{ marginLeft: 'auto' }}>
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {Object.entries(REC_CFG).map(([key, cfg]) => (
          <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 18, borderRadius: 4,
              background: cfg.bg, color: cfg.text, fontSize: 10, fontWeight: 700,
              border: `0.5px solid ${cfg.border}`,
            }}>
              {cfg.label}
            </span>
            <span style={{ color: 'var(--color-text-secondary)' }}>
              {key === 'P' ? 'Present' : key === 'H' ? 'Half Day' : key === 'L' ? 'Leave' : key === 'WO' ? 'Week Off' : 'Absent'}
            </span>
          </span>
        ))}
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginLeft: 'auto' }}>
          Click any cell to mark · Login hours shown below P / H
        </span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <Spinner size={22} />
        </div>
      ) : (
        <div style={{
          overflowX: 'auto',
          borderRadius: 12,
          border: '0.5px solid var(--color-border-tertiary)',
        }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ background: 'var(--color-background-secondary)' }}>

                {/* Agent col header — sticky */}
                <th style={{
                  ...thBase, textAlign: 'left', padding: '8px 14px', minWidth: 160,
                  position: 'sticky', left: 0, zIndex: 2,
                  background: 'var(--color-background-secondary)',
                  borderRight: '1px solid var(--color-border-secondary)',
                }}>
                  Agent
                </th>

                {/* Date columns */}
                {days.map(d => {
                  const isWE = d.getDay() === 0 || d.getDay() === 0
                  return (
                    <th key={d.toISOString()} style={{
                      ...thBase,
                      background: isWE ? '#EEF5FF' : 'var(--color-background-secondary)',
                      color: isWE ? '#185FA5' : 'var(--color-text-secondary)',
                    }}>
                      <div style={{ fontWeight: 500 }}>{format(d, 'EEE')}</div>
                      <div style={{ fontWeight: 700, fontSize: 11 }}>{format(d, 'd')}</div>
                    </th>
                  )
                })}

                {/* Total present */}
                <th style={{
                  ...thBase, minWidth: 72,
                  background: '#E6F1FB', color: '#185FA5',
                  borderRight: 'none',
                }}>
                  Total<br />Days
                </th>

                {/* Total login hrs */}
                <th style={{
                  ...thBase, minWidth: 72,
                  background: '#E1F5EE', color: '#0F6E56',
                  borderRight: 'none',
                }}>
                  Login<br />Hrs
                </th>
              </tr>
            </thead>

            <tbody>
              {agents.length === 0 ? (
                <tr>
                  <td
                    colSpan={days.length + 3}
                    style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)', fontSize: 14 }}
                  >
                    No presales agents found
                  </td>
                </tr>
              ) : agents.map((agent, idx) => {
                const agentRecs = records[agent.id] ?? {}
                const totalPresent = calcTotalPresent(agentRecs)
                const totalLoginSec = calcTotalLoginSecs(agentRecs)
                const rowBg = idx % 2 === 0
                  ? 'var(--color-background-primary)'
                  : 'var(--color-background-secondary)'

                return (
                  <tr key={agent.id} style={{ background: rowBg }}>

                    {/* Agent name — sticky */}
                    <td style={{
                      padding: '8px 14px',
                      position: 'sticky', left: 0, zIndex: 1,
                      background: rowBg,
                      borderRight: '1px solid var(--color-border-secondary)',
                      minWidth: 160,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar name={agent.name} size={26} color="#7F77DD" />
                        <span style={{
                          fontSize: 13, fontWeight: 500,
                          color: 'var(--color-text-primary)',
                          whiteSpace: 'nowrap',
                        }}>
                          {agent.name}
                        </span>
                      </div>
                    </td>

                    {/* Day cells */}
                    {days.map(d => {
                      const dateStr = format(d, 'yyyy-MM-dd')
                      const isWE = d.getDay() === 0 || d.getDay() === 0
                      const isFut = isFuture(d) && !isToday(d)
                      const rec = agentRecs[dateStr]

                      return (
                        <DayCell
                          key={dateStr}
                          rec={rec}
                          isWeekend={isWE}
                          isFutureDate={isFut}
                          onClick={() => setModal({ agent, date: dateStr, current: rec })}
                        />
                      )
                    })}

                    {/* Total present days */}
                    <td style={{
                      textAlign: 'center', padding: '6px 8px',
                      fontWeight: 700, fontSize: 15,
                      color: '#185FA5', background: '#E6F1FB',
                      borderLeft: '0.5px solid var(--color-border-tertiary)',
                    }}>
                      {totalPresent % 1 === 0 ? totalPresent : totalPresent.toFixed(1)}
                    </td>

                    {/* Total login hours */}
                    <td style={{
                      textAlign: 'center', padding: '6px 8px',
                      fontWeight: 600, fontSize: 12,
                      color: '#0F6E56', background: '#E1F5EE',
                    }}>
                      {fmtLoginHours(totalLoginSec) ?? '—'}
                    </td>

                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <MarkModal
        open={!!modal}
        agent={modal?.agent}
        date={modal?.date}
        current={modal?.current}
        onSave={handleSave}
        onClose={() => setModal(null)}
      />
    </>
  )
}

// ─── Live "X ago" ticker ──────────────────────────────────────────────────────
function LiveSince({ ts }) {
  const [label, setLabel] = useState('')
  useEffect(() => {
    if (!ts) return
    function update() {
      const secs = Math.round((Date.now() - new Date(ts)) / 1000)
      if (secs < 5) setLabel('just now')
      else if (secs < 60) setLabel(`${secs}s ago`)
      else if (secs < 3600) setLabel(`${Math.floor(secs / 60)}m ago`)
      else setLabel(`${Math.floor(secs / 3600)}h ago`)
    }
    update()
    const t = setInterval(update, 10_000)
    return () => clearInterval(t)
  }, [ts])
  if (!ts) return null
  return <div className="text-xs text-slate-400 mt-0.5 font-mono">{label}</div>
}

// ─── Agent row for Today view ─────────────────────────────────────────────────
function AgentRow({ agent, leadStats }) {
  const cfg = agent.currentStatus ? STATUS_MAP[agent.currentStatus] : null
  const Icon = cfg ? STATUS_ICONS[agent.currentStatus] : null

  const totalActive = agent.breakdown?.active ?? 0
  const totalBreak = (agent.breakdown?.lunch ?? 0) + (agent.breakdown?.snacks ?? 0)
  const totalDay = Object.values(agent.breakdown ?? {}).reduce((a, b) => a + b, 0)
  const uniqueLeads = new Set(leadStats.map(l => l.lead_id)).size
  const totalLeadSecs = leadStats.reduce((a, l) => a + (l.duration_secs ?? 0), 0)
  const lastAct = agent.lastActivity

  return (
    <div
      className="grid gap-4 px-4 py-3 border-b border-slate-100 items-center hover:bg-slate-50/60 transition-colors"
      style={{ gridTemplateColumns: '200px 140px 1fr 140px 130px 160px' }}
    >
      <div className="flex items-center gap-2.5">
        <Avatar name={agent.name} size={30} color="#7F77DD" />
        <div>
          <div className="text-sm font-medium text-slate-800 leading-tight">{agent.name}</div>
          <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
            {agent.loginTime
              ? <><LogIn size={10} /> {fmtTime(agent.loginTime)}</>
              : <span className="text-slate-300">Not logged in</span>}
            {agent.logoutTime && <><LogOut size={10} className="ml-1" /> {fmtTime(agent.logoutTime)}</>}
          </div>
        </div>
      </div>

      <div>
        {cfg && Icon ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
            style={{ background: cfg.bg, color: cfg.color }}>
            <Icon size={11} />{cfg.label}
          </span>
        ) : (
          <span className="text-xs text-slate-300 italic">
            {agent.logoutTime ? 'Logged out' : 'Offline'}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        {ATTENDANCE_STATUSES.map(s => {
          const secs = agent.breakdown?.[s.key] ?? 0
          if (!secs && !agent.loginTime) return null
          const pct = totalDay > 0 ? Math.round((secs / totalDay) * 100) : 0
          const Ic = STATUS_ICONS[s.key]
          return (
            <div key={s.key} className="flex items-center gap-2">
              <span className="w-14 text-xs flex items-center gap-1" style={{ color: s.color }}>
                <Ic size={10} /> {s.label}
              </span>
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: s.color }} />
              </div>
              <span className="text-xs font-mono text-slate-500 w-16 text-right">{fmtSecs(secs)}</span>
            </div>
          )
        })}
        {!agent.loginTime && <span className="text-xs text-slate-300 italic">No activity today</span>}
      </div>

      <div className="text-center">
        <div className="text-lg font-bold text-slate-700">{uniqueLeads}</div>
        <div className="text-xs text-slate-400">leads worked</div>
        {totalLeadSecs > 0 && (
          <div className="text-xs text-slate-400 mt-0.5 font-mono">{fmtSecs(totalLeadSecs)}</div>
        )}
      </div>

      <div className="text-right">
        <div className="text-sm font-semibold text-green-700">{fmtSecs(totalActive)}</div>
        <div className="text-xs text-slate-400">active</div>
        {totalBreak > 0 && (
          <div className="text-xs text-amber-600 mt-0.5">{fmtSecs(totalBreak)} breaks</div>
        )}
      </div>

      <div className="text-right">
        {lastAct ? (
          <>
            <div className="text-xs font-medium text-slate-600 flex items-center justify-end gap-1">
              <Zap size={10} className="text-amber-400" />
              {ACTIVITY_LABELS[lastAct.action] ?? lastAct.action}
            </div>
            <LiveSince ts={lastAct.happened_at} />
            {lastAct.meta?.to && <div className="text-xs text-slate-400">→ {lastAct.meta.to}</div>}
          </>
        ) : (
          <span className="text-xs text-slate-300 italic">—</span>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, color = '#378ADD' }) {
  return (
    <div className="card p-4">
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      <div className="text-sm font-medium text-slate-600 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  )
}

// ─── Today live view ──────────────────────────────────────────────────────────
function TodayView() {
  const [agents, setAgents] = useState([])
  const [leadStats, setLeadStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const rows = await getAllPresalesToday()
    setAgents(rows)
    const stats = {}
    await Promise.all(rows.map(async a => { stats[a.id] = await getAgentLeadStats(a.id) }))
    setLeadStats(stats)
    setLastRefresh(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [load])

  const online = agents.filter(a => a.currentStatus).length
  const active = agents.filter(a => a.currentStatus === 'active').length
  const onBreak = agents.filter(a => ['lunch', 'snacks'].includes(a.currentStatus)).length
  const training = agents.filter(a => a.currentStatus === 'training').length
  const offline = agents.filter(a => !a.currentStatus).length

  return (
    <>
      <div className="flex items-center justify-end mb-4">
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
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <StatCard label="Online" value={online} sub={`of ${agents.length} agents`} color="#7F77DD" />
        <StatCard label="Active" value={active} sub="On calls" color="#16a34a" />
        <StatCard label="On Break" value={onBreak} sub="Lunch/Snacks" color="#d97706" />
        <StatCard label="Training" value={training} sub="In session" color="#7c3aed" />
        <StatCard label="Offline" value={offline} sub="Not logged in" color="#94a3b8" />
      </div>

      <div className="card p-0 overflow-hidden">
        <div
          className="grid gap-4 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide"
          style={{ gridTemplateColumns: '200px 140px 1fr 140px 130px 160px' }}
        >
          <span className="flex items-center gap-1"><Users size={11} /> Agent</span>
          <span>Status</span>
          <span>Today's Breakdown</span>
          <span className="text-center">Leads</span>
          <span className="text-right">Time</span>
          <span className="text-right flex items-center justify-end gap-1">
            <Zap size={10} /> Last Activity
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={22} /></div>
        ) : agents.length === 0 ? (
          <div className="text-center py-16 text-sm text-slate-400">No presales agents found</div>
        ) : (
          agents.map(agent => (
            <AgentRow key={agent.id} agent={agent} leadStats={leadStats[agent.id] ?? []} />
          ))
        )}
      </div>

      <div className="flex items-center gap-4 mt-4 flex-wrap">
        {ATTENDANCE_STATUSES.map(s => {
          const Ic = STATUS_ICONS[s.key]
          return (
            <span key={s.key} className="flex items-center gap-1.5 text-xs" style={{ color: s.color }}>
              <Ic size={12} /> {s.label}
            </span>
          )
        })}
        <span className="text-xs text-slate-400 ml-auto">
          <Clock size={11} className="inline mr-1" />Auto-refreshes every 30s
        </span>
      </div>
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AttendancePage() {
  const [tab, setTab] = useState('today')
  const [monthDate, setMonthDate] = useState(startOfMonth(new Date()))

  return (
    <Layout>
      <PageHeader
        title="Presales Attendance"
        subtitle={format(new Date(), 'EEEE, dd MMM yyyy')}
      />

      {/* Tab switcher */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 20,
        background: 'var(--color-background-secondary)',
        borderRadius: 10, padding: 4, width: 'fit-content',
      }}>
        {[
          { key: 'today', label: 'Today Live', Icon: Activity },
          { key: 'monthly', label: 'Monthly Matrix', Icon: CalendarDays },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 16px', borderRadius: 8, border: 'none',
              background: tab === t.key
                ? 'var(--color-background-primary)'
                : 'transparent',
              color: tab === t.key
                ? 'var(--color-text-primary)'
                : 'var(--color-text-secondary)',
              fontWeight: tab === t.key ? 500 : 400,
              fontSize: 13, cursor: 'pointer',
              boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <t.Icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'today' && <TodayView />}
      {tab === 'monthly' && (
        <MonthlyMatrix
          monthDate={monthDate}
          onMonthChange={dir =>
            setMonthDate(prev => dir > 0 ? addMonths(prev, 1) : subMonths(prev, 1))
          }
        />
      )}
    </Layout>
  )
}