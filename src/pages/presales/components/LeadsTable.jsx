import { useNavigate } from 'react-router-dom'
import { DispBadge, Spinner } from '@/components/ui'
import { maskPhone } from '@/lib/phone'
import { format } from 'date-fns'
import { Filter } from 'lucide-react'
import { COLS, G_COLORS, G_LABELS, SALES_OUTCOME_LABELS } from '../config/constants'
import { getSalesOutcomeStyle } from '../config/utils'
import ColFilterPopup from './ColFilterPopup'

export default function LeadsTable({
  leads, loading, today,
  isManager, isSuperAdmin,
  selectedIds, onToggleSelect, onToggleSelectAll,
  sortCol, sortDir, onSort,
  filters, filterOpen, onFilterOpen, onApplyFilter, onClearFilter,
}) {
  const navigate = useNavigate()
  const canSelect = isManager || isSuperAdmin
  const visibleCols = COLS.filter(c => c.key !== '_select' || canSelect)
  const G_SPANS = G_LABELS.map((_, i) => visibleCols.filter(c => c.g === i).length)
  const totalW = visibleCols.reduce((s, c) => s + c.w, 0)

  return (
    <div className="card p-0 rounded-xl border border-slate-200" style={{ overflowX: 'auto' }}>
      <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 230px)' }}>
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
                    canSelect ? (
                      <input type="checkbox"
                        checked={leads.length > 0 && selectedIds.size === leads.length}
                        onChange={() => onToggleSelectAll(leads)}
                        className="w-3.5 h-3.5 rounded cursor-pointer" />
                    ) : null
                  ) : (
                    <div className="flex items-center gap-1">
                      <span
                        className={col.sortable ? 'cursor-pointer hover:text-slate-800 select-none' : ''}
                        onClick={() => col.sortable && onSort(col.key)}>
                        {col.label}
                        {sortCol === col.key && (
                          <span style={{ color: G_COLORS[col.g] }}>{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>
                        )}
                      </span>
                      <button
                        onClick={() => onFilterOpen(filterOpen === col.key ? null : col.key)}
                        className={`ml-auto p-0.5 rounded flex-shrink-0 transition-colors ${filters[col.key] ? 'text-blue-500' : 'text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100'}`}>
                        <Filter size={10} />
                      </button>
                    </div>
                  )}
                  {filterOpen === col.key && (
                    <ColFilterPopup
                      col={col}
                      value={filters[col.key]}
                      onApply={f => onApplyFilter(col.key, f)}
                      onClear={() => onClearFilter(col.key)}
                      onClose={() => onFilterOpen(null)} />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={visibleCols.length} className="py-16 text-center"><Spinner size={20} /></td></tr>
            ) : leads.length === 0 ? (
              <tr><td colSpan={visibleCols.length} className="py-16 text-center text-sm text-slate-400">No leads found</td></tr>
            ) : leads.map(lead => (
              <tr key={lead.id}
                className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer ${selectedIds.has(lead.id) ? 'bg-blue-50/40' : ''}`}
                onClick={() => navigate(`/leads/${lead.id}`)}>

                {canSelect && (
                  <td className="px-3 py-2.5" style={{ width: 36, minWidth: 36 }}
                    onClick={e => { e.stopPropagation(); onToggleSelect(lead.id) }}>
                    <input type="checkbox"
                      checked={selectedIds.has(lead.id)}
                      onChange={e => { e.stopPropagation(); onToggleSelect(lead.id) }}
                      onClick={e => e.stopPropagation()}
                      className="w-3.5 h-3.5 rounded cursor-pointer" />
                  </td>
                )}

                {/* Lead info */}
                <td className="px-3 py-2.5" style={{ width: 180, minWidth: 180 }}>
                  <div className="font-medium text-slate-800 text-sm truncate">{lead.name ?? '—'}</div>
                  <div className="text-xs text-slate-400">{maskPhone(lead.phone)}</div>
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
                      : 'bg-red-50 text-red-600 border-red-200'}`}>
                      {lead.call_status === 'Connected' ? 'Connected' : 'Not conn.'}
                    </span>
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
                  ) : lead.stage === 'qc_followup' ? (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-purple-50 text-purple-700 border-purple-200">
                      📞 Rearrange Meeting
                    </span>
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
  )
}