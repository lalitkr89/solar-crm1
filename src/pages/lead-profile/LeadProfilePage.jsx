import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import Layout from '@/components/layout/Layout'
import { PageHeader, StageBadge, DispBadge, Spinner, InfoRow, PhoneRow } from '@/components/ui'
import { maskPhone } from '@/lib/phone'
import { format } from 'date-fns'
import { Clock, IndianRupee, History } from 'lucide-react'
import { startLeadTimer, stopLeadTimer, getLeadTimeLogs, fmtSecs } from '@/lib/attendanceService'

// ── Hooks ─────────────────────────────────────────────────────
import { useLeadData } from "./hooks/useLeadData"
import { useCallingMode } from "./hooks/useCallingMode"
import { useDisposition } from "./hooks/useDisposition"

// ── UI components ─────────────────────────────────────────────
import CallingBanner from "./components/CallingBanner"
import LeadActions from "./components/LeadActions"

// ── Modals ────────────────────────────────────────────────────
import EditLeadModal from './modals/EditLeadModal'
import DispositionModal from './modals/DispositionModal'
import SalesOutcomeModal from './modals/SalesOutcomeModal'
import OrderDetailsModal from './modals/OrderDetailsModal'
import EmiCalculatorModal from './modals/EmiCalculatorModal'
import { SALES_OUTCOMES, getOutcomeStyle, getLeadStatusStyle, getNextStages } from './config/salesOutcomeConfig'

export default function LeadProfilePage() {
  const { id } = useParams()
  const { profile, role, isSuperAdmin } = useAuth()
  const navigate = useNavigate()

  // ── Data ──────────────────────────────────────────────────
  const { lead, setLead, history, payments, loading } = useLeadData(id)

  // ── Calling navigation ────────────────────────────────────
  const calling = useCallingMode(profile?.id)

  // ── Disposition ───────────────────────────────────────────
  const { saving, saveDisposition, handleMoveStage } = useDisposition(lead, setLead, id, profile, role)

  // ── Modal visibility ──────────────────────────────────────
  const [showHistory, setShowHistory] = useState(false)
  const [showDisp, setShowDisp] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showEmiCalc, setShowEmiCalc] = useState(false)
  const [showSalesOutcome, setShowSalesOutcome] = useState(false)
  const [showOrderDetails, setShowOrderDetails] = useState(false)

  // ── Lead timer — logs to Supabase (presales only) ────────────
  const startRef = useRef(Date.now())
  const logIdRef = useRef(null)
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const isPresalesRole = role === 'presales_agent' || role === 'presales_manager'
    if (id && profile?.id && isPresalesRole) {
      startLeadTimer(id, profile.id).then(logId => { logIdRef.current = logId })
    }
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000)
    return () => {
      clearInterval(t)
      if (logIdRef.current) stopLeadTimer(logIdRef.current)
    }
  }, [id, profile?.id, role])
  const mins = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const secs = String(elapsed % 60).padStart(2, '0')

  // ── Derived state ─────────────────────────────────────────
  const isPresales = role === 'presales_agent' || role === 'presales_manager'
  const isSales = role === 'sales_agent' || role === 'sales_manager'
  const nextStages = lead ? getNextStages(lead.stage, role, isSuperAdmin) : []
  const currentOutcome = SALES_OUTCOMES.find(o => o.value === lead?.sales_outcome)
  const outcomeStyle = getOutcomeStyle(lead?.sales_outcome)

  // ── Handlers ──────────────────────────────────────────────
  async function handleSaveDisposition(...args) {
    const result = await saveDisposition(...args)
    setShowDisp(false)
    if (!result.requiresApproval && calling.callingMode) await calling.goToNextLead()
  }

  async function handleSalesOutcomeSaved(updates) {
    setLead(prev => ({ ...prev, ...updates }))
    setShowSalesOutcome(false)
    if (updates.stage === 'sale_pending_approval') { setShowOrderDetails(true); return }
    if (calling.salesCallingMode) await calling.goToNextSalesLead()
  }

  // ── Loading / not found ───────────────────────────────────
  if (loading) return <Layout><div className="flex justify-center py-20"><Spinner size={24} /></div></Layout>
  if (!lead) return <Layout><p className="text-slate-500 p-4">Lead not found</p></Layout>

  return (
    <Layout>

      {/* ── Calling banners ── */}
      {calling.callingMode && (
        <CallingBanner mode="presales"
          currentPos={calling.currentPos} totalInQueue={calling.totalInQueue}
          onNext={calling.goToNextLead} onStop={calling.stopPresales} />
      )}
      {calling.salesCallingMode && (
        <CallingBanner mode="sales" type={calling.salesCallingType}
          currentPos={calling.salesCurrentPos} totalInQueue={calling.salesTotalInQueue}
          onNext={calling.goToNextSalesLead} onStop={calling.stopSales} />
      )}

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn px-2 py-1.5 text-slate-500">←</button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1>{lead.name ?? '—'}</h1>
              <StageBadge stage={lead.stage} />
              {lead.stage === 'new' && (
                lead.disposition
                  ? <DispBadge value={lead.disposition} />
                  : <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">New Lead</span>
              )}
              {lead.stage === 'meeting_scheduled' && (
                lead.sales_outcome
                  ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border"
                    style={{ background: outcomeStyle.bg, color: outcomeStyle.text, borderColor: outcomeStyle.border }}>
                    {currentOutcome?.label || lead.sales_outcome}
                  </span>
                  : <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200">Update pending from sales</span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {maskPhone(lead.phone)} · {lead.city ?? '—'} · Added {lead.created_at ? format(new Date(lead.created_at), 'd MMM yyyy') : '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-navy-900 text-white flex-shrink-0">
          <Clock size={13} className="text-blue-300" />
          <span className="font-mono text-sm font-medium">{mins}:{secs}</span>
        </div>
      </div>

      {/* ── Action buttons ── */}
      <LeadActions
        lead={lead} role={role} isSuperAdmin={isSuperAdmin} nextStages={nextStages}
        isPresales={isPresales} callingMode={calling.callingMode}
        onEdit={() => setShowEdit(true)}
        onSalesOutcome={() => setShowSalesOutcome(true)}
        onEmiCalc={() => setShowEmiCalc(true)}
        onMoveStage={handleMoveStage}
        onToggleHistory={() => setShowHistory(s => !s)}
        showHistory={showHistory}
      />

      {/* ── Info grid (contact / call / payments) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Col 1 — Contact + Property */}
        <div className="flex flex-col gap-4">
          <div className="card">
            <h3 className="mb-3">Contact details</h3>
            <PhoneRow label="Phone" phone={lead.phone} leadId={id} userId={profile?.id} userName={profile?.name} />
            <PhoneRow label="Alternate" phone={lead.alternate_phone} leadId={id} userId={profile?.id} userName={profile?.name} />
            <InfoRow label="Email" value={lead.email} />
            <InfoRow label="City" value={lead.city} />
            <InfoRow label="Pincode" value={lead.pincode} />
            <InfoRow label="Address" value={lead.address} />
            <InfoRow label="Lead source" value={lead.lead_source} />
            <InfoRow label="Referral type" value={lead.referral_type} />
            <InfoRow label="Referral name" value={lead.referral_name} />
            <InfoRow label="Referral ID" value={lead.referral_id} />
          </div>
          <div className="card">
            <h3 className="mb-3">Property &amp; electricity</h3>
            <InfoRow label="Property type" value={lead.property_type} />
            <InfoRow label="Ownership" value={lead.ownership} />
            <InfoRow label="Roof type" value={lead.roof_type} />
            <InfoRow label="Roof area" value={lead.roof_area ? `${lead.roof_area} sq ft` : null} />
            <InfoRow label="Load" value={lead.sanctioned_load ? `${lead.sanctioned_load} kW` : null} />
            <InfoRow label="Monthly bill" value={lead.monthly_bill ? `₹${lead.monthly_bill}` : null} />
            <InfoRow label="Units/month" value={lead.units_per_month ? `${lead.units_per_month} kWh` : null} />
            <InfoRow label="Elec board" value={lead.electricity_board} />
          </div>
        </div>

        {/* Col 2 — Call + Solar */}
        <div className="flex flex-col gap-4">
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3>Call details</h3>
              {lead.updated_at && <span className="text-xs text-slate-400">Updated {format(new Date(lead.updated_at), 'd MMM · h:mm a')}</span>}
            </div>
            <InfoRow label="Current Handler" value={lead.assigned_user?.name} />
            <InfoRow label="PS Agent" value={lead.presales_agent?.name} />
            <InfoRow label="Sales Agent" value={lead.sales_agent?.name} />
            <InfoRow label="Calling date" value={lead.calling_date} />
            <InfoRow label="Callback date" value={lead.callback_date} />
            <InfoRow label="Callback slot" value={lead.callback_slot} />
            <InfoRow label="Meeting date" value={lead.meeting_date} />
            <InfoRow label="Meeting slot" value={lead.meeting_slot} />
          </div>
          <div className="card">
            <h3 className="mb-3">Solar quote</h3>
            <InfoRow label="System size" value={lead.system_size_kw ? `${lead.system_size_kw} kW` : null} />
            <InfoRow label="System type" value={lead.system_type} />
            <InfoRow label="Quoted amount" value={lead.quoted_amount ? `₹${Number(lead.quoted_amount).toLocaleString('en-IN')}` : null} />
          </div>
        </div>

        {/* Col 3 — Payments + Sales outcome + Activity */}
        <div className="flex flex-col gap-4">
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <IndianRupee size={14} className="text-green-600" />
              <h3>Payment milestones</h3>
            </div>
            {payments.length === 0 ? (
              <p className="text-xs text-slate-400">No payments recorded yet</p>
            ) : (
              <div className="flex flex-col gap-2">
                {payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <div>
                      <div className="text-xs font-medium text-slate-700 capitalize">{p.milestone?.replace('_', ' ')}</div>
                      <div className="text-xs text-slate-400">{p.paid_date ?? 'Not paid'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-slate-800">₹{Number(p.amount_expected).toLocaleString('en-IN')}</div>
                      <span className={`text-xs font-medium ${p.status === 'paid' ? 'text-green-600' : p.status === 'overdue' ? 'text-red-500' : 'text-amber-500'}`}>{p.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {lead.remarks && (
            <div className="card">
              <h3 className="mb-2">Presales remarks</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{lead.remarks}</p>
            </div>
          )}

          <div className={`card border-l-4 ${lead.sales_lead_status === 'won' ? 'border-l-green-400' : lead.sales_lead_status === 'lost' ? 'border-l-red-400' : lead.sales_lead_status === 'follow_up' ? 'border-l-blue-400' : 'border-l-slate-200'}`}>
            <div className="flex items-center justify-between mb-3">
              <h3>Sales outcome</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Sales team</span>
                {(isSales || isSuperAdmin) && ['meeting_scheduled', 'meeting_done', 'qc_followup'].includes(lead.stage) && lead.sales_outcome !== 'meeting_done_order_closed' && (
                  <button onClick={() => setShowSalesOutcome(true)} className="text-xs text-blue-500 hover:underline">
                    {lead.sales_outcome ? 'Edit' : 'Add'}
                  </button>
                )}
              </div>
            </div>
            {lead.sales_outcome ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500">Outcome:</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border"
                    style={{ background: outcomeStyle.bg, color: outcomeStyle.text, borderColor: outcomeStyle.border }}>
                    {currentOutcome?.label || lead.sales_outcome}
                  </span>
                </div>
                {lead.sales_meeting_via && <div className="flex items-center gap-2"><span className="text-xs font-medium text-slate-500">Meeting via:</span><span className="text-xs text-slate-700">{lead.sales_meeting_via === 'on_call' ? '📞 On Call' : '🏠 Physical Visit'}</span></div>}
                {lead.sales_lead_status && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500">Lead status:</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${getLeadStatusStyle(lead.sales_lead_status)}`}>{lead.sales_lead_status.replace('_', ' ')}</span>
                  </div>
                )}
                {lead.sales_not_interested_reason && <div className="flex items-center gap-2"><span className="text-xs font-medium text-slate-500">Reason:</span><span className="text-xs text-red-600 capitalize">{lead.sales_not_interested_reason.replace('_', ' ')}</span></div>}
                {lead.sales_callback_date && <div className="flex items-center gap-2"><span className="text-xs font-medium text-slate-500">Sales callback:</span><span className="text-xs text-blue-600">{lead.sales_callback_date} · {lead.sales_callback_slot}</span></div>}
                {lead.sales_followup_date && <div className="flex items-center gap-2"><span className="text-xs font-medium text-slate-500">Follow up:</span><span className="text-xs text-blue-600">{lead.sales_followup_date} · {lead.sales_followup_slot}</span></div>}
                {lead.sales_quoted_amount && <div className="flex items-center gap-2"><span className="text-xs font-medium text-slate-500">Quoted:</span><span className="text-xs font-semibold text-green-700">₹{Number(lead.sales_quoted_amount).toLocaleString('en-IN')}</span></div>}
                {lead.sales_remarks && <div className="mt-1"><span className="text-xs font-medium text-slate-500">Remarks:</span><p className="text-xs text-slate-600 mt-0.5">{lead.sales_remarks}</p></div>}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                {(isSales || isSuperAdmin) ? 'No outcome added yet — click "Add" to update' : 'Not updated by sales team yet'}
              </p>
            )}
          </div>

          {showHistory && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <History size={14} className="text-slate-500" />
                <h3>Activity timeline</h3>
              </div>
              {history.length === 0 ? <p className="text-xs text-slate-400">No activity yet</p> : (
                <div>
                  {history.map((h, i) => (
                    <div key={h.id} className="flex gap-3 pb-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${h.action?.includes('Stage') ? 'bg-blue-500' : h.action?.includes('Meeting') ? 'bg-green-500' : h.action?.includes('Callback') ? 'bg-amber-500' : h.action?.includes('Sales') ? 'bg-purple-500' : h.action?.includes('Assignment') ? 'bg-orange-500' : 'bg-slate-300'}`} />
                        {i < history.length - 1 && <div className="w-px flex-1 bg-slate-100 mt-1" />}
                      </div>
                      <div className="flex-1 min-w-0 pb-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-medium text-slate-700">{h.action}</span>
                          {h.updated_by && <span className="text-xs text-slate-400">· {h.updated_by}</span>}
                        </div>
                        {h.old_value && h.new_value && (
                          <div className="text-xs text-slate-500 mt-0.5">
                            <span className="line-through text-red-400">{h.old_value}</span>{' → '}<span className="text-green-600 font-medium">{h.new_value}</span>
                          </div>
                        )}
                        <div className="text-xs text-slate-400 mt-0.5">{h.updated_at ? format(new Date(h.updated_at), 'd MMM yy · h:mm a') : ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      <EditLeadModal open={showEdit} lead={lead} onClose={() => setShowEdit(false)}
        onSaved={(updated) => { setLead(prev => ({ ...prev, ...updated })); setShowEdit(false) }}
        userId={profile?.id} userName={profile?.name} role={role} />

      <DispositionModal open={showDisp} onClose={() => setShowDisp(false)}
        onSave={handleSaveDisposition} saving={saving} currentDisp={lead.disposition} />

      <EmiCalculatorModal open={showEmiCalc} onClose={() => setShowEmiCalc(false)}
        defaultAmount={lead.quoted_amount || lead.sales_quoted_amount || ''} />

      {showSalesOutcome && (
        <SalesOutcomeModal lead={lead} onClose={() => setShowSalesOutcome(false)}
          onSaved={handleSalesOutcomeSaved}
          userId={profile?.id} userName={profile?.name} />
      )}

      {showOrderDetails && (
        <OrderDetailsModal lead={lead} onClose={() => setShowOrderDetails(false)}
          onSaved={(orderData) => {
            setLead(prev => ({ ...prev, order_details: orderData, ...(prev.stage === 'sale_rejected' ? { stage: 'sale_pending_approval', order_rejected_reason: null } : {}) }))
            setShowOrderDetails(false)
          }}
          userId={profile?.id} userName={profile?.name} />
      )}
    </Layout>
  )
}