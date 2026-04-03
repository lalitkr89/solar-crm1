export const STAGES = {
  new: { label: 'New Lead', team: 'presales', color: '#7F77DD', order: 1 },
  meeting_scheduled: { label: 'Meeting Scheduled', team: 'presales', color: '#378ADD', order: 2 },
  meeting_done: { label: 'Meeting Done', team: 'sales', color: '#378ADD', order: 3 },
  qc_followup: { label: 'Rearrange Meeting', team: 'presales', color: '#EF9F27', order: 4 },
  sale_pending_approval: { label: 'Pending Approval', team: 'sales', color: '#F59E0B', order: 5 },
  sale_closed: { label: 'Sale Closed', team: 'sales', color: '#639922', order: 6 },
  sale_rejected: { label: 'Sale Rejected', team: 'sales', color: '#EF4444', order: 98 },
  finance_approval: { label: 'Finance Approval', team: 'finance', color: '#1D9E75', order: 6 },
  ops_documents: { label: 'Ops — Documents', team: 'ops', color: '#D85A30', order: 7 },
  name_load_change: { label: 'Name/Load Change', team: 'ops', color: '#BA7517', order: 8 },
  net_metering: { label: 'Net Metering', team: 'ops', color: '#BA7517', order: 9 },
  installation: { label: 'Installation', team: 'ops', color: '#0F6E56', order: 10 },
  installed: { label: 'Installed', team: 'amc', color: '#0F6E56', order: 11 },
  amc_active: { label: 'AMC Active', team: 'amc', color: '#1D9E75', order: 12 },
  not_interested: { label: 'Not Interested', team: null, color: '#E24B4A', order: 99 },
  non_qualified: { label: 'Non Qualified', team: null, color: '#888780', order: 99 },
  lost: { label: 'Lost', team: null, color: '#888780', order: 99 },
}

// Which stages each role can ACCESS
export const ROLE_STAGE_ACCESS = {
  presales_agent: ['new', 'meeting_scheduled', 'qc_followup', 'sale_pending_approval', 'sale_closed', 'sale_rejected'],
  presales_manager: ['new', 'meeting_scheduled', 'qc_followup', 'sale_pending_approval', 'sale_closed', 'sale_rejected'],
  sales_agent: ['meeting_scheduled', 'meeting_done', 'qc_followup', 'sale_pending_approval', 'sale_closed', 'sale_rejected'],
  sales_manager: ['meeting_scheduled', 'meeting_done', 'qc_followup', 'sale_pending_approval', 'sale_closed', 'sale_rejected'],
  finance_agent: ['sale_closed', 'finance_approval'],
  finance_manager: ['sale_closed', 'finance_approval'],
  ops_agent: ['finance_approval', 'ops_documents', 'name_load_change', 'net_metering', 'installation', 'installed'],
  ops_manager: ['finance_approval', 'ops_documents', 'name_load_change', 'net_metering', 'installation', 'installed'],
  amc_agent: ['installed', 'amc_active'],
  amc_manager: ['installed', 'amc_active'],
  super_admin: Object.keys(STAGES),
}

// Which stage a role lands on after login (default view)
export const ROLE_DEFAULT_STAGE = {
  presales_agent: 'new',
  presales_manager: 'new',
  sales_agent: 'meeting_scheduled',
  sales_manager: 'meeting_scheduled',
  finance_agent: 'sale_closed',
  finance_manager: 'sale_closed',
  ops_agent: 'ops_documents',
  ops_manager: 'ops_documents',
  amc_agent: 'amc_active',
  amc_manager: 'amc_active',
  super_admin: 'new',
}

// ── Dynamic stage arrays (single source of truth) ────────────
// Agar future mein naya stage add karo stages.js mein, yeh automatically update ho jayega
const SALE_CLOSED_ORDER = STAGES['sale_closed'].order  // = 6

export const PRESALES_VISIBLE_STAGES = Object.entries(STAGES)
  .filter(([key, s]) =>
    s.team === 'presales'           // presales ke apne stages (new, meeting_scheduled, qc_followup)
    || s.team === 'sales'           // sales stages bhi dikhao (meeting_done, sale_pending_approval etc)
    || s.order >= SALE_CLOSED_ORDER // sale_closed aur uske baad ke saare (finance, ops, amc...)
    || s.team === null              // dead stages: not_interested, non_qualified, lost
  )
  .map(([key]) => key)

export const PAYMENT_MILESTONES = [
  { key: 'advance', label: 'Advance' },
  { key: 'commissioning', label: 'Commissioning' },
  { key: 'final_delivery', label: 'Final Delivery' },
  { key: 'amc_renewal', label: 'AMC Renewal' },
]