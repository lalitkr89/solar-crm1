import { useState } from 'react'
import { Phone, MessageCircle, MapPin, ArrowRight, ChevronDown, History, Edit3, ClipboardList, Clock, Calculator } from 'lucide-react'
import { callLink, waLink } from '@/lib/phone'
import { STAGES } from '@/config/stages'

export default function LeadActions({
  lead, role, isSuperAdmin, nextStages,
  onEdit, onSalesOutcome, onEmiCalc,
  onMoveStage, onToggleHistory, showHistory,
  isPresales, callingMode,
}) {
  const [showStage, setShowStage] = useState(false)
  const isSales = role === 'sales_agent' || role === 'sales_manager'
  const isSalesAgent = role === 'sales_agent'
  const canMoveStage = isSuperAdmin || (role === 'sales_manager')

  const mapUrl = `https://maps.google.com/?q=${encodeURIComponent((lead.address ?? lead.city) ?? '')}`
  const canEditLead = !isSalesAgent && !(
    isPresales &&
    (['sale_pending_approval', 'sale_closed', 'sale_rejected'].includes(lead.stage) ||
      lead.sales_outcome === 'meeting_done_order_closed')
  )
  const canAddOutcome =
    (isSales || isSuperAdmin) &&
    ['meeting_scheduled', 'meeting_done', 'qc_followup'].includes(lead.stage) &&
    lead.sales_outcome !== 'meeting_done_order_closed'

  return (
    <div className="card mb-4 flex flex-wrap items-center gap-2">
      <a href={callLink(lead.phone)} className="btn"><Phone size={13} /> Call</a>
      <a href={waLink(lead.phone)} target="_blank" rel="noopener" className="btn"><MessageCircle size={13} /> WhatsApp</a>
      <a href={mapUrl} target="_blank" rel="noopener" className="btn"><MapPin size={13} /> Map</a>
      <div className="h-5 w-px bg-slate-200 mx-1" />

      {canEditLead && (
        <button onClick={onEdit} className="btn-primary"><Edit3 size={13} /> Edit lead</button>
      )}

      {canAddOutcome && (
        <button onClick={onSalesOutcome}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium cursor-pointer transition-colors"
          style={{ background: '#dbeafe', borderColor: '#93c5fd', color: '#1e3a8a' }}>
          <ClipboardList size={13} /> {lead.sales_outcome ? 'Update Outcome' : 'Add Sales Outcome'}
        </button>
      )}

      {lead.stage === 'sale_pending_approval' && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium bg-amber-50 border-amber-300 text-amber-700">
          <Clock size={13} /> Awaiting Manager Approval
        </span>
      )}

      {lead.stage === 'sale_rejected' && (
        <div className="inline-flex flex-col px-3 py-1.5 rounded-lg border bg-red-50 border-red-300">
          <span className="text-xs font-semibold text-red-700">❌ Order Rejected</span>
          {lead.order_rejected_reason && (
            <span className="text-xs text-red-500 mt-0.5">{lead.order_rejected_reason}</span>
          )}
        </div>
      )}

      {canMoveStage && nextStages.length > 0 && (
        <div className="relative">
          <button onClick={() => setShowStage(s => !s)} className="btn">
            <ArrowRight size={13} /> Move stage <ChevronDown size={12} />
          </button>
          {showStage && (
            <div className="absolute right-0 top-9 z-30 bg-white rounded-xl border border-slate-200 shadow-lg py-1 min-w-[200px]">
              {nextStages.map(s => (
                <button key={s} onClick={() => { onMoveStage(s); setShowStage(false) }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STAGES[s]?.color }} />
                  {STAGES[s]?.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isPresales && !callingMode && (
        <span className="text-xs text-slate-400 ml-auto italic">
          Select "Meeting Fixed" to schedule &amp; move to Sales
        </span>
      )}

      <button onClick={onToggleHistory} className="btn ml-auto">
        <History size={13} /> {showHistory ? 'Hide' : 'Activity'}
      </button>

      <button onClick={onEmiCalc}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100 transition-colors">
        <Calculator size={13} /> EMI Calc
      </button>
    </div>
  )
}
