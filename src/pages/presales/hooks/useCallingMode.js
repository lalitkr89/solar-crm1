import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCallingQueue, assignLeadIfUnassigned } from '@/lib/assignment'
import { isCallingModeActive, stopCallingMode } from '../config/utils'

// Re-export karo taaki jo bhi file in helpers ko import kar rahi thi woh break na ho
export { getCallingIndexFromSession, getCallingQueueFromSession, setCallingIndex, stopCallingMode } from '../config/utils'

export function useCallingMode(profileId) {
  const navigate = useNavigate()
  const [callingMode, setCallingMode] = useState(() => isCallingModeActive())
  const [queueLoading, setQueueLoading] = useState(false)

  async function handleStartCalling() {
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

  return { callingMode, queueLoading, handleStartCalling, handleStopCalling }
}
