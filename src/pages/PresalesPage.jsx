import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import Layout from '@/components/layout/Layout'
import { PageHeader, DispBadge, StageBadge, Spinner, Modal } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { createLead } from '@/lib/leadService'
import { autoAssignLead } from '@/lib/assignment'
import { formatPhone, cleanPhone } from '@/lib/phone'
import { NOT_CONNECTED_DISPOSITIONS, CONNECTED_DISPOSITIONS } from '@/config/dispositions'
import { TIME_SLOTS } from '@/config/timeSlots'
import { format } from 'date-fns'
import { Plus, RefreshCw, Search, X, Filter } from 'lucide-react'

// ── Column definitions ────────────────────────────────────────
// g:0 = Lead info, g:1 = Pre-sales, g:2 = Sales
// To add a column: add entry here + one <td> in tbody at same position
const COLS = [
  { key: 'name',             label: 'Name / Phone', w: 180, sortable: true,  g: 0 },
  { key: 'city',             label: 'City',         w: 90,  sortable: true,  g: 0 },
  { key: 'lead_source',      label: 'Source',       w: 110, sortable: true,  g: 0 },
  { key: 'assigned_name',    label: 'PS agent',     w: 90,  sortable: true,  g: 1 },
  { key: 'call_status',      label: 'Status',       w: 100, sortable: true,  g: 1 },
  { key: 'disposition',      label: 'Disposition',  w: 210, sortable: true,  g: 1 },
  { key: 'calling_date',     label: 'Called date',  w: 90,  sortable: true,  g: 1 },
  { key: 'callback_date',    label: 'Callback',     w: 100, sortable: true,  g: 1 },
  { key: 'stage',            label: 'Stage',        w: 140, sortable: true,  g: 2 },
  { key: 'meeting_date',     label: 'Meeting date', w: 105, sortable: true,  g: 2 },
  { key: 'sales_agent_name', label: 'Sales agent',  w: 100, sortable: true,  g: 2 },
]

const G_COLORS = ['#1e40af', '#7c3aed', '#065f46']
const G_LABELS = ['Lead info', 'Pre-sales', 'Sales']

const OPS = [
  { value: 'contains',     label: 'Contains' },
  { value: 'not_contains', label: 'Does not contain' },
  { value: 'equals',       label: 'Equals' },
  { value: 'starts_with',  label: 'Starts with' },
  { value: 'blank',        label: 'Is blank' },
  { value: 'not_blank',    label: 'Is not blank' },
]

function applyFilter(cellVal, f) {
  if (!f) return true
  const hasVal1 = f.val?.trim() || f.op === 'blank' || f.op === 'not_blank'
  const hasVal2 = f.val2?.trim() || f.op2 === 'blank' || f.op2 === 'not_blank'
  if (!hasVal1) return true
  const v = String(cellVal ?? '').toLowerCase()
  function match(op, fv) {
    const fvl = (fv ?? '').toLowerCase()
    switch(op) {
      case 'contains':     return v.includes(fvl)
      case 'not_contains': return !v.includes(fvl)
      case 'equals':       return v === fvl
      case 'starts_with':  return v.startsWith(fvl)
      case 'blank':        return !v
      case 'not_blank':    return !!v
      default:             return v.includes(fvl)
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
  const [leads,       setLeads]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showAdd,     setShowAdd]     = useState(false)
  const [globalSearch,setGlobalSearch]= useState('')
  const [filters,     setFilters]     = useState({})
  const [filterOpen,  setFilterOpen]  = useState(null)
  const [sortCol,     setSortCol]     = useState(null)
  const [sortDir,     setSortDir]     = useState('asc')
  const today = format(new Date(), 'yyyy-MM-dd')

  async function load() {
    setLoading(true)
    let q = supabase
      .from('leads')
      .select(`id, name, phone, city, stage, call_status, disposition,
        calling_date, callback_date, callback_slot,
        meeting_date, meeting_slot, lead_source,
        assigned_to, assigned_user:assigned_to(name),
        sales_agent_id, sales_agent:sales_agent_id(name),
        updated_at`)
      .in('stage', ['new', 'meeting_scheduled', 'qc_followup'])
      .order('updated_at', { ascending: false })
    if (!isManager && !isSuperAdmin) q = q.eq('assigned_to', profile.id)
    const { data } = await q
    setLeads((data ?? []).map(l => ({
      ...l,
      assigned_name:    l.assigned_user?.name ?? '',
      sales_agent_name: l.sales_agent?.name   ?? '',
      phone_clean:      cleanPhone(l.phone),
    })))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Global search — phone normalized
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
  const totalW  = COLS.reduce((s, c) => s + c.w, 0)

  return (
    <Layout>
      <PageHeader title="Pre-sales — calling dashboard" subtitle={`${sorted.length} of ${leads.length} leads`}>
        <button onClick={load} className="btn"><RefreshCw size={13} /></button>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus size={13} /> Add lead
        </button>
      </PageHeader>

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
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 230px)' }}>
          <table style={{ minWidth: totalW, width: '100%', borderCollapse: 'collapse' }}>
            <thead className="sticky top-0 z-10">
              {/* Row 1: Group headers */}
              <tr>
                {G_LABELS.map((label, i) => (
                  <th key={label} colSpan={G_SPANS[i]}
                    style={{ background: G_COLORS[i] }}
                    className="px-3 py-1.5 text-center text-xs font-bold text-white tracking-wide border-r-2 border-white/30 last:border-0">
                    {label}
                  </th>
                ))}
              </tr>
              {/* Row 2: Column headers */}
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
                        className={`ml-auto p-0.5 rounded flex-shrink-0 transition-colors ${
                          filters[col.key] ? 'text-blue-500' : 'text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100'
                        }`}>
                        <Filter size={10} />
                      </button>
                    </div>
                    {filterOpen === col.key && (
                      <ColFilterPopup col={col}
                        value={filters[col.key]}
                        onApply={f => { setFilters(p => ({ ...p, [col.key]: f })); setFilterOpen(null) }}
                        onClear={() => { setFilters(p => { const n={...p}; delete n[col.key]; return n }); setFilterOpen(null) }}
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

                  {/* g:0 Lead info — 3 cols */}
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

                  {/* g:1 Pre-sales — 5 cols */}
                  <td className="px-3 py-2.5" style={{ width: 90, minWidth: 90 }}>
                    <span className="text-xs text-slate-500">{lead.assigned_name?.split(' ')[0] ?? '—'}</span>
                  </td>
                  <td className="px-3 py-2.5" style={{ width: 100, minWidth: 100 }}>
                    {lead.call_status ? (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                        lead.call_status === 'Connected'
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
                      ? <div><div className="text-xs font-medium text-slate-600">{format(new Date(lead.calling_date), 'd MMM')}</div><div className="text-xs text-slate-400">PS</div></div>
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

                  {/* g:2 Sales — 3 cols */}
                  <td className="px-3 py-2.5" style={{ width: 140, minWidth: 140 }}>
                    <StageBadge stage={lead.stage} />
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

      <AddLeadModal open={showAdd} onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); load() }} />
    </Layout>
  )
}

// ── Column filter popup ───────────────────────────────────────
function ColFilterPopup({ col, value, onApply, onClear, onClose }) {
  const [op,   setOp]   = useState(value?.op   ?? 'contains')
  const [val,  setVal]  = useState(value?.val  ?? '')
  const [op2,  setOp2]  = useState(value?.op2  ?? 'contains')
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
        {['AND','OR'].map(j => (
          <button key={j} onClick={() => setJoin(j)}
            className={`flex-1 py-1 text-xs font-semibold ${join===j ? 'bg-slate-800 text-white' : 'bg-white text-slate-400'}`}>
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

// ── Add Lead Modal ────────────────────────────────────────────
function AddLeadModal({ open, onClose, onAdded }) {
  const [form,   setForm]   = useState(initialForm())
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  function set(f, v) { setForm(p => ({ ...p, [f]: v })) }

  async function handleSubmit() {
    if (!form.phone) { setError('Phone number is required'); return }
    setSaving(true); setError('')
    try {
      const lead = await createLead(form)
      await autoAssignLead(lead.id)
      onAdded(); setForm(initialForm())
    } catch (e) {
      setError(e.message || 'Error saving lead')
    } finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add new lead" width={640}>
      {error && <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
      <div className="flex flex-col gap-5">

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 pb-1 border-b border-slate-100">Contact details</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Full name</label><input className="input" placeholder="Customer full name" value={form.name} onChange={e => set('name', e.target.value)} /></div>
            <div><label className="label">Phone <span className="text-red-500">*</span></label><input className="input" placeholder="10-digit mobile" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
            <div><label className="label">Alternate phone</label><input className="input" placeholder="Optional" value={form.alternate_phone} onChange={e => set('alternate_phone', e.target.value)} /></div>
            <div><label className="label">Email</label><input className="input" type="email" placeholder="Optional" value={form.email} onChange={e => set('email', e.target.value)} /></div>
            <div><label className="label">City</label><input className="input" placeholder="City" value={form.city} onChange={e => set('city', e.target.value)} /></div>
            <div><label className="label">Pincode</label><input className="input" placeholder="6-digit" value={form.pincode} onChange={e => set('pincode', e.target.value)} /></div>
            <div><label className="label">Lead source</label>
              <select className="select" value={form.lead_source} onChange={e => set('lead_source', e.target.value)}>
                <option value="">Select source</option>
                {['Facebook Ad','Google Ad','Instagram','YouTube','Referral','Walk-in','Website','IVR','Other'].map(s => <option key={s} value={s}>{s}</option>)}
              </select></div>
            <div><label className="label">Calling date</label><input className="input" type="date" value={form.calling_date} onChange={e => set('calling_date', e.target.value)} /></div>
            <div className="col-span-2"><label className="label">Address</label><input className="input" placeholder="Full address" value={form.address} onChange={e => set('address', e.target.value)} /></div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 pb-1 border-b border-slate-100">Property & electricity</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Property type</label>
              <select className="select" value={form.property_type} onChange={e => set('property_type', e.target.value)}>
                <option value="">Select</option>{['Residential','Commercial','Industrial','Agricultural'].map(s=><option key={s}>{s}</option>)}
              </select></div>
            <div><label className="label">Ownership</label>
              <select className="select" value={form.ownership} onChange={e => set('ownership', e.target.value)}>
                <option value="">Select</option>{['Owned','Rented','Family Owned'].map(s=><option key={s}>{s}</option>)}
              </select></div>
            <div><label className="label">Roof type</label>
              <select className="select" value={form.roof_type} onChange={e => set('roof_type', e.target.value)}>
                <option value="">Select</option>{['RCC / Concrete','Tin / Metal Sheet','Asbestos','Mangalore Tile','Other'].map(s=><option key={s}>{s}</option>)}
              </select></div>
            <div><label className="label">Roof area (sq ft)</label><input className="input" type="number" placeholder="e.g. 500" value={form.roof_area} onChange={e => set('roof_area', e.target.value)} /></div>
            <div><label className="label">Electricity board</label><input className="input" placeholder="e.g. PVVNL, BSES" value={form.electricity_board} onChange={e => set('electricity_board', e.target.value)} /></div>
            <div><label className="label">Sanctioned load (kW)</label><input className="input" type="number" placeholder="e.g. 5" value={form.sanctioned_load} onChange={e => set('sanctioned_load', e.target.value)} /></div>
            <div><label className="label">Monthly bill (₹)</label><input className="input" type="number" placeholder="e.g. 3000" value={form.monthly_bill} onChange={e => set('monthly_bill', e.target.value)} /></div>
            <div><label className="label">Units per month (kWh)</label><input className="input" type="number" placeholder="e.g. 300" value={form.units_per_month} onChange={e => set('units_per_month', e.target.value)} /></div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 pb-1 border-b border-slate-100">Solar & referral</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">System size (kW)</label><input className="input" type="number" placeholder="e.g. 3" value={form.system_size_kw} onChange={e => set('system_size_kw', e.target.value)} /></div>
            <div><label className="label">System type</label>
              <select className="select" value={form.system_type} onChange={e => set('system_type', e.target.value)}>
                <option value="">Select</option>{['On-grid','Off-grid','Hybrid'].map(s=><option key={s}>{s}</option>)}
              </select></div>
            <div><label className="label">Referral type</label>
              <select className="select" value={form.referral_type} onChange={e => set('referral_type', e.target.value)}>
                <option value="">Select</option>{['Customer Referral','Dealer','DSA','Agent','Influencer','Other'].map(s=><option key={s}>{s}</option>)}
              </select></div>
            <div><label className="label">Referrer name</label><input className="input" placeholder="Who referred?" value={form.referral_name} onChange={e => set('referral_name', e.target.value)} /></div>
            <div className="col-span-2"><label className="label">Remarks</label><textarea className="input resize-none" rows={2} placeholder="Notes from the call..." value={form.remarks} onChange={e => set('remarks', e.target.value)} /></div>
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-5 pt-4 border-t border-slate-100">
        <button type="button" onClick={onClose} className="btn flex-1 justify-center">Cancel</button>
        <button type="button" onClick={handleSubmit} disabled={saving || !form.phone} className="btn-primary flex-1 justify-center disabled:opacity-50">
          {saving ? 'Adding...' : 'Add lead & assign'}
        </button>
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
    system_size_kw: '', system_type: '', referral_type: '', referral_name: '',
  }
}
