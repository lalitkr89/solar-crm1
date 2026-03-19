import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import Layout from '@/components/layout/Layout'
import { PageHeader, StageBadge, DispBadge, Spinner, EmptyState, Modal, MetricCard } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { updateLead, logActivity } from '@/lib/leadService'
import { formatPhone } from '@/lib/phone'
import { format } from 'date-fns'
import { Users, Search, RefreshCw, UserCheck, AlertCircle, Calendar, X } from 'lucide-react'

export default function SalesPage() {
  const { profile, role, isManager, isSuperAdmin } = useAuth()
  const navigate   = useNavigate()
  const isAgent    = role === 'sales_agent'
  const isMgr      = isManager || isSuperAdmin

  return (
    <Layout>
      {isMgr ? <SalesManagerView profile={profile} navigate={navigate} /> : <SalesAgentView profile={profile} navigate={navigate} />}
    </Layout>
  )
}

// ── SALES MANAGER VIEW ────────────────────────────────────────
function SalesManagerView({ profile, navigate }) {
  const [unassigned, setUnassigned] = useState([])
  const [assigned,   setAssigned]   = useState([])
  const [agents,     setAgents]     = useState([])
  const [loading,    setLoading]    = useState(true)
  const [selLead,    setSelLead]    = useState(null)
  const [search,     setSearch]     = useState('')
  const today = format(new Date(), 'yyyy-MM-dd')

  async function load() {
    setLoading(true)
    const [{ data: ua }, { data: al }, { data: ag }] = await Promise.all([
      // Unassigned — meeting_scheduled but no sales agent
      supabase.from('leads')
        .select('id, name, phone, city, stage, meeting_date, meeting_slot, disposition, updated_at')
        .eq('stage', 'meeting_scheduled')
        .is('sales_agent_id', null)
        .order('meeting_date', { ascending: true }),

      // Assigned — has sales agent
      supabase.from('leads')
        .select('id, name, phone, city, stage, meeting_date, meeting_slot, disposition, sales_agent_id, sales_agent:sales_agent_id(name), updated_at')
        .eq('stage', 'meeting_scheduled')
        .not('sales_agent_id', 'is', null)
        .order('meeting_date', { ascending: true }),

      // Agents with availability
      supabase.from('v_sales_agents_availability').select('*'),
    ])
    setUnassigned(ua ?? [])
    setAssigned(al ?? [])
    setAgents(ag ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleAssign(leadId, agentId, agentName) {
    await supabase.from('leads').update({
      assigned_to:    agentId,
      sales_agent_id: agentId,
    }).eq('id', leadId)

    await logActivity({
      leadId, action: 'Assigned to sales agent',
      field: 'sales_agent_id', oldVal: null, newVal: agentName,
      userId: profile.id, userName: profile.name,
    })
    setSelLead(null)
    load()
  }

  async function handleLeave(agentId, leaveType, reason) {
    await supabase.from('agent_leaves').upsert({
      agent_id:   agentId,
      leave_date: today,
      leave_type: leaveType,
      reason,
      marked_by:  profile.id,
    }, { onConflict: 'agent_id,leave_date' })
    load()
  }

  async function removeLeave(agentId) {
    await supabase.from('agent_leaves')
      .delete()
      .eq('agent_id', agentId)
      .eq('leave_date', today)
    load()
  }

  const filteredUnassigned = unassigned.filter(l =>
    !search || l.name?.toLowerCase().includes(search.toLowerCase()) || l.phone?.includes(search)
  )
  const filteredAssigned = assigned.filter(l =>
    !search || l.name?.toLowerCase().includes(search.toLowerCase()) || l.phone?.includes(search)
  )

  const todayUnassigned = unassigned.filter(l => l.meeting_date === today).length
  const todayAssigned   = assigned.filter(l => l.meeting_date === today).length
  const available       = agents.filter(a => a.available_today).length

  return (
    <>
      <PageHeader title="Sales — manager view" subtitle="Assign meetings to agents">
        <button onClick={load} className="btn"><RefreshCw size={13} /></button>
      </PageHeader>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <MetricCard
          label="Unassigned today"
          value={todayUnassigned}
          sub={todayUnassigned > 0 ? 'Need assignment' : 'All assigned ✓'}
          subColor={todayUnassigned > 0 ? 'text-amber-500' : 'text-green-600'}
        />
        <MetricCard label="Meetings today" value={todayAssigned} sub="Assigned" />
        <MetricCard
          label="Agents available"
          value={`${available}/${agents.length}`}
          sub="Today"
          subColor={available < agents.length ? 'text-amber-500' : 'text-green-600'}
        />
      </div>

      {/* Agent availability strip */}
      <div className="card mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2>Agent availability — today</h2>
        </div>
        {loading ? <Spinner /> : (
          <div className="flex flex-wrap gap-2">
            {agents.map(agent => (
              <div key={agent.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm ${
                  agent.available_today
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}>
                <div className={`w-2 h-2 rounded-full ${agent.available_today ? 'bg-green-500' : 'bg-red-400'}`} />
                <span className={`font-medium text-xs ${agent.available_today ? 'text-green-800' : 'text-red-700'}`}>
                  {agent.name}
                </span>
                <span className="text-xs text-slate-400">
                  {agent.meetings_today} mtg
                </span>
                {agent.available_today ? (
                  <LeaveDropdown
                    onMark={(type, reason) => handleLeave(agent.id, type, reason)}
                  />
                ) : (
                  <button onClick={() => removeLeave(agent.id)}
                    className="ml-1 text-xs text-red-500 hover:text-red-700 underline">
                    Remove
                  </button>
                )}
              </div>
            ))}
            {agents.length === 0 && (
              <p className="text-xs text-slate-400">No sales agents found</p>
            )}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-8" placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Unassigned */}
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-amber-50">
            <AlertCircle size={14} className="text-amber-500" />
            <h2 className="text-amber-800">Unassigned ({filteredUnassigned.length})</h2>
          </div>
          {loading ? <div className="flex justify-center py-8"><Spinner /></div>
          : filteredUnassigned.length === 0
            ? <EmptyState icon={UserCheck} title="All meetings assigned!" />
            : filteredUnassigned.map(lead => (
              <div key={lead.id}
                className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 hover:bg-slate-50">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/leads/${lead.id}`)}>
                  <div className="text-sm font-medium text-slate-800">{lead.name}</div>
                  <div className="text-xs text-slate-400">{formatPhone(lead.phone)} · {lead.city}</div>
                  {lead.meeting_date && (
                    <div className={`text-xs font-medium mt-0.5 ${lead.meeting_date === today ? 'text-amber-600' : 'text-blue-600'}`}>
                      {lead.meeting_date === today ? 'Today' : format(new Date(lead.meeting_date), 'd MMM')}
                      {lead.meeting_slot && ` · ${lead.meeting_slot.split(' ')[0]}`}
                    </div>
                  )}
                </div>
                <button onClick={() => setSelLead(lead)}
                  className="btn-primary text-xs px-3 py-1.5 flex-shrink-0">
                  <UserCheck size={12} /> Assign
                </button>
              </div>
            ))
          }
        </div>

        {/* Assigned */}
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-green-50">
            <UserCheck size={14} className="text-green-600" />
            <h2 className="text-green-800">Assigned ({filteredAssigned.length})</h2>
          </div>
          {loading ? <div className="flex justify-center py-8"><Spinner /></div>
          : filteredAssigned.length === 0
            ? <EmptyState icon={Calendar} title="No assigned meetings yet" />
            : filteredAssigned.map(lead => (
              <div key={lead.id}
                className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                onClick={() => navigate(`/leads/${lead.id}`)}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800">{lead.name}</div>
                  <div className="text-xs text-slate-400">{formatPhone(lead.phone)} · {lead.city}</div>
                  {lead.meeting_date && (
                    <div className={`text-xs font-medium mt-0.5 ${lead.meeting_date === today ? 'text-blue-600' : 'text-slate-500'}`}>
                      {lead.meeting_date === today ? 'Today' : format(new Date(lead.meeting_date), 'd MMM')}
                      {lead.meeting_slot && ` · ${lead.meeting_slot.split(' ')[0]}`}
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs font-medium text-slate-700">{lead.sales_agent?.name?.split(' ')[0]}</div>
                  <button
                    onClick={e => { e.stopPropagation(); setSelLead(lead) }}
                    className="text-xs text-blue-500 hover:underline mt-0.5">
                    Reassign
                  </button>
                </div>
              </div>
            ))
          }
        </div>
      </div>

      {/* Assign modal */}
      {selLead && (
        <AssignModal
          lead={selLead}
          agents={agents}
          onAssign={handleAssign}
          onClose={() => setSelLead(null)}
        />
      )}
    </>
  )
}

// ── SALES AGENT VIEW ──────────────────────────────────────────
function SalesAgentView({ profile, navigate }) {
  const [leads,   setLeads]   = useState([])
  const [loading, setLoading] = useState(true)
  const today = format(new Date(), 'yyyy-MM-dd')

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('leads')
      .select('id, name, phone, city, stage, meeting_date, meeting_slot, disposition, updated_at')
      .eq('stage', 'meeting_scheduled')
      .eq('assigned_to', profile.id)
      .order('meeting_date', { ascending: true })
    setLeads(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const todayLeads   = leads.filter(l => l.meeting_date === today)
  const upcomingLeads = leads.filter(l => l.meeting_date > today)
  const pastLeads    = leads.filter(l => l.meeting_date < today)

  return (
    <>
      <PageHeader title="My meetings" subtitle={`${leads.length} total · ${todayLeads.length} today`}>
        <button onClick={load} className="btn"><RefreshCw size={13} /></button>
      </PageHeader>

      {loading ? <div className="flex justify-center py-16"><Spinner size={24} /></div> : (
        <div className="flex flex-col gap-4">
          {/* Today */}
          {todayLeads.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-100">
                <h2 className="text-blue-800">Today's meetings ({todayLeads.length})</h2>
              </div>
              {todayLeads.map(lead => <LeadRow key={lead.id} lead={lead} today={today} onClick={() => navigate(`/leads/${lead.id}`)} />)}
            </div>
          )}

          {/* Upcoming */}
          {upcomingLeads.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                <h2>Upcoming ({upcomingLeads.length})</h2>
              </div>
              {upcomingLeads.map(lead => <LeadRow key={lead.id} lead={lead} today={today} onClick={() => navigate(`/leads/${lead.id}`)} />)}
            </div>
          )}

          {/* Past / pending */}
          {pastLeads.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100">
                <h2 className="text-amber-800">Pending outcome ({pastLeads.length})</h2>
              </div>
              {pastLeads.map(lead => <LeadRow key={lead.id} lead={lead} today={today} onClick={() => navigate(`/leads/${lead.id}`)} />)}
            </div>
          )}

          {leads.length === 0 && (
            <EmptyState icon={Calendar} title="No meetings assigned yet" subtitle="Your sales manager will assign meetings to you" />
          )}
        </div>
      )}
    </>
  )
}

// ── Lead row component ────────────────────────────────────────
function LeadRow({ lead, today, onClick }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={onClick}>
      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-semibold text-blue-700">{lead.name?.[0]?.toUpperCase()}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-800">{lead.name}</div>
        <div className="text-xs text-slate-400">{formatPhone(lead.phone)} · {lead.city}</div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className={`text-xs font-semibold ${lead.meeting_date === today ? 'text-blue-600' : lead.meeting_date < today ? 'text-amber-600' : 'text-slate-600'}`}>
          {lead.meeting_date === today ? 'Today' : format(new Date(lead.meeting_date), 'd MMM')}
        </div>
        {lead.meeting_slot && <div className="text-xs text-slate-400">{lead.meeting_slot.split(' - ')[0]}</div>}
      </div>
    </div>
  )
}

// ── Assign Modal ──────────────────────────────────────────────
function AssignModal({ lead, agents, onAssign, onClose }) {
  const [selAgent, setSelAgent] = useState('')
  const today = format(new Date(), 'yyyy-MM-dd')
  const isToday = lead.meeting_date === today

  return (
    <Modal open={true} onClose={onClose} title={`Assign — ${lead.name}`} width={420}>
      <div className="mb-3 p-3 rounded-xl bg-slate-50 text-sm">
        <div className="font-medium text-slate-700">{lead.name}</div>
        <div className="text-xs text-slate-500 mt-0.5">
          {formatPhone(lead.phone)} · {lead.city}
        </div>
        {lead.meeting_date && (
          <div className={`text-xs font-semibold mt-1 ${isToday ? 'text-amber-600' : 'text-blue-600'}`}>
            Meeting: {isToday ? 'Today' : format(new Date(lead.meeting_date), 'd MMM yyyy')}
            {lead.meeting_slot && ` · ${lead.meeting_slot}`}
          </div>
        )}
      </div>

      <label className="label">Select sales agent</label>
      <div className="flex flex-col gap-2 mb-4">
        {agents.map(agent => (
          <button key={agent.id}
            onClick={() => setSelAgent(agent.id)}
            disabled={!agent.available_today}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm transition-all ${
              selAgent === agent.id
                ? 'border-blue-500 bg-blue-50'
                : !agent.available_today
                  ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                  : 'border-slate-200 hover:border-blue-300'
            }`}>
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${agent.available_today ? 'bg-green-500' : 'bg-red-400'}`} />
            <div className="flex-1 text-left">
              <div className="font-medium text-slate-800">{agent.name}</div>
              {!agent.available_today && (
                <div className="text-xs text-red-500 capitalize">{agent.leave_type || 'Off today'}</div>
              )}
            </div>
            <div className="text-xs text-slate-400">{agent.meetings_today} meetings today</div>
            {selAgent === agent.id && <div className="text-blue-500 text-xs font-bold">✓</div>}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={onClose} className="btn flex-1 justify-center">Cancel</button>
        <button
          onClick={() => {
            const agent = agents.find(a => a.id === selAgent)
            onAssign(lead.id, selAgent, agent?.name)
          }}
          disabled={!selAgent}
          className="btn-primary flex-1 justify-center disabled:opacity-50">
          Assign meeting
        </button>
      </div>
    </Modal>
  )
}

// ── Leave dropdown ────────────────────────────────────────────
function LeaveDropdown({ onMark }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [type, setType] = useState('off')

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="text-xs text-slate-400 hover:text-red-500 ml-1 transition-colors">
      Mark off
    </button>
  )

  return (
    <div className="flex items-center gap-1.5 ml-1">
      <select value={type} onChange={e => setType(e.target.value)}
        className="text-xs border border-slate-200 rounded-lg px-1.5 py-1 bg-white">
        <option value="off">Weekly off</option>
        <option value="unplanned">Unplanned</option>
        <option value="halfday">Half day</option>
      </select>
      <input value={reason} onChange={e => setReason(e.target.value)}
        className="text-xs border border-slate-200 rounded-lg px-1.5 py-1 w-20"
        placeholder="Reason" />
      <button onClick={() => { onMark(type, reason); setOpen(false) }}
        className="text-xs bg-red-500 text-white px-2 py-1 rounded-lg hover:bg-red-600">
        OK
      </button>
      <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
        <X size={12} />
      </button>
    </div>
  )
}
