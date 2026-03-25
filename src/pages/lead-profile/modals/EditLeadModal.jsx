import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Modal } from '@/components/ui'
import { updateLead, logActivity } from '@/lib/leadService'
import { assignToSales } from '@/lib/assignment'
import { isMeetingDisposition } from '@/config/dispositions'
import { supabase } from '@/lib/supabase'
import ContactSection from "../sections/ContactSection"
import PropertySection from "../sections/PropertySection"
import DispositionSection from "../sections/DispositionSection"
import SolarSection from "../sections/SolarSection"

export default function EditLeadModal({ open, lead, onClose, onSaved, userId, userName, role }) {
  const { isSuperAdmin } = useAuth()
  const [form, setForm] = useState({})
  const [agents, setAgents] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && lead) {
      setForm({
        name: lead.name ?? '', phone: lead.phone ?? '',
        alternate_phone: lead.alternate_phone ?? '', email: lead.email ?? '',
        city: lead.city ?? '', state: lead.state ?? '', pincode: lead.pincode ?? '',
        address: lead.address ?? '', lead_source: lead.lead_source ?? '',
        calling_date: lead.calling_date ?? '', property_type: lead.property_type ?? '',
        ownership: lead.ownership ?? '', roof_type: lead.roof_type ?? '',
        roof_area: lead.roof_area ?? '', electricity_board: lead.electricity_board ?? '',
        sanctioned_load: lead.sanctioned_load ?? '', monthly_bill: lead.monthly_bill ?? '',
        units_per_month: lead.units_per_month ?? '', system_size_kw: lead.system_size_kw ?? '',
        system_type: lead.system_type ?? '', referral_type: lead.referral_type ?? '',
        referral_name: lead.referral_name ?? '', referral_id: lead.referral_id ?? '',
        call_status: lead.call_status ?? '', disposition: lead.disposition ?? '',
        meeting_date: lead.meeting_date ?? '', meeting_slot: lead.meeting_slot ?? '',
        callback_date: lead.callback_date ?? '', callback_slot: lead.callback_slot ?? '',
        quoted_amount: lead.quoted_amount ?? '', remarks: lead.remarks ?? '',
        assigned_to: lead.assigned_to ?? '', presales_agent_id: lead.presales_agent_id ?? '',
        sales_agent_id: lead.sales_agent_id ?? '',
      })
      setError('')
      if (isSuperAdmin) {
        supabase.from('users').select('id, name, role, team').eq('is_active', true).order('name')
          .then(({ data }) => setAgents(data ?? []))
      }
    }
  }, [open, lead])

  function set(field, val) { setForm(f => ({ ...f, [field]: val })) }

  // Solar auto-calc: bill + roof_area => system kW
  const solarCalc = useMemo(() => {
    const bill = parseFloat(form.monthly_bill)
    const roofArea = parseFloat(form.roof_area)
    if (!bill || bill <= 0) return null
    const units = bill / 8
    const requiredKw = units / 120
    const recommendedKw = Math.round(requiredKw)
    const roofCapacity = roofArea > 0 ? roofArea / 100 : Infinity
    const roofLimited = roofArea > 0 && roofCapacity < recommendedKw
    const finalKw = roofLimited ? Math.floor(roofCapacity) : recommendedKw
    return { units: Math.round(units * 10) / 10, requiredKw: Math.round(requiredKw * 10) / 10, finalKw, roofLimited, roofNeeded: recommendedKw * 100 }
  }, [form.monthly_bill, form.roof_area])

  async function handleSave() {
    if (!form.phone) { setError('Phone is required'); return }
    setSaving(true); setError('')
    try {
      const NUMERIC = ['roof_area', 'sanctioned_load', 'monthly_bill', 'units_per_month', 'system_size_kw', 'quoted_amount']
      const payload = { ...form }
      NUMERIC.forEach(f => { payload[f] = payload[f] !== '' && payload[f] != null ? Number(payload[f]) : null })
      Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null })
      if (!payload.presales_agent_id) payload.assigned_to = null

      if (isMeetingDisposition(form.disposition) && form.meeting_date && form.meeting_slot) {
        payload.stage = 'meeting_scheduled'
        if (lead.stage === 'qc_followup') {
          payload.sales_outcome = null; payload.sales_lead_status = null
          payload.sales_meeting_status = null; payload.sales_callback_date = null
          payload.sales_callback_slot = null; payload.sales_followup_date = null
          payload.sales_followup_slot = null
        }
      }

      const dispositionChanged = form.disposition !== lead.disposition
      const needsApproval = role === 'presales_agent' && lead.stage === 'meeting_scheduled' && dispositionChanged && !payload.stage

      if (needsApproval) {
        let targetStage = null
        if (form.disposition?.includes('Non Qualified') || form.disposition?.includes('Not Serviceable')) targetStage = 'non_qualified'
        else if (form.disposition?.includes('Not Interested')) targetStage = 'not_interested'
        await supabase.from('disposition_approvals').insert({
          lead_id: lead.id, requested_by: userId, requested_by_name: userName,
          old_disposition: lead.disposition, new_disposition: form.disposition,
          old_call_status: lead.call_status, new_call_status: form.call_status,
          notes: targetStage ? `stage:${targetStage}` : null,
          status: 'pending', requested_at: new Date().toISOString(),
        })
        const { disposition, call_status, ...restPayload } = payload
        const updated = await updateLead(lead.id, restPayload)
        await logActivity({ leadId: lead.id, action: 'Lead details updated (disposition pending approval)', field: 'multiple', oldVal: null, newVal: 'Details edited', userId, userName })
        alert('Disposition change request PS Manager ko bheji gayi — baaki details save ho gayi.')
        onSaved(updated); return
      }

      const updated = await updateLead(lead.id, payload)
      if (payload.stage === 'meeting_scheduled' && !lead.sales_agent_id) await assignToSales(lead.id)
      await logActivity({ leadId: lead.id, action: 'Lead details updated', field: 'multiple', oldVal: null, newVal: 'Details edited', userId, userName })
      onSaved(updated)
    } catch (e) {
      setError(e.message || 'Error saving')
    } finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit lead details" width={640}>
      {error && <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
      <div className="flex flex-col gap-5">
        <ContactSection form={form} set={set} />
        {isSuperAdmin && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 pb-1 border-b border-slate-100">Assignment</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Presales agent</label>
                <select className="select" value={form.presales_agent_id ?? ''}
                  onChange={e => { set('presales_agent_id', e.target.value); if (e.target.value) set('assigned_to', e.target.value) }}>
                  <option value="">Unassigned</option>
                  {agents.filter(a => a.role === 'presales_agent').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Sales agent</label>
                <select className="select" value={form.sales_agent_id ?? ''} onChange={e => set('sales_agent_id', e.target.value)}>
                  <option value="">Unassigned</option>
                  {agents.filter(a => a.role === 'sales_agent').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}
        <PropertySection form={form} set={set} solarCalc={solarCalc} />
        <DispositionSection form={form} set={set} />
        <SolarSection form={form} set={set} solarCalc={solarCalc} />
      </div>
      <div className="flex gap-2 mt-5 pt-4 border-t border-slate-100">
        <button onClick={onClose} className="btn flex-1 justify-center">Cancel</button>
        <button onClick={handleSave} disabled={saving || !form.phone} className="btn-primary flex-1 justify-center disabled:opacity-50">
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </Modal>
  )
}