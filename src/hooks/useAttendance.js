import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  getTodayAttendance,
  clockIn,
  switchStatus,
  clockOut,
  ATTENDANCE_STATUSES,
} from '@/lib/attendanceService'

/**
 * useAttendance — presales agent ke liye
 * - Login pe auto clock-in (active)
 * - Status switch buttons
 * - Live timer for current status
 * - Manager/super_admin ke liye no-op
 */
export function useAttendance() {
  const { profile, isPresales, isManager, isSuperAdmin } = useAuth()
  const isAgent = isPresales && !isManager && !isSuperAdmin

  const [currentStatus, setCurrentStatus] = useState(null)   // 'active'|'hold'|...
  const [statusSince,   setStatusSince]   = useState(null)   // when current status started
  const [liveSecs,      setLiveSecs]      = useState(0)
  const [switching,     setSwitching]     = useState(false)
  const [ready,         setReady]         = useState(false)
  const timerRef = useRef(null)

  // ── Load today's attendance on mount ──────────────────────────
  const init = useCallback(async () => {
    if (!profile?.id || !isAgent) { setReady(true); return }

    let att = await getTodayAttendance(profile.id)

    if (!att) {
      // First login today — auto clock-in as active
      att = await clockIn(profile.id, profile.id)
    }

    setCurrentStatus(att?.status ?? 'active')
    // statusSince will be approximate — we'll use the DB updated_at or login_time
    setStatusSince(att?.updated_at ?? att?.login_time ?? new Date().toISOString())
    setReady(true)
  }, [profile?.id, isAgent])

  useEffect(() => { init() }, [init])

  // ── Live timer ─────────────────────────────────────────────────
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (!statusSince) return
    timerRef.current = setInterval(() => {
      setLiveSecs(Math.round((Date.now() - new Date(statusSince)) / 1000))
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [statusSince])

  // ── Switch status ──────────────────────────────────────────────
  async function handleSwitch(newStatus) {
    if (!profile?.id || switching || newStatus === currentStatus) return
    setSwitching(true)
    try {
      await switchStatus(profile.id, newStatus)
      setCurrentStatus(newStatus)
      setStatusSince(new Date().toISOString())
      setLiveSecs(0)
    } catch (e) {
      console.error('Status switch failed:', e)
    } finally {
      setSwitching(false)
    }
  }

  // ── Clock out (called on logout) ───────────────────────────────
  async function handleClockOut() {
    if (!profile?.id) return
    await clockOut(profile.id)
    setCurrentStatus(null)
    setLiveSecs(0)
  }

  return {
    isAgent,
    ready,
    currentStatus,
    liveSecs,
    switching,
    statuses: ATTENDANCE_STATUSES,
    handleSwitch,
    handleClockOut,
  }
}
