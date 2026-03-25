import { useState } from 'react'
import { Modal } from '@/components/ui'
import {
  NOT_CONNECTED_DISPOSITIONS,
  CONNECTED_DISPOSITIONS,
  isMeetingDisposition,
  isCallbackDisposition,
  getDispositionStyle,
} from '@/config/dispositions'
import { TIME_SLOTS } from '@/config/timeSlots'

export default function DispositionModal({ open, onClose, onSave, saving, currentDisp }) {
  const [tab, setTab] = useState('not_connected')
  const [disp, setDisp] = useState(currentDisp ?? '')
  const [date, setDate] = useState('')
  const [slot, setSlot] = useState('')
  const [cbDate, setCbDate] = useState('')
  const [cbSlot, setCbSlot] = useState('')

  const showMeetingFields = isMeetingDisposition(disp)
  const showCallbackFields = isCallbackDisposition(disp)
  const saveDisabled = !disp || saving || (showMeetingFields && (!date || !slot))

  function handleSave() {
    onSave(
      disp,
      tab === 'connected' ? 'Connected' : 'Not Connected',
      showMeetingFields ? date : showCallbackFields ? cbDate : null,
      showMeetingFields ? slot : showCallbackFields ? cbSlot : null,
      showMeetingFields ? 'meeting' : showCallbackFields ? 'callback' : null
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Update disposition" width={520}>
      <div className="flex rounded-lg border border-slate-200 overflow-hidden mb-4">
        {['not_connected', 'connected'].map(t => (
          <button key={t} onClick={() => { setTab(t); setDisp('') }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === t ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
            {t === 'not_connected' ? '📵 Not connected' : '✅ Connected'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {(tab === 'not_connected' ? NOT_CONNECTED_DISPOSITIONS : CONNECTED_DISPOSITIONS).map(d => {
          const style = getDispositionStyle(d)
          return (
            <button key={d} onClick={() => setDisp(d)}
              className="text-left px-3 py-2 rounded-lg text-xs border font-medium transition-all"
              style={disp === d
                ? { background: '#1d4ed8', color: '#fff', borderColor: '#1d4ed8' }
                : { background: style.bg, color: style.text, borderColor: style.border }}>
              {d}
            </button>
          )
        })}
      </div>

      {showMeetingFields && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 mb-4">
          <p className="text-xs font-semibold text-green-800 mb-3">Schedule meeting — lead auto-moves to Sales</p>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Meeting date *</label>
              <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} min={new Date().toISOString().split('T')[0]} /></div>
            <div><label className="label">Meeting slot *</label>
              <select className="select" value={slot} onChange={e => setSlot(e.target.value)}>
                <option value="">Select slot</option>
                {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select></div>
          </div>
          {date && slot && <p className="text-xs text-green-700 mt-2 font-medium">✓ Meeting on {date} · {slot}</p>}
        </div>
      )}

      {showCallbackFields && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 mb-4">
          <p className="text-xs font-semibold text-blue-800 mb-3">Schedule callback (optional)</p>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Callback date</label>
              <input type="date" className="input" value={cbDate} onChange={e => setCbDate(e.target.value)} min={new Date().toISOString().split('T')[0]} /></div>
            <div><label className="label">Callback slot</label>
              <select className="select" value={cbSlot} onChange={e => setCbSlot(e.target.value)}>
                <option value="">Select slot</option>
                {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select></div>
          </div>
        </div>
      )}

      <button onClick={handleSave} disabled={saveDisabled} className="btn-primary w-full justify-center py-2.5 disabled:opacity-50">
        {saving ? 'Saving...' : showMeetingFields ? 'Schedule meeting & move to Sales' : 'Save disposition'}
      </button>
    </Modal>
  )
}
