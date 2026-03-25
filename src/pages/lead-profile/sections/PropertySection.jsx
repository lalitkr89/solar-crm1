export default function PropertySection({ form, set, solarCalc }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 pb-1 border-b border-slate-100">Property & electricity</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Property type</label>
          <select className="select" value={form.property_type ?? ''} onChange={e => set('property_type', e.target.value)}>
            <option value="">Select</option>
            {['Residential', 'Commercial', 'Industrial', 'Agricultural'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Ownership</label>
          <select className="select" value={form.ownership ?? ''} onChange={e => set('ownership', e.target.value)}>
            <option value="">Select</option>
            {['Owned', 'Rented', 'Family Owned'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Roof type</label>
          <select className="select" value={form.roof_type ?? ''} onChange={e => set('roof_type', e.target.value)}>
            <option value="">Select</option>
            {['RCC / Concrete', 'Tin / Metal Sheet', 'Asbestos', 'Mangalore Tile', 'Other'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div><label className="label">Roof area (sq ft)</label><input className="input" type="number" value={form.roof_area ?? ''} onChange={e => set('roof_area', e.target.value)} /></div>
        <div><label className="label">Electricity board</label><input className="input" value={form.electricity_board ?? ''} onChange={e => set('electricity_board', e.target.value)} /></div>
        <div><label className="label">Sanctioned load (kW)</label><input className="input" type="number" value={form.sanctioned_load ?? ''} onChange={e => set('sanctioned_load', e.target.value)} /></div>
        <div><label className="label">Monthly bill (₹)</label><input className="input" type="number" value={form.monthly_bill ?? ''} onChange={e => set('monthly_bill', e.target.value)} /></div>

        {/* Units per month — auto-fill from bill */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="label mb-0">Units per month (kWh)</label>
            {solarCalc && !form.units_per_month && (
              <button type="button" onClick={() => set('units_per_month', String(solarCalc.units))}
                className="text-[11px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-md px-2 py-0.5 hover:bg-blue-100 transition-colors">
                ⚡ Auto: {solarCalc.units}
              </button>
            )}
          </div>
          <input className="input" type="number" placeholder="kWh"
            value={form.units_per_month ?? ''} onChange={e => set('units_per_month', e.target.value)} />
        </div>
      </div>
    </div>
  )
}
