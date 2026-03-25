export default function ReferralFields({ form, set }) {
  return (
    <div>
      <label className="label">Referral Name</label>
      <input
        className="input w-full"
        placeholder="Enter referral name"
        value={form.referral_name || ''}
        onChange={e => set('referral_name', e.target.value)}
      />

      <label className="label mt-2">Referral Phone</label>
      <input
        className="input w-full"
        placeholder="Enter referral phone"
        value={form.referral_phone || ''}
        onChange={e => set('referral_phone', e.target.value)}
      />
    </div>
  )
}