import { PhoneOff } from 'lucide-react'

export default function CallingBanner({ onStop }) {
  return (
    <div className="mb-3 px-4 py-2.5 rounded-xl flex items-center gap-3"
      style={{ background: '#dcfce7', border: '1px solid #86efac' }}>
      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
      <span className="text-sm font-medium text-green-800">
        Calling mode active — disposition save karne ke baad next lead automatically open hogi
      </span>
      <button onClick={onStop}
        className="ml-auto text-xs font-semibold text-red-600 hover:text-red-800 flex items-center gap-1">
        <PhoneOff size={12} /> Stop
      </button>
    </div>
  )
}
