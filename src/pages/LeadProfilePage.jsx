import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import Layout from '@/components/layout/Layout'
import {
  PageHeader, StageBadge, DispBadge, Spinner,
  InfoRow, Modal, Avatar
} from '@/components/ui'
import {
  getLeadById, getLeadHistory,
  updateLead, logActivity, moveStage, logCall
} from '@/lib/leadService'
import { formatPhone, waLink, callLink } from '@/lib/phone'
import { assignToSales, assignLeadIfUnassigned, getCallingQueue, assignSalesLeadIfUnassigned, getSalesCallingQueue, getSalesFollowUpQueue } from '@/lib/assignment'
import {
  isCallingModeActive,
  getCallingQueueFromSession,
  getCallingIndexFromSession,
  setCallingIndex,
  stopCallingMode,
} from '@/pages/PresalesPage'
import {
  isSalesCallingModeActive,
  getSalesCallingModeType,
  getSalesCallingQueueFromSession,
  getSalesCallingIndexFromSession,
  setSalesCallingIndex,
  stopSalesCallingMode,
} from '@/pages/SalesPage'
import {
  NOT_CONNECTED_DISPOSITIONS,
  CONNECTED_DISPOSITIONS,
  isMeetingDisposition,
  isCallbackDisposition,
  getDispositionStyle,
} from '@/config/dispositions'
import { TIME_SLOTS } from '@/config/timeSlots'
import { STAGES } from '@/config/stages'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import {
  Phone, MessageCircle, MapPin, Clock, ArrowRight,
  ChevronDown, History, IndianRupee, Edit3, ClipboardList,
  PhoneOff, ChevronRight
} from 'lucide-react'

// ── Sales Outcome Config ──────────────────────────────────────
const SALES_OUTCOMES = [
  { value: 'call_not_connected_1', label: 'Call Not Connected - 1st', meetingVia: 'on_call', leadStatus: 'pending', meetingStatus: 'meeting_not_done' },
  { value: 'call_not_connected_2', label: 'Call Not Connected - 2nd', meetingVia: 'on_call', leadStatus: 'pending', meetingStatus: 'meeting_not_done' },
  { value: 'call_not_connected_3', label: 'Call Not Connected - 3rd', meetingVia: 'on_call', leadStatus: 'pending', meetingStatus: 'meeting_not_done' },
  { value: 'invalid_number', label: 'Invalid Number', meetingVia: 'on_call', leadStatus: 'pending', meetingStatus: 'meeting_not_done' },
  { value: 'call_later_interested', label: 'Call Later (Interested)', meetingVia: 'on_call', leadStatus: 'pending', meetingStatus: 'meeting_pending', needsCallback: true },
  { value: 'meeting_rescheduled', label: 'Meeting Rescheduled 📅', meetingVia: 'ask', leadStatus: 'pending', meetingStatus: 'meeting_pending', needsReschedule: true },
  { value: 'call_later_underconstruction', label: 'Call Later (Under Construction)', meetingVia: 'ask', leadStatus: 'pending', meetingStatus: 'meeting_pending' },
  { value: 'non_qualified_roof', label: 'Non Qualified - Roof Insufficient', meetingVia: 'ask', leadStatus: 'lost', meetingStatus: 'meeting_done' },
  { value: 'non_qualified_bill', label: 'Non Qualified - Bill Insufficient', meetingVia: 'ask', leadStatus: 'lost', meetingStatus: 'meeting_done' },
  { value: 'non_qualified_ownership', label: 'Non Qualified - No Roof Ownership', meetingVia: 'ask', leadStatus: 'lost', meetingStatus: 'meeting_done' },
  { value: 'non_qualified_not_govt_meter', label: 'Non Qualified - Not Govt Meter', meetingVia: 'ask', leadStatus: 'lost', meetingStatus: 'meeting_done' },
  { value: 'non_qualified_no_connection', label: 'Non Qualified - No Meter Connection', meetingVia: 'ask', leadStatus: 'lost', meetingStatus: 'meeting_done' },
  { value: 'not_serviceable_offgrid', label: 'Not Serviceable - Offgrid', meetingVia: 'ask', leadStatus: 'lost', meetingStatus: 'meeting_done' },
  { value: 'not_serviceable_location', label: 'Not Serviceable - Location', meetingVia: 'ask', leadStatus: 'lost', meetingStatus: 'meeting_done' },
  { value: 'not_interested', label: 'Not Interested in Solar', meetingVia: 'ask', leadStatus: 'lost', meetingStatus: 'meeting_done', needsNotInterestedReason: true },
  { value: 'solarpro_enquiry', label: 'SolarPro Enquiry', meetingVia: 'ask', leadStatus: 'lost', meetingStatus: 'meeting_done' },
  { value: 'meeting_done_hot', label: 'Meeting Done — HOT 🔥', meetingVia: 'ask', leadStatus: 'follow_up', meetingStatus: 'meeting_done', needsFollowup: true },
  { value: 'meeting_done_moderate', label: 'Meeting Done — MODERATE 🌡️', meetingVia: 'ask', leadStatus: 'follow_up', meetingStatus: 'meeting_done', needsFollowup: true },
  { value: 'meeting_done_cold', label: 'Meeting Done — COLD ❄️', meetingVia: 'ask', leadStatus: 'follow_up', meetingStatus: 'meeting_done', needsFollowup: true },
  { value: 'meeting_done_order_closed', label: 'Meeting Done — ORDER CLOSED 🎉', meetingVia: 'ask', leadStatus: 'won', meetingStatus: 'meeting_done' },
]

const NOT_INTERESTED_REASONS = [
  { value: 'price_issue', label: 'Price Issue' },
  { value: 'product_issue', label: 'Product Issue' },
  { value: 'already_installed', label: 'Already Installed' },
  { value: 'competitor_chosen', label: 'Competitor Chosen' },
  { value: 'other', label: 'Other' },
]

function getOutcomeStyle(outcome) {
  if (!outcome) return { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' }
  if (outcome.includes('order_closed')) return { bg: '#dcfce7', text: '#14532d', border: '#86efac' }
  if (outcome.includes('hot')) return { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' }
  if (outcome.includes('moderate')) return { bg: '#dbeafe', text: '#1e3a8a', border: '#93c5fd' }
  if (outcome.includes('cold')) return { bg: '#ede9fe', text: '#4c1d95', border: '#c4b5fd' }
  if (outcome === 'meeting_rescheduled') return { bg: '#f3e8ff', text: '#6b21a8', border: '#d8b4fe' }
  if (outcome.includes('not_interested') || outcome.includes('non_qualified') || outcome.includes('not_serviceable'))
    return { bg: '#fee2e2', text: '#7f1d1d', border: '#fca5a5' }
  if (outcome.includes('call_later')) return { bg: '#dbeafe', text: '#1e3a8a', border: '#93c5fd' }
  if (outcome.includes('not_connected') || outcome.includes('invalid'))
    return { bg: '#fef9c3', text: '#713f12', border: '#fde047' }
  return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' }
}

function getLeadStatusStyle(status) {
  switch (status) {
    case 'won': return 'bg-green-100 text-green-700 border-green-200'
    case 'lost': return 'bg-red-100 text-red-600 border-red-200'
    case 'follow_up': return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200'
    default: return 'bg-slate-100 text-slate-600 border-slate-200'
  }
}

export default function LeadProfilePage() {
  const { id } = useParams()
  const { profile, role, isSuperAdmin, isManager } = useAuth()
  const navigate = useNavigate()

  const [lead, setLead] = useState(null)
  const [history, setHistory] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [showDisp, setShowDisp] = useState(false)
  const [showStage, setShowStage] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showSalesOutcome, setShowSalesOutcome] = useState(false)
  const [saving, setSaving] = useState(false)

  // Presales calling mode
  const callingMode = isCallingModeActive()
  const callingQueue = getCallingQueueFromSession()
  const callingIndex = getCallingIndexFromSession()
  const currentPos = callingIndex + 1
  const totalInQueue = callingQueue.length

  // Sales calling mode
  const salesCallingMode = isSalesCallingModeActive()
  const salesCallingType = getSalesCallingModeType()
  const salesCallingQueue = getSalesCallingQueueFromSession()
  const salesCallingIndex = getSalesCallingIndexFromSession()
  const salesCurrentPos = salesCallingIndex + 1
  const salesTotalInQueue = salesCallingQueue.length
  const isAnyCallingMode = callingMode || salesCallingMode

  const startRef = useRef(Date.now())
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000)
    return () => clearInterval(t)
  }, [])
  const mins = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const secs = String(elapsed % 60).padStart(2, '0')

  async function load() {
    setLoading(true)
    const [l, h] = await Promise.all([getLeadById(id), getLeadHistory(id)])
    setLead(l)
    setHistory(h)
    const { data: p } = await supabase
      .from('payments').select('*').eq('lead_id', id).order('created_at')
    setPayments(p ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  // ── Next lead navigate (calling mode) ────────────────────
  async function goToNextLead() {
    const nextIndex = callingIndex + 1

    if (nextIndex < callingQueue.length) {
      // Queue mein next lead hai — assign karo agar unassigned ho
      const nextLead = callingQueue[nextIndex]
      await assignLeadIfUnassigned(nextLead.id, profile.id)
      setCallingIndex(nextIndex)
      navigate(`/leads/${nextLead.id}`)
    } else {
      // Queue khatam — fresh queue lo (unassigned pool se nayi leads aayengi)
      const freshQueue = await getCallingQueue(profile.id)
      const currentIds = new Set(callingQueue.map(l => l.id))
      const newLeads = freshQueue.filter(l => !currentIds.has(l.id))

      if (newLeads.length > 0) {
        await assignLeadIfUnassigned(newLeads[0].id, profile.id)
        const updatedQueue = [...callingQueue, ...newLeads]
        sessionStorage.setItem('callingQueue', JSON.stringify(updatedQueue))
        setCallingIndex(nextIndex)
        navigate(`/leads/${newLeads[0].id}`)
      } else {
        stopCallingMode()
        alert('🎉 Saari leads ho gayi! Abhi koi aur lead available nahi hai.')
        navigate('/presales')
      }
    }
  }

  function handleStopCalling() {
    stopCallingMode()
    navigate('/presales')
  }

  // ── Sales: Next lead ──────────────────────────────────────
  async function goToNextSalesLead() {
    const nextIndex = salesCallingIndex + 1

    if (nextIndex < salesCallingQueue.length) {
      const nextLead = salesCallingQueue[nextIndex]
      await assignSalesLeadIfUnassigned(nextLead.id, profile.id)
      setSalesCallingIndex(nextIndex)
      navigate(`/leads/${nextLead.id}`)
    } else {
      // Fresh queue lo
      const freshQueue = salesCallingType === 'followup'
        ? await getSalesFollowUpQueue(profile.id)
        : await getSalesCallingQueue(profile.id)
      const currentIds = new Set(salesCallingQueue.map(l => l.id))
      const newLeads = freshQueue.filter(l => !currentIds.has(l.id))

      if (newLeads.length > 0) {
        if (salesCallingType === 'calling') {
          await assignSalesLeadIfUnassigned(newLeads[0].id, profile.id)
        }
        const updatedQueue = [...salesCallingQueue, ...newLeads]
        sessionStorage.setItem('salesCallingQueue', JSON.stringify(updatedQueue))
        setSalesCallingIndex(nextIndex)
        navigate(`/leads/${newLeads[0].id}`)
      } else {
        stopSalesCallingMode()
        alert(`🎉 Saari ${salesCallingType === 'followup' ? 'follow ups' : 'meetings'} ho gayi!`)
        navigate('/sales')
      }
    }
  }

  function handleStopSalesCalling() {
    stopSalesCallingMode()
    navigate('/sales')
  }

  async function saveDisposition(disp, callStatus, date, slot, scheduleType) {
    setSaving(true)
    const old = lead.disposition
    const updates = { disposition: disp, call_status: callStatus }
    if (scheduleType === 'meeting' && date && slot) {
      updates.meeting_date = date
      updates.meeting_slot = slot
      updates.stage = 'meeting_scheduled'
    }
    if (scheduleType === 'callback' && date && slot) {
      updates.callback_date = date
      updates.callback_slot = slot
    }
    await updateLead(id, updates)
    if (updates.stage === 'meeting_scheduled' && !lead.sales_agent_id) {
      await assignToSales(id)
    }
    await logCall({ leadId: id, callerId: profile.id, callStatus, disposition: disp })
    await logActivity({
      leadId: id, action: 'Disposition updated',
      field: 'disposition', oldVal: old, newVal: disp,
      userId: profile.id, userName: profile.name,
    })
    if (updates.stage) {
      await logActivity({
        leadId: id, action: 'Stage changed (auto)',
        field: 'stage', oldVal: lead.stage, newVal: updates.stage,
        userId: profile.id, userName: profile.name,
      })
    }
    setLead(prev => ({ ...prev, ...updates }))
    setShowDisp(false)
    setSaving(false)

    // Calling mode mein hai toh next lead pe jao
    if (callingMode) {
      await goToNextLead()
    }
  }

  async function handleMoveStage(newStage) {
    setSaving(true)
    await moveStage(lead, newStage, profile.id, profile.name)
    setLead(prev => ({ ...prev, stage: newStage }))
    setShowStage(false)
    setSaving(false)
  }

  if (loading) return <Layout><div className="flex justify-center py-20"><Spinner size={24} /></div></Layout>
  if (!lead) return <Layout><p className="text-slate-500 p-4">Lead not found</p></Layout>

  const isPresales = role === 'presales_agent' || role === 'presales_manager'
  const isSales = role === 'sales_agent' || role === 'sales_manager'
  const isSalesAgent = role === 'sales_agent'
  const canMoveStage = isSuperAdmin || (isManager && !isPresales)
  const nextStages = getNextStages(lead.stage, role, isSuperAdmin)

  const currentOutcome = SALES_OUTCOMES.find(o => o.value === lead.sales_outcome)
  const outcomeStyle = getOutcomeStyle(lead.sales_outcome)

  return (
    <Layout>

      {/* ── Presales Calling Mode Banner ── */}
      {callingMode && (
        <div className="mb-3 px-4 py-2.5 rounded-xl flex items-center gap-3"
          style={{ background: '#fef3c7', border: '1px solid #fcd34d' }}>
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
          <div className="flex-1">
            <span className="text-sm font-semibold text-amber-800">📞 Calling Mode</span>
            <span className="text-xs text-amber-700 ml-2">
              Lead {currentPos} of {totalInQueue} — disposition save ke baad next lead khulegi
            </span>
          </div>
          <button onClick={goToNextLead}
            className="flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900 px-2 py-1 rounded-lg hover:bg-amber-100 transition-colors">
            Skip <ChevronRight size={13} />
          </button>
          <button onClick={handleStopCalling}
            className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-800 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">
            <PhoneOff size={13} /> Stop
          </button>
        </div>
      )}

      {/* ── Sales Calling / Follow Up Mode Banner ── */}
      {salesCallingMode && (
        <div className="mb-3 px-4 py-2.5 rounded-xl flex items-center gap-3"
          style={salesCallingType === 'followup'
            ? { background: '#ede9fe', border: '1px solid #c4b5fd' }
            : { background: '#dcfce7', border: '1px solid #86efac' }}>
          <div className={`w-2 h-2 rounded-full animate-pulse flex-shrink-0 ${salesCallingType === 'followup' ? 'bg-purple-500' : 'bg-green-500'}`} />
          <div className="flex-1">
            <span className={`text-sm font-semibold ${salesCallingType === 'followup' ? 'text-purple-800' : 'text-green-800'}`}>
              {salesCallingType === 'followup' ? '📈 Follow Up Mode' : '📞 Sales Calling Mode'}
            </span>
            <span className={`text-xs ml-2 ${salesCallingType === 'followup' ? 'text-purple-700' : 'text-green-700'}`}>
              Lead {salesCurrentPos} of {salesTotalInQueue} — outcome save ke baad next lead khulegi
            </span>
          </div>
          <button onClick={goToNextSalesLead}
            className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 px-2 py-1 rounded-lg hover:bg-white/50 transition-colors">
            Skip <ChevronRight size={13} />
          </button>
          <button onClick={handleStopSalesCalling}
            className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-800 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">
            <PhoneOff size={13} /> Stop
          </button>
        </div>
      )}

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
                lead.sales_outcome ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border"
                    style={{ background: outcomeStyle.bg, color: outcomeStyle.text, borderColor: outcomeStyle.border }}>
                    {currentOutcome?.label || lead.sales_outcome}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200">
                    Update pending from sales
                  </span>
                )
              )}

            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {formatPhone(lead.phone)} · {lead.city ?? '—'} · Added {lead.created_at ? format(new Date(lead.created_at), 'd MMM yyyy') : '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-navy-900 text-white flex-shrink-0">
          <Clock size={13} className="text-blue-300" />
          <span className="font-mono text-sm font-medium">{mins}:{secs}</span>
        </div>
      </div>

      <div className="card mb-4 flex flex-wrap items-center gap-2">
        <a href={callLink(lead.phone)} className="btn"><Phone size={13} /> Call</a>
        <a href={waLink(lead.phone)} target="_blank" rel="noopener" className="btn"><MessageCircle size={13} /> WhatsApp</a>
        <a href={`https://maps.google.com/?q=${encodeURIComponent((lead.address ?? lead.city) ?? '')}`}
          target="_blank" rel="noopener" className="btn"><MapPin size={13} /> Map</a>

        <div className="h-5 w-px bg-slate-200 mx-1" />

        {!isSalesAgent && (
          <button onClick={() => setShowEdit(true)} className="btn-primary">
            <Edit3 size={13} /> Edit lead
          </button>
        )}

        {/* Disposition button — presales ke liye */}
        {isPresales && (
          <button onClick={() => setShowDisp(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium cursor-pointer transition-colors"
            style={{ background: '#fef9c3', borderColor: '#fcd34d', color: '#713f12' }}>
            <Phone size={13} />
            {lead.disposition ? 'Update Disposition' : 'Add Disposition'}
          </button>
        )}

        {(isSales || isSuperAdmin) && lead.stage === 'meeting_scheduled' && (
          <button onClick={() => setShowSalesOutcome(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium cursor-pointer transition-colors"
            style={{ background: '#dbeafe', borderColor: '#93c5fd', color: '#1e3a8a' }}>
            <ClipboardList size={13} />
            {lead.sales_outcome ? 'Update Outcome' : 'Add Sales Outcome'}
          </button>
        )}

        {canMoveStage && nextStages.length > 0 && (
          <div className="relative">
            <button onClick={() => setShowStage(s => !s)} className="btn">
              <ArrowRight size={13} /> Move stage <ChevronDown size={12} />
            </button>
            {showStage && (
              <div className="absolute right-0 top-9 z-30 bg-white rounded-xl border border-slate-200 shadow-lg py-1 min-w-[200px]">
                {nextStages.map(s => (
                  <button key={s} onClick={() => handleMoveStage(s)}
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
            Select "Meeting Fixed" to schedule & move to Sales
          </span>
        )}

        <button onClick={() => setShowHistory(s => !s)} className="btn ml-auto">
          <History size={13} /> {showHistory ? 'Hide' : 'Activity'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Col 1 */}
        <div className="flex flex-col gap-4">
          <div className="card">
            <h3 className="mb-3">Contact details</h3>
            <InfoRow label="Phone" value={formatPhone(lead.phone)} />
            <InfoRow label="Alternate" value={lead.alternate_phone ? formatPhone(lead.alternate_phone) : null} />
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
            <h3 className="mb-3">Property & electricity</h3>
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

        {/* Col 2 */}
        <div className="flex flex-col gap-4">
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3>Call details</h3>
              {lead.updated_at && (
                <span className="text-xs text-slate-400">
                  Updated {format(new Date(lead.updated_at), 'd MMM · h:mm a')}
                </span>
              )}
            </div>
            <InfoRow label="Assigned to" value={lead.assigned_user?.name} />
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

        {/* Col 3 */}
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
                      <span className={`text-xs font-medium ${p.status === 'paid' ? 'text-green-600' :
                        p.status === 'overdue' ? 'text-red-500' : 'text-amber-500'
                        }`}>{p.status}</span>
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

          <div className={`card border-l-4 ${lead.sales_lead_status === 'won' ? 'border-l-green-400' :
            lead.sales_lead_status === 'lost' ? 'border-l-red-400' :
              lead.sales_lead_status === 'follow_up' ? 'border-l-blue-400' :
                'border-l-slate-200'
            }`}>
            <div className="flex items-center justify-between mb-3">
              <h3>Sales outcome</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Sales team</span>
                {(isSales || isSuperAdmin) && lead.stage === 'meeting_scheduled' && (
                  <button onClick={() => setShowSalesOutcome(true)}
                    className="text-xs text-blue-500 hover:underline">
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
                {lead.sales_meeting_via && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500">Meeting via:</span>
                    <span className="text-xs text-slate-700">{lead.sales_meeting_via === 'on_call' ? '📞 On Call' : '🏠 Physical Visit'}</span>
                  </div>
                )}
                {lead.sales_lead_status && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500">Lead status:</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${getLeadStatusStyle(lead.sales_lead_status)}`}>
                      {lead.sales_lead_status.replace('_', ' ')}
                    </span>
                  </div>
                )}
                {lead.sales_not_interested_reason && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500">Reason:</span>
                    <span className="text-xs text-red-600 capitalize">{lead.sales_not_interested_reason.replace('_', ' ')}</span>
                  </div>
                )}
                {lead.sales_callback_date && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500">Sales callback:</span>
                    <span className="text-xs text-blue-600">{lead.sales_callback_date} · {lead.sales_callback_slot}</span>
                  </div>
                )}
                {lead.sales_followup_date && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500">Follow up:</span>
                    <span className="text-xs text-blue-600">{lead.sales_followup_date} · {lead.sales_followup_slot}</span>
                  </div>
                )}
                {lead.sales_quoted_amount && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500">Quoted:</span>
                    <span className="text-xs font-semibold text-green-700">₹{Number(lead.sales_quoted_amount).toLocaleString('en-IN')}</span>
                  </div>
                )}
                {lead.sales_remarks && (
                  <div className="mt-1">
                    <span className="text-xs font-medium text-slate-500">Remarks:</span>
                    <p className="text-xs text-slate-600 mt-0.5">{lead.sales_remarks}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                {(isSales || isSuperAdmin)
                  ? 'No outcome added yet — click "Add" to update'
                  : 'Not updated by sales team yet'}
              </p>
            )}
          </div>

          {showHistory && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <History size={14} className="text-slate-500" />
                <h3>Activity timeline</h3>
              </div>
              {history.length === 0 ? (
                <p className="text-xs text-slate-400">No activity yet</p>
              ) : (
                <div>
                  {history.map((h, i) => (
                    <div key={h.id} className="flex gap-3 pb-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${h.action?.includes('Stage') ? 'bg-blue-500' :
                          h.action?.includes('Meeting') ? 'bg-green-500' :
                            h.action?.includes('Callback') ? 'bg-amber-500' :
                              h.action?.includes('Sales') ? 'bg-purple-500' :
                                h.action?.includes('Assignment') ? 'bg-orange-500' : 'bg-slate-300'
                          }`} />
                        {i < history.length - 1 && <div className="w-px flex-1 bg-slate-100 mt-1" />}
                      </div>
                      <div className="flex-1 min-w-0 pb-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-medium text-slate-700">{h.action}</span>
                          {h.updated_by && <span className="text-xs text-slate-400">· {h.updated_by}</span>}
                        </div>
                        {h.old_value && h.new_value && (
                          <div className="text-xs text-slate-500 mt-0.5">
                            <span className="line-through text-red-400">{h.old_value}</span>
                            {' → '}
                            <span className="text-green-600 font-medium">{h.new_value}</span>
                          </div>
                        )}
                        <div className="text-xs text-slate-400 mt-0.5">
                          {h.updated_at ? format(new Date(h.updated_at), 'd MMM yy · h:mm a') : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <EditLeadModal
        open={showEdit}
        lead={lead}
        onClose={() => setShowEdit(false)}
        onSaved={(updated) => { setLead(prev => ({ ...prev, ...updated })); setShowEdit(false) }}
        userId={profile?.id}
        userName={profile?.name}
      />

      <DispositionModal
        open={showDisp}
        onClose={() => setShowDisp(false)}
        onSave={saveDisposition}
        saving={saving}
        currentDisp={lead.disposition}
      />

      {showSalesOutcome && (
        <SalesOutcomeModal
          lead={lead}
          onClose={() => setShowSalesOutcome(false)}
          onSaved={async (updates) => {
            setLead(prev => ({ ...prev, ...updates }))
            setShowSalesOutcome(false)
            // Sales calling mode mein hai toh next lead pe jao
            if (salesCallingMode) {
              await goToNextSalesLead()
            }
          }}
          userId={profile?.id}
          userName={profile?.name}
        />
      )}
    </Layout>
  )
}

// ── Sales Outcome Modal ───────────────────────────────────────
function SalesOutcomeModal({ lead, onClose, onSaved, userId, userName }) {
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
      updates.stage = 'sale_closed'
      updates.sale_closed_at = new Date().toISOString()
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
                className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${meetingVia === v.value ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}>{v.label}</button>
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
                className={`text-left px-3 py-2 rounded-lg text-xs border font-medium transition-all ${notInterestedReason === r.value ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-700 border-red-200 hover:bg-red-50'
                  }`}>{r.label}</button>
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
        <div className="mb-4 px-3 py-2 rounded-lg bg-green-50 border border-green-200">
          <p className="text-xs text-green-700 font-medium">🎉 Order Closed save karne pe lead automatically "Sale Closed" stage mein move ho jaayega!</p>
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

// ── Referral Fields ───────────────────────────────────────────
function ReferralFields({ form, set }) {
  const showNameId = form.referral_type === 'Existing Customer' || form.referral_type === 'SolarPro'
  const showNameOnly = form.referral_type === 'Employee' || form.referral_type === 'Others'
  return (
    <div className="col-span-2 rounded-xl border border-purple-200 bg-purple-50 p-3">
      <p className="text-xs font-semibold text-purple-800 mb-3">🔗 Referral details</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Referred by</label>
          <select className="select" value={form.referral_type ?? ''} onChange={e => {
            set('referral_type', e.target.value); set('referral_name', ''); set('referral_id', '')
          }}>
            <option value="">Select type</option>
            {['Existing Customer', 'Employee', 'SolarPro', 'Others'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {showNameId && (<>
          <div>
            <label className="label">
              {form.referral_type === 'Existing Customer' ? 'Customer name' : 'Partner name'}
              <span className="text-red-500 ml-0.5">*</span>
            </label>
            <input className="input" placeholder="Full name" value={form.referral_name ?? ''} onChange={e => set('referral_name', e.target.value)} />
          </div>
          <div>
            <label className="label">{form.referral_type === 'Existing Customer' ? 'Customer ID' : 'Partner ID'}</label>
            <input className="input" placeholder="ID / Account number" value={form.referral_id ?? ''} onChange={e => set('referral_id', e.target.value)} />
          </div>
        </>)}
        {showNameOnly && (
          <div>
            <label className="label">Name</label>
            <input className="input" placeholder="Referrer ka naam" value={form.referral_name ?? ''} onChange={e => set('referral_name', e.target.value)} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Disposition Modal ─────────────────────────────────────────
function DispositionModal({ open, onClose, onSave, saving, currentDisp }) {
  const [tab, setTab] = useState('not_connected')
  const [disp, setDisp] = useState(currentDisp ?? '')
  const [date, setDate] = useState('')
  const [slot, setSlot] = useState('')
  const [cbDate, setCbDate] = useState('')
  const [cbSlot, setCbSlot] = useState('')

  const showMeetingFields = isMeetingDisposition(disp)
  const showCallbackFields = isCallbackDisposition(disp)
  const saveDisabled = !disp || saving || (showMeetingFields && (!date || !slot))

  function handleSave() {
    onSave(
      disp,
      tab === 'connected' ? 'Connected' : 'Not Connected',
      showMeetingFields ? date : showCallbackFields ? cbDate : null,
      showMeetingFields ? slot : showCallbackFields ? cbSlot : null,
      showMeetingFields ? 'meeting' : showCallbackFields ? 'callback' : null
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Update disposition" width={520}>
      <div className="flex rounded-lg border border-slate-200 overflow-hidden mb-4">
        {['not_connected', 'connected'].map(t => (
          <button key={t} onClick={() => { setTab(t); setDisp('') }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === t ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
              }`}>
            {t === 'not_connected' ? '📵 Not connected' : '✅ Connected'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {(tab === 'not_connected' ? NOT_CONNECTED_DISPOSITIONS : CONNECTED_DISPOSITIONS).map(d => {
          const style = getDispositionStyle(d)
          return (
            <button key={d} onClick={() => setDisp(d)}
              className="text-left px-3 py-2 rounded-lg text-xs border font-medium transition-all"
              style={disp === d
                ? { background: '#1d4ed8', color: '#fff', borderColor: '#1d4ed8' }
                : { background: style.bg, color: style.text, borderColor: style.border }}>
              {d}
            </button>
          )
        })}
      </div>
      {showMeetingFields && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 mb-4">
          <p className="text-xs font-semibold text-green-800 mb-3">Schedule meeting — lead auto-moves to Sales</p>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Meeting date *</label>
              <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} min={new Date().toISOString().split('T')[0]} /></div>
            <div><label className="label">Meeting slot *</label>
              <select className="select" value={slot} onChange={e => setSlot(e.target.value)}>
                <option value="">Select slot</option>
                {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select></div>
          </div>
          {date && slot && <p className="text-xs text-green-700 mt-2 font-medium">✓ Meeting on {date} · {slot}</p>}
        </div>
      )}
      {showCallbackFields && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 mb-4">
          <p className="text-xs font-semibold text-blue-800 mb-3">Schedule callback (optional)</p>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Callback date</label>
              <input type="date" className="input" value={cbDate} onChange={e => setCbDate(e.target.value)} min={new Date().toISOString().split('T')[0]} /></div>
            <div><label className="label">Callback slot</label>
              <select className="select" value={cbSlot} onChange={e => setCbSlot(e.target.value)}>
                <option value="">Select slot</option>
                {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select></div>
          </div>
        </div>
      )}
      <button onClick={handleSave} disabled={saveDisabled} className="btn-primary w-full justify-center py-2.5 disabled:opacity-50">
        {saving ? 'Saving...' : showMeetingFields ? 'Schedule meeting & move to Sales' : 'Save disposition'}
      </button>
    </Modal>
  )
}

// ── Next stages ───────────────────────────────────────────────
function getNextStages(currentStage, role, isSuperAdmin) {
  const order = [
    'new', 'meeting_scheduled', 'meeting_done', 'qc_followup',
    'sale_closed', 'finance_approval', 'ops_documents',
    'name_load_change', 'net_metering', 'installation', 'installed', 'amc_active'
  ]
  const closed = ['not_interested', 'non_qualified', 'lost']
  if (isSuperAdmin) return [...order.filter(s => s !== currentStage), ...closed]
  const idx = order.indexOf(currentStage)
  const next = order[idx + 1]
  return next ? [next, ...closed] : closed
}

// ── Edit Lead Modal ───────────────────────────────────────────
function EditLeadModal({ open, lead, onClose, onSaved, userId, userName }) {
  const { isSuperAdmin } = useAuth()
  const [form, setForm] = useState({})
  const [agents, setAgents] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && lead) {
      setForm({
        name: lead.name ?? '',
        phone: lead.phone ?? '',
        alternate_phone: lead.alternate_phone ?? '',
        email: lead.email ?? '',
        city: lead.city ?? '',
        pincode: lead.pincode ?? '',
        address: lead.address ?? '',
        lead_source: lead.lead_source ?? '',
        calling_date: lead.calling_date ?? '',
        property_type: lead.property_type ?? '',
        ownership: lead.ownership ?? '',
        roof_type: lead.roof_type ?? '',
        roof_area: lead.roof_area ?? '',
        electricity_board: lead.electricity_board ?? '',
        sanctioned_load: lead.sanctioned_load ?? '',
        monthly_bill: lead.monthly_bill ?? '',
        units_per_month: lead.units_per_month ?? '',
        system_size_kw: lead.system_size_kw ?? '',
        system_type: lead.system_type ?? '',
        referral_type: lead.referral_type ?? '',
        referral_name: lead.referral_name ?? '',
        referral_id: lead.referral_id ?? '',
        call_status: lead.call_status ?? '',
        disposition: lead.disposition ?? '',
        meeting_date: lead.meeting_date ?? '',
        meeting_slot: lead.meeting_slot ?? '',
        callback_date: lead.callback_date ?? '',
        callback_slot: lead.callback_slot ?? '',
        quoted_amount: lead.quoted_amount ?? '',
        remarks: lead.remarks ?? '',
        assigned_to: lead.assigned_to ?? '',
        presales_agent_id: lead.presales_agent_id ?? '',
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

  async function handleSave() {
    if (!form.phone) { setError('Phone is required'); return }
    setSaving(true); setError('')
    try {
      const NUMERIC = ['roof_area', 'sanctioned_load', 'monthly_bill', 'units_per_month', 'system_size_kw', 'quoted_amount']
      const payload = { ...form }
      NUMERIC.forEach(f => { payload[f] = payload[f] !== '' && payload[f] != null ? Number(payload[f]) : null })
      Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null })
      // PS Agent clear hone pe assigned_to bhi clear karo
      if (!payload.presales_agent_id) payload.assigned_to = null

      if (isMeetingDisposition(form.disposition) && form.meeting_date && form.meeting_slot) {
        payload.stage = 'meeting_scheduled'
      }
      const updated = await updateLead(lead.id, payload)
      if (payload.stage === 'meeting_scheduled' && !lead.sales_agent_id) {
        await assignToSales(lead.id)
      }
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

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 pb-1 border-b border-slate-100">Contact details</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Full name</label><input className="input" value={form.name ?? ''} onChange={e => set('name', e.target.value)} /></div>
            <div><label className="label">Phone <span className="text-red-500">*</span></label><input className="input" value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} /></div>
            <div><label className="label">Alternate phone</label><input className="input" value={form.alternate_phone ?? ''} onChange={e => set('alternate_phone', e.target.value)} /></div>
            <div><label className="label">Email</label><input className="input" type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)} /></div>
            <div><label className="label">City</label><input className="input" value={form.city ?? ''} onChange={e => set('city', e.target.value)} /></div>
            <div><label className="label">Pincode</label><input className="input" value={form.pincode ?? ''} onChange={e => set('pincode', e.target.value)} /></div>
            <div>
              <label className="label">Lead source</label>
              <select className="select" value={form.lead_source ?? ''} onChange={e => {
                set('lead_source', e.target.value)
                if (e.target.value !== 'Referral') { set('referral_type', ''); set('referral_name', ''); set('referral_id', '') }
              }}>
                <option value="">Select source</option>
                {['Facebook Ad', 'Google Ad', 'Instagram', 'YouTube', 'Referral', 'Walk-in', 'Website', 'IVR', 'Other'].map(s =>
                  <option key={s} value={s}>{s}</option>
                )}
              </select>
            </div>
            <div>
              <label className="label">Calling date
                {!form.calling_date && (
                  <button type="button" onClick={() => set('calling_date', new Date().toISOString().split('T')[0])}
                    className="ml-2 text-blue-500 text-xs underline">Set today</button>
                )}
              </label>
              <input type="date" className="input" value={form.calling_date ?? ''} onChange={e => set('calling_date', e.target.value)} />
            </div>
            <div className="col-span-2"><label className="label">Address</label><input className="input" value={form.address ?? ''} onChange={e => set('address', e.target.value)} /></div>
            {form.lead_source === 'Referral' && <ReferralFields form={form} set={set} />}
          </div>
        </div>

        {isSuperAdmin && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 pb-1 border-b border-slate-100">Assignment</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Presales agent</label>
                <select className="select" value={form.presales_agent_id ?? ''}
                  onChange={e => { set('presales_agent_id', e.target.value); if (e.target.value) set('assigned_to', e.target.value) }}>
                  <option value="">— Unassigned —</option>
                  {agents.filter(a => a.role === 'presales_agent').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Sales agent</label>
                <select className="select" value={form.sales_agent_id ?? ''} onChange={e => set('sales_agent_id', e.target.value)}>
                  <option value="">— Unassigned —</option>
                  {agents.filter(a => a.role === 'sales_agent').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 pb-1 border-b border-slate-100">Property & electricity</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Property type</label>
              <select className="select" value={form.property_type ?? ''} onChange={e => set('property_type', e.target.value)}>
                <option value="">Select</option>{['Residential', 'Commercial', 'Industrial', 'Agricultural'].map(s => <option key={s}>{s}</option>)}</select></div>
            <div><label className="label">Ownership</label>
              <select className="select" value={form.ownership ?? ''} onChange={e => set('ownership', e.target.value)}>
                <option value="">Select</option>{['Owned', 'Rented', 'Family Owned'].map(s => <option key={s}>{s}</option>)}</select></div>
            <div><label className="label">Roof type</label>
              <select className="select" value={form.roof_type ?? ''} onChange={e => set('roof_type', e.target.value)}>
                <option value="">Select</option>{['RCC / Concrete', 'Tin / Metal Sheet', 'Asbestos', 'Mangalore Tile', 'Other'].map(s => <option key={s}>{s}</option>)}</select></div>
            <div><label className="label">Roof area (sq ft)</label><input className="input" type="number" value={form.roof_area ?? ''} onChange={e => set('roof_area', e.target.value)} /></div>
            <div><label className="label">Electricity board</label><input className="input" value={form.electricity_board ?? ''} onChange={e => set('electricity_board', e.target.value)} /></div>
            <div><label className="label">Sanctioned load (kW)</label><input className="input" type="number" value={form.sanctioned_load ?? ''} onChange={e => set('sanctioned_load', e.target.value)} /></div>
            <div><label className="label">Monthly bill (₹)</label><input className="input" type="number" value={form.monthly_bill ?? ''} onChange={e => set('monthly_bill', e.target.value)} /></div>
            <div><label className="label">Units per month (kWh)</label><input className="input" type="number" value={form.units_per_month ?? ''} onChange={e => set('units_per_month', e.target.value)} /></div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 pb-1 border-b border-slate-100">Call status & disposition</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Call status</label>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                {['Not Connected', 'Connected'].map(s => (
                  <button key={s} type="button" onClick={() => { set('call_status', s); set('disposition', '') }}
                    className={`flex-1 py-2 text-xs font-medium transition-colors ${form.call_status === s ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                    {s === 'Not Connected' ? '📵 Not connected' : '✅ Connected'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Disposition</label>
              <select className="select" value={form.disposition ?? ''} onChange={e => set('disposition', e.target.value)}>
                <option value="">Select disposition</option>
                {(form.call_status === 'Connected' ? CONNECTED_DISPOSITIONS : NOT_CONNECTED_DISPOSITIONS).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            {isMeetingDisposition(form.disposition) && (<>
              <div><label className="label">Meeting date</label>
                <input type="date" className="input" value={form.meeting_date ?? ''} onChange={e => set('meeting_date', e.target.value)} min={new Date().toISOString().split('T')[0]} /></div>
              <div><label className="label">Meeting slot</label>
                <select className="select" value={form.meeting_slot ?? ''} onChange={e => set('meeting_slot', e.target.value)}>
                  <option value="">Select slot</option>{TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select></div>
            </>)}
            {isCallbackDisposition(form.disposition) && (<>
              <div><label className="label">Callback date</label>
                <input type="date" className="input" value={form.callback_date ?? ''} onChange={e => set('callback_date', e.target.value)} min={new Date().toISOString().split('T')[0]} /></div>
              <div><label className="label">Callback slot</label>
                <select className="select" value={form.callback_slot ?? ''} onChange={e => set('callback_slot', e.target.value)}>
                  <option value="">Select slot</option>{TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select></div>
            </>)}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 pb-1 border-b border-slate-100">Solar & remarks</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">System size (kW)</label><input className="input" type="number" value={form.system_size_kw ?? ''} onChange={e => set('system_size_kw', e.target.value)} /></div>
            <div><label className="label">System type</label>
              <select className="select" value={form.system_type ?? ''} onChange={e => set('system_type', e.target.value)}>
                <option value="">Select</option>{['On-grid', 'Off-grid', 'Hybrid'].map(s => <option key={s}>{s}</option>)}
              </select></div>
            <div><label className="label">Quoted amount (₹)</label><input className="input" type="number" value={form.quoted_amount ?? ''} onChange={e => set('quoted_amount', e.target.value)} /></div>
            <div className="col-span-2"><label className="label">Remarks</label>
              <textarea className="input resize-none" rows={3} value={form.remarks ?? ''} onChange={e => set('remarks', e.target.value)} /></div>
          </div>
        </div>

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