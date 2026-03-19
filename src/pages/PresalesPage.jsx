import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import Layout from '@/components/layout/Layout'
import { PageHeader, DispBadge, StageBadge, Spinner, Modal } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { createLead } from '@/lib/leadService'
import { autoAssignLead, assignLeadToCurrentUser, getCallingQueue } from '@/lib/assignment'
import { formatPhone, cleanPhone } from '@/lib/phone'
import { format } from 'date-fns'
import { Plus, RefreshCw, Search, X, Filter, Phone, PhoneOff } from 'lucide-react'

// ── Column definitions ────────────────────────────────────────
const COLS = [
  { key: 'name', label: 'Name / Phone', w: 180, sortable: true, g: 0 },
  { key: 'city', label: 'City', w: 90, sortable: true, g: 0 },
  { key: 'lead_source', label: 'Source', w: 110, sortable: true, g: 0 },
  { key: 'assigned_name', label: 'PS agent', w: 90, sortable: true, g: 1 },
  { key: 'call_status', label: 'Status', w: 100, sortable: true, g: 1 },
  { key: 'disposition', label: 'Disposition', w: 210, sortable: true, g: 1 },
  { key: 'calling_date', label: 'Called date', w: 90, sortable: true, g: 1 },
  { key: 'callback_date', label: 'Callback', w: 100, sortable: true, g: 1 },
  { key: 'sales_outcome', label: 'Sales outcome', w: 140, sortable: true, g: 2 },
  { key: 'meeting_date', label: 'Meeting date', w: 105, sortable: true, g: 2 },
  { key: 'sales_agent_name', label: 'Sales agent', w: 100, sortable: true, g: 2 },
]

const G_COLORS = ['#1e40af', '#7c3aed', '#065f46']
const G_LABELS = ['Lead info', 'Pre-sales', 'Sales']

const OPS = [
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does not contain' },
  { value: 'equals', label: 'Equals' },
  { value: 'starts_with', label: 'Starts with' },
  { value: 'blank', label: 'Is blank' },
  { value: 'not_blank', label: 'Is not blank' },
]

// ── Sales outcome helpers ─────────────────────────────────────
const SALES_OUTCOME_LABELS = {
  call_not_connected_1: 'Not Conn. 1',
  call_not_connected_2: 'Not Conn. 2',
  call_not_connected_3: 'Not Conn. 3',
  invalid_number: 'Invalid',
  call_later_interested: 'Call Later',
  meeting_rescheduled: 'Rescheduled 📅',
  call_later_underconstruction: 'Under Const.',
  non_qualified_roof: 'NQ - Roof',
  non_qualified_bill: 'NQ - Bill',
  non_qualified_ownership: 'NQ - Ownership',
  non_qualified_not_govt_meter: 'NQ - Meter',
  non_qualified_no_connection: 'NQ - No Conn.',
  not_serviceable_offgrid: 'Not Serviceable',
  not_serviceable_location: 'Not Serviceable',
  not_interested: 'Not Interested',
  solarpro_enquiry: 'SolarPro',
  meeting_done_hot: 'HOT 🔥',
  meeting_done_moderate: 'MODERATE 🌡️',
  meeting_done_cold: 'COLD ❄️',
  meeting_done_order_closed: 'ORDER CLOSED 🎉',
}

function getSalesOutcomeStyle(o) {
  if (!o) return {}
  if (o.includes('order_closed')) return { background: '#dcfce7', color: '#14532d', borderColor: '#86efac' }
  if (o.includes('hot')) return { background: '#fef3c7', color: '#92400e', borderColor: '#fcd34d' }
  if (o.includes('moderate')) return { background: '#dbeafe', color: '#1e3a8a', borderColor: '#93c5fd' }
  if (o.includes('cold')) return { background: '#ede9fe', color: '#4c1d95', borderColor: '#c4b5fd' }
  if (o === 'meeting_rescheduled') return { background: '#f3e8ff', color: '#6b21a8', borderColor: '#d8b4fe' }
  if (o.includes('not_interested') || o.includes('non_qualified') || o.includes('not_serviceable'))
    return { background: '#fee2e2', color: '#7f1d1d', borderColor: '#fca5a5' }
  if (o.includes('call_later')) return { background: '#dbeafe', color: '#1e3a8a', borderColor: '#93c5fd' }
  if (o.includes('not_connected') || o.includes('invalid'))
    return { background: '#fef9c3', color: '#713f12', borderColor: '#fde047' }
  return { background: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1' }
}

// ── Calling mode helpers (sessionStorage) ────────────────────
export function isCallingModeActive() {
  return sessionStorage.getItem('callingMode') === 'true'
}
export function getCallingQueueFromSession() {
  try { return JSON.parse(sessionStorage.getItem('callingQueue') ?? '[]') } catch { return [] }
}
export function getCallingIndexFromSession() {
  return parseInt(sessionStorage.getItem('callingIndex') ?? '0', 10)
}
export function setCallingIndex(idx) {
  sessionStorage.setItem('callingIndex', String(idx))
}
export function stopCallingMode() {
  sessionStorage.removeItem('callingMode')
  sessionStorage.removeItem('callingQueue')
  sessionStorage.removeItem('callingIndex')
}

function applyFilter(cellVal, f) {
  if (!f) return true
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

export default function PresalesPage() {
  const { profile, isManager, isSuperAdmin } = useAuth()
  const navigate = useNavigate()
  const isAgent = !isManager && !isSuperAdmin

  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [globalSearch, setGlobalSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [filterOpen, setFilterOpen] = useState(null)
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [callingMode, setCallingMode] = useState(() => isCallingModeActive())
  const [queueLoading, setQueueLoading] = useState(false)

  const today = format(new Date(), 'yyyy-MM-dd')

  async function load() {
    setLoading(true)
    let q = supabase
      .from('leads')
      .select(`id, name, phone, city, stage, call_status, disposition,
        calling_date, callback_date, callback_slot,
        meeting_date, meeting_slot, lead_source,
        sales_outcome, sales_lead_status,
        assigned_to, assigned_user:assigned_to(name),
        sales_agent_id, sales_agent:sales_agent_id(name),
        updated_at`)
      .in('stage', ['new', 'meeting_scheduled', 'qc_followup'])
      .order('updated_at', { ascending: false })
    if (!isManager && !isSuperAdmin) q = q.eq('assigned_to', profile.id)
    const { data } = await q
    setLeads((data ?? []).map(l => ({
      ...l,
      assigned_name: l.assigned_user?.name ?? '',
      sales_agent_name: l.sales_agent?.name ?? '',
      phone_clean: cleanPhone(l.phone),
    })))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // ── Start Calling ─────────────────────────────────────────
  async function handleStartCalling() {
    setQueueLoading(true)
    const queue = await getCallingQueue(profile.id)
    if (queue.length === 0) {
      alert('Abhi koi lead available nahi hai calling ke liye!')
      setQueueLoading(false)
      return
    }
    sessionStorage.setItem('callingMode', 'true')
    sessionStorage.setItem('callingQueue', JSON.stringify(queue))
    sessionStorage.setItem('callingIndex', '0')
    setCallingMode(true)
    setQueueLoading(false)
    navigate(`/leads/${queue[0].id}`)
  }

  // ── Stop Calling ──────────────────────────────────────────
  function handleStopCalling() {
    stopCallingMode()
    setCallingMode(false)
  }

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
  const G_SPANS = G_LABELS.map((_, i) => COLS.filter(c => c.g === i).length)
  const totalW = COLS.reduce((s, c) => s + c.w, 0)

  return (
    <Layout>
      <PageHeader title="Pre-sales — calling dashboard" subtitle={`${sorted.length} of ${leads.length} leads`}>
        <button onClick={load} className="btn"><RefreshCw size={13} /></button>

        {/* Start / Stop Calling — sirf agent ko */}
        {isAgent && (
          callingMode ? (
            <button onClick={handleStopCalling}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer border-0"
              style={{ background: '#dc2626', color: '#fff' }}>
              <PhoneOff size={13} /> Stop Calling
            </button>
          ) : (
            <button onClick={handleStartCalling} disabled={queueLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer border-0 disabled:opacity-60"
              style={{ background: '#16a34a', color: '#fff' }}>
              {queueLoading
                ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Loading...</>
                : <><Phone size={13} /> Start Calling</>
              }
            </button>
          )
        )}

        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus size={13} /> Add lead
        </button>
      </PageHeader>

      {/* Calling mode active banner */}
      {callingMode && (
        <div className="mb-3 px-4 py-2.5 rounded-xl flex items-center gap-3"
          style={{ background: '#dcfce7', border: '1px solid #86efac' }}>
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
          <span className="text-sm font-medium text-green-800">
            Calling mode active — disposition save karne ke baad next lead automatically open hogi
          </span>
          <button onClick={handleStopCalling}
            className="ml-auto text-xs font-semibold text-red-600 hover:text-red-800 flex items-center gap-1">
            <PhoneOff size={12} /> Stop
          </button>
        </div>
      )}

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

      {/* Table */}
      <div className="card p-0 rounded-xl border border-slate-200" style={{ overflowX: 'auto' }}>
        <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 230px)' }}>
          <table style={{ minWidth: totalW, width: '100%', borderCollapse: 'collapse' }}>
            <thead className="sticky top-0 z-10">
              <tr>
                {G_LABELS.map((label, i) => (
                  <th key={label} colSpan={G_SPANS[i]}
                    style={{ background: G_COLORS[i] }}
                    className="px-3 py-1.5 text-center text-xs font-bold text-white tracking-wide border-r-2 border-white/30 last:border-0">
                    {label}
                  </th>
                ))}
              </tr>
              <tr className="bg-slate-50 border-b border-slate-200">
                {COLS.map(col => (
                  <th key={col.key}
                    style={{ width: col.w, minWidth: col.w, borderTop: `2px solid ${G_COLORS[col.g]}` }}
                    className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap relative group bg-slate-50">
                    <div className="flex items-center gap-1">
                      <span className={col.sortable ? 'cursor-pointer hover:text-slate-800 select-none' : ''}
                        onClick={() => col.sortable && toggleSort(col.key)}>
                        {col.label}
                        {sortCol === col.key && (
                          <span style={{ color: G_COLORS[col.g] }}>{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>
                        )}
                      </span>
                      <button onClick={() => setFilterOpen(filterOpen === col.key ? null : col.key)}
                        className={`ml-auto p-0.5 rounded flex-shrink-0 transition-colors ${filters[col.key] ? 'text-blue-500' : 'text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100'
                          }`}>
                        <Filter size={10} />
                      </button>
                    </div>
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
                <tr><td colSpan={COLS.length} className="py-16 text-center"><Spinner size={20} /></td></tr>
              ) : sorted.length === 0 ? (
                <tr><td colSpan={COLS.length} className="py-16 text-center text-sm text-slate-400">No leads found</td></tr>
              ) : sorted.map(lead => (
                <tr key={lead.id}
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(`/leads/${lead.id}`)}>

                  {/* Lead info */}
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

                  {/* Pre-sales */}
                  <td className="px-3 py-2.5" style={{ width: 90, minWidth: 90 }}>
                    <span className="text-xs text-slate-500">{lead.assigned_name?.split(' ')[0] ?? '—'}</span>
                  </td>
                  <td className="px-3 py-2.5" style={{ width: 100, minWidth: 100 }}>
                    {lead.call_status ? (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${lead.call_status === 'Connected'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-red-50 text-red-600 border-red-200'
                        }`}>{lead.call_status === 'Connected' ? 'Connected' : 'Not conn.'}</span>
                    ) : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2.5" style={{ width: 210, minWidth: 210 }}>
                    {lead.disposition ? <DispBadge value={lead.disposition} /> : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2.5" style={{ width: 90, minWidth: 90 }}>
                    {lead.calling_date
                      ? <div className="text-xs font-medium text-slate-600">{format(new Date(lead.calling_date), 'd MMM')}</div>
                      : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2.5" style={{ width: 100, minWidth: 100 }}>
                    {lead.callback_date ? (
                      <div>
                        <span className={`text-xs font-medium ${lead.callback_date === today ? 'text-amber-600' : 'text-slate-500'}`}>
                          {lead.callback_date === today ? 'Today' : format(new Date(lead.callback_date), 'd MMM')}
                        </span>
                        {lead.callback_slot && <div className="text-xs text-slate-400">{lead.callback_slot.split(' ')[0]}</div>}
                      </div>
                    ) : <span className="text-slate-300 text-xs">—</span>}
                  </td>

                  {/* Sales */}
                  <td className="px-3 py-2.5" style={{ width: 140, minWidth: 140 }}>
                    {lead.sales_outcome ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full border"
                        style={getSalesOutcomeStyle(lead.sales_outcome)}>
                        {SALES_OUTCOME_LABELS[lead.sales_outcome] ?? lead.sales_outcome}
                      </span>
                    ) : lead.stage === 'meeting_scheduled' ? (
                      <span className="text-xs text-blue-600 font-medium">Mtg scheduled</span>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5" style={{ width: 105, minWidth: 105 }}>
                    {lead.meeting_date ? (
                      <div>
                        <span className={`text-xs font-medium ${lead.meeting_date === today ? 'text-blue-600' : 'text-slate-500'}`}>
                          {lead.meeting_date === today ? 'Today' : format(new Date(lead.meeting_date), 'd MMM')}
                        </span>
                        {lead.meeting_slot && <div className="text-xs text-slate-400">{lead.meeting_slot.split(' ')[0]}</div>}
                      </div>
                    ) : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2.5" style={{ width: 100, minWidth: 100 }}>
                    <span className="text-xs text-slate-500">{lead.sales_agent_name || '—'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AddLeadModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdded={() => { setShowAdd(false); load() }}
        isAgent={isAgent}
        agentId={profile?.id}
        isManager={isManager || isSuperAdmin}
      />
    </Layout>
  )
}

// ── Column filter popup ───────────────────────────────────────
function ColFilterPopup({ col, value, onApply, onClear, onClose }) {
  const [op, setOp] = useState(value?.op ?? 'contains')
  const [val, setVal] = useState(value?.val ?? '')
  const [op2, setOp2] = useState(value?.op2 ?? 'contains')
  const [val2, setVal2] = useState(value?.val2 ?? '')
  const [join, setJoin] = useState(value?.join ?? 'AND')
  const noInput = o => o === 'blank' || o === 'not_blank'

  useEffect(() => {
    function handle(e) { if (!e.target.closest('[data-fp]')) onClose() }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  return (
    <div data-fp className="absolute top-full right-0 z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-3 min-w-[240px] mt-1"
      onClick={e => e.stopPropagation()}>
      <div className="text-xs font-semibold text-slate-600 mb-2">{col.label}</div>
      <select className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 mb-1.5 bg-white focus:outline-none"
        value={op} onChange={e => setOp(e.target.value)}>
        {OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {!noInput(op) && (
        <input autoFocus className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 mb-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
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
        <input className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 mb-3 focus:outline-none focus:ring-1 focus:ring-blue-400"
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

// ── Referral fields component ─────────────────────────────────
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
            set('referral_type', e.target.value)
            set('referral_name', '')
            set('referral_id', '')
          }}>
            <option value="">Select type</option>
            {['Existing Customer', 'Employee', 'SolarPro', 'Others'].map(s =>
              <option key={s} value={s}>{s}</option>
            )}
          </select>
        </div>
        {showNameId && (<>
          <div>
            <label className="label">
              {form.referral_type === 'Existing Customer' ? 'Customer name' : 'Partner name'}
              <span className="text-red-500 ml-0.5">*</span>
            </label>
            <input className="input" placeholder="Full name"
              value={form.referral_name ?? ''} onChange={e => set('referral_name', e.target.value)} />
          </div>
          <div>
            <label className="label">
              {form.referral_type === 'Existing Customer' ? 'Customer ID' : 'Partner ID'}
            </label>
            <input className="input" placeholder="ID / Account number"
              value={form.referral_id ?? ''} onChange={e => set('referral_id', e.target.value)} />
          </div>
        </>)}
        {showNameOnly && (
          <div>
            <label className="label">Name</label>
            <input className="input" placeholder="Referrer ka naam"
              value={form.referral_name ?? ''} onChange={e => set('referral_name', e.target.value)} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Add Lead Modal ────────────────────────────────────────────
function AddLeadModal({ open, onClose, onAdded, isAgent, agentId, isManager }) {
  const [form, setForm] = useState(initialForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dupeLead, setDupeLead] = useState(null)
  const [checkingDupe, setCheckingDupe] = useState(false)
  const [agents, setAgents] = useState([])
  const [selAgent, setSelAgent] = useState('')

  // Load agents for manager
  useEffect(() => {
    if (open && isManager) {
      supabase.from('users').select('id, name').eq('role', 'presales_agent').eq('is_active', true).order('name')
        .then(({ data }) => setAgents(data ?? []))
    }
  }, [open, isManager])

  function set(f, v) { setForm(p => ({ ...p, [f]: v })) }

  function handleClose() {
    onClose(); setDupeLead(null); setError(''); setForm(initialForm()); setSelAgent('')
  }

  async function handlePhoneChange(val) {
    set('phone', val)
    setDupeLead(null); setError('')
    const cleaned = cleanPhone(val)
    if (cleaned.length !== 10) return
    setCheckingDupe(true)
    const { data: existing } = await supabase
      .from('leads')
      .select('id, name, phone, alternate_phone, email, city, pincode, address, lead_source, calling_date, property_type, ownership, roof_type, roof_area, electricity_board, sanctioned_load, monthly_bill, units_per_month, system_size_kw, system_type, referral_type, referral_name, referral_id, remarks, stage, disposition')
      .or(`phone.eq.${cleaned},alternate_phone.eq.${cleaned}`)
      .maybeSingle()
    setCheckingDupe(false)
    if (existing) {
      setDupeLead(existing)
      setForm({
        name: existing.name ?? '',
        phone: val,
        alternate_phone: existing.alternate_phone ?? '',
        email: existing.email ?? '',
        city: existing.city ?? '',
        pincode: existing.pincode ?? '',
        address: existing.address ?? '',
        calling_date: existing.calling_date ?? new Date().toISOString().split('T')[0],
        lead_source: existing.lead_source ?? '',
        remarks: existing.remarks ?? '',
        property_type: existing.property_type ?? '',
        ownership: existing.ownership ?? '',
        roof_type: existing.roof_type ?? '',
        roof_area: existing.roof_area ?? '',
        electricity_board: existing.electricity_board ?? '',
        sanctioned_load: existing.sanctioned_load ?? '',
        monthly_bill: existing.monthly_bill ?? '',
        units_per_month: existing.units_per_month ?? '',
        system_size_kw: existing.system_size_kw ?? '',
        system_type: existing.system_type ?? '',
        referral_type: existing.referral_type ?? '',
        referral_name: existing.referral_name ?? '',
        referral_id: existing.referral_id ?? '',
      })
    }
  }

  async function handleSubmit() {
    if (!form.phone) { setError('Phone number is required'); return }
    if (dupeLead) { setError('Duplicate lead hai — "Edit Lead" button se existing lead edit karo'); return }
    setSaving(true); setError('')
    try {
      const lead = await createLead(form)
      if (isAgent) {
        // Agent ne add kiya — usko hi assign karo
        await assignLeadToCurrentUser(lead.id, agentId)
      } else if (isManager && selAgent) {
        // Manager ne specific agent choose kiya
        await assignLeadToCurrentUser(lead.id, selAgent)
      } else {
        // Manager — round robin
        await autoAssignLead(lead.id)
      }
      onAdded(); setForm(initialForm()); setDupeLead(null); setSelAgent('')
    } catch (e) {
      setError(e.message || 'Error saving lead')
    } finally { setSaving(false) }
  }

  function handleEditExisting() {
    if (dupeLead) window.location.href = `/leads/${dupeLead.id}`
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add new lead" width={640}>
      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}
      <div className="flex flex-col gap-5">

        {/* Contact details */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 pb-1 border-b border-slate-100">Contact details</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Full name</label>
              <input className="input" placeholder="Customer full name"
                value={form.name} onChange={e => set('name', e.target.value)} />
            </div>

            {/* Phone with duplicate check */}
            <div>
              <label className="label">Phone <span className="text-red-500">*</span></label>
              <div className="relative">
                <input
                  className={`input pr-8 ${dupeLead ? 'border-amber-400 bg-amber-50 focus:ring-amber-400' : ''}`}
                  placeholder="10-digit mobile"
                  value={form.phone}
                  onChange={e => handlePhoneChange(e.target.value)}
                />
                {checkingDupe && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              {dupeLead && (
                <div className="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-300">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-amber-800">⚠️ Number already exists!</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        <span className="font-medium">{dupeLead.name || 'Unknown'}</span>
                        {' · '}
                        <span className="capitalize">{dupeLead.stage?.replace(/_/g, ' ')}</span>
                        {dupeLead.disposition && <span className="text-amber-600"> · {dupeLead.disposition}</span>}
                      </p>
                      <p className="text-xs text-amber-600 mt-0.5">You can only edit this lead, not add a new one.</p>
                    </div>
                    <button type="button" onClick={handleEditExisting}
                      className="flex-shrink-0 text-xs bg-amber-500 text-white px-2.5 py-1.5 rounded-lg hover:bg-amber-600 font-medium whitespace-nowrap">
                      Edit Lead →
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="label">Alternate phone</label>
              <input className="input" placeholder="Optional"
                value={form.alternate_phone} onChange={e => set('alternate_phone', e.target.value)} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" placeholder="Optional"
                value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div>
              <label className="label">City</label>
              <input className="input" placeholder="City"
                value={form.city} onChange={e => set('city', e.target.value)} />
            </div>
            <div>
              <label className="label">Pincode</label>
              <input className="input" placeholder="6-digit"
                value={form.pincode} onChange={e => set('pincode', e.target.value)} />
            </div>
            <div>
              <label className="label">Lead source</label>
              <select className="select" value={form.lead_source} onChange={e => {
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
              <label className="label">Calling date</label>
              <input className="input" type="date"
                value={form.calling_date} onChange={e => set('calling_date', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Address</label>
              <input className="input" placeholder="Full address"
                value={form.address} onChange={e => set('address', e.target.value)} />
            </div>
            {form.lead_source === 'Referral' && <ReferralFields form={form} set={set} />}
          </div>
        </div>

        {/* Manager — agent assign karo */}
        {isManager && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 pb-1 border-b border-slate-100">Assignment</p>
            <div>
              <label className="label">Assign to agent (optional — warna round robin)</label>
              <select className="select" value={selAgent} onChange={e => setSelAgent(e.target.value)}>
                <option value="">— Auto assign (round robin) —</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Property & electricity */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 pb-1 border-b border-slate-100">Property & electricity</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Property type</label>
              <select className="select" value={form.property_type} onChange={e => set('property_type', e.target.value)}>
                <option value="">Select</option>
                {['Residential', 'Commercial', 'Industrial', 'Agricultural'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Ownership</label>
              <select className="select" value={form.ownership} onChange={e => set('ownership', e.target.value)}>
                <option value="">Select</option>
                {['Owned', 'Rented', 'Family Owned'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Roof type</label>
              <select className="select" value={form.roof_type} onChange={e => set('roof_type', e.target.value)}>
                <option value="">Select</option>
                {['RCC / Concrete', 'Tin / Metal Sheet', 'Asbestos', 'Mangalore Tile', 'Other'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Roof area (sq ft)</label>
              <input className="input" type="number" placeholder="e.g. 500"
                value={form.roof_area} onChange={e => set('roof_area', e.target.value)} />
            </div>
            <div>
              <label className="label">Electricity board</label>
              <input className="input" placeholder="e.g. PVVNL, BSES"
                value={form.electricity_board} onChange={e => set('electricity_board', e.target.value)} />
            </div>
            <div>
              <label className="label">Sanctioned load (kW)</label>
              <input className="input" type="number" placeholder="e.g. 5"
                value={form.sanctioned_load} onChange={e => set('sanctioned_load', e.target.value)} />
            </div>
            <div>
              <label className="label">Monthly bill (₹)</label>
              <input className="input" type="number" placeholder="e.g. 3000"
                value={form.monthly_bill} onChange={e => set('monthly_bill', e.target.value)} />
            </div>
            <div>
              <label className="label">Units per month (kWh)</label>
              <input className="input" type="number" placeholder="e.g. 300"
                value={form.units_per_month} onChange={e => set('units_per_month', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Solar */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 pb-1 border-b border-slate-100">Solar details</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">System size (kW)</label>
              <input className="input" type="number" placeholder="e.g. 3"
                value={form.system_size_kw} onChange={e => set('system_size_kw', e.target.value)} />
            </div>
            <div>
              <label className="label">System type</label>
              <select className="select" value={form.system_type} onChange={e => set('system_type', e.target.value)}>
                <option value="">Select</option>
                {['On-grid', 'Off-grid', 'Hybrid'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Remarks</label>
              <textarea className="input resize-none" rows={2} placeholder="Notes from the call..."
                value={form.remarks} onChange={e => set('remarks', e.target.value)} />
            </div>
          </div>
        </div>

      </div>

      <div className="flex gap-2 mt-5 pt-4 border-t border-slate-100">
        <button type="button" onClick={handleClose} className="btn flex-1 justify-center">Cancel</button>
        {dupeLead ? (
          <button type="button" onClick={handleEditExisting}
            className="flex-1 justify-center inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 border-0">
            Edit Existing Lead →
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={saving || !form.phone}
            className="btn-primary flex-1 justify-center disabled:opacity-50">
            {saving ? 'Adding...' : 'Add lead & assign'}
          </button>
        )}
      </div>
    </Modal>
  )
}

function initialForm() {
  return {
    name: '', phone: '', alternate_phone: '', email: '',
    city: '', pincode: '', address: '',
    calling_date: new Date().toISOString().split('T')[0],
    lead_source: '', remarks: '',
    property_type: '', ownership: '', roof_type: '', roof_area: '',
    electricity_board: '', sanctioned_load: '', monthly_bill: '', units_per_month: '',
    system_size_kw: '', system_type: '',
    referral_type: '', referral_name: '', referral_id: '',
  }
}