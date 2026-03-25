import { isMeetingDisposition, isCallbackDisposition, NOT_CONNECTED_DISPOSITIONS, CONNECTED_DISPOSITIONS } from '@/config/dispositions'
import { TIME_SLOTS } from '@/config/timeSlots'

export default function DispositionSection({ form, set }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 pb-1 border-b border-slate-100">Call status & disposition</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Call status</label>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            {['Not Connected', 'Connected'].map(s => (
              <button key={s} type="button" onClick={() => { set('call_status', s); set('disposition', '') }}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${form.call_status === s ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                {s === 'Not Connected' ? '📵 Not connected' : '✅ Connected'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Disposition</label>
          <select className="select" value={form.disposition ?? ''} onChange={e => set('disposition', e.target.value)}>
            <option value="">Select disposition</option>
            {(form.call_status === 'Connected' ? CONNECTED_DISPOSITIONS : NOT_CONNECTED_DISPOSITIONS).map(d =>
              <option key={d} value={d}>{d}</option>
            )}
          </select>
        </div>
        {isMeetingDisposition(form.disposition) && (<>
          <div><label className="label">Meeting date</label>
            <input type="date" className="input" value={form.meeting_date ?? ''} onChange={e => set('meeting_date', e.target.value)} min={new Date().toISOString().split('T')[0]} /></div>
          <div><label className="label">Meeting slot</label>
            <select className="select" value={form.meeting_slot ?? ''} onChange={e => set('meeting_slot', e.target.value)}>
              <option value="">Select slot</option>
              {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select></div>
        </>)}
        {isCallbackDisposition(form.disposition) && (<>
          <div><label className="label">Callback date</label>
            <input type="date" className="input" value={form.callback_date ?? ''} onChange={e => set('callback_date', e.target.value)} min={new Date().toISOString().split('T')[0]} /></div>
          <div><label className="label">Callback slot</label>
            <select className="select" value={form.callback_slot ?? ''} onChange={e => set('callback_slot', e.target.value)}>
              <option value="">Select slot</option>
              {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select></div>
        </>)}
      </div>
    </div>
  )
}
