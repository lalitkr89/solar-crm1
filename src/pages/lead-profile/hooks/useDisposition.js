import { useState } from 'react'
import { updateLead, logActivity, logCall, moveStage } from '@/lib/leadService'
import { assignToSales } from '@/lib/assignment'
import { supabase } from '@/lib/supabase'

export function useDisposition(lead, setLead, id, profile, role) {
  const [saving, setSaving] = useState(false)

  const isPresales = role === 'presales_agent' || role === 'presales_manager'

  async function saveDisposition(disp, callStatus, date, slot, scheduleType) {
    setSaving(true)
    const old = lead.disposition
    const updates = { disposition: disp, call_status: callStatus }

    if (scheduleType === 'meeting' && date && slot) {
      updates.meeting_date = date
      updates.meeting_slot = slot
      updates.stage = 'meeting_scheduled'
      if (lead.stage === 'qc_followup') {
        updates.sales_outcome = null; updates.sales_lead_status = null
        updates.sales_meeting_status = null; updates.sales_callback_date = null
        updates.sales_callback_slot = null; updates.sales_followup_date = null
        updates.sales_followup_slot = null
      }
    }
    if (scheduleType === 'callback' && date && slot) {
      updates.callback_date = date
      updates.callback_slot = slot
    }

    // PS agent on meeting_scheduled → needs manager approval
    if (
      isPresales &&
      role === 'presales_agent' &&
      lead.stage === 'meeting_scheduled' &&
      !updates.stage &&
      disp !== old
    ) {
      let targetStage = null
      if (disp.includes('Non Qualified') || disp.includes('Not Serviceable')) targetStage = 'non_qualified'
      else if (disp.includes('Not Interested')) targetStage = 'not_interested'

      const { error } = await supabase.from('disposition_approvals').insert({
        lead_id: lead.id, requested_by: profile.id, requested_by_name: profile.name,
        old_disposition: old, new_disposition: disp,
        old_call_status: lead.call_status, new_call_status: callStatus,
        notes: targetStage ? `stage:${targetStage}` : null,
        status: 'pending', requested_at: new Date().toISOString(),
      })
      alert(error
        ? 'Request bhejne mein error: ' + error.message
        : '✅ Request PS Manager ko bheji gayi — approve hone pe update hoga.')
      setSaving(false)
      return { requiresApproval: true }
    }

    await updateLead(id, updates)
    if (updates.stage === 'meeting_scheduled' && !lead.sales_agent_id) await assignToSales(id)
    await logCall({ leadId: id, callerId: profile.id, callStatus, disposition: disp })
    await logActivity({ leadId: id, action: 'Disposition updated', field: 'disposition', oldVal: old, newVal: disp, userId: profile.id, userName: profile.name })
    if (updates.stage) {
      await logActivity({ leadId: id, action: 'Stage changed (auto)', field: 'stage', oldVal: lead.stage, newVal: updates.stage, userId: profile.id, userName: profile.name })
    }

    setLead(prev => ({ ...prev, ...updates }))
    setSaving(false)
    return { requiresApproval: false }
  }

  async function handleMoveStage(newStage) {
    setSaving(true)
    await moveStage(lead, newStage, profile.id, profile.name)
    setLead(prev => ({ ...prev, stage: newStage }))
    setSaving(false)
  }

  return { saving, saveDisposition, handleMoveStage }
}
