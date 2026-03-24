import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import Layout from '@/components/layout/Layout'
import { PageHeader, Modal, Spinner } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { updateLead, logActivity } from '@/lib/leadService'
import { CheckCircle, XCircle, Eye, Clock, MessageSquare } from 'lucide-react'
import { format } from 'date-fns'

export default function PSDispositionApprovalsPage() {
  const { profile, role, isSuperAdmin } = useAuth()
  const canApprove = isSuperAdmin || role === 'presales_manager'
  const navigate = useNavigate()

  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [selected, setSelected] = useState(null)
  const [showApprove, setShowApprove] = useState(false)
  const [showReject, setShowReject] = useState(false)

  useEffect(() => { fetchRequests() }, [filter])

  async function fetchRequests() {
    setLoading(true)
    let q = supabase
      .from('disposition_approvals')
      .select(`
        id, lead_id, requested_by, requested_by_name, requested_at,
        old_disposition, new_disposition, old_call_status, new_call_status,
        status, reviewed_by_name, reviewed_at, rejection_reason, notes,
        lead:lead_id (id, name, phone, city, stage, meeting_date, meeting_slot)
      `)
      .order('requested_at', { ascending: false })

    if (filter !== 'all') q = q.eq('status', filter)

    const { data, error } = await q
    if (!error) setRequests(data ?? [])
    setLoading(false)
  }

  const tabs = [
    { key: 'pending', label: '⏳ Pending' },
    { key: 'approved', label: '✅ Approved' },
    { key: 'rejected', label: '❌ Rejected' },
    { key: 'all', label: 'All' },
  ]

  return (
    <Layout>
      <PageHeader
        title="Disposition Approvals"
        subtitle="PS agent requests to change disposition on meeting-scheduled leads"
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-slate-200 px-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              filter === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center text-xs text-slate-400 pb-2">
          {requests.length} request{requests.length !== 1 ? 's' : ''}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-slate-400">
          <CheckCircle size={40} className="mb-3 opacity-30" />
          <p className="text-sm">Koi request nahi mili</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => (
            <RequestCard
              key={req.id}
              req={req}
              canApprove={canApprove}
              onView={() => navigate(`/leads/${req.lead_id}`)}
              onApprove={() => { setSelected(req); setShowApprove(true) }}
              onReject={() => { setSelected(req); setShowReject(true) }}
            />
          ))}
        </div>
      )}

      {showApprove && selected && (
        <ApproveModal
          req={selected}
          approverId={profile?.id}
          approverName={profile?.name}
          onClose={() => { setShowApprove(false); setSelected(null) }}
          onDone={() => { setShowApprove(false); setSelected(null); fetchRequests() }}
        />
      )}

      {showReject && selected && (
        <RejectModal
          req={selected}
          rejecterId={profile?.id}
          rejecterName={profile?.name}
          onClose={() => { setShowReject(false); setSelected(null) }}
          onDone={() => { setShowReject(false); setSelected(null); fetchRequests() }}
        />
      )}
    </Layout>
  )
}

// ── Request Card ─────────────────────────────────────────────
function RequestCard({ req, canApprove, onView, onApprove, onReject }) {
  const lead = req.lead

  const statusBadge = {
    pending:  { cls: 'bg-amber-50 text-amber-700 border-amber-200',  label: '⏳ Pending' },
    approved: { cls: 'bg-green-50 text-green-700 border-green-200',  label: '✅ Approved' },
    rejected: { cls: 'bg-red-50   text-red-600   border-red-200',    label: '❌ Rejected' },
  }[req.status] ?? { cls: 'bg-slate-50 text-slate-600 border-slate-200', label: req.status }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* Lead info */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-slate-800 text-sm">{lead?.name || 'Unknown'}</span>
            <span className="text-slate-400 text-xs">{lead?.phone}</span>
            {lead?.city && <span className="text-slate-400 text-xs">· {lead.city}</span>}
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusBadge.cls}`}>
              {statusBadge.label}
            </span>
          </div>

          {/* Meeting info */}
          {lead?.meeting_date && (
            <div className="text-xs text-slate-500 mb-2 flex items-center gap-1">
              <Clock size={11} /> Meeting: {format(new Date(lead.meeting_date), 'dd MMM')} · {lead.meeting_slot}
            </div>
          )}

          {/* Disposition change */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-slate-500">Requested by <strong>{req.requested_by_name}</strong></span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-400">{format(new Date(req.requested_at), 'dd MMM, hh:mm a')}</span>
          </div>

          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <div className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-600 line-through">
              {req.old_disposition || 'No disposition'}
            </div>
            <span className="text-slate-400 text-xs">→</span>
            <div className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 font-medium">
              {req.new_disposition}
            </div>
          </div>

          {req.status === 'rejected' && req.rejection_reason && (
            <div className="mt-2 text-xs text-red-600 bg-red-50 rounded px-2 py-1">
              Rejection reason: {req.rejection_reason}
            </div>
          )}
          {req.status !== 'pending' && req.reviewed_by_name && (
            <div className="mt-1 text-xs text-slate-400">
              {req.status === 'approved' ? 'Approved' : 'Rejected'} by {req.reviewed_by_name}
              {req.reviewed_at && ` · ${format(new Date(req.reviewed_at), 'dd MMM, hh:mm a')}`}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={onView} className="btn text-xs px-3 py-1.5">
            <Eye size={12} /> View Lead
          </button>
          {canApprove && req.status === 'pending' && (
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
        </div>
      </div>
    </div>
  )
}

// ── Approve Modal ────────────────────────────────────────────
function ApproveModal({ req, approverId, approverName, onClose, onDone }) {
  const [saving, setSaving] = useState(false)

  async function handleApprove() {
    setSaving(true)
    const now = new Date().toISOString()

    // Parse target stage from notes field (format: "stage:non_qualified")
    const targetStage = req.notes?.startsWith('stage:') ? req.notes.split(':')[1] : null

    // 1. Lead ka disposition + stage update karo
    const leadUpdates = {
      disposition: req.new_disposition,
      call_status: req.new_call_status || undefined,
    }
    if (targetStage) {
      leadUpdates.stage = targetStage
      // Meeting data clear karo — lead sales queue se hat jaaye
      leadUpdates.meeting_date = null
      leadUpdates.meeting_slot = null
      leadUpdates.sales_agent_id = null
      leadUpdates.sales_outcome = null
      leadUpdates.sales_meeting_status = null
    }

    await updateLead(req.lead_id, leadUpdates)

    // 2. Activity logs
    await logActivity({
      leadId: req.lead_id,
      action: 'Disposition updated (PS Manager approved)',
      field: 'disposition',
      oldVal: req.old_disposition,
      newVal: req.new_disposition,
      userId: approverId,
      userName: approverName,
    })
    if (targetStage) {
      await logActivity({
        leadId: req.lead_id,
        action: 'Stage changed (disposition approval)',
        field: 'stage',
        oldVal: 'meeting_scheduled',
        newVal: targetStage,
        userId: approverId,
        userName: approverName,
      })
    }

    // 3. Approval request update karo
    await supabase.from('disposition_approvals').update({
      status: 'approved',
      reviewed_by: approverId,
      reviewed_by_name: approverName,
      reviewed_at: now,
    }).eq('id', req.id)

    setSaving(false)
    onDone()
  }

  return (
    <Modal open={true} onClose={onClose} title="✅ Approve Disposition Change" width={440}>
      <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
        <p className="text-sm text-green-800 font-medium">{req.lead?.name} — {req.lead?.phone}</p>
        <p className="text-xs text-green-700 mt-2">
          <span className="line-through text-slate-400">{req.old_disposition || 'No disposition'}</span>
          <span className="mx-2">→</span>
          <strong>{req.new_disposition}</strong>
        </p>
        {req.notes?.startsWith('stage:') && (
          <p className="text-xs text-amber-700 mt-1.5 bg-amber-50 border border-amber-200 rounded px-2 py-1">
            ⚠️ Stage bhi change hoga: <strong>Meeting Scheduled → {req.notes.split(':')[1].replace('_', ' ')}</strong> — lead sales queue se hat jaayegi
          </p>
        )}
        <p className="text-xs text-green-600 mt-1">Approve karne pe lead ka disposition turant update ho jaayega.</p>
      </div>
      <div className="flex gap-2">
        <button onClick={onClose} className="btn flex-1 justify-center">Cancel</button>
        <button onClick={handleApprove} disabled={saving}
          className="flex-1 justify-center flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
          {saving ? 'Approving...' : <><CheckCircle size={15} /> Approve Change</>}
        </button>
      </div>
    </Modal>
  )
}

// ── Reject Modal ─────────────────────────────────────────────
function RejectModal({ req, rejecterId, rejecterName, onClose, onDone }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleReject() {
    if (!reason.trim()) return
    setSaving(true)
    const now = new Date().toISOString()

    await supabase.from('disposition_approvals').update({
      status: 'rejected',
      reviewed_by: rejecterId,
      reviewed_by_name: rejecterName,
      reviewed_at: now,
      rejection_reason: reason,
    }).eq('id', req.id)

    await logActivity({
      leadId: req.lead_id,
      action: 'Disposition change rejected by PS Manager',
      field: 'disposition',
      oldVal: req.new_disposition,
      newVal: req.old_disposition,
      userId: rejecterId,
      userName: rejecterName,
    })

    setSaving(false)
    onDone()
  }

  return (
    <Modal open={true} onClose={onClose} title="❌ Reject Disposition Change" width={440}>
      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-800 font-medium">{req.lead?.name} — {req.lead?.phone}</p>
        <p className="text-xs text-red-700 mt-1">
          Requested: <strong>{req.old_disposition}</strong> → <strong>{req.new_disposition}</strong>
        </p>
        <p className="text-xs text-red-600 mt-1">Reject karne pe lead ka disposition unchanged rahega.</p>
      </div>
      <div className="mb-4">
        <label className="label">Rejection Reason <span className="text-red-500">*</span></label>
        <textarea className="input w-full resize-none" rows={3}
          placeholder="Kyun reject kar rahe ho? PS agent ko kya karna chahiye..."
          value={reason} onChange={e => setReason(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button onClick={onClose} className="btn flex-1 justify-center">Cancel</button>
        <button onClick={handleReject} disabled={saving || !reason.trim()}
          className="flex-1 justify-center flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors">
          {saving ? 'Rejecting...' : <><XCircle size={15} /> Reject Request</>}
        </button>
      </div>
    </Modal>
  )
}
