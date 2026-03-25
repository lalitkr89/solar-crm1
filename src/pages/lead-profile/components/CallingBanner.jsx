import { ChevronRight, PhoneOff } from 'lucide-react'

export default function CallingBanner({ mode, type, currentPos, totalInQueue, onNext, onStop }) {
  if (mode === 'presales') {
    return (
      <div className="mb-3 px-4 py-2.5 rounded-xl flex items-center gap-3"
        style={{ background: '#fef3c7', border: '1px solid #fcd34d' }}>
        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
        <div className="flex-1">
          <span className="text-sm font-semibold text-amber-800">📞 Calling Mode</span>
          <span className="text-xs text-amber-700 ml-2">
            Lead {currentPos} of {totalInQueue} — disposition save ke baad next lead khulegi
          </span>
        </div>
        <button onClick={onNext} className="flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900 px-2 py-1 rounded-lg hover:bg-amber-100 transition-colors">
          Skip <ChevronRight size={13} />
        </button>
        <button onClick={onStop} className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-800 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">
          <PhoneOff size={13} /> Stop
        </button>
      </div>
    )
  }

  const isFollowup = type === 'followup'
  const colors = isFollowup
    ? { bg: '#ede9fe', border: '#c4b5fd', dot: 'bg-purple-500', label: 'text-purple-800', sub: 'text-purple-700' }
    : { bg: '#dcfce7', border: '#86efac', dot: 'bg-green-500', label: 'text-green-800', sub: 'text-green-700' }

  return (
    <div className="mb-3 px-4 py-2.5 rounded-xl flex items-center gap-3"
      style={{ background: colors.bg, border: `1px solid ${colors.border}` }}>
      <div className={`w-2 h-2 rounded-full animate-pulse flex-shrink-0 ${colors.dot}`} />
      <div className="flex-1">
        <span className={`text-sm font-semibold ${colors.label}`}>
          {isFollowup ? '📈 Follow Up Mode' : '📞 Sales Calling Mode'}
        </span>
        <span className={`text-xs ml-2 ${colors.sub}`}>
          Lead {currentPos} of {totalInQueue}
        </span>
      </div>
      <button onClick={onNext} className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 px-2 py-1 rounded-lg hover:bg-white/50 transition-colors">
        Skip <ChevronRight size={13} />
      </button>
      <button onClick={onStop} className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-800 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">
        <PhoneOff size={13} /> Stop
      </button>
    </div>
  )
}
