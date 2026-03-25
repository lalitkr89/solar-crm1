import { useState } from 'react'
import { Modal } from '@/components/ui'
import { updateLead, logActivity } from '@/lib/leadService'
import { TIME_SLOTS } from '@/config/timeSlots'
import { SALES_OUTCOMES, NOT_INTERESTED_REASONS } from '../config/salesOutcomeConfig'

export default function SalesOutcomeModal({ lead, onClose, onSaved, userId, userName }) {
  const [outcome, setOutcome] = useState(lead.sales_outcome ?? '')
  const [meetingVia, setMeetingVia] = useState(lead.sales_meeting_via ?? '')
  const [notInterestedReason, setNotInterestedReason] = useState(lead.sales_not_interested_reason ?? '')
  const [callbackDate, setCallbackDate] = useState(lead.sales_callback_date ?? '')
  const [callbackSlot, setCallbackSlot] = useState(lead.sales_callback_slot ?? '')
  const [followupDate, setFollowupDate] = useState(lead.sales_followup_date ?? '')
  const [followupSlot, setFollowupSlot] = useState(lead.sales_followup_slot ?? '')
  const [rescheduleDate, setRescheduleDate] = useState(lead.meeting_date ?? '')
  const [rescheduleSlot, setRescheduleSlot] = useState(lead.meeting_slot ?? '')
  const [quotedAmount, setQuotedAmount] = useState(lead.sales_quoted_amount ?? '')
  const [remarks, setRemarks] = useState(lead.sales_remarks ?? '')
  const [saving, setSaving] = useState(false)

  const selectedOutcome = SALES_OUTCOMES.find(o => o.value === outcome)
  const needsVia = selectedOutcome?.meetingVia === 'ask'
  const needsNotInterestedReason = selectedOutcome?.needsNotInterestedReason
  const needsCallback = selectedOutcome?.needsCallback
  const needsFollowup = selectedOutcome?.needsFollowup
  const needsReschedule = selectedOutcome?.needsReschedule

  const saveDisabled =
    !outcome ||
    (needsVia && !meetingVia) ||
    (needsNotInterestedReason && !notInterestedReason) ||
    (needsCallback && (!callbackDate || !callbackSlot)) ||
    (needsFollowup && (!followupDate || !followupSlot)) ||
    (needsReschedule && (!rescheduleDate || !rescheduleSlot)) ||
    saving

  async function handleSave() {
    setSaving(true)
    const updates = {
      sales_outcome: outcome,
      sales_meeting_via: needsVia ? meetingVia : selectedOutcome?.meetingVia === 'on_call' ? 'on_call' : null,
      sales_lead_status: selectedOutcome?.leadStatus ?? null,
      sales_meeting_status: selectedOutcome?.meetingStatus ?? null,
      sales_not_interested_reason: needsNotInterestedReason ? notInterestedReason : null,
      sales_callback_date: needsCallback ? callbackDate : null,
      sales_callback_slot: needsCallback ? callbackSlot : null,
      sales_followup_date: needsFollowup ? followupDate : null,
      sales_followup_slot: needsFollowup ? followupSlot : null,
      sales_quoted_amount: quotedAmount ? Number(quotedAmount) : null,
      sales_remarks: remarks || null,
      ...(needsReschedule ? { meeting_date: rescheduleDate, meeting_slot: rescheduleSlot } : {}),
    }
    if (outcome === 'meeting_done_order_closed') {
      updates.stage = 'sale_pending_approval'
      updates.order_submitted_at = new Date().toISOString()
    }
    if (outcome === 'multiple_nc_rearrange') {
      updates.stage = 'qc_followup'
      updates.sales_outcome = null
      updates.sales_lead_status = null
      updates.sales_meeting_status = null
      updates.meeting_date = null
      updates.meeting_slot = null
      updates.assigned_to = lead.presales_agent_id ?? lead.assigned_to
      updates.disposition = 'Multiple NC — Rearrange Meeting'
      updates.call_status = 'Not Connected'
    }
    await updateLead(lead.id, updates)
    await logActivity({
      leadId: lead.id, action: 'Sales outcome updated',
      field: 'sales_outcome', oldVal: lead.sales_outcome,
      newVal: selectedOutcome?.label || outcome, userId, userName,
    })
    if (needsReschedule) {
      await logActivity({
        leadId: lead.id, action: 'Meeting rescheduled',
        field: 'meeting_date', oldVal: lead.meeting_date,
        newVal: `${rescheduleDate} · ${rescheduleSlot}`, userId, userName,
      })
    }
    if (updates.stage) {
      await logActivity({
        leadId: lead.id, action: 'Stage changed (auto)',
        field: 'stage', oldVal: lead.stage, newVal: updates.stage, userId, userName,
      })
    }
    onSaved(updates)
    setSaving(false)
  }

  return (
    <Modal open={true} onClose={onClose} title="Sales outcome update" width={520}>
      <div className="mb-4">
        <label className="label">Meeting outcome <span className="text-red-500">*</span></label>
        {[
          { group: 'Meeting Not Done', filter: 'meeting_not_done', color: '#fef9c3', textColor: '#713f12' },
          { group: 'Meeting Pending', filter: 'meeting_pending', color: '#dbeafe', textColor: '#1e3a8a' },
          { group: 'Meeting Done — Lost', filter: 'meeting_done', color: '#fee2e2', textColor: '#7f1d1d', onlyLost: true },
          { group: 'Meeting Done — Follow Up / Won', filter: 'meeting_done', color: '#dcfce7', textColor: '#14532d', onlyPositive: true },
        ].map(({ group, filter, color, textColor, onlyLost, onlyPositive }) => {
          const groupOutcomes = SALES_OUTCOMES.filter(o => {
            if (o.meetingStatus !== filter) return false
            if (onlyLost) return o.leadStatus === 'lost'
            if (onlyPositive) return o.leadStatus === 'follow_up' || o.leadStatus === 'won'
            return true
          })
          if (groupOutcomes.length === 0) return null
          return (
            <div key={group} className="mb-3">
              <p className="text-xs font-semibold mb-1.5 px-1" style={{ color: textColor }}>{group}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {groupOutcomes.map(o => (
                  <button key={o.value} onClick={() => {
                    setOutcome(o.value); setMeetingVia(''); setNotInterestedReason('')
                    setCallbackDate(''); setCallbackSlot('')
                    setFollowupDate(''); setFollowupSlot('')
                    if (o.needsReschedule) { setRescheduleDate(lead.meeting_date ?? ''); setRescheduleSlot(lead.meeting_slot ?? '') }
                  }}
                    className="text-left px-3 py-2 rounded-lg text-xs border font-medium transition-all"
                    style={outcome === o.value
                      ? { background: '#1d4ed8', color: '#fff', borderColor: '#1d4ed8' }
                      : { background: color, color: textColor, borderColor: textColor + '40' }}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {needsVia && (
        <div className="mb-4 p-3 rounded-xl border border-slate-200 bg-slate-50">
          <label className="label">Meeting kaise hua? <span className="text-red-500">*</span></label>
          <div className="flex gap-2">
            {[{ value: 'on_call', label: '📞 On Call' }, { value: 'physical', label: '🏠 Physical Visit' }].map(v => (
              <button key={v.value} onClick={() => setMeetingVia(v.value)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${meetingVia === v.value ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {needsNotInterestedReason && (
        <div className="mb-4 p-3 rounded-xl border border-red-200 bg-red-50">
          <label className="label text-red-700">Reason <span className="text-red-500">*</span></label>
          <div className="grid grid-cols-2 gap-1.5">
            {NOT_INTERESTED_REASONS.map(r => (
              <button key={r.value} onClick={() => setNotInterestedReason(r.value)}
                className={`text-left px-3 py-2 rounded-lg text-xs border font-medium transition-all ${notInterestedReason === r.value ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-700 border-red-200 hover:bg-red-50'}`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {needsCallback && (
        <div className="mb-4 p-3 rounded-xl border border-blue-200 bg-blue-50">
          <p className="text-xs font-semibold text-blue-800 mb-2">📅 Sales callback schedule <span className="text-red-500">*</span></p>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Callback date</label>
              <input type="date" className="input" value={callbackDate} onChange={e => setCallbackDate(e.target.value)} min={new Date().toISOString().split('T')[0]} /></div>
            <div><label className="label">Callback slot</label>
              <select className="select" value={callbackSlot} onChange={e => setCallbackSlot(e.target.value)}>
                <option value="">Select slot</option>
                {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select></div>
          </div>
        </div>
      )}

      {needsFollowup && (
        <div className="mb-4 p-3 rounded-xl border border-green-200 bg-green-50">
          <p className="text-xs font-semibold text-green-800 mb-2">📅 Follow up date <span className="text-red-500">*</span></p>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Follow up date</label>
              <input type="date" className="input" value={followupDate} onChange={e => setFollowupDate(e.target.value)} min={new Date().toISOString().split('T')[0]} /></div>
            <div><label className="label">Follow up slot</label>
              <select className="select" value={followupSlot} onChange={e => setFollowupSlot(e.target.value)}>
                <option value="">Select slot</option>
                {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select></div>
          </div>
        </div>
      )}

      {needsReschedule && (
        <div className="mb-4 p-3 rounded-xl border border-purple-200 bg-purple-50">
          <p className="text-xs font-semibold text-purple-800 mb-2">📅 New meeting date & slot <span className="text-red-500">*</span></p>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">New date</label>
              <input type="date" className="input" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} min={new Date().toISOString().split('T')[0]} /></div>
            <div><label className="label">New slot</label>
              <select className="select" value={rescheduleSlot} onChange={e => setRescheduleSlot(e.target.value)}>
                <option value="">Select slot</option>
                {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select></div>
          </div>
          {rescheduleDate && rescheduleSlot && (
            <p className="text-xs text-purple-700 mt-2 font-medium">✓ Rescheduled to {rescheduleDate} · {rescheduleSlot}</p>
          )}
        </div>
      )}

      {outcome && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div><label className="label">Quoted amount (₹)</label>
            <input className="input" type="number" placeholder="e.g. 250000" value={quotedAmount} onChange={e => setQuotedAmount(e.target.value)} /></div>
          <div className="col-span-2"><label className="label">Sales remarks</label>
            <textarea className="input resize-none" rows={2} placeholder="Meeting mein kya hua..."
              value={remarks} onChange={e => setRemarks(e.target.value)} /></div>
        </div>
      )}

      {outcome === 'meeting_done_order_closed' && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
          <p className="text-xs text-amber-700 font-medium">🎉 Order details form khulega — Sales Manager ki approval ke baad sale confirm hoga.</p>
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t border-slate-100">
        <button onClick={onClose} className="btn flex-1 justify-center">Cancel</button>
        <button onClick={handleSave} disabled={saveDisabled} className="btn-primary flex-1 justify-center disabled:opacity-50">
          {saving ? 'Saving...' : 'Save outcome'}
        </button>
      </div>
    </Modal>
  )
}
