import { useState, useEffect } from 'react'
import { FILTER_OPS } from '../config/constants'

export default function ColFilterPopup({ col, value, onApply, onClear, onClose }) {
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
          <button
            onClick={() => onApply({ isDate: true, from: fromDate, to: toDate })}
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
      <select
        className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 mb-1.5 bg-white focus:outline-none"
        value={op} onChange={e => setOp(e.target.value)}>
        {FILTER_OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
      <select
        className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 mb-1.5 bg-white focus:outline-none"
        value={op2} onChange={e => setOp2(e.target.value)}>
        {FILTER_OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {!noInput(op2) && (
        <input
          className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 mb-3 focus:outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="Value..." value={val2} onChange={e => setVal2(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onApply({ op, val, op2, val2, join })} />
      )}
      <div className="flex gap-2">
        <button onClick={onClear} className="flex-1 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50">Clear</button>
        <button
          onClick={() => onApply({ op, val, op2, val2, join })}
          className="flex-1 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Apply
        </button>
      </div>
    </div>
  )
}
