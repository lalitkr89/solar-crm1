import { useState, useMemo, useRef, useEffect } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, Filter, X } from 'lucide-react'

// ── AG Grid style DataGrid ────────────────────────────────────
// Supports: sort, column filters (contains/equals/startsWith/AND/OR)

export default function DataGrid({ columns, rows, onRowClick, emptyText = 'No data' }) {
  const [sort,    setSort]    = useState({ col: null, dir: 'asc' })
  const [filters, setFilters] = useState({})   // { colKey: { conditions: [{op,val}, {op,val}], join: 'AND'|'OR' } }
  const [filterOpen, setFilterOpen] = useState(null)  // which col's filter popup is open

  function toggleSort(col) {
    if (!col.sortable) return
    setSort(s => s.col === col.key
      ? { col: col.key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
      : { col: col.key, dir: 'asc' }
    )
  }

  function setFilter(colKey, filterObj) {
    setFilters(f => ({ ...f, [colKey]: filterObj }))
  }

  function clearFilter(colKey) {
    setFilters(f => { const n = { ...f }; delete n[colKey]; return n })
  }

  const filtered = useMemo(() => {
    let data = [...rows]

    // Apply column filters
    Object.entries(filters).forEach(([colKey, { conditions, join }]) => {
      const active = conditions.filter(c => c.val?.trim())
      if (!active.length) return

      data = data.filter(row => {
        const cellVal = String(row[colKey] ?? '').toLowerCase()
        const results = active.map(({ op, val }) => {
          const v = val.toLowerCase()
          switch (op) {
            case 'contains':       return cellVal.includes(v)
            case 'not_contains':   return !cellVal.includes(v)
            case 'equals':         return cellVal === v
            case 'not_equals':     return cellVal !== v
            case 'starts_with':    return cellVal.startsWith(v)
            case 'ends_with':      return cellVal.endsWith(v)
            case 'blank':          return !cellVal
            case 'not_blank':      return !!cellVal
            default:               return cellVal.includes(v)
          }
        })
        return join === 'OR' ? results.some(Boolean) : results.every(Boolean)
      })
    })

    // Apply sort
    if (sort.col) {
      data.sort((a, b) => {
        const av = String(a[sort.col] ?? '').toLowerCase()
        const bv = String(b[sort.col] ?? '').toLowerCase()
        return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      })
    }

    return data
  }, [rows, filters, sort])

  const activeFilterCount = Object.values(filters).filter(f =>
    f.conditions.some(c => c.val?.trim() || c.op === 'blank' || c.op === 'not_blank')
  ).length

  return (
    <div className="card p-0 overflow-hidden relative">
      {/* Active filter badge */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-b border-blue-100">
          <Filter size={12} className="text-blue-500" />
          <span className="text-xs text-blue-700 font-medium">{activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active</span>
          <button onClick={() => setFilters({})} className="text-xs text-blue-500 hover:text-blue-700 underline ml-1">
            Clear all
          </button>
          <span className="text-xs text-blue-500 ml-auto">{filtered.length} of {rows.length} rows</span>
        </div>
      )}

      {/* Header */}
      <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide select-none">
        {columns.map(col => (
          <div
            key={col.key}
            className="relative flex items-center gap-1 px-3 py-2.5 group"
            style={{ width: col.width ?? 'auto', flex: col.flex ?? 'none' }}
          >
            {/* Sort */}
            <span
              className={col.sortable ? 'cursor-pointer hover:text-slate-800' : ''}
              onClick={() => toggleSort(col)}
            >
              {col.label}
            </span>
            {col.sortable && (
              <span className="ml-0.5">
                {sort.col === col.key
                  ? sort.dir === 'asc'
                    ? <ChevronUp size={11} className="text-blue-500" />
                    : <ChevronDown size={11} className="text-blue-500" />
                  : <ChevronsUpDown size={11} className="text-slate-300 group-hover:text-slate-400" />
                }
              </span>
            )}

            {/* Filter icon */}
            {col.filterable !== false && (
              <button
                onClick={e => { e.stopPropagation(); setFilterOpen(filterOpen === col.key ? null : col.key) }}
                className={`ml-auto p-0.5 rounded transition-colors ${
                  filters[col.key]?.conditions?.some(c => c.val?.trim())
                    ? 'text-blue-500'
                    : 'text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100'
                }`}
              >
                <Filter size={11} />
              </button>
            )}

            {/* Filter popup */}
            {filterOpen === col.key && (
              <FilterPopup
                col={col}
                value={filters[col.key]}
                onApply={(f) => { setFilter(col.key, f); setFilterOpen(null) }}
                onClear={() => { clearFilter(col.key); setFilterOpen(null) }}
                onClose={() => setFilterOpen(null)}
              />
            )}
          </div>
        ))}
      </div>

      {/* Rows */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-slate-400">{emptyText}</div>
      ) : (
        <div>
          {filtered.map((row, i) => (
            <div
              key={row.id ?? i}
              className="flex items-center border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors duration-75"
              onClick={() => onRowClick?.(row)}
            >
              {columns.map(col => (
                <div
                  key={col.key}
                  className="px-3 py-3 text-sm overflow-hidden text-ellipsis whitespace-nowrap"
                  style={{ width: col.width ?? 'auto', flex: col.flex ?? 'none' }}
                >
                  {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Filter Popup — AG Grid style ──────────────────────────────
const OPS = [
  { value: 'contains',     label: 'Contains' },
  { value: 'not_contains', label: 'Does not contain' },
  { value: 'equals',       label: 'Equals' },
  { value: 'not_equals',   label: 'Does not equal' },
  { value: 'starts_with',  label: 'Starts with' },
  { value: 'ends_with',    label: 'Ends with' },
  { value: 'blank',        label: 'Is blank' },
  { value: 'not_blank',    label: 'Is not blank' },
]

function FilterPopup({ col, value, onApply, onClear, onClose }) {
  const ref = useRef()
  const [c1, setC1] = useState(value?.conditions?.[0] ?? { op: 'contains', val: '' })
  const [c2, setC2] = useState(value?.conditions?.[1] ?? { op: 'contains', val: '' })
  const [join, setJoin] = useState(value?.join ?? 'AND')

  // Close on outside click
  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function apply() {
    onApply({ conditions: [c1, c2], join })
  }

  const noInput = op => op === 'blank' || op === 'not_blank'

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-3 min-w-[260px]"
      style={{ marginTop: 2 }}
      onClick={e => e.stopPropagation()}
    >
      <div className="text-xs font-semibold text-slate-600 mb-2">Filter: {col.label}</div>

      {/* Condition 1 */}
      <div className="flex flex-col gap-1.5 mb-2">
        <select
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          value={c1.op} onChange={e => setC1(p => ({ ...p, op: e.target.value }))}>
          {OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {!noInput(c1.op) && (
          <input
            autoFocus
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="Filter value..."
            value={c1.val} onChange={e => setC1(p => ({ ...p, val: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && apply()}
          />
        )}
      </div>

      {/* AND / OR */}
      <div className="flex rounded-lg border border-slate-200 overflow-hidden mb-2">
        {['AND', 'OR'].map(j => (
          <button key={j} onClick={() => setJoin(j)}
            className={`flex-1 py-1 text-xs font-semibold transition-colors ${
              join === j ? 'bg-slate-800 text-white' : 'bg-white text-slate-400 hover:bg-slate-50'
            }`}>
            {j}
          </button>
        ))}
      </div>

      {/* Condition 2 */}
      <div className="flex flex-col gap-1.5 mb-3">
        <select
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          value={c2.op} onChange={e => setC2(p => ({ ...p, op: e.target.value }))}>
          {OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {!noInput(c2.op) && (
          <input
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="Filter value..."
            value={c2.val} onChange={e => setC2(p => ({ ...p, val: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && apply()}
          />
        )}
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <button onClick={onClear}
          className="flex-1 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
          Clear
        </button>
        <button onClick={apply}
          className="flex-1 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Apply
        </button>
      </div>
    </div>
  )
}
