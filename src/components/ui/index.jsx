import { X } from 'lucide-react'
import { getDispositionStyle } from '@/config/dispositions'
import { STAGES } from '@/config/stages'

// ── Spinner ──────────────────────────────────────────────────
export function Spinner({ size = 16 }) {
  return (
    <div
      className="border-2 border-blue-600 border-t-transparent rounded-full animate-spin"
      style={{ width: size, height: size, flexShrink: 0 }}
    />
  )
}

// ── Disposition badge ─────────────────────────────────────────
export function DispBadge({ value }) {
  if (!value) return null
  const s = getDispositionStyle(value)
  return (
    <span
      className="disp-badge"
      style={{ background: s.bg, color: s.text, borderColor: s.border }}
    >
      {value}
    </span>
  )
}

// ── Stage badge ───────────────────────────────────────────────
export function StageBadge({ stage }) {
  const s = STAGES[stage]
  if (!s) return null
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border"
      style={{
        background: s.color + '18',
        color: s.color,
        borderColor: s.color + '40',
      }}
    >
      {s.label}
    </span>
  )
}

// ── Avatar initials ───────────────────────────────────────────
export function Avatar({ name, size = 32, color = '#378ADD' }) {
  const initial = name?.[0]?.toUpperCase() ?? '?'
  return (
    <div
      className="rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0"
      style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}
    >
      {initial}
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      {Icon && <Icon size={32} className="text-slate-300" />}
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, width = 520 }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full flex flex-col max-h-[90vh]"
        style={{ maxWidth: width }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={16} className="text-slate-500" />
          </button>
        </div>
        <div className="overflow-y-auto p-5 flex-1">{children}</div>
      </div>
    </div>
  )
}

// ── Section header ────────────────────────────────────────────
export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}

// ── Metric card ───────────────────────────────────────────────
export function MetricCard({ label, value, sub, subColor = 'text-slate-400' }) {
  return (
    <div className="metric-card">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-2xl font-semibold text-slate-800 tracking-tight">{value}</span>
      {sub && <span className={`text-xs ${subColor}`}>{sub}</span>}
    </div>
  )
}

// ── Info row (label + value) ──────────────────────────────────
export function InfoRow({ label, value }) {
  if (!value) return null
  return (
    <div className="flex justify-between py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs font-medium text-slate-700 text-right max-w-[55%]">{value}</span>
    </div>
  )
}
