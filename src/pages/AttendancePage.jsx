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
  Users, Zap, ChevronLeft, ChevronRight, CalendarDays, Settings,
  Save, ToggleLeft, ToggleRight,
} from 'lucide-react'
import {
  getAllPresalesToday, getAgentLeadStats,
  ATTENDANCE_STATUSES, STATUS_MAP, ACTIVITY_LABELS,
  fmtSecs, fmtTime, fmtLoginHours,
  fetchMonthlyRecords,
  getAttendanceSettings, saveAttendanceSettings, invalidateSettingsCache,
} from '@/lib/attendanceService'
import { supabase } from '@/lib/supabase'

// ─── Status icon map ──────────────────────────────────────────────────────────
const STATUS_ICONS = {
  active: Activity, hold: PauseCircle,
  training: BookOpen, lunch: UtensilsCrossed, snacks: Cookie,
}

// ─── Attendance record badge config ──────────────────────────────────────────
const REC_CFG = {
  P: { bg: '#E1F5EE', text: '#0F6E56', border: '#5DCAA5', label: 'P' },
  H: { bg: '#FAEEDA', text: '#854F0B', border: '#EF9F27', label: 'H' },
  L: { bg: '#FCEBEB', text: '#A32D2D', border: '#F09595', label: 'L' },
  WO: { bg: '#F1EFE8', text: '#5F5E5A', border: '#B4B2A9', label: 'WO' },
  A: { bg: '#FEF9C3', text: '#713F12', border: '#FDE047', label: 'A' },
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

// ═══════════════════════════════════════════════════════════════════
// SETTINGS TAB
// ═══════════════════════════════════════════════════════════════════
const DAYS_LIST = [
  { val: 1, label: 'Mon' }, { val: 2, label: 'Tue' }, { val: 3, label: 'Wed' },
  { val: 4, label: 'Thu' }, { val: 5, label: 'Fri' }, { val: 6, label: 'Sat' },
  { val: 0, label: 'Sun' },
]

function SettingsSection({ title, children }) {
  return (
    <div className="card" style={{ marginBottom: 16, padding: '20px 24px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function FieldRow({ label, desc, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>{desc}</div>}
      </div>
      <div style={{ marginLeft: 24 }}>{children}</div>
    </div>
  )
}

function NumInput({ value, onChange, min = 0, max = 9999, unit = '' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input
        type="number" value={value} min={min} max={max}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          width: 72, padding: '6px 10px', borderRadius: 8, textAlign: 'center',
          border: '1px solid var(--color-border-secondary)', fontSize: 14, fontWeight: 600,
          background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)',
        }}
      />
      {unit && <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{unit}</span>}
    </div>
  )
}

function Toggle({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
      {value
        ? <ToggleRight size={32} color="#16a34a" />
        : <ToggleLeft size={32} color="#94a3b8" />}
    </button>
  )
}

function AttendanceSettingsTab() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Thresholds
  const [presentMins, setPresentMins] = useState(540)
  const [halfDayMins, setHalfDayMins] = useState(300)
  const [graceMins, setGraceMins] = useState(15)

  // Inactivity
  const [inactEnabled, setInactEnabled] = useState(true)
  const [inactTimeout, setInactTimeout] = useState(120)

  // Auto logout
  const [midnightEnabled, setMidnightEnabled] = useState(true)
  const [timezone, setTimezone] = useState('Asia/Kolkata')

  // Working days
  const [workingDays, setWorkingDays] = useState([1, 2, 3, 4, 5, 6])

  useEffect(() => {
    async function load() {
      const s = await getAttendanceSettings()
      setPresentMins(s.thresholds.present_min_mins)
      setHalfDayMins(s.thresholds.half_day_min_mins)
      setGraceMins(s.thresholds.grace_period_mins)
      setInactEnabled(s.inactivity.enabled)
      setInactTimeout(s.inactivity.timeout_mins)
      setMidnightEnabled(s.auto_logout.midnight_enabled)
      setTimezone(s.auto_logout.timezone)
      setWorkingDays(s.working_days.days)
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      await Promise.all([
        saveAttendanceSettings('thresholds', {
          present_min_mins: presentMins,
          half_day_min_mins: halfDayMins,
          grace_period_mins: graceMins,
        }),
        saveAttendanceSettings('inactivity', {
          enabled: inactEnabled,
          timeout_mins: inactTimeout,
          check_interval_mins: 5,
        }),
        saveAttendanceSettings('auto_logout', {
          midnight_enabled: midnightEnabled,
          timezone,
        }),
        saveAttendanceSettings('working_days', {
          days: workingDays,
          labels: DAYS_LIST.filter(d => workingDays.includes(d.val)).map(d => d.label),
        }),
      ])
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      console.error('Settings save failed:', e)
    } finally {
      setSaving(false)
    }
  }

  function toggleDay(val) {
    setWorkingDays(prev =>
      prev.includes(val) ? prev.filter(d => d !== val) : [...prev, val]
    )
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner size={22} /></div>

  return (
    <div style={{ maxWidth: 640 }}>

      {/* Thresholds */}
      <SettingsSection title="⏱ Attendance Thresholds">
        <FieldRow
          label="Present (P) minimum hours"
          desc="Agent ko P milega agar itne ya zyada hours login rahe"
        >
          <NumInput value={Math.round(presentMins / 60)} onChange={v => setPresentMins(v * 60)} min={1} max={24} unit="hrs" />
        </FieldRow>
        <FieldRow
          label="Half Day (H) minimum hours"
          desc="H milega agar login hours is threshold aur Present threshold ke beech ho"
        >
          <NumInput value={Math.round(halfDayMins / 60)} onChange={v => setHalfDayMins(v * 60)} min={1} max={24} unit="hrs" />
        </FieldRow>
        <FieldRow
          label="Grace period"
          desc="Late login pe itne minutes ignore honge (attendance pe asar nahi)"
        >
          <NumInput value={graceMins} onChange={setGraceMins} min={0} max={60} unit="mins" />
        </FieldRow>

        {/* Visual summary */}
        <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 10, background: 'var(--color-background-secondary)', fontSize: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--color-text-primary)' }}>Current Rules:</div>
          {[
            { label: 'L  (Leave)', range: `1 min – ${halfDayMins - 1} min`, color: '#A32D2D', bg: '#FCEBEB' },
            { label: 'H  (Half Day)', range: `${fmtLoginHours(halfDayMins * 60)} – ${fmtLoginHours(presentMins * 60 - 60)}`, color: '#854F0B', bg: '#FAEEDA' },
            { label: 'P  (Present)', range: `${fmtLoginHours(presentMins * 60)}+`, color: '#0F6E56', bg: '#E1F5EE' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ width: 80, padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 700, background: r.bg, color: r.color }}>{r.label}</span>
              <span style={{ color: 'var(--color-text-secondary)' }}>{r.range}</span>
            </div>
          ))}
          <div style={{ marginTop: 4, color: 'var(--color-text-secondary)' }}>
            <span style={{ fontWeight: 600 }}>Blank</span> — Login nahi kiya (admin manually mark kare)
          </div>
        </div>
      </SettingsSection>

      {/* Inactivity Auto Logout */}
      <SettingsSection title="🔌 Inactivity Auto Logout">
        <FieldRow label="Enable inactivity logout" desc="Last activity ke baad itne time mein auto logout ho jaaye">
          <Toggle value={inactEnabled} onChange={setInactEnabled} />
        </FieldRow>
        <FieldRow
          label="Inactivity timeout"
          desc="Agent ki last activity (call, lead open, etc.) ke baad kitne minutes mein logout"
        >
          <NumInput value={inactTimeout} onChange={setInactTimeout} min={15} max={480} unit="mins" />
        </FieldRow>
        <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: '#FEF9C3', fontSize: 12, color: '#713F12' }}>
          ⚡ Cron har 5 min mein check karta hai — actual logout {'{timeout}'} to {'{timeout + 5}'} min ke beech hoga
        </div>
      </SettingsSection>

      {/* Midnight Backup */}
      <SettingsSection title="🌙 Midnight Backup Logout">
        <FieldRow
          label="Midnight auto logout"
          desc="11:59 PM pe jo bhi logged in hain unhe force logout karo (backup)"
        >
          <Toggle value={midnightEnabled} onChange={setMidnightEnabled} />
        </FieldRow>
        <FieldRow label="Timezone" desc="Midnight logout is timezone ke hisaab se chalega">
          <select
            value={timezone}
            onChange={e => setTimezone(e.target.value)}
            style={{
              padding: '6px 10px', borderRadius: 8, fontSize: 13,
              border: '1px solid var(--color-border-secondary)',
              background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)',
            }}
          >
            <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
            <option value="UTC">UTC</option>
            <option value="Asia/Dubai">Asia/Dubai (GST)</option>
          </select>
        </FieldRow>
      </SettingsSection>

      {/* Working Days */}
      <SettingsSection title="📅 Working Days">
        <FieldRow label="Select working days" desc="Sunday auto Week Off mark hoga agar agent ne login nahi kiya">
          <div style={{ display: 'flex', gap: 6 }}>
            {DAYS_LIST.map(d => {
              const active = workingDays.includes(d.val)
              return (
                <button
                  key={d.val}
                  onClick={() => toggleDay(d.val)}
                  style={{
                    width: 38, height: 38, borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontWeight: 600, fontSize: 12,
                    background: active ? '#7F77DD' : 'var(--color-background-secondary)',
                    color: active ? '#fff' : 'var(--color-text-secondary)',
                    boxShadow: active ? '0 2px 6px rgba(127,119,221,0.3)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  {d.label}
                </button>
              )
            })}
          </div>
        </FieldRow>
      </SettingsSection>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: saved ? '#16a34a' : '#7F77DD', color: '#fff',
          fontSize: 14, fontWeight: 600,
          opacity: saving ? 0.7 : 1,
          transition: 'background 0.2s',
        }}
      >
        <Save size={15} />
        {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Settings'}
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// MONTHLY MATRIX
// ═══════════════════════════════════════════════════════════════════
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
      <div className="card" style={{ width: 320, padding: '20px 24px' }}>
        <div className="text-sm font-medium text-slate-800 mb-0.5">Mark attendance</div>
        <div className="text-xs text-slate-400 mb-4">{agent.name} · {format(parseISO(date), 'd MMM yyyy')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {OPTIONS.map(o => {
            const cfg = REC_CFG[o.value]
            const active = status === o.value
            return (
              <button key={o.value} onClick={() => setStatus(o.value)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
                border: active ? `1.5px solid ${cfg.border}` : '0.5px solid var(--color-border-tertiary)',
                background: active ? cfg.bg : 'var(--color-background-secondary)', textAlign: 'left',
              }}>
                <span style={{ width: 32, height: 22, borderRadius: 4, background: cfg.bg, color: cfg.text, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${cfg.border}` }}>
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
          <button onClick={handleSave} disabled={!status || saving} className="btn-primary flex-1 justify-center disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DayCell({ rec, isWeekend, isFutureDate, onClick }) {
  const cfg = rec?.status ? REC_CFG[rec.status] : null
  const hours = fmtLoginHours(rec?.login_secs)
  const showWO = !rec?.status && isWeekend && !isFutureDate
  const showHours = hours && (rec?.status === 'P' || rec?.status === 'H' || rec?.status === 'L')

  return (
    <td onClick={!isFutureDate ? onClick : undefined} style={{
      padding: '5px 4px', textAlign: 'center',
      borderRight: '0.5px solid var(--color-border-tertiary)',
      cursor: isFutureDate ? 'default' : 'pointer', minWidth: 52, verticalAlign: 'middle',
    }}>
      {isFutureDate && !rec?.status ? (
        <span style={{ color: '#E2E8F0', fontSize: 11 }}>—</span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minWidth: 28, height: 20, borderRadius: 4, padding: '0 3px',
            background: cfg ? cfg.bg : showWO ? REC_CFG.WO.bg : 'transparent',
            color: cfg ? cfg.text : showWO ? REC_CFG.WO.text : '#94A3B8',
            fontSize: 10, fontWeight: 700,
            border: cfg ? `0.5px solid ${cfg.border}` : showWO ? `0.5px solid ${REC_CFG.WO.border}` : 'none',
          }}>
            {cfg ? cfg.label : showWO ? 'WO' : '·'}
          </div>
          {/* Login hours below badge — shown for P, H, L */}
          {showHours && (
            <span style={{ fontSize: 9, color: cfg.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1, opacity: 0.85 }}>
              {hours}
            </span>
          )}
        </div>
      )}
    </td>
  )
}

function MonthlyMatrix({ monthDate, onMonthChange }) {
  const { profile } = useAuth()
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const days = eachDayOfInterval({ start: startOfMonth(monthDate), end: endOfMonth(monthDate) })

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
    const { data: att } = await supabase.from('attendance').select('login_time, logout_time')
      .eq('user_id', userId).eq('date', date).maybeSingle()

    let login_secs = records[userId]?.[date]?.login_secs ?? 0
    if (!login_secs && att?.login_time && att?.logout_time) {
      login_secs = Math.max(0, Math.round((new Date(att.logout_time) - new Date(att.login_time)) / 1000))
    }

    await supabase.from('attendance_records').upsert(
      { user_id: userId, date, status, login_secs, marked_by: profile?.id, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,date' }
    )
    setRecords(prev => ({ ...prev, [userId]: { ...prev[userId], [date]: { status, login_secs } } }))
  }

  const thBase = { padding: '6px 4px', textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)', borderRight: '0.5px solid var(--color-border-tertiary)', whiteSpace: 'nowrap', minWidth: 52 }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => onMonthChange(-1)} className="btn" style={{ padding: '5px 8px' }}><ChevronLeft size={14} /></button>
        <span style={{ fontSize: 15, fontWeight: 500, minWidth: 140, textAlign: 'center', color: 'var(--color-text-primary)' }}>
          {format(monthDate, 'MMMM yyyy')}
        </span>
        <button onClick={() => onMonthChange(1)} className="btn" style={{ padding: '5px 8px' }} disabled={monthDate >= startOfMonth(new Date())}>
          <ChevronRight size={14} />
        </button>
        <button onClick={load} className="btn" style={{ marginLeft: 'auto' }}><RefreshCw size={13} /></button>
      </div>

      <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {Object.entries(REC_CFG).map(([key, cfg]) => (
          <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 18, borderRadius: 4, background: cfg.bg, color: cfg.text, fontSize: 10, fontWeight: 700, border: `0.5px solid ${cfg.border}` }}>
              {cfg.label}
            </span>
            <span style={{ color: 'var(--color-text-secondary)' }}>
              {key === 'P' ? 'Present' : key === 'H' ? 'Half Day' : key === 'L' ? 'Leave' : key === 'WO' ? 'Week Off' : 'Absent'}
            </span>
          </span>
        ))}
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginLeft: 'auto' }}>
          Click any cell to mark · Login hours shown below P / H / L
        </span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}><Spinner size={22} /></div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 12, border: '0.5px solid var(--color-border-tertiary)' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ background: 'var(--color-background-secondary)' }}>
                <th style={{ ...thBase, textAlign: 'left', padding: '8px 14px', minWidth: 160, position: 'sticky', left: 0, zIndex: 2, background: 'var(--color-background-secondary)', borderRight: '1px solid var(--color-border-secondary)' }}>
                  Agent
                </th>
                {days.map(d => {
                  const isWE = d.getDay() === 0
                  return (
                    <th key={d.toISOString()} style={{ ...thBase, background: isWE ? '#EEF5FF' : 'var(--color-background-secondary)', color: isWE ? '#185FA5' : 'var(--color-text-secondary)' }}>
                      <div style={{ fontWeight: 500 }}>{format(d, 'EEE')}</div>
                      <div style={{ fontWeight: 700, fontSize: 11 }}>{format(d, 'd')}</div>
                    </th>
                  )
                })}
                <th style={{ ...thBase, minWidth: 72, background: '#E6F1FB', color: '#185FA5', borderRight: 'none' }}>Total<br />Days</th>
                <th style={{ ...thBase, minWidth: 72, background: '#E1F5EE', color: '#0F6E56', borderRight: 'none' }}>Login<br />Hrs</th>
              </tr>
            </thead>
            <tbody>
              {agents.length === 0 ? (
                <tr><td colSpan={days.length + 3} style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)', fontSize: 14 }}>No presales agents found</td></tr>
              ) : agents.map((agent, idx) => {
                const agentRecs = records[agent.id] ?? {}
                const totalPresent = calcTotalPresent(agentRecs)
                const totalLoginSec = calcTotalLoginSecs(agentRecs)
                const rowBg = idx % 2 === 0 ? 'var(--color-background-primary)' : 'var(--color-background-secondary)'
                return (
                  <tr key={agent.id} style={{ background: rowBg }}>
                    <td style={{ padding: '8px 14px', position: 'sticky', left: 0, zIndex: 1, background: rowBg, borderRight: '1px solid var(--color-border-secondary)', minWidth: 160 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar name={agent.name} size={26} color="#7F77DD" />
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', whiteSpace: 'nowrap' }}>{agent.name}</span>
                      </div>
                    </td>
                    {days.map(d => {
                      const dateStr = format(d, 'yyyy-MM-dd')
                      const isWE = d.getDay() === 0
                      const isFut = isFuture(d) && !isToday(d)
                      return (
                        <DayCell key={dateStr} rec={agentRecs[dateStr]} isWeekend={isWE} isFutureDate={isFut}
                          onClick={() => setModal({ agent, date: dateStr, current: agentRecs[dateStr] })} />
                      )
                    })}
                    <td style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 700, fontSize: 15, color: '#185FA5', background: '#E6F1FB', borderLeft: '0.5px solid var(--color-border-tertiary)' }}>
                      {totalPresent % 1 === 0 ? totalPresent : totalPresent.toFixed(1)}
                    </td>
                    <td style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 600, fontSize: 12, color: '#0F6E56', background: '#E1F5EE' }}>
                      {fmtLoginHours(totalLoginSec) ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <MarkModal open={!!modal} agent={modal?.agent} date={modal?.date} current={modal?.current}
        onSave={handleSave} onClose={() => setModal(null)} />
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════
// TODAY LIVE VIEW
// ═══════════════════════════════════════════════════════════════════
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
    <div className="grid gap-4 px-4 py-3 border-b border-slate-100 items-center hover:bg-slate-50/60 transition-colors"
      style={{ gridTemplateColumns: '200px 140px 1fr 140px 130px 160px' }}>
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ background: cfg.bg, color: cfg.color }}>
            <Icon size={11} />{cfg.label}
          </span>
        ) : (
          <span className="text-xs text-slate-300 italic">{agent.logoutTime ? 'Logged out' : 'Offline'}</span>
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
              <span className="w-14 text-xs flex items-center gap-1" style={{ color: s.color }}><Ic size={10} /> {s.label}</span>
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
        {totalLeadSecs > 0 && <div className="text-xs text-slate-400 mt-0.5 font-mono">{fmtSecs(totalLeadSecs)}</div>}
      </div>

      <div className="text-right">
        <div className="text-sm font-semibold text-green-700">{fmtSecs(totalActive)}</div>
        <div className="text-xs text-slate-400">active</div>
        {totalBreak > 0 && <div className="text-xs text-amber-600 mt-0.5">{fmtSecs(totalBreak)} breaks</div>}
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

  useEffect(() => { load(); const t = setInterval(load, 30_000); return () => clearInterval(t) }, [load])

  const online = agents.filter(a => a.currentStatus).length
  const active = agents.filter(a => a.currentStatus === 'active').length
  const onBreak = agents.filter(a => ['lunch', 'snacks'].includes(a.currentStatus)).length
  const training = agents.filter(a => a.currentStatus === 'training').length
  const offline = agents.filter(a => !a.currentStatus).length

  return (
    <>
      <div className="flex items-center justify-end mb-4">
        <div className="flex items-center gap-2">
          {lastRefresh && <span className="text-xs text-slate-400">Updated {format(lastRefresh, 'hh:mm:ss a')}</span>}
          <button onClick={load} className="btn" disabled={loading}><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /></button>
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
        <div className="grid gap-4 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide"
          style={{ gridTemplateColumns: '200px 140px 1fr 140px 130px 160px' }}>
          <span className="flex items-center gap-1"><Users size={11} /> Agent</span>
          <span>Status</span>
          <span>Today's Breakdown</span>
          <span className="text-center">Leads</span>
          <span className="text-right">Time</span>
          <span className="text-right flex items-center justify-end gap-1"><Zap size={10} /> Last Activity</span>
        </div>
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={22} /></div>
        ) : agents.length === 0 ? (
          <div className="text-center py-16 text-sm text-slate-400">No presales agents found</div>
        ) : (
          agents.map(agent => <AgentRow key={agent.id} agent={agent} leadStats={leadStats[agent.id] ?? []} />)
        )}
      </div>

      <div className="flex items-center gap-4 mt-4 flex-wrap">
        {ATTENDANCE_STATUSES.map(s => {
          const Ic = STATUS_ICONS[s.key]
          return <span key={s.key} className="flex items-center gap-1.5 text-xs" style={{ color: s.color }}><Ic size={12} /> {s.label}</span>
        })}
        <span className="text-xs text-slate-400 ml-auto"><Clock size={11} className="inline mr-1" />Auto-refreshes every 30s</span>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════
export default function AttendancePage() {
  const { isSuperAdmin, isManager } = useAuth()
  const canSeeSettings = isSuperAdmin || isManager

  const [tab, setTab] = useState('today')
  const [monthDate, setMonthDate] = useState(startOfMonth(new Date()))

  const TABS = [
    { key: 'today', label: 'Today Live', Icon: Activity },
    { key: 'monthly', label: 'Monthly Matrix', Icon: CalendarDays },
    ...(canSeeSettings ? [{ key: 'settings', label: 'Settings', Icon: Settings }] : []),
  ]

  return (
    <Layout>
      <PageHeader title="Presales Attendance" subtitle={format(new Date(), 'EEEE, dd MMM yyyy')} />

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--color-background-secondary)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: 'none',
            background: tab === t.key ? 'var(--color-background-primary)' : 'transparent',
            color: tab === t.key ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            fontWeight: tab === t.key ? 500 : 400, fontSize: 13, cursor: 'pointer',
            boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.15s ease',
          }}>
            <t.Icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {tab === 'today' && <TodayView />}
      {tab === 'monthly' && <MonthlyMatrix monthDate={monthDate} onMonthChange={dir => setMonthDate(prev => dir > 0 ? addMonths(prev, 1) : subMonths(prev, 1))} />}
      {tab === 'settings' && <AttendanceSettingsTab />}
    </Layout>
  )
}