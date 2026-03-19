import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import { PageHeader, DispBadge, Spinner } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { STAGES } from '@/config/stages'
import { formatPhone } from '@/lib/phone'
import { RefreshCw } from 'lucide-react'

const KANBAN_STAGES = [
  'new','meeting_scheduled','meeting_done','sale_closed',
  'finance_approval','ops_documents','net_metering','installation','installed','amc_active'
]

export default function KanbanPage() {
  const navigate  = useNavigate()
  const [leads,   setLeads]   = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('leads')
      .select('id, name, phone, city, stage, disposition, system_size_kw, quoted_amount, updated_at')
      .in('stage', KANBAN_STAGES)
      .order('updated_at', { ascending: false })
    setLeads(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const byStage = KANBAN_STAGES.reduce((acc, s) => {
    acc[s] = leads.filter(l => l.stage === s)
    return acc
  }, {})

  return (
    <Layout>
      <PageHeader title="Pipeline — kanban view" subtitle="All stages · manager view">
        <button onClick={load} className="btn"><RefreshCw size={13} /></button>
      </PageHeader>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={24} /></div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {KANBAN_STAGES.map(stage => {
            const info  = STAGES[stage]
            const cards = byStage[stage] ?? []
            return (
              <div key={stage} className="flex-shrink-0 w-48">
                {/* Column header */}
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: info?.color }}
                    />
                    <span className="text-xs font-semibold text-slate-700 truncate">
                      {info?.label}
                    </span>
                  </div>
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                    {cards.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-2">
                  {cards.map(lead => (
                    <div
                      key={lead.id}
                      className="bg-white border border-slate-200 rounded-xl p-3 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
                      onClick={() => navigate(`/leads/${lead.id}`)}
                    >
                      <div className="text-xs font-semibold text-slate-800 truncate">{lead.name ?? '—'}</div>
                      <div className="text-xs text-slate-400 mt-0.5 truncate">{lead.city ?? '—'}</div>
                      {lead.system_size_kw && (
                        <div className="text-xs text-slate-500 mt-1">{lead.system_size_kw} kW</div>
                      )}
                      {lead.quoted_amount && (
                        <div className="text-xs font-medium text-green-700 mt-0.5">
                          ₹{Number(lead.quoted_amount).toLocaleString('en-IN')}
                        </div>
                      )}
                      {lead.disposition && (
                        <div className="mt-2">
                          <DispBadge value={lead.disposition} />
                        </div>
                      )}
                    </div>
                  ))}

                  {cards.length === 0 && (
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center">
                      <span className="text-xs text-slate-300">Empty</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Layout>
  )
}
