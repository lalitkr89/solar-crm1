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
import { assignToSales } from '@/lib/assignment'
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
  ChevronDown, History, IndianRupee, Edit3
} from 'lucide-react'

export default function LeadProfilePage() {
  const { id }  = useParams()
  const { profile, role, isSuperAdmin, isManager } = useAuth()
  const navigate = useNavigate()

  const [lead,        setLead]        = useState(null)
  const [history,     setHistory]     = useState([])
  const [payments,    setPayments]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [showDisp,    setShowDisp]    = useState(false)
  const [showStage,   setShowStage]   = useState(false)
  const [showEdit,    setShowEdit]    = useState(false)
  const [saving,      setSaving]      = useState(false)

  // Timer
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

  // Pre-sales: when "Meeting Fixed" is saved, auto-move to meeting_scheduled
  async function saveDisposition(disp, callStatus, date, slot, scheduleType) {
    setSaving(true)
    const old = lead.disposition

    const updates = { disposition: disp, call_status: callStatus }

    // Meeting Scheduled — save meeting date/slot + auto move stage to sales
    if (scheduleType === 'meeting' && date && slot) {
      updates.meeting_date = date
      updates.meeting_slot = slot
      updates.stage        = 'meeting_scheduled'
    }

    // Call Later / Meet Later — save callback date/slot only
    if (scheduleType === 'callback' && date && slot) {
      updates.callback_date = date
      updates.callback_slot = slot
    }

    await updateLead(id, updates)

    // Auto assign to sales agent when meeting scheduled
    if (updates.stage === 'meeting_scheduled') {
      await assignToSales(id)
    }

    await logCall({
      leadId: id, callerId: profile.id,
      callStatus, disposition: disp,
    })

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
  }

  async function saveSchedule(type, date, slot) {
    setSaving(true)
    const field = type === 'callback' ? 'callback' : 'meeting'
    await updateLead(id, { [`${field}_date`]: date, [`${field}_slot`]: slot })
    await logActivity({
      leadId: id,
      action: type === 'callback' ? 'Callback scheduled' : 'Meeting scheduled',
      field: `${field}_date`, oldVal: null, newVal: date,
      userId: profile.id, userName: profile.name,
    })
    await load()
    setSaving(false)
  }

  async function handleMoveStage(newStage) {
    setSaving(true)
    await moveStage(lead, newStage, profile.id, profile.name)
    setLead(prev => ({ ...prev, stage: newStage }))
    setShowStage(false)
    setSaving(false)
  }

  if (loading) return <Layout><div className="flex justify-center py-20"><Spinner size={24} /></div></Layout>
  if (!lead)   return <Layout><p className="text-slate-500 p-4">Lead not found</p></Layout>

  // Pre-sales can NEVER manually move stage — it happens auto on Meeting Fixed
  const isPresales   = role === 'presales_agent' || role === 'presales_manager'
  const isSales      = role === 'sales_agent' || role === 'sales_manager'
  const canMoveStage = isSuperAdmin || (isManager && !isPresales)
  const nextStages   = getNextStages(lead.stage, role, isSuperAdmin)

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn px-2 py-1.5 text-slate-500">←</button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1>{lead.name ?? '—'}</h1>
              <StageBadge stage={lead.stage} />
              {lead.disposition && <DispBadge value={lead.disposition} />}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {formatPhone(lead.phone)} · {lead.city ?? '—'} · Added {lead.created_at ? format(new Date(lead.created_at), 'd MMM yyyy') : '—'}
            </p>
          </div>
        </div>
        {/* Timer */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-navy-900 text-white flex-shrink-0">
          <Clock size={13} className="text-blue-300" />
          <span className="font-mono text-sm font-medium">{mins}:{secs}</span>
        </div>
      </div>

      {/* Action bar */}
      <div className="card mb-4 flex flex-wrap items-center gap-2">
        <a href={callLink(lead.phone)} className="btn">
          <Phone size={13} /> Call
        </a>
        <a href={waLink(lead.phone)} target="_blank" rel="noopener" className="btn">
          <MessageCircle size={13} /> WhatsApp
        </a>
        <a
          href={`https://maps.google.com/?q=${encodeURIComponent((lead.address ?? lead.city) ?? '')}`}
          target="_blank" rel="noopener" className="btn"
        >
          <MapPin size={13} /> Map
        </a>

        <div className="h-5 w-px bg-slate-200 mx-1" />

        <button onClick={() => setShowEdit(true)} className="btn-primary">
          <Edit3 size={13} /> Edit lead
        </button>

        {/* Stage move — only for managers/admin, not presales */}
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

        {/* Pre-sales info pill — so they know what happens */}
        {isPresales && (
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
            <InfoRow label="Phone"        value={formatPhone(lead.phone)} />
            <InfoRow label="Alternate"    value={lead.alternate_phone ? formatPhone(lead.alternate_phone) : null} />
            <InfoRow label="Email"        value={lead.email} />
            <InfoRow label="City"         value={lead.city} />
            <InfoRow label="Pincode"      value={lead.pincode} />
            <InfoRow label="Address"      value={lead.address} />
            <InfoRow label="Lead source"  value={lead.lead_source} />
            <InfoRow label="Referral"     value={lead.referral_name} />
          </div>
          <div className="card">
            <h3 className="mb-3">Property & electricity</h3>
            <InfoRow label="Property type"  value={lead.property_type} />
            <InfoRow label="Ownership"      value={lead.ownership} />
            <InfoRow label="Roof type"      value={lead.roof_type} />
            <InfoRow label="Roof area"      value={lead.roof_area ? `${lead.roof_area} sq ft` : null} />
            <InfoRow label="Load"           value={lead.sanctioned_load ? `${lead.sanctioned_load} kW` : null} />
            <InfoRow label="Monthly bill"   value={lead.monthly_bill ? `₹${lead.monthly_bill}` : null} />
            <InfoRow label="Units/month"    value={lead.units_per_month ? `${lead.units_per_month} kWh` : null} />
            <InfoRow label="Elec board"     value={lead.electricity_board} />
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
            <InfoRow label="Assigned to"   value={lead.assigned_user?.name} />
            <InfoRow label="Calling date"  value={lead.calling_date} />
            <InfoRow label="Callback date" value={lead.callback_date} />
            <InfoRow label="Callback slot" value={lead.callback_slot} />
            <InfoRow label="Meeting date"  value={lead.meeting_date} />
            <InfoRow label="Meeting slot"  value={lead.meeting_slot} />
          </div>
          {/* Last update info */}
          {history.length > 0 && (
            <div className="card-sm bg-slate-50 border-slate-100">
              <div className="text-xs text-slate-500 mb-1 font-medium">Last activity</div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-slate-700">{history[0].action}</div>
                  {history[0].old_value && history[0].new_value && (
                    <div className="text-xs text-slate-500 mt-0.5">
                      <span className="line-through text-red-400">{history[0].old_value?.slice(0,30)}</span>
                      {' → '}
                      <span className="text-green-600 font-medium">{history[0].new_value?.slice(0,30)}</span>
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs font-medium text-slate-600">{history[0].updated_by}</div>
                  <div className="text-xs text-slate-400">
                    {history[0].updated_at ? format(new Date(history[0].updated_at), 'd MMM · h:mm a') : ''}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <h3 className="mb-3">Solar quote</h3>
            <InfoRow label="System size"   value={lead.system_size_kw ? `${lead.system_size_kw} kW` : null} />
            <InfoRow label="System type"   value={lead.system_type} />
            <InfoRow label="Quoted amount" value={lead.quoted_amount ? `₹${Number(lead.quoted_amount).toLocaleString('en-IN')}` : null} />
          </div>
          <ScheduleCard onSave={saveSchedule} saving={saving} />
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
                      <span className={`text-xs font-medium ${
                        p.status === 'paid'    ? 'text-green-600' :
                        p.status === 'overdue' ? 'text-red-500'   : 'text-amber-500'
                      }`}>{p.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {lead.remarks && (
            <div className="card">
              <h3 className="mb-2">Remarks</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{lead.remarks}</p>
            </div>
          )}

          {/* Meeting outcome — sales fills, presales reads */}
          {(lead.meeting_outcome || lead.sales_remarks || isSales || isSuperAdmin) && (
            <div className={`card border-l-4 ${lead.meeting_outcome ? 'border-l-blue-400' : 'border-l-slate-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <h3>Meeting outcome</h3>
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Sales team</span>
              </div>
              {(isSales || isSuperAdmin) ? (
                <SalesMeetingOutcome
                  lead={lead}
                  onSaved={(updates) => setLead(prev => ({ ...prev, ...updates }))}
                  userId={profile?.id}
                  userName={profile?.name}
                />
              ) : (
                <>
                  <InfoRow label="Outcome"       value={lead.meeting_outcome} />
                  <InfoRow label="Sales remarks" value={lead.sales_remarks} />
                  {!lead.meeting_outcome && (
                    <p className="text-xs text-slate-400 italic">Not updated by sales team yet</p>
                  )}
                </>
              )}
            </div>
          )}

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
                        <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${
                          h.action?.includes('Stage')    ? 'bg-blue-500'  :
                          h.action?.includes('Meeting')  ? 'bg-green-500' :
                          h.action?.includes('Callback') ? 'bg-amber-500' : 'bg-slate-300'
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
        isPresales={isPresales}
      />
    </Layout>
  )
}

// ── Disposition Modal — exact Streamlit behaviour ────────────
function DispositionModal({ open, onClose, onSave, saving, currentDisp, isPresales }) {
  const [tab,    setTab]    = useState('not_connected')
  const [disp,   setDisp]   = useState(currentDisp ?? '')
  const [date,   setDate]   = useState('')
  const [slot,   setSlot]   = useState('')
  const [cbDate, setCbDate] = useState('')
  const [cbSlot, setCbSlot] = useState('')

  const showMeetingFields   = isMeetingDisposition(disp)
  const showCallbackFields  = isCallbackDisposition(disp)

  // Disable save if Meeting picked but no date/slot filled
  const saveDisabled = !disp || saving ||
    (showMeetingFields && (!date || !slot))

  function handleSave() {
    onSave(
      disp,
      tab === 'connected' ? 'Connected' : 'Not Connected',
      showMeetingFields  ? date   : showCallbackFields ? cbDate : null,
      showMeetingFields  ? slot   : showCallbackFields ? cbSlot : null,
      showMeetingFields  ? 'meeting' : showCallbackFields ? 'callback' : null
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Update disposition" width={520}>

      {/* Connected / Not Connected — same as Streamlit two-section layout */}
      <div className="flex rounded-lg border border-slate-200 overflow-hidden mb-4">
        {['not_connected', 'connected'].map(t => (
          <button key={t} onClick={() => { setTab(t); setDisp('') }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              tab === t ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
            }`}>
            {t === 'not_connected' ? '📵 Not connected' : '✅ Connected'}
          </button>
        ))}
      </div>

      {/* Disposition list */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {(tab === 'not_connected' ? NOT_CONNECTED_DISPOSITIONS : CONNECTED_DISPOSITIONS).map(d => {
          const style = getDispositionStyle(d)
          const isSelected = disp === d
          return (
            <button key={d} onClick={() => setDisp(d)}
              className="text-left px-3 py-2 rounded-lg text-xs border font-medium transition-all"
              style={isSelected ? {
                background: '#1d4ed8', color: '#fff', borderColor: '#1d4ed8'
              } : {
                background: style.bg, color: style.text, borderColor: style.border
              }}>
              {d}
            </button>
          )
        })}
      </div>

      {/* Meeting scheduling — only for Meeting Scheduled (BD) */}
      {showMeetingFields && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 mb-4">
          <p className="text-xs font-semibold text-green-800 mb-3">
            Schedule meeting — lead auto-moves to Sales after saving
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Meeting date *</label>
              <input type="date" className="input" value={date}
                onChange={e => setDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]} />
            </div>
            <div>
              <label className="label">Meeting slot *</label>
              <select className="select" value={slot} onChange={e => setSlot(e.target.value)}>
                <option value="">Select slot</option>
                {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          {date && slot && (
            <p className="text-xs text-green-700 mt-2 font-medium">
              ✓ Meeting on {date} · {slot}
            </p>
          )}
        </div>
      )}

      {/* Callback scheduling — for Call Later / Meet Later */}
      {showCallbackFields && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 mb-4">
          <p className="text-xs font-semibold text-blue-800 mb-3">
            Schedule callback (optional)
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Callback date</label>
              <input type="date" className="input" value={cbDate}
                onChange={e => setCbDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]} />
            </div>
            <div>
              <label className="label">Callback slot</label>
              <select className="select" value={cbSlot} onChange={e => setCbSlot(e.target.value)}>
                <option value="">Select slot</option>
                {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      <button onClick={handleSave} disabled={saveDisabled}
        className="btn-primary w-full justify-center py-2.5 disabled:opacity-50">
        {saving
          ? 'Saving...'
          : showMeetingFields
            ? 'Schedule meeting & move to Sales'
            : 'Save disposition'}
      </button>
    </Modal>
  )
}

// ── Schedule card ─────────────────────────────────────────────
function ScheduleCard({ onSave, saving }) {
  const [type, setType] = useState('callback')
  const [date, setDate] = useState('')
  const [slot, setSlot] = useState('')

  async function handleSave() {
    if (!date || !slot) return
    await onSave(type, date, slot)
    setDate(''); setSlot('')
  }

  return (
    <div className="card">
      <h3 className="mb-3">Quick schedule</h3>
      <div className="flex rounded-lg border border-slate-200 overflow-hidden mb-3">
        {['callback', 'meeting'].map(t => (
          <button key={t} onClick={() => setType(t)}
            className={`flex-1 py-1.5 text-xs font-medium transition-colors capitalize ${
              type === t ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
            }`}>
            {t}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={date}
            onChange={e => setDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]} />
        </div>
        <div>
          <label className="label">Time slot</label>
          <select className="select" value={slot} onChange={e => setSlot(e.target.value)}>
            <option value="">Select slot</option>
            {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button onClick={handleSave} disabled={!date || !slot || saving}
          className="btn-primary justify-center disabled:opacity-50">
          {saving ? 'Saving...' : `Schedule ${type}`}
        </button>
      </div>
    </div>
  )
}

// ── Which stages can this role move to? ───────────────────────
function getNextStages(currentStage, role, isSuperAdmin) {
  const order = [
    'new','meeting_scheduled','meeting_done','qc_followup',
    'sale_closed','finance_approval','ops_documents',
    'name_load_change','net_metering','installation','installed','amc_active'
  ]
  const closed = ['not_interested','non_qualified','lost']

  if (isSuperAdmin) return [...order.filter(s => s !== currentStage), ...closed]

  const idx  = order.indexOf(currentStage)
  const next = order[idx + 1]
  return next ? [next, ...closed] : closed
}

// ── Edit Lead Modal ───────────────────────────────────────────
function EditLeadModal({ open, lead, onClose, onSaved, userId, userName }) {
  const [form,   setForm]   = useState({})
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  // Populate form when modal opens
  useEffect(() => {
    if (open && lead) {
      setForm({
        name:             lead.name             ?? '',
        phone:            lead.phone            ?? '',
        alternate_phone:  lead.alternate_phone  ?? '',
        email:            lead.email            ?? '',
        city:             lead.city             ?? '',
        pincode:          lead.pincode          ?? '',
        address:          lead.address          ?? '',
        lead_source:      lead.lead_source      ?? '',
        property_type:    lead.property_type    ?? '',
        ownership:        lead.ownership        ?? '',
        roof_type:        lead.roof_type        ?? '',
        roof_area:        lead.roof_area        ?? '',
        electricity_board:lead.electricity_board?? '',
        sanctioned_load:  lead.sanctioned_load  ?? '',
        monthly_bill:     lead.monthly_bill     ?? '',
        units_per_month:  lead.units_per_month  ?? '',
        system_size_kw:   lead.system_size_kw   ?? '',
        system_type:      lead.system_type      ?? '',
        quoted_amount:    lead.quoted_amount     ?? '',
        referral_type:    lead.referral_type    ?? '',
        referral_name:    lead.referral_name    ?? '',
        remarks:          lead.remarks          ?? '',
      })
      setError('')
    }
  }, [open, lead])

  function set(field, val) { setForm(f => ({ ...f, [field]: val })) }

  async function handleSave() {
    if (!form.phone) { setError('Phone is required'); return }
    setSaving(true); setError('')
    try {
      const NUMERIC = ['roof_area','sanctioned_load','monthly_bill','units_per_month','system_size_kw','quoted_amount']
      const payload = { ...form }
      NUMERIC.forEach(f => {
        payload[f] = payload[f] !== '' && payload[f] != null ? Number(payload[f]) : null
      })
      Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null })

      // Auto move stage if Meeting Fixed
      if (isMeetingDisposition(form.disposition) && form.meeting_date && form.meeting_slot) {
        payload.stage = 'meeting_scheduled'
      }

      const updated = await updateLead(lead.id, payload)

      // Auto assign to sales agent when meeting scheduled
      if (payload.stage === 'meeting_scheduled') {
        await assignToSales(lead.id)
      }
      await logActivity({
        leadId: lead.id, action: 'Lead details updated',
        field: 'multiple', oldVal: null, newVal: 'Details edited',
        userId, userName,
      })
      onSaved(updated)
    } catch (e) {
      setError(e.message || 'Error saving')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit lead details" width={640}>
      {error && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-5">

        {/* Contact */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 pb-1 border-b border-slate-100">
            Contact details
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Full name</label>
              <input className="input" value={form.name ?? ''} onChange={e => set('name', e.target.value)} />
            </div>
            <div>
              <label className="label">Phone <span className="text-red-500">*</span></label>
              <input className="input" value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} />
            </div>
            <div>
              <label className="label">Alternate phone</label>
              <input className="input" value={form.alternate_phone ?? ''} onChange={e => set('alternate_phone', e.target.value)} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)} />
            </div>
            <div>
              <label className="label">City</label>
              <input className="input" value={form.city ?? ''} onChange={e => set('city', e.target.value)} />
            </div>
            <div>
              <label className="label">Pincode</label>
              <input className="input" value={form.pincode ?? ''} onChange={e => set('pincode', e.target.value)} />
            </div>
            <div>
              <label className="label">
                Calling date
                {!form.calling_date && (
                  <button type="button"
                    onClick={() => set('calling_date', new Date().toISOString().split('T')[0])}
                    className="ml-2 text-blue-500 hover:text-blue-700 text-xs font-normal underline">
                    Set today
                  </button>
                )}
              </label>
              <input type="date" className="input"
                value={form.calling_date ?? ''}
                onChange={e => set('calling_date', e.target.value)} />
            </div>
            <div>
              <label className="label">Lead source</label>
              <select className="select" value={form.lead_source ?? ''} onChange={e => set('lead_source', e.target.value)}>
                <option value="">Select source</option>
                {['Facebook Ad','Google Ad','Instagram','YouTube','Referral','Walk-in','Website','IVR','Other'].map(s =>
                  <option key={s} value={s}>{s}</option>
                )}
              </select>
            </div>
            <div>
              <label className="label">Referral type</label>
              <select className="select" value={form.referral_type ?? ''} onChange={e => set('referral_type', e.target.value)}>
                <option value="">Select</option>
                {['Customer Referral','Dealer','DSA','Agent','Influencer','Other'].map(s =>
                  <option key={s} value={s}>{s}</option>
                )}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Address</label>
              <input className="input" value={form.address ?? ''} onChange={e => set('address', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Property */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 pb-1 border-b border-slate-100">
            Property & electricity
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Property type</label>
              <select className="select" value={form.property_type ?? ''} onChange={e => set('property_type', e.target.value)}>
                <option value="">Select</option>
                {['Residential','Commercial','Industrial','Agricultural'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Ownership</label>
              <select className="select" value={form.ownership ?? ''} onChange={e => set('ownership', e.target.value)}>
                <option value="">Select</option>
                {['Owned','Rented','Family Owned'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Roof type</label>
              <select className="select" value={form.roof_type ?? ''} onChange={e => set('roof_type', e.target.value)}>
                <option value="">Select</option>
                {['RCC / Concrete','Tin / Metal Sheet','Asbestos','Mangalore Tile','Other'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Roof area (sq ft)</label>
              <input className="input" type="number" value={form.roof_area ?? ''} onChange={e => set('roof_area', e.target.value)} />
            </div>
            <div>
              <label className="label">Electricity board</label>
              <input className="input" placeholder="e.g. PVVNL, BSES" value={form.electricity_board ?? ''} onChange={e => set('electricity_board', e.target.value)} />
            </div>
            <div>
              <label className="label">Sanctioned load (kW)</label>
              <input className="input" type="number" value={form.sanctioned_load ?? ''} onChange={e => set('sanctioned_load', e.target.value)} />
            </div>
            <div>
              <label className="label">Monthly bill (₹)</label>
              <input className="input" type="number" value={form.monthly_bill ?? ''} onChange={e => set('monthly_bill', e.target.value)} />
            </div>
            <div>
              <label className="label">Units per month (kWh)</label>
              <input className="input" type="number" value={form.units_per_month ?? ''} onChange={e => set('units_per_month', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Disposition & Call Status */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 pb-1 border-b border-slate-100">
            Call status & disposition
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Call status</label>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                {['Not Connected', 'Connected'].map(s => (
                  <button key={s} type="button"
                    onClick={() => { set('call_status', s); set('disposition', '') }}
                    className={`flex-1 py-2 text-xs font-medium transition-colors ${
                      form.call_status === s ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
                    }`}>
                    {s === 'Not Connected' ? '📵 Not connected' : '✅ Connected'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Disposition</label>
              <select className="select" value={form.disposition ?? ''} onChange={e => set('disposition', e.target.value)}>
                <option value="">Select disposition</option>
                {form.call_status === 'Connected'
                  ? CONNECTED_DISPOSITIONS.map(d => <option key={d} value={d}>{d}</option>)
                  : NOT_CONNECTED_DISPOSITIONS.map(d => <option key={d} value={d}>{d}</option>)
                }
              </select>
            </div>

            {/* Meeting scheduling if Meeting Scheduled (BD) */}
            {isMeetingDisposition(form.disposition) && (
              <>
                <div>
                  <label className="label">Meeting date</label>
                  <input type="date" className="input" value={form.meeting_date ?? ''}
                    onChange={e => set('meeting_date', e.target.value)}
                    min={new Date().toISOString().split('T')[0]} />
                </div>
                <div>
                  <label className="label">Meeting slot</label>
                  <select className="select" value={form.meeting_slot ?? ''} onChange={e => set('meeting_slot', e.target.value)}>
                    <option value="">Select slot</option>
                    {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </>
            )}

            {/* Callback scheduling if Call Later / Meet Later */}
            {isCallbackDisposition(form.disposition) && (
              <>
                <div>
                  <label className="label">Callback date</label>
                  <input type="date" className="input" value={form.callback_date ?? ''}
                    onChange={e => set('callback_date', e.target.value)}
                    min={new Date().toISOString().split('T')[0]} />
                </div>
                <div>
                  <label className="label">Callback slot</label>
                  <select className="select" value={form.callback_slot ?? ''} onChange={e => set('callback_slot', e.target.value)}>
                    <option value="">Select slot</option>
                    {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Solar */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 pb-1 border-b border-slate-100">
            Solar & remarks
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">System size (kW)</label>
              <input className="input" type="number" value={form.system_size_kw ?? ''} onChange={e => set('system_size_kw', e.target.value)} />
            </div>
            <div>
              <label className="label">System type</label>
              <select className="select" value={form.system_type ?? ''} onChange={e => set('system_type', e.target.value)}>
                <option value="">Select</option>
                {['On-grid','Off-grid','Hybrid'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Remarks</label>
              <textarea className="input resize-none" rows={3} value={form.remarks ?? ''} onChange={e => set('remarks', e.target.value)} />
            </div>
          </div>
        </div>

      </div>

      <div className="flex gap-2 mt-5 pt-4 border-t border-slate-100">
        <button onClick={onClose} className="btn flex-1 justify-center">Cancel</button>
        <button onClick={handleSave} disabled={saving || !form.phone}
          className="btn-primary flex-1 justify-center disabled:opacity-50">
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </Modal>
  )
}

// ── Sales Meeting Outcome — editable by sales team only ───────
function SalesMeetingOutcome({ lead, onSaved, userId, userName }) {
  const [outcome,  setOutcome]  = useState(lead.meeting_outcome ?? '')
  const [remarks,  setRemarks]  = useState(lead.sales_remarks   ?? '')
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)

  const OUTCOMES = [
    'Meeting Done — Interested',
    'Meeting Done — Not Interested',
    'Meeting Done — Price Issue',
    'Meeting Done — Site Not Suitable',
    'Meeting Done — Thinking',
    'Meeting Not Done — Customer Absent',
    'Meeting Not Done — Rescheduled',
    'Sale Closed',
    'QC Required',
  ]

  async function handleSave() {
    setSaving(true)
    await updateLead(lead.id, {
      meeting_outcome: outcome || null,
      sales_remarks:   remarks || null,
    })
    await logActivity({
      leadId: lead.id, action: 'Meeting outcome updated',
      field: 'meeting_outcome', oldVal: lead.meeting_outcome, newVal: outcome,
      userId, userName,
    })
    onSaved({ meeting_outcome: outcome, sales_remarks: remarks })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <label className="label">Outcome</label>
        <select className="select" value={outcome} onChange={e => setOutcome(e.target.value)}>
          <option value="">Select outcome</option>
          {OUTCOMES.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Sales remarks</label>
        <textarea className="input resize-none" rows={2}
          placeholder="Notes from the meeting..."
          value={remarks} onChange={e => setRemarks(e.target.value)} />
      </div>
      <button onClick={handleSave} disabled={saving}
        className={`btn justify-center transition-colors ${saved ? 'bg-green-50 text-green-700 border-green-200' : ''}`}>
        {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save outcome'}
      </button>
    </div>
  )
}
