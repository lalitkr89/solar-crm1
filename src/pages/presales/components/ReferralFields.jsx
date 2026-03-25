import { REFERRAL_TYPES } from '../config/constants'

export default function ReferralFields({ form, set }) {
  const showNameId = form.referral_type === 'Existing Customer' || form.referral_type === 'SolarPro'
  const showNameOnly = form.referral_type === 'Employee' || form.referral_type === 'Others'

  return (
    <div className="col-span-2 rounded-xl border border-purple-200 bg-purple-50 p-3">
      <p className="text-xs font-semibold text-purple-800 mb-3">🔗 Referral details</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Referred by</label>
          <select className="select" value={form.referral_type ?? ''} onChange={e => {
            set('referral_type', e.target.value)
            set('referral_name', '')
            set('referral_id', '')
          }}>
            <option value="">Select type</option>
            {REFERRAL_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {showNameId && (<>
          <div>
            <label className="label">
              {form.referral_type === 'Existing Customer' ? 'Customer name' : 'Partner name'}
              <span className="text-red-500 ml-0.5">*</span>
            </label>
            <input className="input" placeholder="Full name"
              value={form.referral_name ?? ''} onChange={e => set('referral_name', e.target.value)} />
          </div>
          <div>
            <label className="label">
              {form.referral_type === 'Existing Customer' ? 'Customer ID' : 'Partner ID'}
            </label>
            <input className="input" placeholder="ID / Account number"
              value={form.referral_id ?? ''} onChange={e => set('referral_id', e.target.value)} />
          </div>
        </>)}
        {showNameOnly && (
          <div>
            <label className="label">Name</label>
            <input className="input" placeholder="Referrer ka naam"
              value={form.referral_name ?? ''} onChange={e => set('referral_name', e.target.value)} />
          </div>
        )}
      </div>
    </div>
  )
}
