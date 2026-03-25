import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCallingQueue, assignLeadIfUnassigned } from '@/lib/assignment'
import { isCallingModeActive, stopCallingMode } from '../config/utils'
import { getTodayAttendance } from '@/lib/attendanceService'

// Re-export karo taaki jo bhi file in helpers ko import kar rahi thi woh break na ho
export { getCallingIndexFromSession, getCallingQueueFromSession, setCallingIndex, stopCallingMode } from '../config/utils'

const STATUS_LABELS = {
  hold: 'Hold',
  training: 'Training',
  lunch: 'Lunch Break',
  snacks: 'Snacks Break',
}

export function useCallingMode(profileId) {
  const navigate = useNavigate()
  const [callingMode, setCallingMode] = useState(() => isCallingModeActive())
  const [queueLoading, setQueueLoading] = useState(false)
  const [statusWarning, setStatusWarning] = useState(null) // null | 'hold' | 'lunch' | etc.

  async function handleStartCalling() {
    // ── Check attendance status first ────────────────────────
    if (profileId) {
      const att = await getTodayAttendance(profileId)
      if (att?.status && att.status !== 'active') {
        setStatusWarning(att.status)
        return
      }
    }

    setStatusWarning(null)
    setQueueLoading(true)
    const queue = await getCallingQueue(profileId)
    if (queue.length === 0) {
      alert('Abhi koi lead available nahi hai calling ke liye!')
      setQueueLoading(false)
      return
    }
    await assignLeadIfUnassigned(queue[0].id, profileId)
    sessionStorage.setItem('callingMode', 'true')
    sessionStorage.setItem('callingQueue', JSON.stringify(queue))
    sessionStorage.setItem('callingIndex', '0')
    setCallingMode(true)
    setQueueLoading(false)
    navigate(`/leads/${queue[0].id}`)
  }

  function handleStopCalling() {
    stopCallingMode()
    setCallingMode(false)
  }

  function dismissWarning() {
    setStatusWarning(null)
  }

  return {
    callingMode, queueLoading,
    handleStartCalling, handleStopCalling,
    statusWarning, dismissWarning, STATUS_LABELS,
  }
}