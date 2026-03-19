import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import Layout from '@/components/layout/Layout'
import { PageHeader, StageBadge, Spinner, EmptyState, Modal } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { formatPhone } from '@/lib/phone'
import { format } from 'date-fns'
import { Wallet, HardHat, Shield, RefreshCw, Search, IndianRupee, Plus } from 'lucide-react'

// ── FINANCE PAGE ──────────────────────────────────────────────
export function FinancePage() {
  const { profile, isManager, isSuperAdmin } = useAuth()
  const navigate  = useNavigate()
  const [leads,   setLeads]   = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [selLead, setSelLead] = useState(null)  // for payment modal

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('leads')
      .select('id, name, phone, city, stage, quoted_amount, updated_at, assigned_user:assigned_to(name)')
      .in('stage', ['sale_closed','finance_approval'])
      .order('updated_at', { ascending: false })
    setLeads(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = leads.filter(l =>
    !search || l.name?.toLowerCase().includes(search.toLowerCase()) || l.phone?.includes(search)
  )

  return (
    <Layout>
      <PageHeader title="Finance — payments" subtitle={`${leads.length} leads`}>
        <button onClick={load} className="btn"><RefreshCw size={13} /></button>
      </PageHeader>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-8" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="grid grid-cols-[1fr_130px_120px_100px] gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <span>Lead</span><span>Stage</span><span>Quoted</span><span>Action</span>
        </div>
        {loading ? <div className="flex justify-center py-12"><Spinner size={22} /></div>
        : filtered.length === 0 ? <EmptyState icon={Wallet} title="No leads in finance" />
        : filtered.map(lead => (
          <div key={lead.id}
            className="grid grid-cols-[1fr_130px_120px_100px] gap-3 px-4 py-3 border-b border-slate-100 hover:bg-slate-50 items-center cursor-pointer"
            onClick={() => navigate(`/leads/${lead.id}`)}>
            <div>
              <div className="text-sm font-medium text-slate-800">{lead.name ?? '—'}</div>
              <div className="text-xs text-slate-400">{formatPhone(lead.phone)} · {lead.city ?? '—'}</div>
            </div>
            <StageBadge stage={lead.stage} />
            <div className="text-sm font-semibold text-slate-700">
              {lead.quoted_amount ? `₹${Number(lead.quoted_amount).toLocaleString('en-IN')}` : '—'}
            </div>
            <button
              onClick={e => { e.stopPropagation(); setSelLead(lead) }}
              className="btn text-xs py-1 px-2">
              <IndianRupee size={11} /> Payment
            </button>
          </div>
        ))}
      </div>

      {selLead && (
        <PaymentModal
          open={!!selLead}
          lead={selLead}
          onClose={() => { setSelLead(null); load() }}
        />
      )}
    </Layout>
  )
}

// Payment modal for finance team
function PaymentModal({ open, lead, onClose }) {
  const { profile } = useAuth()
  const [milestone, setMilestone] = useState('advance')
  const [amount,    setAmount]    = useState('')
  const [mode,      setMode]      = useState('NEFT')
  const [ref,       setRef]       = useState('')
  const [saving,    setSaving]    = useState(false)

  async function handleSave() {
    setSaving(true)
    await supabase.from('payments').upsert({
      lead_id:          lead.id,
      milestone,
      amount_expected:  amount,
      amount_received:  amount,
      status:           'paid',
      paid_date:        new Date().toISOString().split('T')[0],
      payment_mode:     mode,
      reference_no:     ref,
      recorded_by_id:   profile.id,
    }, { onConflict: 'lead_id,milestone' })
    setSaving(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={`Record payment — ${lead.name}`} width={420}>
      <div className="flex flex-col gap-3">
        <div>
          <label className="label">Milestone</label>
          <select className="select" value={milestone} onChange={e => setMilestone(e.target.value)}>
            <option value="advance">Advance</option>
            <option value="commissioning">Commissioning</option>
            <option value="final_delivery">Final delivery</option>
            <option value="amc_renewal">AMC renewal</option>
          </select>
        </div>
        <div>
          <label className="label">Amount (₹)</label>
          <input className="input" type="number" placeholder="Amount received" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="label">Payment mode</label>
          <select className="select" value={mode} onChange={e => setMode(e.target.value)}>
            {['NEFT','UPI','Cash','Cheque','RTGS'].map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Reference / UTR no.</label>
          <input className="input" placeholder="Optional" value={ref} onChange={e => setRef(e.target.value)} />
        </div>
        <button onClick={handleSave} disabled={!amount || saving} className="btn-primary justify-center disabled:opacity-50">
          {saving ? 'Saving...' : 'Record payment'}
        </button>
      </div>
    </Modal>
  )
}


// ── OPS PAGE ──────────────────────────────────────────────────
export function OpsPage() {
  const navigate  = useNavigate()
  const [leads,   setLeads]   = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('leads')
      .select('id, name, phone, city, stage, updated_at')
      .in('stage', ['finance_approval','ops_documents','name_load_change','net_metering','installation','installed'])
      .order('updated_at', { ascending: false })
    setLeads(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = leads.filter(l =>
    !search || l.name?.toLowerCase().includes(search.toLowerCase()) || l.phone?.includes(search)
  )

  return (
    <Layout>
      <PageHeader title="Ops — docs & installation" subtitle={`${leads.length} leads`}>
        <button onClick={load} className="btn"><RefreshCw size={13} /></button>
      </PageHeader>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-8" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="grid grid-cols-[1fr_160px_100px] gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <span>Lead</span><span>Stage</span><span>Updated</span>
        </div>
        {loading ? <div className="flex justify-center py-12"><Spinner size={22} /></div>
        : filtered.length === 0 ? <EmptyState icon={HardHat} title="No leads in ops pipeline" />
        : filtered.map(lead => (
          <div key={lead.id}
            className="grid grid-cols-[1fr_160px_100px] gap-3 px-4 py-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer items-center"
            onClick={() => navigate(`/leads/${lead.id}`)}>
            <div>
              <div className="text-sm font-medium text-slate-800">{lead.name ?? '—'}</div>
              <div className="text-xs text-slate-400">{formatPhone(lead.phone)} · {lead.city ?? '—'}</div>
            </div>
            <StageBadge stage={lead.stage} />
            <div className="text-xs text-slate-400">
              {lead.updated_at ? format(new Date(lead.updated_at), 'd MMM') : '—'}
            </div>
          </div>
        ))}
      </div>
    </Layout>
  )
}


// ── AMC PAGE ──────────────────────────────────────────────────
export function AmcPage() {
  const navigate  = useNavigate()
  const [leads,   setLeads]   = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('leads')
      .select('id, name, phone, city, stage, system_size_kw, updated_at')
      .in('stage', ['installed','amc_active'])
      .order('updated_at', { ascending: false })
    setLeads(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = leads.filter(l =>
    !search || l.name?.toLowerCase().includes(search.toLowerCase()) || l.phone?.includes(search)
  )

  return (
    <Layout>
      <PageHeader title="AMC — service & renewals" subtitle={`${leads.length} installed customers`}>
        <button onClick={load} className="btn"><RefreshCw size={13} /></button>
      </PageHeader>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-8" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="grid grid-cols-[1fr_130px_80px_100px] gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <span>Customer</span><span>Status</span><span>System</span><span>Updated</span>
        </div>
        {loading ? <div className="flex justify-center py-12"><Spinner size={22} /></div>
        : filtered.length === 0 ? <EmptyState icon={Shield} title="No customers yet" />
        : filtered.map(lead => (
          <div key={lead.id}
            className="grid grid-cols-[1fr_130px_80px_100px] gap-3 px-4 py-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer items-center"
            onClick={() => navigate(`/leads/${lead.id}`)}>
            <div>
              <div className="text-sm font-medium text-slate-800">{lead.name ?? '—'}</div>
              <div className="text-xs text-slate-400">{formatPhone(lead.phone)} · {lead.city ?? '—'}</div>
            </div>
            <StageBadge stage={lead.stage} />
            <div className="text-xs text-slate-600 font-medium">
              {lead.system_size_kw ? `${lead.system_size_kw} kW` : '—'}
            </div>
            <div className="text-xs text-slate-400">
              {lead.updated_at ? format(new Date(lead.updated_at), 'd MMM yyyy') : '—'}
            </div>
          </div>
        ))}
      </div>
    </Layout>
  )
}
