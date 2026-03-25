import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import Layout from '@/components/layout/Layout'
import { MetricCard, StageBadge, DispBadge, Spinner, PageHeader, EmptyState } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { STAGES } from '@/config/stages'
import { maskPhone } from '@/lib/phone'
import { format, addDays, startOfDay } from 'date-fns'
import { Phone, Calendar, RefreshCw, TrendingUp, Users, IndianRupee, ChevronRight } from 'lucide-react'

export default function DashboardPage() {
  const { profile, role, isSuperAdmin } = useAuth()

  if (!profile) return <Layout><div className="flex justify-center py-20"><Spinner size={24} /></div></Layout>

  // Route to correct dashboard based on role
  if (role === 'presales_agent') return <Layout><PresalesAgentDash profile={profile} /></Layout>
  if (role === 'presales_manager') return <Layout><PresalesManagerDash profile={profile} /></Layout>
  if (role === 'sales_agent') return <Layout><SalesAgentDash profile={profile} /></Layout>
  if (role === 'sales_manager') return <Layout><SalesManagerDash profile={profile} /></Layout>
  if (role === 'finance_agent' || role === 'finance_manager') return <Layout><FinanceDash profile={profile} role={role} /></Layout>
  if (role === 'ops_agent' || role === 'ops_manager') return <Layout><OpsDash profile={profile} role={role} /></Layout>
  if (role === 'amc_agent' || role === 'amc_manager') return <Layout><AmcDash profile={profile} role={role} /></Layout>
  if (isSuperAdmin) return <Layout><SuperAdminDash profile={profile} /></Layout>

  return <Layout><p className="text-slate-400 p-4">Loading...</p></Layout>
}

// ── SHARED: Date filter bar ───────────────────────────────────
function DateFilter({ value, onChange, label = 'Calling date' }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500">{label}:</span>
      <input type="date" className="input py-1 text-xs w-36"
        value={value} onChange={e => onChange(e.target.value)} />
      {value && (
        <button onClick={() => onChange('')} className="text-xs text-slate-400 hover:text-slate-600">Clear</button>
      )}
    </div>
  )
}

// ── SHARED: Disposition funnel ────────────────────────────────
function DispositionFunnel({ leads }) {
  const counts = {}
  leads.forEach(l => {
    if (l.disposition) {
      counts[l.disposition] = (counts[l.disposition] || 0) + 1
    } else {
      counts['Not called'] = (counts['Not called'] || 0) + 1
    }
  })
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  const max = sorted[0]?.[1] || 1

  return (
    <div className="card">
      <h2 className="mb-3">Disposition funnel</h2>
      {sorted.length === 0
        ? <p className="text-xs text-slate-400">No data</p>
        : sorted.map(([disp, count]) => (
          <div key={disp} className="flex items-center gap-3 py-1.5">
            <span className="text-xs text-slate-600 w-48 truncate flex-shrink-0">{disp}</span>
            <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div className="h-1.5 rounded-full bg-blue-500 transition-all"
                style={{ width: `${(count / max) * 100}%` }} />
            </div>
            <span className="text-xs font-semibold text-slate-700 w-6 text-right">{count}</span>
          </div>
        ))
      }
    </div>
  )
}

// ── SHARED: Lead mini row ─────────────────────────────────────
function LeadMiniRow({ lead, onClick, showAgent = false }) {
  const today = format(new Date(), 'yyyy-MM-dd')
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 hover:bg-slate-50 cursor-pointer last:border-0"
      onClick={onClick}>
      <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-semibold text-blue-700">{lead.name?.[0]?.toUpperCase() ?? '?'}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-800 truncate">{lead.name ?? '—'}</div>
        <div className="text-xs text-slate-400">{maskPhone(lead.phone)} · {lead.city ?? '—'}</div>
      </div>
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        {lead.disposition && <DispBadge value={lead.disposition} />}
        {lead.callback_date && (
          <span className={`text-xs font-medium ${lead.callback_date === today ? 'text-amber-600' : 'text-slate-400'}`}>
            CB: {lead.callback_date === today ? 'Today' : format(new Date(lead.callback_date), 'd MMM')}
          </span>
        )}
        {lead.meeting_date && (
          <span className={`text-xs font-medium ${lead.meeting_date === today ? 'text-blue-600' : 'text-slate-400'}`}>
            Mtg: {lead.meeting_date === today ? 'Today' : format(new Date(lead.meeting_date), 'd MMM')}
          </span>
        )}
        {showAgent && lead.assigned_user?.name && (
          <span className="text-xs text-slate-400">{lead.assigned_user.name.split(' ')[0]}</span>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
//  1. PRE-SALES AGENT DASHBOARD
// ════════════════════════════════════════════════════════════
function PresalesAgentDash({ profile }) {
  const navigate = useNavigate()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState('')
  const today = format(new Date(), 'yyyy-MM-dd')

  async function load() {
    setLoading(true)
    let q = supabase
      .from('leads')
      .select('id, name, phone, city, stage, disposition, call_status, calling_date, callback_date, callback_slot, meeting_date, meeting_slot, updated_at')
      .eq('assigned_to', profile.id)
      .in('stage', ['new', 'meeting_scheduled', 'qc_followup'])
      .order('updated_at', { ascending: false })

    if (dateFilter) q = q.eq('calling_date', dateFilter)
    const { data } = await q
    setLeads(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [dateFilter])

  const totalLeads = leads.length
  const callsToday = leads.filter(l => l.calling_date === today).length
  const meetingsToday = leads.filter(l => l.meeting_date === today).length
  const callbacksToday = leads.filter(l => l.callback_date === today).length
  const newLeads = leads.filter(l => l.stage === 'new').length

  return (
    <>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1>Good {getGreeting()}, {profile.name?.split(' ')[0]}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
        </div>
        <div className="flex items-center gap-2">
          <DateFilter value={dateFilter} onChange={setDateFilter} />
          <button onClick={load} className="btn"><RefreshCw size={13} /></button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <MetricCard label="New leads in bucket" value={loading ? '—' : newLeads} sub="Pending calls" />
        <MetricCard label="Calls today" value={loading ? '—' : callsToday} sub="Called today" subColor="text-blue-500" />
        <MetricCard label="Callbacks today" value={loading ? '—' : callbacksToday}
          sub={callbacksToday > 0 ? 'Due today' : 'None due'}
          subColor={callbacksToday > 0 ? 'text-amber-500' : 'text-slate-400'} />
        <MetricCard label="Meetings today" value={loading ? '—' : meetingsToday}
          sub={meetingsToday > 0 ? 'Scheduled' : 'None'}
          subColor={meetingsToday > 0 ? 'text-green-600' : 'text-slate-400'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today's priority leads */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2>Priority leads</h2>
            <button onClick={() => navigate('/presales')} className="text-xs text-blue-600 hover:underline">
              View all →
            </button>
          </div>
          {loading ? <div className="flex justify-center py-8"><Spinner /></div> : (
            <>
              {/* Callbacks first */}
              {leads.filter(l => l.callback_date === today).map(l =>
                <LeadMiniRow key={l.id} lead={l} onClick={() => navigate(`/leads/${l.id}`)} />
              )}
              {/* Then new uncalled */}
              {leads.filter(l => !l.disposition && l.stage === 'new').slice(0, 5).map(l =>
                <LeadMiniRow key={l.id} lead={l} onClick={() => navigate(`/leads/${l.id}`)} />
              )}
              {leads.length === 0 && <EmptyState icon={Phone} title="No leads in your bucket" />}
            </>
          )}
        </div>

        {/* Disposition funnel */}
        {!loading && <DispositionFunnel leads={leads} />}
      </div>
    </>
  )
}

// ════════════════════════════════════════════════════════════
//  2. PRE-SALES MANAGER DASHBOARD
// ════════════════════════════════════════════════════════════
function PresalesManagerDash({ profile }) {
  const navigate = useNavigate()
  const [leads, setLeads] = useState([])
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState('')
  const today = format(new Date(), 'yyyy-MM-dd')

  async function load() {
    setLoading(true)
    let q = supabase
      .from('leads')
      .select('id, name, phone, city, stage, disposition, call_status, calling_date, callback_date, meeting_date, assigned_to, assigned_user:assigned_to(id,name), updated_at')
      .in('stage', ['new', 'meeting_scheduled', 'qc_followup'])
      .order('updated_at', { ascending: false })

    if (dateFilter) q = q.eq('calling_date', dateFilter)

    const [{ data: leadsData }, { data: agentsData }] = await Promise.all([
      q,
      supabase.from('users').select('id, name').eq('team', 'presales').eq('role', 'presales_agent').eq('is_active', true)
    ])

    setLeads(leadsData ?? [])
    setAgents(agentsData ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [dateFilter])

  const totalLeads = leads.length
  const callsToday = leads.filter(l => l.calling_date === today).length
  const meetingsToday = leads.filter(l => l.meeting_date === today).length
  const callbacksToday = leads.filter(l => l.callback_date === today).length

  // Next 7 days meetings
  const next7 = Array.from({ length: 7 }, (_, i) => {
    const d = format(addDays(new Date(), i), 'yyyy-MM-dd')
    const label = i === 0 ? 'Today' : format(addDays(new Date(), i), 'EEE d MMM')
    return { date: d, label, count: leads.filter(l => l.meeting_date === d).length }
  })

  // Agent wise breakdown
  const agentStats = agents.map(agent => {
    const agentLeads = leads.filter(l => l.assigned_to === agent.id)
    return {
      ...agent,
      total: agentLeads.length,
      calls: agentLeads.filter(l => l.calling_date === today).length,
      meetings: agentLeads.filter(l => l.meeting_date === today).length,
      callbacks: agentLeads.filter(l => l.callback_date === today).length,
    }
  })

  return (
    <>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1>Pre-sales — manager view</h1>
          <p className="text-sm text-slate-500 mt-0.5">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
        </div>
        <div className="flex items-center gap-2">
          <DateFilter value={dateFilter} onChange={setDateFilter} />
          <button onClick={load} className="btn"><RefreshCw size={13} /></button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <MetricCard label="Total leads" value={loading ? '—' : totalLeads} sub="In pipeline" />
        <MetricCard label="Calls today" value={loading ? '—' : callsToday} sub="Made today" subColor="text-blue-500" />
        <MetricCard label="Callbacks today" value={loading ? '—' : callbacksToday}
          sub={callbacksToday > 0 ? 'Due today' : 'None due'}
          subColor={callbacksToday > 0 ? 'text-amber-500' : 'text-slate-400'} />
        <MetricCard label="Meetings today" value={loading ? '—' : meetingsToday}
          sub="Scheduled" subColor="text-green-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Next 7 days meetings */}
        <div className="card">
          <h2 className="mb-3">Meetings — next 7 days</h2>
          <div className="flex flex-col gap-1.5">
            {next7.map(({ date, label, count }) => (
              <div key={date} className="flex items-center gap-3">
                <span className={`text-xs w-20 flex-shrink-0 ${date === today ? 'font-semibold text-blue-600' : 'text-slate-500'}`}>
                  {label}
                </span>
                <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="h-1.5 rounded-full bg-blue-500"
                    style={{ width: count > 0 ? `${Math.min((count / 10) * 100, 100)}%` : '0%' }} />
                </div>
                <span className="text-xs font-semibold text-slate-700 w-4 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Agent wise */}
        <div className="card col-span-2">
          <h2 className="mb-3">Agent performance — today</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 text-slate-500 font-semibold">Agent</th>
                  <th className="text-center py-2 text-slate-500 font-semibold">Total leads</th>
                  <th className="text-center py-2 text-slate-500 font-semibold">Calls today</th>
                  <th className="text-center py-2 text-slate-500 font-semibold">Callbacks due</th>
                  <th className="text-center py-2 text-slate-500 font-semibold">Meetings today</th>
                </tr>
              </thead>
              <tbody>
                {agentStats.map(a => (
                  <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2.5 font-medium text-slate-800">{a.name}</td>
                    <td className="py-2.5 text-center text-slate-600">{a.total}</td>
                    <td className="py-2.5 text-center text-blue-600 font-semibold">{a.calls}</td>
                    <td className="py-2.5 text-center">
                      <span className={a.callbacks > 0 ? 'text-amber-600 font-semibold' : 'text-slate-300'}>{a.callbacks}</span>
                    </td>
                    <td className="py-2.5 text-center">
                      <span className={a.meetings > 0 ? 'text-green-600 font-semibold' : 'text-slate-300'}>{a.meetings}</span>
                    </td>
                  </tr>
                ))}
                {agentStats.length === 0 && (
                  <tr><td colSpan={5} className="py-4 text-center text-slate-400">No agents found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Disposition funnel */}
        {!loading && <DispositionFunnel leads={leads} />}

        {/* Recent leads */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2>Recent activity</h2>
            <button onClick={() => navigate('/presales')} className="text-xs text-blue-600 hover:underline">All leads →</button>
          </div>
          {loading ? <div className="flex justify-center py-8"><Spinner /></div>
            : leads.slice(0, 6).map(l =>
              <LeadMiniRow key={l.id} lead={l} showAgent onClick={() => navigate(`/leads/${l.id}`)} />
            )}
        </div>
      </div>
    </>
  )
}

// ════════════════════════════════════════════════════════════
//  3. SALES AGENT DASHBOARD
// ════════════════════════════════════════════════════════════
function SalesAgentDash({ profile }) {
  const navigate = useNavigate()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const today = format(new Date(), 'yyyy-MM-dd')

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('leads')
      .select('id, name, phone, city, stage, disposition, meeting_date, meeting_slot, updated_at')
      .eq('assigned_to', profile.id)
      .eq('stage', 'meeting_scheduled')
      .order('meeting_date', { ascending: true })
    setLeads(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const todayMtg = leads.filter(l => l.meeting_date === today)
  const upcoming = leads.filter(l => l.meeting_date > today)
  const pendingOutcome = leads.filter(l => l.meeting_date < today)

  return (
    <>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1>Good {getGreeting()}, {profile.name?.split(' ')[0]}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
        </div>
        <button onClick={load} className="btn"><RefreshCw size={13} /></button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <MetricCard label="Meetings today" value={loading ? '—' : todayMtg.length}
          sub={todayMtg.length > 0 ? 'Scheduled' : 'None today'}
          subColor={todayMtg.length > 0 ? 'text-blue-600' : 'text-slate-400'} />
        <MetricCard label="Upcoming" value={loading ? '—' : upcoming.length} sub="Next days" />
        <MetricCard label="Pending outcome" value={loading ? '—' : pendingOutcome.length}
          sub={pendingOutcome.length > 0 ? 'Update needed' : 'All updated'}
          subColor={pendingOutcome.length > 0 ? 'text-amber-500' : 'text-green-600'} />
      </div>

      {loading ? <div className="flex justify-center py-16"><Spinner size={24} /></div> : (
        <div className="flex flex-col gap-4">
          {todayMtg.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-blue-100 bg-blue-50">
                <h2 className="text-blue-800">Today's meetings ({todayMtg.length})</h2>
              </div>
              {todayMtg.map(l => <LeadMiniRow key={l.id} lead={l} onClick={() => navigate(`/leads/${l.id}`)} />)}
            </div>
          )}
          {pendingOutcome.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-amber-100 bg-amber-50">
                <h2 className="text-amber-800">Pending outcome — update required ({pendingOutcome.length})</h2>
              </div>
              {pendingOutcome.map(l => <LeadMiniRow key={l.id} lead={l} onClick={() => navigate(`/leads/${l.id}`)} />)}
            </div>
          )}
          {upcoming.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <h2>Upcoming meetings ({upcoming.length})</h2>
              </div>
              {upcoming.map(l => <LeadMiniRow key={l.id} lead={l} onClick={() => navigate(`/leads/${l.id}`)} />)}
            </div>
          )}
          {leads.length === 0 && <EmptyState icon={Calendar} title="No meetings assigned yet" subtitle="Your sales manager will assign meetings to you" />}
        </div>
      )}
    </>
  )
}

// ════════════════════════════════════════════════════════════
//  4. SALES MANAGER DASHBOARD
// ════════════════════════════════════════════════════════════
function SalesManagerDash({ profile }) {
  const navigate = useNavigate()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const today = format(new Date(), 'yyyy-MM-dd')

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('leads')
      .select('id, name, phone, city, stage, disposition, meeting_date, meeting_slot, sales_agent_id, sales_agent:sales_agent_id(name), updated_at')
      .in('stage', ['meeting_scheduled', 'meeting_done', 'sale_closed'])
      .order('meeting_date', { ascending: true })
    setLeads(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const unassigned = leads.filter(l => !l.sales_agent_id && l.stage === 'meeting_scheduled')
  const todayMtg = leads.filter(l => l.meeting_date === today)
  const next7 = Array.from({ length: 7 }, (_, i) => {
    const d = format(addDays(new Date(), i), 'yyyy-MM-dd')
    const label = i === 0 ? 'Today' : format(addDays(new Date(), i), 'EEE d MMM')
    return { date: d, label, count: leads.filter(l => l.meeting_date === d).length }
  })

  return (
    <>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1>Sales — manager view</h1>
          <p className="text-sm text-slate-500 mt-0.5">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/sales')} className="btn-primary">Assign meetings →</button>
          <button onClick={load} className="btn"><RefreshCw size={13} /></button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5">
        <MetricCard label="Unassigned" value={loading ? '—' : unassigned.length}
          sub={unassigned.length > 0 ? 'Need assignment' : 'All assigned ✓'}
          subColor={unassigned.length > 0 ? 'text-amber-500' : 'text-green-600'} />
        <MetricCard label="Meetings today" value={loading ? '—' : todayMtg.length} sub="Scheduled" subColor="text-blue-500" />
        <MetricCard label="Meeting done" value={loading ? '—' : leads.filter(l => l.stage === 'meeting_done').length} sub="Outcome pending" />
        <MetricCard label="Sales closed" value={loading ? '—' : leads.filter(l => l.stage === 'sale_closed').length} sub="This period" subColor="text-green-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card">
          <h2 className="mb-3">Meetings — next 7 days</h2>
          {next7.map(({ date, label, count }) => (
            <div key={date} className="flex items-center gap-3 py-1.5">
              <span className={`text-xs w-20 flex-shrink-0 ${date === today ? 'font-semibold text-blue-600' : 'text-slate-500'}`}>{label}</span>
              <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div className="h-1.5 rounded-full bg-blue-500" style={{ width: count > 0 ? `${Math.min((count / 5) * 100, 100)}%` : '0%' }} />
              </div>
              <span className="text-xs font-semibold text-slate-700 w-4 text-right">{count}</span>
            </div>
          ))}
        </div>

        <div className="card p-0 overflow-hidden col-span-2">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2>Today's meetings</h2>
            <button onClick={() => navigate('/sales')} className="text-xs text-blue-600 hover:underline">Manage →</button>
          </div>
          {loading ? <div className="flex justify-center py-8"><Spinner /></div>
            : todayMtg.length === 0
              ? <EmptyState icon={Calendar} title="No meetings today" />
              : todayMtg.map(l => <LeadMiniRow key={l.id} lead={l} showAgent onClick={() => navigate(`/leads/${l.id}`)} />)
          }
        </div>
      </div>
    </>
  )
}

// ════════════════════════════════════════════════════════════
//  5. FINANCE DASHBOARD
// ════════════════════════════════════════════════════════════
function FinanceDash({ profile, role }) {
  const navigate = useNavigate()
  const [leads, setLeads] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const isAgent = role === 'finance_agent'
    const [{ data: l }, { data: p }] = await Promise.all([
      supabase.from('leads')
        .select('id, name, phone, city, stage, quoted_amount, updated_at')
        .in('stage', ['sale_closed', 'finance_approval'])
        .order('updated_at', { ascending: false }),
      supabase.from('payments')
        .select('*, lead:lead_id(name, phone)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
    ])
    setLeads(l ?? [])
    setPayments(p ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const totalPending = payments.reduce((s, p) => s + (p.amount_expected - p.amount_received), 0)

  return (
    <>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1>Finance dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
        </div>
        <button onClick={load} className="btn"><RefreshCw size={13} /></button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <MetricCard label="Leads in finance" value={loading ? '—' : leads.length} sub="Pending approval" />
        <MetricCard label="Pending payments" value={loading ? '—' : payments.length} sub="Milestones due" subColor="text-amber-500" />
        <MetricCard label="Amount pending"
          value={loading ? '—' : `₹${(totalPending / 100000).toFixed(1)}L`}
          sub="Total collection due" subColor="text-red-500" />
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2>Leads awaiting payment</h2>
        </div>
        {loading ? <div className="flex justify-center py-8"><Spinner /></div>
          : leads.map(l => (
            <div key={l.id} className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer last:border-0"
              onClick={() => navigate(`/leads/${l.id}`)}>
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-800">{l.name}</div>
                <div className="text-xs text-slate-400">{maskPhone(l.phone)} · {l.city}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-slate-800">
                  {l.quoted_amount ? `₹${Number(l.quoted_amount).toLocaleString('en-IN')}` : '—'}
                </div>
                <StageBadge stage={l.stage} />
              </div>
            </div>
          ))}
      </div>
    </>
  )
}

// ════════════════════════════════════════════════════════════
//  6. OPS DASHBOARD
// ════════════════════════════════════════════════════════════
function OpsDash({ profile, role }) {
  const navigate = useNavigate()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('leads')
      .select('id, name, phone, city, stage, updated_at')
      .in('stage', ['finance_approval', 'ops_documents', 'name_load_change', 'net_metering', 'installation', 'installed'])
      .order('updated_at', { ascending: false })
    setLeads(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const byStage = (s) => leads.filter(l => l.stage === s).length

  return (
    <>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1>Ops dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
        </div>
        <button onClick={load} className="btn"><RefreshCw size={13} /></button>
      </div>

      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        {[
          { stage: 'finance_approval', label: 'Finance approval' },
          { stage: 'ops_documents', label: 'Docs pending' },
          { stage: 'name_load_change', label: 'Name/load change' },
          { stage: 'net_metering', label: 'Net metering' },
          { stage: 'installation', label: 'Installation' },
          { stage: 'installed', label: 'Installed' },
        ].map(({ stage, label }) => (
          <MetricCard key={stage} label={label} value={loading ? '—' : byStage(stage)} sub="" />
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2>All ops leads</h2>
        </div>
        {loading ? <div className="flex justify-center py-8"><Spinner /></div>
          : leads.map(l => (
            <div key={l.id} className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer last:border-0"
              onClick={() => navigate(`/leads/${l.id}`)}>
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-800">{l.name}</div>
                <div className="text-xs text-slate-400">{maskPhone(l.phone)} · {l.city}</div>
              </div>
              <StageBadge stage={l.stage} />
            </div>
          ))}
      </div>
    </>
  )
}

// ════════════════════════════════════════════════════════════
//  7. AMC DASHBOARD
// ════════════════════════════════════════════════════════════
function AmcDash({ profile, role }) {
  const navigate = useNavigate()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('leads')
      .select('id, name, phone, city, stage, system_size_kw, updated_at')
      .in('stage', ['installed', 'amc_active'])
      .order('updated_at', { ascending: false })
    setLeads(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1>AMC dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
        </div>
        <button onClick={load} className="btn"><RefreshCw size={13} /></button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <MetricCard label="Installed customers" value={loading ? '—' : leads.filter(l => l.stage === 'installed').length} sub="Pending AMC" />
        <MetricCard label="AMC active" value={loading ? '—' : leads.filter(l => l.stage === 'amc_active').length} sub="Under service" subColor="text-green-600" />
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100"><h2>All customers</h2></div>
        {loading ? <div className="flex justify-center py-8"><Spinner /></div>
          : leads.map(l => (
            <div key={l.id} className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer last:border-0"
              onClick={() => navigate(`/leads/${l.id}`)}>
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-800">{l.name}</div>
                <div className="text-xs text-slate-400">{maskPhone(l.phone)} · {l.city} · {l.system_size_kw ? `${l.system_size_kw} kW` : ''}</div>
              </div>
              <StageBadge stage={l.stage} />
            </div>
          ))}
      </div>
    </>
  )
}

// ════════════════════════════════════════════════════════════
//  8. SUPER ADMIN DASHBOARD
// ════════════════════════════════════════════════════════════
function SuperAdminDash({ profile }) {
  const navigate = useNavigate()
  const [funnel, setFunnel] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('v_pipeline_funnel').select('*')
    setFunnel(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const total = funnel.reduce((s, f) => s + Number(f.lead_count), 0)

  return (
    <>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1>Good {getGreeting()}, {profile.name?.split(' ')[0]}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/kanban')} className="btn">Pipeline kanban →</button>
          <button onClick={load} className="btn"><RefreshCw size={13} /></button>
        </div>
      </div>

      <MetricCard label="Total leads in pipeline" value={loading ? '—' : total} sub="All stages" />

      <div className="card mt-4">
        <h2 className="mb-4">Full pipeline funnel</h2>
        {loading ? <Spinner /> : funnel.map(row => {
          const info = STAGES[row.stage]
          const max = funnel[0]?.lead_count ?? 1
          const pct = Math.round((row.lead_count / max) * 100)
          return (
            <div key={row.stage} className="flex items-center gap-3 py-1.5">
              <span className="text-xs text-slate-500 w-40 flex-shrink-0 truncate">{info?.label ?? row.stage}</span>
              <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: info?.color ?? '#378ADD' }} />
              </div>
              <span className="text-xs font-semibold text-slate-700 w-6 text-right">{row.lead_count}</span>
            </div>
          )
        })}
      </div>
    </>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}