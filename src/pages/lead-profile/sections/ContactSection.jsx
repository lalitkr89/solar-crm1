import ReferralFields from './ReferralFields'

// All Indian states + UTs for the dropdown
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  // Union Territories
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Chandigarh', 'Puducherry',
  'Andaman and Nicobar', 'Dadra and Nagar Haveli', 'Lakshadweep',
]

export default function ContactSection({ form, set }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 pb-1 border-b border-slate-100">Contact details</p>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Full name</label><input className="input" value={form.name ?? ''} onChange={e => set('name', e.target.value)} /></div>
        <div><label className="label">Phone <span className="text-red-500">*</span></label><input className="input" value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} /></div>
        <div><label className="label">Alternate phone</label><input className="input" value={form.alternate_phone ?? ''} onChange={e => set('alternate_phone', e.target.value)} /></div>
        <div><label className="label">Email</label><input className="input" type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)} /></div>

        {/* City + State side by side */}
        <div>
          <label className="label">City</label>
          <input className="input" value={form.city ?? ''} onChange={e => set('city', e.target.value)} />
        </div>
        <div>
          <label className="label">State</label>
          <select className="select" value={form.state ?? ''} onChange={e => set('state', e.target.value)}>
            <option value="">Select state</option>
            {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div><label className="label">Pincode</label><input className="input" value={form.pincode ?? ''} onChange={e => set('pincode', e.target.value)} /></div>
        <div>
          <label className="label">Lead source</label>
          <select className="select" value={form.lead_source ?? ''} onChange={e => {
            set('lead_source', e.target.value)
            if (e.target.value !== 'Referral') { set('referral_type', ''); set('referral_name', ''); set('referral_id', '') }
          }}>
            <option value="">Select source</option>
            {['Facebook Ad', 'Google Ad', 'Instagram', 'YouTube', 'Referral', 'Walk-in', 'Website', 'IVR', 'Other'].map(s =>
              <option key={s} value={s}>{s}</option>
            )}
          </select>
        </div>
        <div>
          <label className="label">Calling date
            {!form.calling_date && (
              <button type="button" onClick={() => set('calling_date', new Date().toISOString().split('T')[0])}
                className="ml-2 text-blue-500 text-xs underline">Set today</button>
            )}
          </label>
          <input type="date" className="input" value={form.calling_date ?? ''} onChange={e => set('calling_date', e.target.value)} />
        </div>
        <div className="col-span-2"><label className="label">Address</label><input className="input" value={form.address ?? ''} onChange={e => set('address', e.target.value)} /></div>
        {form.lead_source === 'Referral' && <ReferralFields form={form} set={set} />}
      </div>
    </div>
  )
}