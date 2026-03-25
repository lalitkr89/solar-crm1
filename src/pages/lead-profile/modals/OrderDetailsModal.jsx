import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui'
import { updateLead, logActivity } from '@/lib/leadService'
import { supabase } from '@/lib/supabase'

// ── Order Details Modal ───────────────────────────────────────
export default function OrderDetailsModal({ lead, onClose, onSaved, userId, userName }) {
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // Panel
  const [panelType, setPanelType] = useState('both') // dcr | non_dcr | both
  const [dcrNum, setDcrNum] = useState('')
  const [dcrCap, setDcrCap] = useState('')
  const [dcrBrand, setDcrBrand] = useState('')
  const [dcrTech, setDcrTech] = useState('')
  const [nonDcrNum, setNonDcrNum] = useState('')
  const [nonDcrCap, setNonDcrCap] = useState('')
  const [nonDcrBrand, setNonDcrBrand] = useState('')
  const [nonDcrTech, setNonDcrTech] = useState('')

  // System
  const [systemSize, setSystemSize] = useState(lead.system_size_kw ?? '')

  // Auto-compute system size from panels
  useEffect(() => {
    const dcrTotal = (Number(dcrNum) || 0) * (Number(dcrCap) || 0)
    const nonDcrTotal = (Number(nonDcrNum) || 0) * (Number(nonDcrCap) || 0)
    const totalWp = (panelType === 'dcr' ? dcrTotal : 0) +
      (panelType === 'non_dcr' ? nonDcrTotal : 0) +
      (panelType === 'both' ? dcrTotal + nonDcrTotal : 0)
    if (totalWp > 0) {
      setSystemSize((totalWp / 1000).toFixed(2))
    }
  }, [dcrNum, dcrCap, nonDcrNum, nonDcrCap, panelType])
  const [systemType, setSystemType] = useState(lead.system_type ?? 'on_grid')
  const [structureType, setStructureType] = useState('basic')
  const [structureHeight, setStructureHeight] = useState('')
  const [structureMaterial, setStructureMaterial] = useState('gi')
  const [structureNotes, setStructureNotes] = useState('')

  // Inverter
  const [invBrand, setInvBrand] = useState('')
  const [invCap, setInvCap] = useState('')
  const [invType, setInvType] = useState('single_phase')

  // AMC
  const [amcIncluded, setAmcIncluded] = useState(false)
  const [amcYears, setAmcYears] = useState('1')
  const [amcPlan, setAmcPlan] = useState('basic')

  // Design
  const [designIncluded, setDesignIncluded] = useState(true)

  // Financials
  const [salesQuotedAmt, setSalesQuotedAmt] = useState(lead.sales_quoted_amount ?? '')
  const [totalProjectCost, setTotalProjectCost] = useState('')
  const [costDiffReason, setCostDiffReason] = useState('')

  // Payment milestones — fixed stages
  const [paymentMode, setPaymentMode] = useState('direct') // direct | emi
  const [paymentMilestones, setPaymentMilestones] = useState({
    advance: '', design: '', dispatch: '', installation: '', commissioning: '',
  })
  const [emiTotalAmount, setEmiTotalAmount] = useState('')
  const [emiTenureMonths, setEmiTenureMonths] = useState('')

  // Corrections / change requests
  const [nameChangeRequired, setNameChangeRequired] = useState(false)
  const [nameChangeRemark, setNameChangeRemark] = useState('')
  const [loadChangeRequired, setLoadChangeRequired] = useState(false)
  const [loadChangeRemark, setLoadChangeRemark] = useState('')
  const [otherCorrectionRemark, setOtherCorrectionRemark] = useState('')

  const isBelowMin = false // advance section removed

  async function handleSave() {
    if (!totalProjectCost) { setErr('Total project cost required'); return }
    setSaving(true); setErr('')
    try {
      const payload = {
        lead_id: lead.id,
        panel_type: panelType,
        dcr_num_panels: panelType !== 'non_dcr' ? (Number(dcrNum) || null) : null,
        dcr_capacity_wp: panelType !== 'non_dcr' ? (Number(dcrCap) || null) : null,
        dcr_brand: panelType !== 'non_dcr' ? (dcrBrand || null) : null,
        non_dcr_num_panels: panelType !== 'dcr' ? (Number(nonDcrNum) || null) : null,
        non_dcr_capacity_wp: panelType !== 'dcr' ? (Number(nonDcrCap) || null) : null,
        non_dcr_brand: panelType !== 'dcr' ? (nonDcrBrand || null) : null,
        inverter_brand: invBrand || null,
        inverter_capacity_kw: Number(invCap) || null,
        inverter_type: invType,
        structure_type: structureType,
        structure_notes: structureNotes || null,
        system_size_kw: Number(systemSize) || null,
        system_type: systemType,
        amc_included: amcIncluded,
        amc_years: amcIncluded ? Number(amcYears) : null,
        amc_plan: amcIncluded ? amcPlan : null,
        sales_quoted_amount: Number(salesQuotedAmt) || null,
        total_project_cost: Number(totalProjectCost),
        cost_difference_reason: costDiffReason || null,
        advance_received: advanceReceived,
        advance_amount: advanceReceived ? (Number(advanceAmount) || null) : null,
        advance_mode: advanceReceived ? advanceMode : null,
        advance_reference: advanceReceived ? (advanceRef || null) : null,
        advance_date: advanceReceived ? (advanceDate || null) : null,
        submitted_by: userId,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Store payment structure + extras in structure_notes as JSON suffix
      }

      // Save payment structure details in structure_notes extended field
      const paymentMeta = JSON.stringify({
        payment_mode: paymentMode,
        milestones: paymentMode === 'direct' ? {
          advance: Number(paymentMilestones.advance) || null,
          design: Number(paymentMilestones.design) || null,
          dispatch: Number(paymentMilestones.dispatch) || null,
          installation: Number(paymentMilestones.installation) || null,
          commissioning: Number(paymentMilestones.commissioning) || null,
        } : null,
        emi_total_amount: paymentMode === 'emi' ? (Number(emiTotalAmount) || null) : null,
        emi_tenure_months: paymentMode === 'emi' ? (Number(emiTenureMonths) || null) : null,
        below_min_advance_approval: isBelowMin ? belowMinApproval : null,
        design_included: designIncluded,
        structure_height_ft: Number(structureHeight) || null,
        structure_material: structureMaterial || null,
        dcr_tech: dcrTech || null,
        non_dcr_tech: nonDcrTech || null,
        name_change_required: nameChangeRequired,
        name_change_remark: nameChangeRequired ? nameChangeRemark : null,
        load_change_required: loadChangeRequired,
        load_change_remark: loadChangeRequired ? loadChangeRemark : null,
        other_correction_remark: otherCorrectionRemark || null,
      })
      payload.structure_notes = paymentMeta

      // Upsert order_details
      const { error } = await supabase
        .from('order_details')
        .upsert(payload, { onConflict: 'lead_id' })
      if (error) throw error

      // If lead was rejected, move back to pending_approval on resubmit
      const leadUpdates = {
        order_submitted_at: new Date().toISOString(),
        order_rejected_reason: null,
      }
      if (lead.stage === 'sale_rejected') {
        leadUpdates.stage = 'sale_pending_approval'
      }
      await supabase.from('leads').update(leadUpdates).eq('id', lead.id)

      await supabase.from('lead_history').insert({
        lead_id: lead.id,
        action: lead.stage === 'sale_rejected' ? 'Order re-submitted after rejection' : 'Order details submitted',
        field: 'order_details',
        new_val: `₹${Number(totalProjectCost).toLocaleString('en-IN')} · ${panelType.toUpperCase()} panels`,
        changed_by: userId,
        changed_by_name: userName,
        created_at: new Date().toISOString(),
      })

      onSaved(payload)
    } catch (e) {
      setErr(e.message || 'Save failed')
    }
    setSaving(false)
  }

  const inputCls = 'input w-full'
  const labelCls = 'label'
  const sectionCls = 'mb-5'
  const sectionHead = 'text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 mt-1'

  return (
    <Modal open={true} onClose={onClose} title="📋 Order Details" width={640}>
      <div className="max-h-[70vh] overflow-y-auto pr-1 space-y-1 pb-2">

        {/* ── System Info ── */}
        <div className={sectionCls}>
          <div className={sectionHead}>System Details</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>System Size (kW) <span className="text-xs text-blue-500 font-normal">auto-computed</span></label>
              <input className={`${inputCls} bg-blue-50 text-blue-800 font-medium cursor-not-allowed`} type="number"
                placeholder="Auto from panels" value={systemSize} readOnly />
            </div>
            <div>
              <label className={labelCls}>System Type</label>
              <select className={inputCls} value={systemType} onChange={e => setSystemType(e.target.value)}>
                <option value="on_grid">On Grid</option>
                <option value="off_grid">Off Grid</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Structure Type</label>
              <select className={inputCls} value={structureType} onChange={e => setStructureType(e.target.value)}>
                <option value="basic">Basic (Light Width)</option>
                <option value="premium">Premium (Heavy Width)</option>
                <option value="tin_shed">Tin / Shed</option>
                <option value="ground_mounted">Ground Mounted</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Structure Height (ft)</label>
              <input className={inputCls} type="number" placeholder="e.g. 6" value={structureHeight} onChange={e => setStructureHeight(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Structure Material</label>
              <select className={inputCls} value={structureMaterial} onChange={e => setStructureMaterial(e.target.value)}>
                <option value="gi">GI (Galvanized Iron)</option>
                <option value="hdgi">HDGI (Hot Dip Galvanized)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Design Included?</label>
              <select className={inputCls} value={designIncluded ? 'yes' : 'no'} onChange={e => setDesignIncluded(e.target.value === 'yes')}>
                <option value="yes">Yes — Included</option>
                <option value="no">No — Not Included</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Panel Type ── */}
        <div className={sectionCls}>
          <div className={sectionHead}>Panel Details</div>
          <div className="mb-3">
            <label className={labelCls}>Panel Type <span className="text-red-500">*</span></label>
            <div className="flex gap-2">
              {[['dcr', 'DCR Only'], ['non_dcr', 'Non-DCR Only'], ['both', 'DCR + Non-DCR Both']].map(([v, l]) => (
                <button key={v} onClick={() => setPanelType(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${panelType === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {panelType !== 'non_dcr' && (
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 mb-3">
              <div className="text-xs font-semibold text-blue-700 mb-2">DCR Panels</div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={labelCls}>No. of Panels</label><input className={inputCls} type="number" placeholder="e.g. 12" value={dcrNum} onChange={e => setDcrNum(e.target.value)} /></div>
                <div><label className={labelCls}>Capacity (Wp)</label><input className={inputCls} type="number" placeholder="e.g. 440" value={dcrCap} onChange={e => setDcrCap(e.target.value)} /></div>
                <div><label className={labelCls}>Brand</label><input className={inputCls} type="text" placeholder="e.g. Waaree" value={dcrBrand} onChange={e => setDcrBrand(e.target.value)} /></div>
                <div>
                  <label className={labelCls}>Technology</label>
                  <select className={inputCls} value={dcrTech} onChange={e => setDcrTech(e.target.value)}>
                    <option value="">Select</option>
                    <option value="Mono PERC">Mono PERC</option>
                    <option value="Bifacial">Bifacial</option>
                    <option value="TOPCon">TOPCon</option>
                    <option value="HJT">HJT</option>
                    <option value="Poly">Poly</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {panelType !== 'dcr' && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 mb-3">
              <div className="text-xs font-semibold text-slate-600 mb-2">Non-DCR Panels</div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={labelCls}>No. of Panels</label><input className={inputCls} type="number" placeholder="e.g. 8" value={nonDcrNum} onChange={e => setNonDcrNum(e.target.value)} /></div>
                <div><label className={labelCls}>Capacity (Wp)</label><input className={inputCls} type="number" placeholder="e.g. 400" value={nonDcrCap} onChange={e => setNonDcrCap(e.target.value)} /></div>
                <div><label className={labelCls}>Brand</label><input className={inputCls} type="text" placeholder="e.g. Adani" value={nonDcrBrand} onChange={e => setNonDcrBrand(e.target.value)} /></div>
                <div>
                  <label className={labelCls}>Technology</label>
                  <select className={inputCls} value={nonDcrTech} onChange={e => setNonDcrTech(e.target.value)}>
                    <option value="">Select</option>
                    <option value="Mono PERC">Mono PERC</option>
                    <option value="Bifacial">Bifacial</option>
                    <option value="TOPCon">TOPCon</option>
                    <option value="HJT">HJT</option>
                    <option value="Poly">Poly</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Inverter ── */}
        <div className={sectionCls}>
          <div className={sectionHead}>Inverter</div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className={labelCls}>Brand</label><input className={inputCls} type="text" placeholder="e.g. Sungrow" value={invBrand} onChange={e => setInvBrand(e.target.value)} /></div>
            <div><label className={labelCls}>Capacity (kW)</label><input className={inputCls} type="number" placeholder="e.g. 5" value={invCap} onChange={e => setInvCap(e.target.value)} /></div>
            <div>
              <label className={labelCls}>Phase</label>
              <select className={inputCls} value={invType} onChange={e => setInvType(e.target.value)}>
                <option value="single_phase">Single Phase</option>
                <option value="three_phase">Three Phase</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── AMC ── */}
        <div className={sectionCls}>
          <div className={sectionHead}>AMC</div>
          <div className="flex items-center gap-3 mb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={amcIncluded} onChange={e => setAmcIncluded(e.target.checked)} className="w-4 h-4 rounded" />
              <span className="text-sm text-slate-700">AMC Included in this order</span>
            </label>
          </div>
          {amcIncluded && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
              <div>
                <label className={labelCls}>AMC Plan</label>
                <select className={inputCls} value={amcPlan} onChange={e => setAmcPlan(e.target.value)}>
                  <option value="basic">Basic</option>
                  <option value="comprehensive">Comprehensive</option>
                  <option value="premium">Premium</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Years</label>
                <input className={inputCls} type="number" min="1" max="10" value={amcYears} onChange={e => setAmcYears(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* ── Financials ── */}
        <div className={sectionCls}>
          <div className={sectionHead}>Project Cost</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Sales Quoted Amount (₹)</label>
              <input className={inputCls} type="number" placeholder="Amount quoted to customer" value={salesQuotedAmt} onChange={e => setSalesQuotedAmt(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Final Project Cost (₹) <span className="text-red-500">*</span></label>
              <input className={inputCls} type="number" placeholder="Actual project cost" value={totalProjectCost} onChange={e => setTotalProjectCost(e.target.value)} />
            </div>
          </div>
          {salesQuotedAmt && totalProjectCost && Number(salesQuotedAmt) !== Number(totalProjectCost) && (
            <div className="mt-2">
              <label className={labelCls}>Difference Reason <span className="text-red-500">*</span></label>
              <input className={inputCls} type="text" placeholder="Why quoted ≠ final cost?" value={costDiffReason} onChange={e => setCostDiffReason(e.target.value)} />
            </div>
          )}
        </div>

        {/* ── Payment Structure ── */}
        <div className={sectionCls}>
          <div className={sectionHead}>Payment Structure</div>

          {/* Payment Mode Toggle */}
          <div className="flex gap-2 mb-4">
            {[['direct', '💳 Direct Payment'], ['emi', '📅 EMI']].map(([val, lbl]) => (
              <button key={val} onClick={() => setPaymentMode(val)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${paymentMode === val
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                  }`}>
                {lbl}
              </button>
            ))}
          </div>

          {/* Direct Payment — milestones */}
          {paymentMode === 'direct' && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400 mb-2">Jo milestones applicable nahi hain unhe blank chhod do</p>
              {[
                { key: 'advance', label: 'Advance', color: 'bg-green-50 border-green-200' },
                { key: 'design', label: 'Design Approval', color: 'bg-blue-50 border-blue-200' },
                { key: 'dispatch', label: 'At Dispatch / Delivery', color: 'bg-amber-50 border-amber-200' },
                { key: 'installation', label: 'Installation Complete', color: 'bg-orange-50 border-orange-200' },
                { key: 'commissioning', label: 'Commissioning', color: 'bg-purple-50 border-purple-200' },
              ].map(({ key, label, color }) => (
                <div key={key} className={`flex items-center gap-3 p-2.5 rounded-lg border ${color}`}>
                  <span className="text-xs font-medium text-slate-700 w-44 flex-shrink-0">{label}</span>
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-slate-400 text-xs">₹</span>
                    <input className="input flex-1 py-1.5 text-sm" type="number" placeholder="Amount"
                      value={paymentMilestones[key] ?? ''}
                      onChange={e => setPaymentMilestones(prev => ({ ...prev, [key]: e.target.value }))} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* EMI Payment */}
          {paymentMode === 'emi' && (
            <div className="p-3 bg-pink-50 border border-pink-200 rounded-lg">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Total Amount (₹) <span className="text-red-500">*</span></label>
                  <input className={inputCls} type="number" placeholder="e.g. 150000"
                    value={emiTotalAmount} onChange={e => setEmiTotalAmount(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Tenure (months) <span className="text-red-500">*</span></label>
                  <input className={inputCls} type="number" placeholder="e.g. 12"
                    value={emiTenureMonths} onChange={e => setEmiTenureMonths(e.target.value)} />
                </div>
              </div>
            </div>
          )}
        </div>


      </div>

      {/* ── Corrections / Change Requests ── */}
      <div className={sectionCls}>
        <div className={sectionHead}>Corrections / Change Requests (Ops ke liye)</div>

        {/* Name Change */}
        <label className="flex items-center gap-2 cursor-pointer mb-2">
          <input type="checkbox" checked={nameChangeRequired} onChange={e => setNameChangeRequired(e.target.checked)} className="w-4 h-4 rounded" />
          <span className="text-sm text-slate-700">Name Change Required (bijli bill pe naam alag hai)</span>
        </label>
        {nameChangeRequired && (
          <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <label className={labelCls}>Name change details</label>
            <input className={inputCls} type="text" placeholder="Current name on bill, required name..." value={nameChangeRemark} onChange={e => setNameChangeRemark(e.target.value)} />
          </div>
        )}

        {/* Load Change */}
        <label className="flex items-center gap-2 cursor-pointer mb-2">
          <input type="checkbox" checked={loadChangeRequired} onChange={e => setLoadChangeRequired(e.target.checked)} className="w-4 h-4 rounded" />
          <span className="text-sm text-slate-700">Load Change Required (sanctioned load increase)</span>
        </label>
        {loadChangeRequired && (
          <div className="mb-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <label className={labelCls}>Load change details</label>
            <input className={inputCls} type="text" placeholder="Current load, required load..." value={loadChangeRemark} onChange={e => setLoadChangeRemark(e.target.value)} />
          </div>
        )}

        {/* Other Corrections */}
        <div>
          <label className={labelCls}>Other Correction / Remark (optional)</label>
          <textarea className={`${inputCls} resize-none`} rows={2}
            placeholder="Koi aur special instruction ya correction Ops team ke liye..."
            value={otherCorrectionRemark} onChange={e => setOtherCorrectionRemark(e.target.value)} />
        </div>
      </div>

      {err && <p className="text-xs text-red-500 mt-2">{err}</p>}

      <div className="flex gap-2 pt-3 border-t border-slate-100 mt-2">
        <button onClick={onClose} className="btn flex-1 justify-center">Save Later</button>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center disabled:opacity-50">
          {saving ? 'Submitting...' : '📤 Submit for Approval'}
        </button>
      </div>
    </Modal>
  )
}