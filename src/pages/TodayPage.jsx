import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import Layout from '@/components/layout/Layout'
import { PageHeader, StageBadge, DispBadge, Spinner, EmptyState } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { formatPhone } from '@/lib/phone'
import { format } from 'date-fns'
import { Phone, Calendar, CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react'

export default function TodayPage() {
  const { profile, role, isSuperAdmin, isManager } = useAuth()
  const navigate  = useNavigate()
  const today     = format(new Date(), 'yyyy-MM-dd')
  const [data,    setData]    = useState({ callbacks: [], meetings: [] })
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)

    // Base queries — filtered by role
    let cbQ = supabase
      .from('leads')
      .select('id, name, phone, city, stage, disposition, callback_date, callback_slot, assigned_to, assigned_user:assigned_to(name)')
      .eq('callback_date', today)
      .order('callback_slot')

    let mtQ = supabase
      .from('leads')
      .select('id, name, phone, city, stage, disposition, meeting_date, meeting_slot, assigned_to, assigned_user:assigned_to(name)')
      .eq('meeting_date', today)
      .order('meeting_slot')

    // Role-based filtering
    if (role === 'presales_agent') {
      // Only own assigned leads in presales stages
      cbQ = cbQ.eq('assigned_to', profile.id).in('stage', ['new', 'meeting_scheduled', 'qc_followup'])
      mtQ = mtQ.eq('assigned_to', profile.id).in('stage', ['new', 'meeting_scheduled', 'qc_followup'])
    } else if (role === 'presales_manager') {
      // Whole presales team
      cbQ = cbQ.in('stage', ['new', 'meeting_scheduled', 'qc_followup'])
      mtQ = mtQ.in('stage', ['new', 'meeting_scheduled', 'qc_followup'])
    } else if (role === 'sales_agent') {
      // Only own assigned sales meetings
      cbQ = cbQ.eq('assigned_to', profile.id).eq('stage', 'meeting_scheduled')
      mtQ = mtQ.eq('assigned_to', profile.id).eq('stage', 'meeting_scheduled')
    } else if (role === 'sales_manager') {
      cbQ = cbQ.in('stage', ['meeting_scheduled', 'meeting_done', 'sale_closed'])
      mtQ = mtQ.in('stage', ['meeting_scheduled', 'meeting_done', 'sale_closed'])
    } else if (role === 'finance_agent' || role === 'finance_manager') {
      cbQ = cbQ.in('stage', ['sale_closed', 'finance_approval'])
      mtQ = mtQ.in('stage', ['sale_closed', 'finance_approval'])
    } else if (role === 'ops_agent' || role === 'ops_manager') {
      cbQ = cbQ.in('stage', ['finance_approval','ops_documents','name_load_change','net_metering','installation','installed'])
      mtQ = mtQ.in('stage', ['finance_approval','ops_documents','name_load_change','net_metering','installation','installed'])
    } else if (role === 'amc_agent' || role === 'amc_manager') {
      cbQ = cbQ.in('stage', ['installed', 'amc_active'])
      mtQ = mtQ.in('stage', ['installed', 'amc_active'])
    }
    // super_admin — no filter, sees all

    const [{ data: callbacks }, { data: meetings }] = await Promise.all([cbQ, mtQ])
    setData({ callbacks: callbacks ?? [], meetings: meetings ?? [] })
    setLoading(false)
  }

  useEffect(() => { load() }, [role])

  const showAgent = isManager || isSuperAdmin
  const todayLabel = format(new Date(), 'EEEE, d MMMM yyyy')

  return (
    <Layout>
      <PageHeader title="Today's action center" subtitle={todayLabel}>
        <button onClick={load} className="btn"><RefreshCw size={13} /> Refresh</button>
      </PageHeader>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={24} /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Callbacks */}
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-100 bg-amber-50">
              <Phone size={14} className="text-amber-600" />
              <h2 className="text-amber-800">Callbacks today</h2>
              <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                {data.callbacks.length}
              </span>
            </div>

            {data.callbacks.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="No callbacks due today" subtitle="You're all caught up!" />
            ) : (
              data.callbacks.map(lead => (
                <div key={lead.id}
                  className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer last:border-0"
                  onClick={() => navigate(`/leads/${lead.id}`)}>
                  <div className="w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-amber-700">{lead.name?.[0]?.toUpperCase() ?? '?'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800">{lead.name ?? '—'}</div>
                    <div className="text-xs text-slate-400">{formatPhone(lead.phone)} · {lead.city ?? '—'}</div>
                    {lead.callback_slot && (
                      <div className="text-xs text-amber-600 mt-0.5 font-medium">{lead.callback_slot}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {lead.disposition && <DispBadge value={lead.disposition} />}
                    {showAgent && lead.assigned_user?.name && (
                      <span className="text-xs text-slate-400">{lead.assigned_user.name.split(' ')[0]}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Meetings */}
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-blue-100 bg-blue-50">
              <Calendar size={14} className="text-blue-600" />
              <h2 className="text-blue-800">Meetings today</h2>
              <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                {data.meetings.length}
              </span>
            </div>

            {data.meetings.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="No meetings today" subtitle="Nothing scheduled for today" />
            ) : (
              data.meetings.map(lead => (
                <div key={lead.id}
                  className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer last:border-0"
                  onClick={() => navigate(`/leads/${lead.id}`)}>
                  <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-blue-700">{lead.name?.[0]?.toUpperCase() ?? '?'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800">{lead.name ?? '—'}</div>
                    <div className="text-xs text-slate-400">{formatPhone(lead.phone)} · {lead.city ?? '—'}</div>
                    {lead.meeting_slot && (
                      <div className="text-xs text-blue-600 mt-0.5 font-medium">{lead.meeting_slot}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StageBadge stage={lead.stage} />
                    {showAgent && lead.assigned_user?.name && (
                      <span className="text-xs text-slate-400">{lead.assigned_user.name.split(' ')[0]}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      )}
    </Layout>
  )
}
