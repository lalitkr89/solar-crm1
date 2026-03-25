import { useState, useEffect, useMemo } from 'react'
import { Modal } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { createLead } from '@/lib/leadService'
import { assignLeadToCurrentUser } from '@/lib/assignment'
import { cleanPhone } from '@/lib/phone'
import { LEAD_SOURCES, PROPERTY_TYPES, OWNERSHIP_TYPES, ROOF_TYPES, SYSTEM_TYPES } from '../config/constants'
import ReferralFields from '../components/ReferralFields'

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Chandigarh', 'Puducherry',
  'Andaman and Nicobar', 'Dadra and Nagar Haveli', 'Lakshadweep',
]

function initialForm() {
  return {
    name: '', phone: '', alternate_phone: '', email: '',
    city: '', state: '', pincode: '', address: '',
    calling_date: new Date().toISOString().split('T')[0],
    lead_source: '', remarks: '',
    property_type: '', ownership: '', roof_type: '', roof_area: '',
    electricity_board: '', sanctioned_load: '', monthly_bill: '', units_per_month: '',
    system_size_kw: '', system_type: '',
    referral_type: '', referral_name: '', referral_id: '',
  }
}

export default function AddLeadModal({ open, onClose, onAdded, isAgent, agentId, isManager }) {
  const [form, setForm] = useState(initialForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [dupeLead, setDupeLead] = useState(null)
  const [checkingDupe, setCheckingDupe] = useState(false)
  const [agents, setAgents] = useState([])
  const [selAgent, setSelAgent] = useState('')

  useEffect(() => {
    if (open && isManager) {
      supabase.from('users').select('id, name').eq('role', 'presales_agent').eq('is_active', true).order('name')
        .then(({ data }) => setAgents(data ?? []))
    }
  }, [open, isManager])

  function set(f, v) { setForm(p => ({ ...p, [f]: v })) }

  // ── Solar auto-calculator (monthly bill + roof area se) ────
  const solarCalc = useMemo(() => {
    const bill = parseFloat(form.monthly_bill)
    const roofArea = parseFloat(form.roof_area)
    if (!bill || bill <= 0) return null
    const units = bill / 8
    const requiredKw = units / 120
    const recommendedKw = Math.round(requiredKw)
    const roofCapacity = roofArea > 0 ? roofArea / 100 : Infinity
    const roofLimited = roofArea > 0 && roofCapacity < recommendedKw
    const finalKw = roofLimited ? Math.floor(roofCapacity) : recommendedKw
    return {
      units: Math.round(units * 10) / 10,
      requiredKw: Math.round(requiredKw * 10) / 10,
      finalKw,
      roofLimited,
      roofNeeded: recommendedKw * 100,
    }
  }, [form.monthly_bill, form.roof_area])

  function handleClose() {
    onClose()
    setDupeLead(null)
    setError('')
    setPhoneError('')
    setForm(initialForm())
    setSelAgent('')
  }

  async function handlePhoneChange(val) {
    set('phone', val)
    setDupeLead(null)
    setError('')

    const cleaned = cleanPhone(val)
    if (val.trim() === '') { setPhoneError(''); return }
    if (cleaned.length !== 10) {
      setPhoneError('Phone 10 digits ka hona chahiye (91, +91, 0 auto-remove ho jaata hai)')
      return
    }
    setPhoneError('')

    setCheckingDupe(true)
    const { data: existing } = await supabase
      .from('leads')
      .select('id, name, phone, alternate_phone, email, city, state, pincode, address, lead_source, calling_date, property_type, ownership, roof_type, roof_area, electricity_board, sanctioned_load, monthly_bill, units_per_month, system_size_kw, system_type, referral_type, referral_name, referral_id, remarks, stage, disposition')
      .or(`phone.eq.${cleaned},alternate_phone.eq.${cleaned}`)
      .maybeSingle()
    setCheckingDupe(false)

    if (existing) {
      setDupeLead(existing)
      setForm({
        name: existing.name ?? '', phone: val,
        alternate_phone: existing.alternate_phone ?? '',
        email: existing.email ?? '', city: existing.city ?? '',
        state: existing.state ?? '',
        pincode: existing.pincode ?? '', address: existing.address ?? '',
        calling_date: existing.calling_date ?? new Date().toISOString().split('T')[0],
        lead_source: existing.lead_source ?? '', remarks: existing.remarks ?? '',
        property_type: existing.property_type ?? '', ownership: existing.ownership ?? '',
        roof_type: existing.roof_type ?? '', roof_area: existing.roof_area ?? '',
        electricity_board: existing.electricity_board ?? '',
        sanctioned_load: existing.sanctioned_load ?? '',
        monthly_bill: existing.monthly_bill ?? '',
        units_per_month: existing.units_per_month ?? '',
        system_size_kw: existing.system_size_kw ?? '',
        system_type: existing.system_type ?? '',
        referral_type: existing.referral_type ?? '',
        referral_name: existing.referral_name ?? '',
        referral_id: existing.referral_id ?? '',
      })
    }
  }

  async function handleSubmit() {
    if (!form.phone) { setError('Phone number is required'); return }
    const cleaned = cleanPhone(form.phone)
    if (cleaned.length !== 10) { setError('Phone number 10 digits ka hona chahiye'); return }
    if (dupeLead) { setError('Duplicate lead hai — "Edit Lead" button se existing lead edit karo'); return }

    setSaving(true)
    setError('')
    try {
      const lead = await createLead(form)
      if (isAgent) {
        await assignLeadToCurrentUser(lead.id, agentId)
      } else if (selAgent) {
        await assignLeadToCurrentUser(lead.id, selAgent)
      }
      onAdded()
      setForm(initialForm())
      setDupeLead(null)
      setSelAgent('')
    } catch (e) {
      setError(e.message || 'Error saving lead')
    } finally {
      setSaving(false)
    }
  }

  function handleEditExisting() {
    if (dupeLead) window.location.href = `/leads/${dupeLead.id}`
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add new lead" width={640}>
      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}
      <div className="flex flex-col gap-5">

        {/* Contact details */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 pb-1 border-b border-slate-100">Contact details</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Full name</label>
              <input className="input" placeholder="Customer full name"
                value={form.name} onChange={e => set('name', e.target.value)} />
            </div>

            <div>
              <label className="label">Phone <span className="text-red-500">*</span></label>
              <div className="relative">
                <input
                  className={`input pr-8 ${dupeLead ? 'border-amber-400 bg-amber-50 focus:ring-amber-400' : phoneError ? 'border-red-400 bg-red-50 focus:ring-red-400' : ''}`}
                  placeholder="10-digit mobile"
                  value={form.phone}
                  onChange={e => handlePhoneChange(e.target.value)}
                />
                {checkingDupe && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              {phoneError && !dupeLead && (
                <p className="mt-1 text-xs text-red-600 font-medium">⚠️ {phoneError}</p>
              )}
              {dupeLead && (
                <div className="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-300">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-amber-800">⚠️ Number already exists!</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        <span className="font-medium">{dupeLead.name || 'Unknown'}</span>
                        {' · '}
                        <span className="capitalize">{dupeLead.stage?.replace(/_/g, ' ')}</span>
                        {dupeLead.disposition && <span className="text-amber-600"> · {dupeLead.disposition}</span>}
                      </p>
                      <p className="text-xs text-amber-600 mt-0.5">You can only edit this lead, not add a new one.</p>
                    </div>
                    <button type="button" onClick={handleEditExisting}
                      className="flex-shrink-0 text-xs bg-amber-500 text-white px-2.5 py-1.5 rounded-lg hover:bg-amber-600 font-medium whitespace-nowrap">
                      Edit Lead →
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="label">Alternate phone</label>
              <input className="input" placeholder="Optional"
                value={form.alternate_phone} onChange={e => set('alternate_phone', e.target.value)} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" placeholder="Optional"
                value={form.email} onChange={e => set('email', e.target.value)} />
            </div>

            {/* City + State */}
            <div>
              <label className="label">City</label>
              <input className="input" placeholder="City"
                value={form.city} onChange={e => set('city', e.target.value)} />
            </div>
            <div>
              <label className="label">State</label>
              <select className="select" value={form.state} onChange={e => set('state', e.target.value)}>
                <option value="">Select state</option>
                {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="label">Pincode</label>
              <input className="input" placeholder="6-digit"
                value={form.pincode} onChange={e => set('pincode', e.target.value)} />
            </div>
            <div>
              <label className="label">Lead source</label>
              <select className="select" value={form.lead_source} onChange={e => {
                set('lead_source', e.target.value)
                if (e.target.value !== 'Referral') {
                  set('referral_type', '')
                  set('referral_name', '')
                  set('referral_id', '')
                }
              }}>
                <option value="">Select source</option>
                {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Calling date</label>
              <input className="input" type="date"
                value={form.calling_date} onChange={e => set('calling_date', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Address</label>
              <input className="input" placeholder="Full address"
                value={form.address} onChange={e => set('address', e.target.value)} />
            </div>
            {form.lead_source === 'Referral' && <ReferralFields form={form} set={set} />}
          </div>
        </div>

        {/* Manager — agent assign */}
        {isManager && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 pb-1 border-b border-slate-100">Assignment</p>
            <div>
              <label className="label">Pre-assign to agent (optional — warna unassigned pool mein jayegi)</label>
              <select className="select" value={selAgent} onChange={e => setSelAgent(e.target.value)}>
                <option value="">— Unassigned pool (calling start pe assign hogi) —</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Property & electricity */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 pb-1 border-b border-slate-100">Property & electricity</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Property type</label>
              <select className="select" value={form.property_type} onChange={e => set('property_type', e.target.value)}>
                <option value="">Select</option>
                {PROPERTY_TYPES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Ownership</label>
              <select className="select" value={form.ownership} onChange={e => set('ownership', e.target.value)}>
                <option value="">Select</option>
                {OWNERSHIP_TYPES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Roof type</label>
              <select className="select" value={form.roof_type} onChange={e => set('roof_type', e.target.value)}>
                <option value="">Select</option>
                {ROOF_TYPES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Roof area (sq ft)</label>
              <input className="input" type="number" placeholder="e.g. 500"
                value={form.roof_area} onChange={e => set('roof_area', e.target.value)} />
            </div>
            <div>
              <label className="label">Electricity board</label>
              <input className="input" placeholder="e.g. PVVNL, BSES"
                value={form.electricity_board} onChange={e => set('electricity_board', e.target.value)} />
            </div>
            <div>
              <label className="label">Sanctioned load (kW)</label>
              <input className="input" type="number" placeholder="e.g. 5"
                value={form.sanctioned_load} onChange={e => set('sanctioned_load', e.target.value)} />
            </div>
            <div>
              <label className="label">Monthly bill (₹)</label>
              <input className="input" type="number" placeholder="e.g. 3000"
                value={form.monthly_bill} onChange={e => set('monthly_bill', e.target.value)} />
            </div>

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
                value={form.units_per_month} onChange={e => set('units_per_month', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Solar details */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 pb-1 border-b border-slate-100">Solar details</p>
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
                value={form.system_size_kw} onChange={e => set('system_size_kw', e.target.value)} />
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
              <select className="select" value={form.system_type} onChange={e => set('system_type', e.target.value)}>
                <option value="">Select</option>
                {SYSTEM_TYPES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Remarks</label>
              <textarea className="input resize-none" rows={2} placeholder="Notes from the call..."
                value={form.remarks} onChange={e => set('remarks', e.target.value)} />
            </div>
          </div>
        </div>

      </div>

      <div className="flex gap-2 mt-5 pt-4 border-t border-slate-100">
        <button type="button" onClick={handleClose} className="btn flex-1 justify-center">Cancel</button>
        {dupeLead ? (
          <button type="button" onClick={handleEditExisting}
            className="flex-1 justify-center inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 border-0">
            Edit Existing Lead →
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={saving || !form.phone || !!phoneError}
            className="btn-primary flex-1 justify-center disabled:opacity-50">
            {saving ? 'Adding...' : 'Add lead'}
          </button>
        )}
      </div>
    </Modal>
  )
}