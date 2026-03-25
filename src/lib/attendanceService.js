import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'

// ─── Status config (shared across app) ───────────────────────────────────────
export const ATTENDANCE_STATUSES = [
  { key: 'active',    label: 'Active',    emoji: '🟢', color: '#16a34a', bg: '#dcfce7' },
  { key: 'hold',      label: 'Hold',      emoji: '🔴', color: '#dc2626', bg: '#fee2e2' },
  { key: 'training',  label: 'Training',  emoji: '🟣', color: '#7c3aed', bg: '#ede9fe' },
  { key: 'lunch',     label: 'Lunch',     emoji: '🟡', color: '#d97706', bg: '#fef3c7' },
  { key: 'snacks',    label: 'Snacks',    emoji: '🔵', color: '#0891b2', bg: '#cffafe' },
]

export const STATUS_MAP = Object.fromEntries(ATTENDANCE_STATUSES.map(s => [s.key, s]))

// ─── Format seconds → "1h 23m" / "45m 12s" ───────────────────────────────────
export function fmtSecs(secs) {
  if (!secs || secs <= 0) return '0m'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function fmtTime(ts) {
  if (!ts) return '—'
  return format(new Date(ts), 'hh:mm a')
}

// ─── Get today's attendance row for this user ─────────────────────────────────
export async function getTodayAttendance(userId) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const { data } = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle()
  return data
}

// ─── Clock in — create attendance row + first status_log ─────────────────────
export async function clockIn(userId, markedBy) {
  const today   = format(new Date(), 'yyyy-MM-dd')
  const now     = new Date().toISOString()

  // Insert/upsert attendance row
  const { data: att, error } = await supabase
    .from('attendance')
    .upsert({
      user_id:    userId,
      date:       today,
      login_time: now,
      status:     'active',
      marked_by:  markedBy,
    }, { onConflict: 'user_id,date' })
    .select()
    .single()
  if (error) throw error

  // Start first status log
  await supabase.from('attendance_status_logs').insert({
    attendance_id: att.id,
    user_id:       userId,
    status:        'active',
    started_at:    now,
    date:          today,
  })

  return att
}

// ─── Switch status ────────────────────────────────────────────────────────────
export async function switchStatus(userId, newStatus) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const now   = new Date().toISOString()

  // Get today's attendance row
  const { data: att } = await supabase
    .from('attendance')
    .select('id')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle()

  if (!att) {
    // Auto clock-in if not done yet
    return clockIn(userId, userId)
  }

  // Close current open log
  const { data: openLog } = await supabase
    .from('attendance_status_logs')
    .select('id, started_at')
    .eq('attendance_id', att.id)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (openLog) {
    const dur = Math.round((new Date(now) - new Date(openLog.started_at)) / 1000)
    await supabase
      .from('attendance_status_logs')
      .update({ ended_at: now, duration_secs: dur })
      .eq('id', openLog.id)
  }

  // Open new log
  await supabase.from('attendance_status_logs').insert({
    attendance_id: att.id,
    user_id:       userId,
    status:        newStatus,
    started_at:    now,
    date:          today,
  })

  // Update attendance.status
  await supabase
    .from('attendance')
    .update({ status: newStatus, updated_at: now })
    .eq('id', att.id)

  return att
}

// ─── Clock out ────────────────────────────────────────────────────────────────
export async function clockOut(userId) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const now   = new Date().toISOString()

  const { data: att } = await supabase
    .from('attendance')
    .select('id')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle()

  if (!att) return

  // Close open log
  const { data: openLog } = await supabase
    .from('attendance_status_logs')
    .select('id, started_at')
    .eq('attendance_id', att.id)
    .is('ended_at', null)
    .maybeSingle()

  if (openLog) {
    const dur = Math.round((new Date(now) - new Date(openLog.started_at)) / 1000)
    await supabase
      .from('attendance_status_logs')
      .update({ ended_at: now, duration_secs: dur })
      .eq('id', openLog.id)
  }

  await supabase
    .from('attendance')
    .update({ logout_time: now, status: null, updated_at: now })
    .eq('id', att.id)
}

// ─── Get today's status breakdown for a user ─────────────────────────────────
export async function getDayBreakdown(userId, date) {
  const d = date ?? format(new Date(), 'yyyy-MM-dd')
  const { data } = await supabase
    .from('attendance_status_logs')
    .select('status, duration_secs, started_at, ended_at')
    .eq('user_id', userId)
    .eq('date', d)
  return data ?? []
}

// ─── Manager: get all presales agents' today attendance ──────────────────────
export async function getAllPresalesToday() {
  const today = format(new Date(), 'yyyy-MM-dd')

  // Get all presales agents
  const { data: agents } = await supabase
    .from('users')
    .select('id, name')
    .eq('team', 'presales')
    .eq('is_active', true)
    .order('name')

  if (!agents?.length) return []

  // Get today's attendance
  const { data: attRows } = await supabase
    .from('attendance')
    .select('id, user_id, login_time, logout_time, status')
    .eq('date', today)
    .in('user_id', agents.map(a => a.id))

  // Get today's status logs
  const attIds = attRows?.map(a => a.id) ?? []
  let logs = []
  if (attIds.length > 0) {
    const { data: l } = await supabase
      .from('attendance_status_logs')
      .select('user_id, status, duration_secs, started_at, ended_at')
      .eq('date', today)
      .in('user_id', agents.map(a => a.id))
    logs = l ?? []
  }

  // Build per-agent summary
  return agents.map(agent => {
    const att    = attRows?.find(a => a.user_id === agent.id)
    const myLogs = logs.filter(l => l.user_id === agent.id)

    const breakdown = {}
    ATTENDANCE_STATUSES.forEach(s => {
      breakdown[s.key] = myLogs
        .filter(l => l.status === s.key)
        .reduce((acc, l) => {
          // Open session: count till now
          const dur = l.ended_at
            ? (l.duration_secs ?? 0)
            : Math.round((Date.now() - new Date(l.started_at)) / 1000)
          return acc + dur
        }, 0)
    })

    return {
      id:            agent.id,
      name:          agent.name,
      loginTime:     att?.login_time ?? null,
      logoutTime:    att?.logout_time ?? null,
      currentStatus: att?.status ?? null,
      breakdown,
    }
  })
}

// ─── Lead time tracking ───────────────────────────────────────────────────────
export async function startLeadTimer(leadId, userId) {
  const { data, error } = await supabase
    .from('lead_time_logs')
    .insert({
      lead_id:    leadId,
      user_id:    userId,
      started_at: new Date().toISOString(),
      date:       format(new Date(), 'yyyy-MM-dd'),
    })
    .select()
    .single()
  if (error) console.error('Lead timer start error:', error)
  return data?.id ?? null
}

export async function stopLeadTimer(logId) {
  if (!logId) return
  const now = new Date().toISOString()
  const { data: log } = await supabase
    .from('lead_time_logs')
    .select('started_at')
    .eq('id', logId)
    .single()

  const dur = log ? Math.round((new Date(now) - new Date(log.started_at)) / 1000) : 0
  await supabase
    .from('lead_time_logs')
    .update({ ended_at: now, duration_secs: dur })
    .eq('id', logId)
}

export async function getLeadTimeLogs(leadId) {
  const { data } = await supabase
    .from('lead_time_logs')
    .select('*, agent:user_id(name)')
    .eq('lead_id', leadId)
    .order('started_at', { ascending: false })
  return data ?? []
}

export async function getAgentLeadStats(userId, date) {
  const d = date ?? format(new Date(), 'yyyy-MM-dd')
  const { data } = await supabase
    .from('lead_time_logs')
    .select('lead_id, duration_secs, started_at')
    .eq('user_id', userId)
    .eq('date', d)
    .not('duration_secs', 'is', null)
  return data ?? []
}
