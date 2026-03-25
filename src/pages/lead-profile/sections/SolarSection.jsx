export default function SolarSection({ form, set, solarCalc }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 pb-1 border-b border-slate-100">Solar & remarks</p>
      <div className="grid grid-cols-2 gap-3">

        {/* System size — auto-calculated from bill + roof */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="label mb-0">System size (kW)</label>
            {solarCalc && (
              <button type="button" onClick={() => set('system_size_kw', String(solarCalc.finalKw))}
                className="text-[11px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-md px-2 py-0.5 hover:bg-blue-100 transition-colors">
                ⚡ Auto: {solarCalc.finalKw} kW
              </button>
            )}
          </div>
          <input className="input" type="number" placeholder="kW"
            value={form.system_size_kw ?? ''} onChange={e => set('system_size_kw', e.target.value)} />
          {solarCalc && (
            <div className={`mt-1.5 rounded-lg px-3 py-2 text-[11px] leading-relaxed ${solarCalc.roofLimited
              ? 'bg-amber-50 border border-amber-200 text-amber-800'
              : 'bg-green-50 border border-green-200 text-green-800'}`}>
              {solarCalc.roofLimited
                ? <>⚠️ Roof limited: <b>{solarCalc.finalKw} kW</b> recommended (bill needs {solarCalc.requiredKw} kW, {solarCalc.roofNeeded} sqft needed)</>
                : <>✅ Bill = {solarCalc.units} units/mo → <b>{solarCalc.finalKw} kW</b> recommended</>
              }
            </div>
          )}
        </div>

        <div>
          <label className="label">System type</label>
          <select className="select" value={form.system_type ?? ''} onChange={e => set('system_type', e.target.value)}>
            <option value="">Select</option>
            {['On-grid', 'Off-grid', 'Hybrid'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Quoted amount (₹)</label>
          <input className="input" type="number" value={form.quoted_amount ?? ''} onChange={e => set('quoted_amount', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="label">Remarks</label>
          <textarea className="input resize-none" rows={3} value={form.remarks ?? ''} onChange={e => set('remarks', e.target.value)} />
        </div>
      </div>
    </div>
  )
}
