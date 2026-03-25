export const SALES_OUTCOMES = [
  { value: 'call_not_connected_1', label: 'Call Not Connected - 1st', meetingVia: 'on_call', leadStatus: 'pending', meetingStatus: 'meeting_not_done' },
  { value: 'call_not_connected_2', label: 'Call Not Connected - 2nd', meetingVia: 'on_call', leadStatus: 'pending', meetingStatus: 'meeting_not_done' },
  { value: 'call_not_connected_3', label: 'Call Not Connected - 3rd', meetingVia: 'on_call', leadStatus: 'pending', meetingStatus: 'meeting_not_done' },
  { value: 'multiple_nc_rearrange', label: 'Multiple NC — Rearrange Meeting 📞', meetingVia: 'on_call', leadStatus: 'pending', meetingStatus: 'meeting_not_done' },
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

export const NOT_INTERESTED_REASONS = [
  { value: 'price_issue', label: 'Price Issue' },
  { value: 'product_issue', label: 'Product Issue' },
  { value: 'already_installed', label: 'Already Installed' },
  { value: 'competitor_chosen', label: 'Competitor Chosen' },
  { value: 'other', label: 'Other' },
]

export function getOutcomeStyle(outcome) {
  if (!outcome) return { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' }
  if (outcome.includes('multiple_nc')) return { bg: '#fdf4ff', text: '#7e22ce', border: '#d8b4fe' }
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

export function getLeadStatusStyle(status) {
  switch (status) {
    case 'won': return 'bg-green-100 text-green-700 border-green-200'
    case 'lost': return 'bg-red-100 text-red-600 border-red-200'
    case 'follow_up': return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200'
    default: return 'bg-slate-100 text-slate-600 border-slate-200'
  }
}

export function getNextStages(currentStage, role, isSuperAdmin) {
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