import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import Layout from '@/components/layout/Layout'
import { PageHeader, Modal, Spinner, StageBadge } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { updateLead, logActivity } from '@/lib/leadService'
import { CheckCircle, XCircle, Eye, Clock, IndianRupee, Package, Zap, ChevronDown, ChevronUp } from 'lucide-react'
import { format } from 'date-fns'

// ── Helpers ─────────────────────────────────────────────────
function inr(n) {
  if (!n) return '—'
  return '₹' + Number(n).toLocaleString('en-IN')
}

function parsePaymentMeta(notes) {
  try { return JSON.parse(notes) } catch { return null }
}

const PAYMENT_TYPE_LABELS = {
  lump_sum: 'Lump Sum (Full Payment)',
  advance_dispatch: 'Advance + At Dispatch/Delivery',
  advance_emi: 'Advance + EMI',
  advance_partial_final: 'Advance + Partial + Final',
  milestone_based: 'Milestone Based (Custom)',
}

// ── Main Page ────────────────────────────────────────────────
export default function SalesApprovalPage() {
  const { profile, isSuperAdmin, isSalesManager } = useAuth()
  // isSalesManager not in AuthContext by default, derive from role
  const { role } = useAuth()
  const canApprove = isSuperAdmin || role === 'sales_manager'

  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending') // pending | approved | rejected | all
  const [selectedLead, setSelectedLead] = useState(null)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { fetchLeads() }, [filter])

  async function fetchLeads() {
    setLoading(true)
    let q = supabase
      .from('leads')
      .select(`
        id, name, phone, city, stage,
        sales_quoted_amount, sale_closed_at, order_submitted_at,
        order_approved_by, order_approved_at, order_rejected_reason, order_id,
        system_size_kw,
        sales_agent_id,
        order_details (
          id, panel_type,
          dcr_num_panels, dcr_capacity_wp, dcr_brand,
          non_dcr_num_panels, non_dcr_capacity_wp, non_dcr_brand,
          inverter_brand, inverter_capacity_kw, inverter_type,
          structure_type, structure_notes,
          system_size_kw, system_type,
          amc_included, amc_years, amc_plan,
          sales_quoted_amount, total_project_cost, cost_difference_reason,
          advance_received, advance_amount, advance_mode, advance_reference, advance_date,
          submitted_by, submitted_at
        ),
        assigned_user:assigned_to (name)
      `)

    if (filter === 'pending') {
      q = q.eq('stage', 'sale_pending_approval')
    } else if (filter === 'approved') {
      q = q.eq('stage', 'sale_closed').not('order_approved_at', 'is', null)
    } else if (filter === 'rejected') {
      q = q.eq('stage', 'sale_rejected')
    } else {
      q = q.in('stage', ['sale_pending_approval', 'sale_closed', 'sale_rejected'])
    }

    q = q.order('order_submitted_at', { ascending: false, nullsFirst: false })

    const { data, error } = await q
    if (!error) setLeads(data ?? [])
    setLoading(false)
  }

  const tabs = [
    { key: 'pending', label: '⏳ Pending', color: 'text-amber-600' },
    { key: 'approved', label: '✅ Approved', color: 'text-green-600' },
    { key: 'rejected', label: '❌ Rejected', color: 'text-red-500' },
    { key: 'all', label: 'All', color: 'text-slate-600' },
  ]

  return (
    <Layout>
      <PageHeader title="Sales Approval" subtitle="Review and approve order submissions from sales agents" />

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-slate-200 px-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${filter === t.key ? `border-blue-600 ${t.color}` : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center text-xs text-slate-400 pb-2">
          {leads.length} order{leads.length !== 1 ? 's' : ''}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : leads.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-slate-400">
          <CheckCircle size={40} className="mb-3 opacity-30" />
          <p className="text-sm">Koi order nahi mila is filter mein</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map(lead => (
            <OrderCard
              key={lead.id}
              lead={lead}
              canApprove={canApprove}
              onView={() => navigate(`/leads/${lead.id}`)}
              onApprove={() => { setSelectedLead(lead); setShowApproveModal(true) }}
              onReject={() => { setSelectedLead(lead); setShowRejectModal(true) }}
            />
          ))}
        </div>
      )}

      {showApproveModal && selectedLead && (
        <ApproveModal
          lead={selectedLead}
          approverId={profile?.id}
          approverName={profile?.name}
          onClose={() => { setShowApproveModal(false); setSelectedLead(null) }}
          onDone={() => { setShowApproveModal(false); setSelectedLead(null); fetchLeads() }}
        />
      )}

      {showRejectModal && selectedLead && (
        <RejectModal
          lead={selectedLead}
          rejecterId={profile?.id}
          rejecterName={profile?.name}
          onClose={() => { setShowRejectModal(false); setSelectedLead(null) }}
          onDone={() => { setShowRejectModal(false); setSelectedLead(null); fetchLeads() }}
        />
      )}
    </Layout>
  )
}

// ── Order Card ───────────────────────────────────────────────
function OrderCard({ lead, canApprove, onView, onApprove, onReject }) {
  const [expanded, setExpanded] = useState(false)
  const od = lead.order_details?.[0] ?? lead.order_details ?? null
  const meta = od ? parsePaymentMeta(od.structure_notes) : null

  const statusBadge = {
    sale_pending_approval: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: '⏳ Pending Approval' },
    sale_closed: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', label: '✅ Approved' },
    sale_rejected: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', label: '❌ Rejected' },
  }[lead.stage] ?? { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', label: lead.stage }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-800 text-sm">{lead.name || 'No Name'}</span>
            <span className="text-slate-400 text-xs">{lead.phone}</span>
            {lead.city && <span className="text-slate-400 text-xs">· {lead.city}</span>}
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}>
              {statusBadge.label}
            </span>
            {lead.order_id && (
              <span className="text-xs px-2 py-0.5 rounded-full border font-mono font-semibold bg-blue-50 text-blue-700 border-blue-200 tracking-wide">
                🔖 {lead.order_id}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {od?.total_project_cost && (
              <span className="text-xs text-slate-600 flex items-center gap-1">
                <IndianRupee size={11} /> {Number(od.total_project_cost).toLocaleString('en-IN')} project cost
              </span>
            )}
            {od?.system_size_kw && (
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Zap size={11} /> {od.system_size_kw} kW
              </span>
            )}
            {od?.panel_type && (
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Package size={11} /> {od.panel_type.toUpperCase().replace('_', '+')} panels
              </span>
            )}
            {od?.submitted_at && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock size={11} /> Submitted {format(new Date(od.submitted_at), 'dd MMM, hh:mm a')}
              </span>
            )}
          </div>
          {lead.stage === 'sale_rejected' && lead.order_rejected_reason && (
            <div className="mt-1 text-xs text-red-600 bg-red-50 rounded px-2 py-1 inline-block">
              Rejection: {lead.order_rejected_reason}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={onView} className="btn text-xs px-3 py-1.5">View Lead</button>
          {canApprove && lead.stage === 'sale_pending_approval' && (
            <>
              <button onClick={onApprove}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors">
                <CheckCircle size={13} /> Approve
              </button>
              <button onClick={onReject}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition-colors">
                <XCircle size={13} /> Reject
              </button>
            </>
          )}
          {od && (
            <button onClick={() => setExpanded(p => !p)}
              className="text-slate-400 hover:text-slate-600 p-1 transition-colors">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded order details */}
      {expanded && od && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">

            {/* Panels */}
            <div>
              <div className="font-semibold text-slate-500 uppercase tracking-wide text-[10px] mb-1">Panels</div>
              {(od.panel_type === 'dcr' || od.panel_type === 'both') && od.dcr_num_panels && (
                <div className="mb-1">
                  <span className="font-medium text-blue-700">DCR:</span>{' '}
                  {od.dcr_num_panels} × {od.dcr_capacity_wp}Wp {od.dcr_brand && `(${od.dcr_brand})`}
                </div>
              )}
              {(od.panel_type === 'non_dcr' || od.panel_type === 'both') && od.non_dcr_num_panels && (
                <div>
                  <span className="font-medium text-slate-600">Non-DCR:</span>{' '}
                  {od.non_dcr_num_panels} × {od.non_dcr_capacity_wp}Wp {od.non_dcr_brand && `(${od.non_dcr_brand})`}
                </div>
              )}
            </div>

            {/* Inverter */}
            <div>
              <div className="font-semibold text-slate-500 uppercase tracking-wide text-[10px] mb-1">Inverter</div>
              <div>{od.inverter_brand || '—'} {od.inverter_capacity_kw && `${od.inverter_capacity_kw}kW`}</div>
              <div className="text-slate-400">{od.inverter_type?.replace('_', ' ')}</div>
            </div>

            {/* Financials */}
            <div>
              <div className="font-semibold text-slate-500 uppercase tracking-wide text-[10px] mb-1">Financials</div>
              <div>Quoted: {inr(od.sales_quoted_amount)}</div>
              <div className="font-semibold text-slate-800">Final: {inr(od.total_project_cost)}</div>
              {od.cost_difference_reason && (
                <div className="text-slate-400 mt-0.5">Diff reason: {od.cost_difference_reason}</div>
              )}
            </div>

            {/* Payment */}
            <div className="col-span-2 md:col-span-2">
              <div className="font-semibold text-slate-500 uppercase tracking-wide text-[10px] mb-1">Payment Structure</div>
              {meta?.payment_mode === 'emi' ? (
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-pink-700 mb-1">📅 EMI Payment</div>
                  {[
                    { label: 'Total Amount', val: inr(meta.emi_total_amount) },
                    { label: 'Tenure', val: meta.emi_tenure_months ? `${meta.emi_tenure_months} months` : '—' },
                  ].map(({ label, val }) => (
                    <div key={label} className="flex justify-between text-xs">
                      <span className="text-slate-500">{label}</span>
                      <span className="font-medium text-slate-700">{val}</span>
                    </div>
                  ))}
                </div>
              ) : meta?.milestones ? (
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-blue-700 mb-1">💳 Direct Payment</div>
                  {[
                    { key: 'advance', label: 'Advance' },
                    { key: 'design', label: 'Design Approval' },
                    { key: 'dispatch', label: 'Dispatch/Delivery' },
                    { key: 'installation', label: 'Installation' },
                    { key: 'commissioning', label: 'Commissioning' },
                  ].filter(m => meta.milestones[m.key]).map(m => (
                    <div key={m.key} className="flex justify-between text-xs">
                      <span className="text-slate-500">{m.label}</span>
                      <span className="font-medium text-slate-700">{inr(meta.milestones[m.key])}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-slate-400 text-xs">—</span>
              )}
              {od.advance_received && (
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <span className="text-green-700 font-medium text-xs">Advance received: {inr(od.advance_amount)}</span>
                  <div className="text-slate-400 text-xs">{od.advance_mode} {od.advance_reference && `· ${od.advance_reference}`}</div>
                  {od.advance_date && <div className="text-slate-400 text-xs">{format(new Date(od.advance_date), 'dd MMM yyyy')}</div>}
                </div>
              )}
            </div>

            {/* AMC & Structure */}
            <div className="col-span-2 md:col-span-4 border-t border-slate-200 pt-2 mt-1 flex gap-6 flex-wrap">
              <div><span className="text-slate-400">Structure:</span> <span className="capitalize">{od.structure_type?.replace('_', ' ')}</span>{meta?.structure_height_ft ? ` · ${meta.structure_height_ft} ft` : ''}{meta?.structure_material ? ` · ${meta.structure_material.toUpperCase()}` : ''}</div>
              <div><span className="text-slate-400">System:</span> {od.system_size_kw}kW {od.system_type?.replace('_', ' ')}</div>
              <div><span className="text-slate-400">AMC:</span> {od.amc_included ? `Yes — ${od.amc_years}yr ${od.amc_plan}` : 'Not included'}</div>
              {meta?.design_included !== undefined && (
                <div><span className="text-slate-400">Design:</span> {meta.design_included ? 'Included' : 'Not included'}</div>
              )}
            </div>

            {/* Corrections */}
            {(meta?.name_change_required || meta?.load_change_required || meta?.other_correction_remark) && (
              <div className="col-span-2 md:col-span-4 border-t border-slate-200 pt-2 mt-1">
                <div className="font-semibold text-slate-500 uppercase tracking-wide text-[10px] mb-1">⚠️ Corrections Required</div>
                <div className="flex gap-3 flex-wrap">
                  {meta?.name_change_required && (
                    <div className="text-xs bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
                      <span className="font-medium text-yellow-700">Name Change:</span> {meta.name_change_remark || 'Required'}
                    </div>
                  )}
                  {meta?.load_change_required && (
                    <div className="text-xs bg-orange-50 border border-orange-200 rounded px-2 py-1">
                      <span className="font-medium text-orange-700">Load Change:</span> {meta.load_change_remark || 'Required'}
                    </div>
                  )}
                  {meta?.other_correction_remark && (
                    <div className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1">
                      <span className="font-medium text-slate-600">Other:</span> {meta.other_correction_remark}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Approve Modal ────────────────────────────────────────────
function ApproveModal({ lead, approverId, approverName, onClose, onDone }) {
  const [saving, setSaving] = useState(false)
  const [remarks, setRemarks] = useState('')

  async function handleApprove() {
    setSaving(true)
    const now = new Date().toISOString()
    await updateLead(lead.id, {
      stage: 'sale_closed',
      sale_closed_at: now,
      order_approved_by: approverId,
      order_approved_at: now,
      order_rejected_reason: null,
    })
    await logActivity({
      leadId: lead.id,
      action: 'Order Approved ✅',
      field: 'stage',
      oldVal: 'sale_pending_approval',
      newVal: 'sale_closed',
      userId: approverId,
      userName: approverName,
    })
    if (remarks) {
      await logActivity({
        leadId: lead.id,
        action: 'Approval remarks',
        field: 'remarks',
        oldVal: null,
        newVal: remarks,
        userId: approverId,
        userName: approverName,
      })
    }
    setSaving(false)
    onDone()
  }

  return (
    <Modal open={true} onClose={onClose} title="✅ Approve Order" width={420}>
      <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
        <p className="text-sm text-green-800 font-medium">{lead.name} — {lead.phone}</p>
        <p className="text-xs text-green-700 mt-1">Order approve karne pe lead <strong>Sale Closed</strong> stage mein move ho jayegi aur Finance team ko dikhegi.</p>
      </div>
      <div className="mb-4">
        <label className="label">Approval Remarks (optional)</label>
        <textarea className="input w-full resize-none" rows={2} placeholder="Koi note..." value={remarks} onChange={e => setRemarks(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button onClick={onClose} className="btn flex-1 justify-center">Cancel</button>
        <button onClick={handleApprove} disabled={saving}
          className="flex-1 justify-center flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
          {saving ? 'Approving...' : <><CheckCircle size={15} /> Approve & Move to Sale Closed</>}
        </button>
      </div>
    </Modal>
  )
}

// ── Reject Modal ─────────────────────────────────────────────
function RejectModal({ lead, rejecterId, rejecterName, onClose, onDone }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleReject() {
    if (!reason.trim()) return
    setSaving(true)
    await updateLead(lead.id, {
      stage: 'sale_rejected',
      order_rejected_reason: reason,
      order_approved_by: null,
      order_approved_at: null,
    })
    await logActivity({
      leadId: lead.id,
      action: 'Order Rejected ❌',
      field: 'stage',
      oldVal: 'sale_pending_approval',
      newVal: 'sale_rejected',
      userId: rejecterId,
      userName: rejecterName,
    })
    await logActivity({
      leadId: lead.id,
      action: 'Rejection reason',
      field: 'order_rejected_reason',
      oldVal: null,
      newVal: reason,
      userId: rejecterId,
      userName: rejecterName,
    })
    setSaving(false)
    onDone()
  }

  return (
    <Modal open={true} onClose={onClose} title="❌ Reject Order" width={420}>
      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-800 font-medium">{lead.name} — {lead.phone}</p>
        <p className="text-xs text-red-700 mt-1">Lead <strong>Sale Rejected</strong> stage mein move ho jayegi. Sales agent ko dobara kaam karna hoga.</p>
      </div>
      <div className="mb-4">
        <label className="label">Rejection Reason <span className="text-red-500">*</span></label>
        <textarea className="input w-full resize-none" rows={3}
          placeholder="Kya galat tha? Sales agent ko kya fix karna hai..."
          value={reason} onChange={e => setReason(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button onClick={onClose} className="btn flex-1 justify-center">Cancel</button>
        <button onClick={handleReject} disabled={saving || !reason.trim()}
          className="flex-1 justify-center flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors">
          {saving ? 'Rejecting...' : <><XCircle size={15} /> Reject Order</>}
        </button>
      </div>
    </Modal>
  )
}