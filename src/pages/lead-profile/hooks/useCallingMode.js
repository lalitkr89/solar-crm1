import { useNavigate } from 'react-router-dom'
import { assignLeadIfUnassigned, getCallingQueue, assignSalesLeadIfUnassigned, getSalesCallingQueue, getSalesFollowUpQueue } from '@/lib/assignment'
import { isCallingModeActive, getCallingQueueFromSession, getCallingIndexFromSession, setCallingIndex, stopCallingMode } from '@/pages/presales/config/utils'
import { isSalesCallingModeActive, getSalesCallingModeType, getSalesCallingQueueFromSession, getSalesCallingIndexFromSession, setSalesCallingIndex, stopSalesCallingMode } from '@/pages/SalesPage'

export function useCallingMode(profileId) {
  const navigate = useNavigate()

  // ── Presales ──────────────────────────────────────────────
  const callingMode = isCallingModeActive()
  const callingQueue = getCallingQueueFromSession()
  const callingIndex = getCallingIndexFromSession()
  const currentPos = callingIndex + 1
  const totalInQueue = callingQueue.length

  // ── Sales ─────────────────────────────────────────────────
  const salesCallingMode = isSalesCallingModeActive()
  const salesCallingType = getSalesCallingModeType()
  const salesCallingQueue = getSalesCallingQueueFromSession()
  const salesCallingIndex = getSalesCallingIndexFromSession()
  const salesCurrentPos = salesCallingIndex + 1
  const salesTotalInQueue = salesCallingQueue.length

  async function goToNextLead() {
    const nextIndex = callingIndex + 1
    if (nextIndex < callingQueue.length) {
      await assignLeadIfUnassigned(callingQueue[nextIndex].id, profileId)
      setCallingIndex(nextIndex)
      navigate(`/leads/${callingQueue[nextIndex].id}`)
      return
    }
    const freshQueue = await getCallingQueue(profileId)
    const seen = new Set(callingQueue.map(x => x.id))
    const newLeads = freshQueue.filter(l => !seen.has(l.id))
    if (newLeads.length > 0) {
      await assignLeadIfUnassigned(newLeads[0].id, profileId)
      sessionStorage.setItem('callingQueue', JSON.stringify([...callingQueue, ...newLeads]))
      setCallingIndex(nextIndex)
      navigate(`/leads/${newLeads[0].id}`)
    } else {
      stopCallingMode()
      alert('🎉 Saari leads ho gayi! Abhi koi aur lead available nahi hai.')
      navigate('/presales')
    }
  }

  async function goToNextSalesLead() {
    const nextIndex = salesCallingIndex + 1
    if (nextIndex < salesCallingQueue.length) {
      await assignSalesLeadIfUnassigned(salesCallingQueue[nextIndex].id, profileId)
      setSalesCallingIndex(nextIndex)
      navigate(`/leads/${salesCallingQueue[nextIndex].id}`)
      return
    }
    const freshQueue = salesCallingType === 'followup'
      ? await getSalesFollowUpQueue(profileId)
      : await getSalesCallingQueue(profileId)
    const seen = new Set(salesCallingQueue.map(x => x.id))
    const newLeads = freshQueue.filter(l => !seen.has(l.id))
    if (newLeads.length > 0) {
      if (salesCallingType === 'calling') await assignSalesLeadIfUnassigned(newLeads[0].id, profileId)
      sessionStorage.setItem('salesCallingQueue', JSON.stringify([...salesCallingQueue, ...newLeads]))
      setSalesCallingIndex(nextIndex)
      navigate(`/leads/${newLeads[0].id}`)
    } else {
      stopSalesCallingMode()
      alert(`🎉 Saari ${salesCallingType === 'followup' ? 'follow ups' : 'meetings'} ho gayi!`)
      navigate('/sales')
    }
  }

  function stopPresales() { stopCallingMode(); navigate('/presales') }
  function stopSales() { stopSalesCallingMode(); navigate('/sales') }

  return {
    // presales
    callingMode, callingQueue, currentPos, totalInQueue, goToNextLead, stopPresales,
    // sales
    salesCallingMode, salesCallingType, salesCurrentPos, salesTotalInQueue, goToNextSalesLead, stopSales,
  }
}
