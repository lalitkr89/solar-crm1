import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import Layout from '@/components/layout/Layout'
import { PageHeader, Spinner, Modal } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { formatPhone, cleanPhone } from '@/lib/phone'
import { getSalesCallingQueue, getSalesFollowUpQueue, assignSalesLeadIfUnassigned } from '@/lib/assignment'
import { format } from 'date-fns'
import { RefreshCw, Search, X, Filter, Phone, PhoneOff, TrendingUp } from 'lucide-react'

// ── Sales calling mode helpers (sessionStorage) ───────────────
export function isSalesCallingModeActive() {
  return sessionStorage.getItem('salesCallingMode') === 'true'
}
export function getSalesCallingModeType() {
  return sessionStorage.getItem('salesCallingType') ?? 'calling'
}
export function getSalesCallingQueueFromSession() {
  try { return JSON.parse(sessionStorage.getItem('salesCallingQueue') ?? '[]') } catch { return [] }
}
export function getSalesCallingIndexFromSession() {
  return parseInt(sessionStorage.getItem('salesCallingIndex') ?? '0', 10)
}
export function setSalesCallingIndex(idx) {
  sessionStorage.setItem('salesCallingIndex', String(idx))
}
export function stopSalesCallingMode() {
  sessionStorage.removeItem('salesCallingMode')
  sessionStorage.removeItem('salesCallingType')
  sessionStorage.removeItem('salesCallingQueue')
  sessionStorage.removeItem('salesCallingIndex')
}

// ── Column definitions ────────────────────────────────────────
const COLS = [
  { key: '_select', label: '', w: 36, sortable: false, g: 0 },
  // Group 0 — Lead Info
  { key: 'name', label: 'Name / Phone', w: 180, sortable: true, g: 0 },
  { key: 'city', label: 'City', w: 90, sortable: true, g: 0 },
  { key: 'lead_source', label: 'Source', w: 110, sortable: true, g: 0 },
  { key: 'presales_name', label: 'PS Agent', w: 100, sortable: true, g: 0 },

  // Group 1 — Sales
  { key: 'sales_name', label: 'Sales Agent', w: 100, sortable: true, g: 1 },
  { key: 'meeting_date', label: 'Meeting Date', w: 110, sortable: true, g: 1, isDate: true },
  { key: 'meeting_slot', label: 'Slot', w: 130, sortable: true, g: 1 },
  { key: 'sales_meeting_status', label: 'Mtg Status', w: 120, sortable: true, g: 1 },
  { key: 'sales_outcome', label: 'Outcome', w: 200, sortable: true, g: 1 },
  { key: 'sales_lead_status', label: 'Lead Status', w: 100, sortable: true, g: 1 },
  { key: 'sales_followup_date', label: 'Follow Up', w: 100, sortable: true, g: 1, isDate: true },
  { key: 'sales_quoted_amount', label: 'Quoted ₹', w: 100, sortable: true, g: 1 },

  // Group 2 — Property Details
  { key: 'property_type', label: 'Property', w: 110, sortable: true, g: 2 },
  { key: 'ownership', label: 'Ownership', w: 110, sortable: true, g: 2 },
  { key: 'roof_type', label: 'Roof Type', w: 130, sortable: true, g: 2 },
  { key: 'roof_area', label: 'Roof Area', w: 90, sortable: true, g: 2 },
  { key: 'sanctioned_load', label: 'Load kW', w: 80, sortable: true, g: 2 },
  { key: 'monthly_bill', label: 'Bill ₹', w: 80, sortable: true, g: 2 },
  { key: 'units_per_month', label: 'Units/mo', w: 80, sortable: true, g: 2 },
  { key: 'electricity_board', label: 'Elec Board', w: 100, sortable: true, g: 2 },
  { key: 'system_size_kw', label: 'System kW', w: 90, sortable: true, g: 2 },
  { key: 'system_type', label: 'System Type', w: 100, sortable: true, g: 2 },
]

const G_COLORS = ['#1e40af', '#7c3aed', '#065f46']
const G_LABELS = ['Lead Info', 'Sales', 'Property Details']

const OPS = [
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does not contain' },
  { value: 'equals', label: 'Equals' },
  { value: 'starts_with', label: 'Starts with' },
  { value: 'blank', label: 'Is blank' },
  { value: 'not_blank', label: 'Is not blank' },
]

// Sales outcome labels
const OUTCOME_LABELS = {
  call_not_connected_1: 'Not Connected - 1st',
  call_not_connected_2: 'Not Connected - 2nd',
  call_not_connected_3: 'Not Connected - 3rd',
  invalid_number: 'Invalid Number',
  call_later_interested: 'Call Later (Interested)',
  call_later_underconstruction: 'Call Later (UC)',
  non_qualified_roof: 'NQ - Roof',
  non_qualified_bill: 'NQ - Bill',
  non_qualified_ownership: 'NQ - Ownership',
  non_qualified_not_govt_meter: 'NQ - Not Govt Meter',
  non_qualified_no_connection: 'NQ - No Connection',
  not_serviceable_offgrid: 'NS - Offgrid',
  not_serviceable_location: 'NS - Location',
  not_interested: 'Not Interested',
  solarpro_enquiry: 'SolarPro Enquiry',
  meeting_done_hot: 'HOT 🔥',
  meeting_done_moderate: 'MODERATE 🌡️',
  meeting_done_cold: 'COLD ❄️',
  meeting_done_order_closed: 'ORDER CLOSED 🎉',
}

function getOutcomeStyle(outcome) {
  if (!outcome) return null
  if (outcome.includes('order_closed')) return { bg: '#dcfce7', text: '#14532d', border: '#86efac' }
  if (outcome.includes('hot')) return { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' }
  if (outcome.includes('moderate')) return { bg: '#dbeafe', text: '#1e3a8a', border: '#93c5fd' }
  if (outcome.includes('cold')) return { bg: '#ede9fe', text: '#4c1d95', border: '#c4b5fd' }
  if (outcome.includes('not_interested') || outcome.includes('non_qualified') || outcome.includes('not_serviceable'))
    return { bg: '#fee2e2', text: '#7f1d1d', border: '#fca5a5' }
  if (outcome.includes('call_later')) return { bg: '#dbeafe', text: '#1e3a8a', border: '#93c5fd' }
  if (outcome.includes('not_connected') || outcome.includes('invalid'))
    return { bg: '#fef9c3', text: '#713f12', border: '#fde047' }
  return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' }
}

function getLeadStatusStyle(status) {
  switch (status) {
    case 'won': return { bg: '#dcfce7', text: '#14532d', border: '#86efac' }
    case 'lost': return { bg: '#fee2e2', text: '#7f1d1d', border: '#fca5a5' }
    case 'follow_up': return { bg: '#dbeafe', text: '#1e3a8a', border: '#93c5fd' }
    case 'pending': return { bg: '#fef9c3', text: '#713f12', border: '#fde047' }
    default: return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' }
  }
}

function getMtgStatusStyle(status) {
  switch (status) {
    case 'in_progress': return { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' }
    case 'meeting_done': return { bg: '#dcfce7', text: '#14532d', border: '#86efac' }
    case 'meeting_not_done': return { bg: '#fee2e2', text: '#7f1d1d', border: '#fca5a5' }
    case 'meeting_pending': return { bg: '#dbeafe', text: '#1e3a8a', border: '#93c5fd' }
    case 'pending_outcome': return { bg: '#fef9c3', text: '#713f12', border: '#fde047' }
    default: return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' }
  }
}

function getMtgStatusLabel(status) {
  switch (status) {
    case 'scheduled': return 'Scheduled'
    case 'in_progress': return 'In Progress'
    case 'meeting_done': return 'Done'
    case 'meeting_not_done': return 'Not Done'
    case 'meeting_pending': return 'Pending'
    case 'pending_outcome': return 'Outcome Pending'
    default: return status ?? '—'
  }
}

function applyFilter(cellVal, f) {
  if (!f) return true

  // Date range filter
  if (f.isDate) {
    if (!f.from && !f.to) return true
    if (!cellVal) return false
    if (f.from && f.to) return cellVal >= f.from && cellVal <= f.to
    if (f.from) return cellVal >= f.from
    if (f.to) return cellVal <= f.to
    return true
  }

  const hasVal1 = f.val?.trim() || f.op === 'blank' || f.op === 'not_blank'
  const hasVal2 = f.val2?.trim() || f.op2 === 'blank' || f.op2 === 'not_blank'
  if (!hasVal1) return true
  const v = String(cellVal ?? '').toLowerCase()
  function match(op, fv) {
    const fvl = (fv ?? '').toLowerCase()
    switch (op) {
      case 'contains': return v.includes(fvl)
      case 'not_contains': return !v.includes(fvl)
      case 'equals': return v === fvl
      case 'starts_with': return v.startsWith(fvl)
      case 'blank': return !v
      case 'not_blank': return !!v
      default: return v.includes(fvl)
    }
  }
  const r1 = match(f.op, f.val)
  if (!hasVal2) return r1
  const r2 = match(f.op2, f.val2)
  return f.join === 'OR' ? r1 || r2 : r1 && r2
}

export default function SalesPage() {
  const { profile, role, isManager, isSuperAdmin } = useAuth()
  const navigate = useNavigate()
  const isSalesAgent = role === 'sales_agent'

  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [globalSearch, setGlobalSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [filterOpen, setFilterOpen] = useState(null)
  const [sortCol, setSortCol] = useState('meeting_date')
  const [sortDir, setSortDir] = useState('asc')
  const [callingMode, setCallingMode] = useState(() => isSalesCallingModeActive())
  const [callingType, setCallingType] = useState(() => getSalesCallingModeType())
  const [queueLoading, setQueueLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  const today = format(new Date(), 'yyyy-MM-dd')

  async function load() {
    setLoading(true)
    let q = supabase
      .from('leads')
      .select(`
        id, name, phone, city, stage, lead_source,
        meeting_date, meeting_slot, meeting_status, sales_meeting_status,
        sales_outcome, sales_lead_status, sales_followup_date,
        sales_quoted_amount, sales_remarks,
        property_type, ownership, roof_type, roof_area,
        sanctioned_load, monthly_bill, units_per_month,
        electricity_board, system_size_kw, system_type,
        assigned_to,
        presales_agent_id, presales_agent:presales_agent_id(name),
        sales_agent_id, sales_agent:sales_agent_id(name),
        updated_at
      `)
      .eq('stage', 'meeting_scheduled')
      .order('meeting_date', { ascending: true })

    // Role based filtering
    if (isSalesAgent) {
      q = q.eq('sales_agent_id', profile.id)
    } else if (role === 'sales_manager') {
      // Manager sees all — no extra filter
    }
    // super_admin sees all — no filter

    const { data } = await q
    setLeads((data ?? []).map(l => ({
      ...l,
      presales_name: l.presales_agent?.name ?? '',
      sales_name: l.sales_agent?.name ?? '',
      phone_clean: cleanPhone(l.phone),
    })))
    setLoading(false)
  }

  useEffect(() => { load() }, [role])

  // ── Start Calling ─────────────────────────────────────────
  async function handleStartCalling() {
    setQueueLoading(true)
    const queue = await getSalesCallingQueue(profile.id)
    if (queue.length === 0) {
      alert('Abhi koi meeting/lead available nahi hai calling ke liye!')
      setQueueLoading(false)
      return
    }
    await assignSalesLeadIfUnassigned(queue[0].id, profile.id)
    sessionStorage.setItem('salesCallingMode', 'true')
    sessionStorage.setItem('salesCallingType', 'calling')
    sessionStorage.setItem('salesCallingQueue', JSON.stringify(queue))
    sessionStorage.setItem('salesCallingIndex', '0')
    setCallingMode(true)
    setCallingType('calling')
    setQueueLoading(false)
    navigate(`/leads/${queue[0].id}`)
  }

  // ── Start Follow Up ───────────────────────────────────────
  async function handleStartFollowUp() {
    setQueueLoading(true)
    const queue = await getSalesFollowUpQueue(profile.id)
    if (queue.length === 0) {
      alert('Abhi koi follow up due nahi hai!')
      setQueueLoading(false)
      return
    }
    sessionStorage.setItem('salesCallingMode', 'true')
    sessionStorage.setItem('salesCallingType', 'followup')
    sessionStorage.setItem('salesCallingQueue', JSON.stringify(queue))
    sessionStorage.setItem('salesCallingIndex', '0')
    setCallingMode(true)
    setCallingType('followup')
    setQueueLoading(false)
    navigate(`/leads/${queue[0].id}`)
  }

  // ── Stop ──────────────────────────────────────────────────
  function handleStop() {
    stopSalesCallingMode()
    setCallingMode(false)
  }

  // Global search
  const filtered = leads.filter(lead => {
    if (globalSearch) {
      const s = globalSearch.toLowerCase()
      const p = cleanPhone(globalSearch)
      if (
        !lead.name?.toLowerCase().includes(s) &&
        !lead.phone_clean?.includes(p) &&
        !lead.city?.toLowerCase().includes(s)
      ) return false
    }
    for (const [col, f] of Object.entries(filters)) {
      if (!applyFilter(lead[col], f)) return false
    }
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (!sortCol) return 0
    const av = String(a[sortCol] ?? '').toLowerCase()
    const bv = String(b[sortCol] ?? '').toLowerCase()
    return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
  })

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const activeFilters = Object.keys(filters).length
  const visibleCols = COLS.filter(c => c.key !== '_select' || isManager || isSuperAdmin)
  const G_SPANS = G_LABELS.map((_, i) => visibleCols.filter(c => c.g === i).length)
  const totalW = visibleCols.reduce((s, c) => s + c.w, 0)

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === sorted.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(sorted.map(l => l.id)))
    }
  }

  // Quick stats
  const todayMtg = leads.filter(l => l.meeting_date === today).length
  const pendingOutcome = leads.filter(l => {
    if (l.sales_meeting_status && l.sales_meeting_status !== 'scheduled') {
      return l.sales_meeting_status === 'pending_outcome'
    }
    if (!l.meeting_date || !l.meeting_slot) return false
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const now = new Date()
    if (l.meeting_date < todayStr) return true  // past meeting, no outcome
    if (l.meeting_date === todayStr) {
      try {
        const slotEnd = new Date(`${l.meeting_date} ${l.meeting_slot.split(' - ')[1]}`)
        return now > slotEnd
      } catch { return false }
    }
    return false
  }).length
  const hotLeads = leads.filter(l => l.sales_outcome === 'meeting_done_hot').length
  const ordersClosed = leads.filter(l => l.sales_outcome === 'meeting_done_order_closed').length

  return (
    <Layout>
      <PageHeader
        title="Sales — meetings & leads"
        subtitle={`${sorted.length} of ${leads.length} leads`}
      >
        <button onClick={load} className="btn"><RefreshCw size={13} /></button>

        {isSalesAgent && (
          callingMode ? (
            <button onClick={handleStop}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer border-0"
              style={{ background: '#dc2626', color: '#fff' }}>
              <PhoneOff size={13} /> Stop {callingType === 'followup' ? 'Follow Up' : 'Calling'}
            </button>
          ) : (
            <>
              <button onClick={handleStartCalling} disabled={queueLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer border-0 disabled:opacity-60"
                style={{ background: '#16a34a', color: '#fff' }}>
                {queueLoading
                  ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Loading...</>
                  : <><Phone size={13} /> Start Calling</>
                }
              </button>
              <button onClick={handleStartFollowUp} disabled={queueLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer border-0 disabled:opacity-60"
                style={{ background: '#7c3aed', color: '#fff' }}>
                {queueLoading
                  ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Loading...</>
                  : <><TrendingUp size={13} /> Start Follow Up</>
                }
              </button>
            </>
          )
        )}
      </PageHeader>

      {/* Calling mode banner */}
      {callingMode && (
        <div className="mb-3 px-4 py-2.5 rounded-xl flex items-center gap-3"
          style={callingType === 'followup'
            ? { background: '#ede9fe', border: '1px solid #c4b5fd' }
            : { background: '#dcfce7', border: '1px solid #86efac' }}>
          <div className={`w-2 h-2 rounded-full animate-pulse flex-shrink-0 ${callingType === 'followup' ? 'bg-purple-500' : 'bg-green-500'}`} />
          <span className={`text-sm font-medium ${callingType === 'followup' ? 'text-purple-800' : 'text-green-800'}`}>
            {callingType === 'followup' ? '📈 Follow Up mode active' : '📞 Calling mode active'}
            {' — '}outcome save karne ke baad next lead automatically open hogi
          </span>
          <button onClick={handleStop}
            className="ml-auto text-xs font-semibold text-red-600 hover:text-red-800 flex items-center gap-1">
            <PhoneOff size={12} /> Stop
          </button>
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="metric-card">
          <span className="text-xs text-slate-500">Meetings today</span>
          <span className="text-2xl font-semibold text-blue-600">{todayMtg}</span>
        </div>
        <div className="metric-card">
          <span className="text-xs text-slate-500">Outcome pending</span>
          <span className={`text-2xl font-semibold ${pendingOutcome > 0 ? 'text-amber-500' : 'text-slate-800'}`}>
            {pendingOutcome}
          </span>
        </div>
        <div className="metric-card">
          <span className="text-xs text-slate-500">HOT leads 🔥</span>
          <span className="text-2xl font-semibold text-orange-500">{hotLeads}</span>
        </div>
        <div className="metric-card">
          <span className="text-xs text-slate-500">Orders closed 🎉</span>
          <span className="text-2xl font-semibold text-green-600">{ordersClosed}</span>
        </div>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="relative min-w-[220px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-8 pr-8" placeholder="Search name, phone, city..."
            value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} />
          {globalSearch && (
            <button onClick={() => setGlobalSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
              <X size={13} />
            </button>
          )}
        </div>
        {activeFilters > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
            <Filter size={11} className="text-blue-500" />
            <span className="text-xs text-blue-700 font-medium">{activeFilters} filter{activeFilters > 1 ? 's' : ''}</span>
            <button onClick={() => setFilters({})} className="text-blue-400 hover:text-blue-600 ml-1"><X size={11} /></button>
          </div>
        )}
        <span className="text-xs text-slate-400 ml-auto">{sorted.length} results</span>
      </div>

      {/* Bulk action bar */}
      {(isManager || isSuperAdmin) && selectedIds.size > 0 && (
        <div className="mb-3 px-4 py-2.5 rounded-xl flex items-center gap-3"
          style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <span className="text-sm font-semibold text-blue-800">{selectedIds.size} lead{selectedIds.size > 1 ? 's' : ''} selected</span>
          <button onClick={() => setShowBulkEdit(true)}
            className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700">
            Bulk Edit
          </button>
          <button onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs text-blue-500 hover:text-blue-700">
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      <div className="card p-0 rounded-xl border border-slate-200" style={{ overflowX: 'auto' }}>
        <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
          <table style={{ minWidth: totalW, width: '100%', borderCollapse: 'collapse' }}>
            <thead className="sticky top-0 z-10">
              {/* Group headers */}
              <tr>
                {G_LABELS.map((label, i) => (
                  <th key={label} colSpan={G_SPANS[i]}
                    style={{ background: G_COLORS[i] }}
                    className="px-3 py-1.5 text-center text-xs font-bold text-white tracking-wide border-r-2 border-white/30 last:border-0">
                    {label}
                  </th>
                ))}
              </tr>
              {/* Column headers */}
              <tr className="bg-slate-50 border-b border-slate-200">
                {visibleCols.map(col => (
                  <th key={col.key}
                    style={{ width: col.w, minWidth: col.w, borderTop: `2px solid ${G_COLORS[col.g]}` }}
                    className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap relative group bg-slate-50">
                    {col.key === '_select' ? (
                      (isManager || isSuperAdmin) ? (
                        <input type="checkbox"
                          checked={sorted.length > 0 && selectedIds.size === sorted.length}
                          onChange={toggleSelectAll}
                          className="w-3.5 h-3.5 rounded cursor-pointer accent-blue-600" />
                      ) : null
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className={col.sortable ? 'cursor-pointer hover:text-slate-800 select-none' : ''}
                          onClick={() => col.sortable && toggleSort(col.key)}>
                          {col.label}
                          {sortCol === col.key && (
                            <span style={{ color: G_COLORS[col.g] }}>{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>
                          )}
                        </span>
                        <button onClick={() => setFilterOpen(filterOpen === col.key ? null : col.key)}
                          className={`ml-auto p-0.5 rounded flex-shrink-0 transition-colors ${filters[col.key] ? 'text-blue-500' : 'text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100'}`}>
                          <Filter size={10} />
                        </button>
                      </div>
                    )}
                    {filterOpen === col.key && (
                      <ColFilterPopup col={col}
                        value={filters[col.key]}
                        onApply={f => { setFilters(p => ({ ...p, [col.key]: f })); setFilterOpen(null) }}
                        onClear={() => { setFilters(p => { const n = { ...p }; delete n[col.key]; return n }); setFilterOpen(null) }}
                        onClose={() => setFilterOpen(null)} />
                    )}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr><td colSpan={visibleCols.length} className="py-16 text-center"><Spinner size={20} /></td></tr>
              ) : sorted.length === 0 ? (
                <tr><td colSpan={visibleCols.length} className="py-16 text-center text-sm text-slate-400">No leads found</td></tr>
              ) : sorted.map(lead => {
                const isToday = lead.meeting_date === today
                const isPast = lead.meeting_date < today
                const outcomeStyle = getOutcomeStyle(lead.sales_outcome)
                const statusStyle = lead.sales_lead_status ? getLeadStatusStyle(lead.sales_lead_status) : null
                const mtgStyle = lead.sales_meeting_status ? getMtgStatusStyle(lead.sales_meeting_status) : null

                return (
                  <tr key={lead.id}
                    className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer ${selectedIds.has(lead.id) ? 'bg-blue-50/40' : isToday ? 'bg-blue-50/30' : isPast && !lead.sales_outcome ? 'bg-amber-50/30' : ''}`}
                    onClick={() => navigate(`/leads/${lead.id}`)}>

                    {/* Checkbox */}
                    {(isManager || isSuperAdmin) && (
                      <td className="px-3 py-2.5" style={{ width: 36, minWidth: 36 }}
                        onClick={e => e.stopPropagation()}>
                        <input type="checkbox"
                          checked={selectedIds.has(lead.id)}
                          onClick={e => e.stopPropagation()}
                          onChange={e => { e.stopPropagation(); toggleSelect(lead.id) }}
                          className="w-3.5 h-3.5 rounded cursor-pointer accent-blue-600" />
                      </td>
                    )}

                    {/* g:0 Lead Info */}
                    <td className="px-3 py-2.5" style={{ width: 180, minWidth: 180 }}>
                      <div className="font-medium text-slate-800 text-sm truncate">{lead.name ?? '—'}</div>
                      <div className="text-xs text-slate-400">{formatPhone(lead.phone)}</div>
                    </td>
                    <td className="px-3 py-2.5" style={{ width: 90, minWidth: 90 }}>
                      <span className="text-xs text-slate-600">{lead.city ?? '—'}</span>
                    </td>
                    <td className="px-3 py-2.5" style={{ width: 110, minWidth: 110 }}>
                      <span className="text-xs text-slate-500 truncate block">{lead.lead_source ?? '—'}</span>
                    </td>
                    <td className="px-3 py-2.5" style={{ width: 100, minWidth: 100 }}>
                      <span className="text-xs text-slate-500">{lead.presales_name?.split(' ')[0] ?? '—'}</span>
                    </td>

                    {/* g:1 Sales */}
                    <td className="px-3 py-2.5" style={{ width: 100, minWidth: 100 }}>
                      <span className="text-xs text-slate-600 font-medium">{lead.sales_name?.split(' ')[0] ?? '—'}</span>
                    </td>
                    <td className="px-3 py-2.5" style={{ width: 110, minWidth: 110 }}>
                      {lead.meeting_date ? (
                        <div>
                          <span className={`text-xs font-semibold ${isToday ? 'text-blue-600' : isPast ? 'text-amber-600' : 'text-slate-600'
                            }`}>
                            {isToday ? 'Today' : format(new Date(lead.meeting_date), 'd MMM')}
                          </span>
                        </div>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5" style={{ width: 130, minWidth: 130 }}>
                      <span className="text-xs text-slate-500">{lead.meeting_slot ?? '—'}</span>
                    </td>
                    <td className="px-3 py-2.5" style={{ width: 120, minWidth: 120 }}>
                      {lead.sales_meeting_status ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border"
                          style={{ background: mtgStyle?.bg, color: mtgStyle?.text, borderColor: mtgStyle?.border }}>
                          {getMtgStatusLabel(lead.sales_meeting_status)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                          Scheduled
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5" style={{ width: 200, minWidth: 200 }}>
                      {lead.sales_outcome ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border"
                          style={{ background: outcomeStyle?.bg, color: outcomeStyle?.text, borderColor: outcomeStyle?.border }}>
                          {OUTCOME_LABELS[lead.sales_outcome] || lead.sales_outcome}
                        </span>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5" style={{ width: 100, minWidth: 100 }}>
                      {lead.sales_lead_status ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize"
                          style={{ background: statusStyle?.bg, color: statusStyle?.text, borderColor: statusStyle?.border }}>
                          {lead.sales_lead_status.replace('_', ' ')}
                        </span>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5" style={{ width: 100, minWidth: 100 }}>
                      {lead.sales_followup_date ? (
                        <div>
                          <span className={`text-xs font-medium ${lead.sales_followup_date === today ? 'text-blue-600' :
                            lead.sales_followup_date < today ? 'text-amber-600' : 'text-slate-500'
                            }`}>
                            {lead.sales_followup_date === today ? 'Today' : format(new Date(lead.sales_followup_date), 'd MMM')}
                          </span>
                        </div>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5" style={{ width: 100, minWidth: 100 }}>
                      {lead.sales_quoted_amount ? (
                        <span className="text-xs font-semibold text-green-700">
                          ₹{Number(lead.sales_quoted_amount).toLocaleString('en-IN')}
                        </span>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>

                    {/* g:2 Property Details */}
                    <td className="px-3 py-2.5" style={{ width: 110, minWidth: 110 }}>
                      <span className="text-xs text-slate-600">{lead.property_type ?? '—'}</span>
                    </td>
                    <td className="px-3 py-2.5" style={{ width: 110, minWidth: 110 }}>
                      <span className="text-xs text-slate-600">{lead.ownership ?? '—'}</span>
                    </td>
                    <td className="px-3 py-2.5" style={{ width: 130, minWidth: 130 }}>
                      <span className="text-xs text-slate-600">{lead.roof_type ?? '—'}</span>
                    </td>
                    <td className="px-3 py-2.5" style={{ width: 90, minWidth: 90 }}>
                      <span className="text-xs text-slate-600">{lead.roof_area ? `${lead.roof_area} sqft` : '—'}</span>
                    </td>
                    <td className="px-3 py-2.5" style={{ width: 80, minWidth: 80 }}>
                      <span className="text-xs text-slate-600">{lead.sanctioned_load ? `${lead.sanctioned_load} kW` : '—'}</span>
                    </td>
                    <td className="px-3 py-2.5" style={{ width: 80, minWidth: 80 }}>
                      <span className="text-xs text-slate-600">{lead.monthly_bill ? `₹${lead.monthly_bill}` : '—'}</span>
                    </td>
                    <td className="px-3 py-2.5" style={{ width: 80, minWidth: 80 }}>
                      <span className="text-xs text-slate-600">{lead.units_per_month ? `${lead.units_per_month}` : '—'}</span>
                    </td>
                    <td className="px-3 py-2.5" style={{ width: 100, minWidth: 100 }}>
                      <span className="text-xs text-slate-600">{lead.electricity_board ?? '—'}</span>
                    </td>
                    <td className="px-3 py-2.5" style={{ width: 90, minWidth: 90 }}>
                      <span className="text-xs text-slate-600">{lead.system_size_kw ? `${lead.system_size_kw} kW` : '—'}</span>
                    </td>
                    <td className="px-3 py-2.5" style={{ width: 100, minWidth: 100 }}>
                      <span className="text-xs text-slate-600">{lead.system_type ?? '—'}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <SalesBulkEditModal
        open={showBulkEdit}
        onClose={() => setShowBulkEdit(false)}
        selectedIds={[...selectedIds]}
        onDone={() => {
          setShowBulkEdit(false)
          setSelectedIds(new Set())
          load()
        }}
      />
    </Layout>
  )
}

// ── Sales Bulk Edit Modal ─────────────────────────────────────
function SalesBulkEditModal({ open, onClose, selectedIds, onDone }) {
  const [agents, setAgents] = useState([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    sales_agent_id: '',
    meeting_date: '',
    meeting_slot: '',
    sales_outcome: '',
    sales_lead_status: '',
    sales_followup_date: '',
    sales_followup_slot: '',
  })

  const TIME_SLOTS = [
    '9:00 AM - 10:00 AM', '10:00 AM - 11:00 AM', '11:00 AM - 12:00 PM',
    '12:00 PM - 1:00 PM', '1:00 PM - 2:00 PM', '2:00 PM - 3:00 PM',
    '3:00 PM - 4:00 PM', '4:00 PM - 5:00 PM', '5:00 PM - 6:00 PM', '6:00 PM - 7:00 PM',
  ]

  const OUTCOMES = [
    { value: 'call_not_connected_1', label: 'Not Connected - 1st' },
    { value: 'call_not_connected_2', label: 'Not Connected - 2nd' },
    { value: 'call_not_connected_3', label: 'Not Connected - 3rd' },
    { value: 'call_later_interested', label: 'Call Later (Interested)' },
    { value: 'call_later_underconstruction', label: 'Call Later (UC)' },
    { value: 'meeting_rescheduled', label: 'Meeting Rescheduled' },
    { value: 'meeting_done_hot', label: 'HOT 🔥' },
    { value: 'meeting_done_moderate', label: 'MODERATE 🌡️' },
    { value: 'meeting_done_cold', label: 'COLD ❄️' },
    { value: 'meeting_done_order_closed', label: 'ORDER CLOSED 🎉' },
    { value: 'not_interested', label: 'Not Interested' },
    { value: 'non_qualified_roof', label: 'NQ - Roof' },
    { value: 'non_qualified_bill', label: 'NQ - Bill' },
  ]

  useEffect(() => {
    if (open) {
      supabase.from('users').select('id, name')
        .eq('role', 'sales_agent').eq('is_active', true).order('name')
        .then(({ data }) => setAgents(data ?? []))
      setForm({ sales_agent_id: '', meeting_date: '', meeting_slot: '', sales_outcome: '', sales_lead_status: '', sales_followup_date: '', sales_followup_slot: '' })
    }
  }, [open])

  function set(f, v) { setForm(p => ({ ...p, [f]: v })) }

  async function handleSave() {
    setSaving(true)
    const updates = {}
    if (form.sales_agent_id) { updates.sales_agent_id = form.sales_agent_id; updates.assigned_to = form.sales_agent_id }
    if (form.meeting_date) updates.meeting_date = form.meeting_date
    if (form.meeting_slot) updates.meeting_slot = form.meeting_slot
    if (form.sales_outcome) updates.sales_outcome = form.sales_outcome
    if (form.sales_lead_status) updates.sales_lead_status = form.sales_lead_status
    if (form.sales_followup_date) updates.sales_followup_date = form.sales_followup_date
    if (form.sales_followup_slot) updates.sales_followup_slot = form.sales_followup_slot

    if (Object.keys(updates).length === 0) {
      alert('Koi bhi field fill nahi ki!')
      setSaving(false)
      return
    }

    const { error } = await supabase.from('leads').update(updates).in('id', selectedIds)
    if (error) { alert('Error: ' + error.message) }
    else { onDone() }
    setSaving(false)
  }

  return (
    <Modal open={open} onClose={onClose} title={`Bulk edit — ${selectedIds.length} leads`} width={500}>
      <p className="text-xs text-slate-500 mb-4">
        Sirf jo fields fill karoge wahi update hongi. Baaki unchanged rahenge.
      </p>
      <div className="flex flex-col gap-4">
        <div>
          <label className="label">Sales agent change karo</label>
          <select className="select" value={form.sales_agent_id} onChange={e => set('sales_agent_id', e.target.value)}>
            <option value="">— No change —</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Meeting date</label>
            <input type="date" className="input" value={form.meeting_date} onChange={e => set('meeting_date', e.target.value)} />
          </div>
          <div>
            <label className="label">Meeting slot</label>
            <select className="select" value={form.meeting_slot} onChange={e => set('meeting_slot', e.target.value)}>
              <option value="">— No change —</option>
              {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Follow up date</label>
            <input type="date" className="input" value={form.sales_followup_date} onChange={e => set('sales_followup_date', e.target.value)} />
          </div>
          <div>
            <label className="label">Follow up slot</label>
            <select className="select" value={form.sales_followup_slot} onChange={e => set('sales_followup_slot', e.target.value)}>
              <option value="">— No change —</option>
              {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Sales outcome</label>
          <select className="select" value={form.sales_outcome} onChange={e => set('sales_outcome', e.target.value)}>
            <option value="">— No change —</option>
            {OUTCOMES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Lead status</label>
          <select className="select" value={form.sales_lead_status} onChange={e => set('sales_lead_status', e.target.value)}>
            <option value="">— No change —</option>
            <option value="pending">Pending</option>
            <option value="follow_up">Follow Up</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 mt-5 pt-4 border-t border-slate-100">
        <button onClick={onClose} className="btn flex-1 justify-center">Cancel</button>
        <button onClick={handleSave} disabled={saving}
          className="btn-primary flex-1 justify-center disabled:opacity-50">
          {saving ? 'Saving...' : `Update ${selectedIds.length} leads`}
        </button>
      </div>
    </Modal>
  )
}

// ── Column filter popup ───────────────────────────────────────
function ColFilterPopup({ col, value, onApply, onClear, onClose }) {
  const [op, setOp] = useState(value?.op ?? 'contains')
  const [val, setVal] = useState(value?.val ?? '')
  const [op2, setOp2] = useState(value?.op2 ?? 'contains')
  const [val2, setVal2] = useState(value?.val2 ?? '')
  const [join, setJoin] = useState(value?.join ?? 'AND')
  const [fromDate, setFromDate] = useState(value?.from ?? '')
  const [toDate, setToDate] = useState(value?.to ?? '')
  const noInput = o => o === 'blank' || o === 'not_blank'

  useEffect(() => {
    function handle(e) { if (!e.target.closest('[data-fp]')) onClose() }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // Date column — show calendar UI
  if (col.isDate) {
    return (
      <div data-fp
        className="absolute top-full right-0 z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-3 min-w-[220px] mt-1"
        onClick={e => e.stopPropagation()}>
        <div className="text-xs font-semibold text-slate-600 mb-3">{col.label} filter</div>
        <div className="flex flex-col gap-2 mb-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">From</label>
            <input type="date" autoFocus
              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
              value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">To</label>
            <input type="date"
              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
              value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClear} className="flex-1 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50">Clear</button>
          <button onClick={() => onApply({ isDate: true, from: fromDate, to: toDate })}
            disabled={!fromDate && !toDate}
            className="flex-1 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40">
            Apply
          </button>
        </div>
      </div>
    )
  }

  return (
    <div data-fp
      className="absolute top-full right-0 z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-3 min-w-[240px] mt-1"
      onClick={e => e.stopPropagation()}>
      <div className="text-xs font-semibold text-slate-600 mb-2">{col.label}</div>
      <select className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 mb-1.5 bg-white focus:outline-none"
        value={op} onChange={e => setOp(e.target.value)}>
        {OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {!noInput(op) && (
        <input autoFocus
          className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 mb-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="Value..." value={val} onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onApply({ op, val, op2, val2, join })} />
      )}
      <div className="flex rounded-lg border border-slate-200 overflow-hidden mb-2">
        {['AND', 'OR'].map(j => (
          <button key={j} onClick={() => setJoin(j)}
            className={`flex-1 py-1 text-xs font-semibold ${join === j ? 'bg-slate-800 text-white' : 'bg-white text-slate-400'}`}>
            {j}
          </button>
        ))}
      </div>
      <select className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 mb-1.5 bg-white focus:outline-none"
        value={op2} onChange={e => setOp2(e.target.value)}>
        {OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {!noInput(op2) && (
        <input
          className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 mb-3 focus:outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="Value..." value={val2} onChange={e => setVal2(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onApply({ op, val, op2, val2, join })} />
      )}
      <div className="flex gap-2">
        <button onClick={onClear} className="flex-1 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50">Clear</button>
        <button onClick={() => onApply({ op, val, op2, val2, join })}
          className="flex-1 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">Apply</button>
      </div>
    </div>
  )
}