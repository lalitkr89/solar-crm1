import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import Layout from '@/components/layout/Layout'
import { Spinner } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { format, subMonths, startOfMonth, endOfMonth, parseISO, differenceInCalendarMonths } from 'date-fns'
import { RefreshCw, ChevronRight, TrendingUp, TrendingDown, Minus, Calendar, X } from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────
const inr = n =>
  n == null ? '—' : '₹' + Number(n).toLocaleString('en-IN')

const pct = (a, b) =>
  !b || b === 0 ? null : Math.round((a / b) * 100)

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

const fmt = d => format(d, 'yyyy-MM-dd')
const fmtDisplay = d => format(d, 'd MMM yyyy')

// ── Constants ─────────────────────────────────────────────────
const MEETING_STAGES = [
  'meeting_scheduled',
  'meeting_done',
  'qc_followup',
  'sale_pending_approval',
  'sale_closed',
  'sale_rejected',
]

const OUTCOME_META = {
  meeting_done_order_closed: { label: 'Order Closed', color: '#10b981' },
  meeting_done_hot: { label: 'HOT', color: '#f59e0b' },
  meeting_done_moderate: { label: 'Moderate', color: '#3b82f6' },
  meeting_done_cold: { label: 'Cold', color: '#8b5cf6' },
  meeting_rescheduled: { label: 'Rescheduled', color: '#06b6d4' },
  call_later_interested: { label: 'Call Later', color: '#6366f1' },
  call_later_underconstruction: { label: 'Under Const.', color: '#64748b' },
  not_interested: { label: 'Not Interested', color: '#ef4444' },
  non_qualified_roof: { label: 'NQ – Roof', color: '#f43f5e' },
  non_qualified_bill: { label: 'NQ – Bill', color: '#f43f5e' },
  non_qualified_ownership: { label: 'NQ – Ownership', color: '#f43f5e' },
  call_not_connected_1: { label: 'NC 1', color: '#94a3b8' },
  call_not_connected_2: { label: 'NC 2', color: '#94a3b8' },
  call_not_connected_3: { label: 'NC 3', color: '#94a3b8' },
  solarpro_enquiry: { label: 'SolarPro', color: '#94a3b8' },
  multiple_nc_rearrange: { label: 'Multiple NC', color: '#94a3b8' },
}

// ── Styles (shared) ───────────────────────────────────────────
const card = {
  background: 'var(--color-bg-card, white)',
  borderRadius: 12,
  border: '1px solid var(--color-border, #8fb3e2)',
  padding: '16px 20px',
}

// ─────────────────────────────────────────────────────────────
// DATE RANGE PICKER  (NEW)
// Shows a popover with:
//   • Quick presets: Today, Last 7d, 1M, 3M, 6M, 1Y, All time
//   • Custom: two date inputs (from / to)
// ─────────────────────────────────────────────────────────────
const PRESETS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'This month', thisMonth: true },
  { label: 'Last month', lastMonth: true },
  { label: 'Last 3 months', months: 3 },
  { label: 'Last 6 months', months: 6 },
  { label: 'Last 1 year', months: 12 },
  { label: 'All time', allTime: true },
]

function getPresetRange(preset) {
  const today = new Date()
  if (preset.days) {
    const from = new Date(today); from.setDate(from.getDate() - preset.days + 1)
    return { from: fmt(from), to: fmt(today) }
  }
  if (preset.thisMonth) {
    return { from: fmt(startOfMonth(today)), to: fmt(today) }
  }
  if (preset.lastMonth) {
    const prev = subMonths(today, 1)
    return { from: fmt(startOfMonth(prev)), to: fmt(endOfMonth(prev)) }
  }
  if (preset.months) {
    return { from: fmt(subMonths(startOfMonth(today), preset.months - 1)), to: fmt(today) }
  }
  if (preset.allTime) {
    return { from: '2020-01-01', to: fmt(today) }
  }
  return null
}

function DateRangePicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [customFrom, setCustomFrom] = useState(value.from)
  const [customTo, setCustomTo] = useState(value.to)
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Sync custom inputs when value changes externally
  useEffect(() => { setCustomFrom(value.from); setCustomTo(value.to) }, [value.from, value.to])

  function applyPreset(preset) {
    const range = getPresetRange(preset)
    if (range) { onChange(range); setOpen(false) }
  }

  function applyCustom() {
    if (!customFrom || !customTo) return
    if (customFrom > customTo) return
    onChange({ from: customFrom, to: customTo })
    setOpen(false)
  }

  // Display label
  const displayLabel = useMemo(() => {
    const matchedPreset = PRESETS.find(p => {
      const r = getPresetRange(p)
      return r && r.from === value.from && r.to === value.to
    })
    if (matchedPreset) return matchedPreset.label
    return `${fmtDisplay(parseISO(value.from))} – ${fmtDisplay(parseISO(value.to))}`
  }, [value])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: open ? '#3b82f6' : '#1e293b',
          border: `1px solid ${open ? '#3b82f6' : '#334155'}`,
          borderRadius: 8, color: open ? 'white' : '#e2e8f0',
          fontSize: 12, fontWeight: 500,
          padding: '6px 12px', cursor: 'pointer',
          transition: 'all 0.15s', whiteSpace: 'nowrap',
        }}
      >
        <Calendar size={12} />
        {displayLabel}
      </button>

      {/* Popover */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 999,
          background: '#0f172a', border: '1px solid #1e293b',
          borderRadius: 12, padding: 16, width: 280,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          {/* Quick presets */}
          <p style={{ fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
            Quick select
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {PRESETS.map(preset => {
              const r = getPresetRange(preset)
              const active = r && r.from === value.from && r.to === value.to
              return (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset)}
                  style={{
                    fontSize: 11, fontWeight: 500,
                    padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                    border: `1px solid ${active ? '#3b82f6' : '#1e293b'}`,
                    background: active ? '#3b82f6' : '#1e293b',
                    color: active ? 'white' : '#94a3b8',
                    transition: 'all 0.12s',
                  }}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: '#1e293b', marginBottom: 14 }} />

          {/* Custom range */}
          <p style={{ fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>
            Custom range
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 10, color: '#64748b', display: 'block', marginBottom: 4 }}>From</label>
              <input
                type="date"
                value={customFrom}
                max={customTo || fmt(new Date())}
                onChange={e => setCustomFrom(e.target.value)}
                style={{
                  width: '100%', padding: '6px 10px', borderRadius: 6, fontSize: 12,
                  background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#64748b', display: 'block', marginBottom: 4 }}>To</label>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                max={fmt(new Date())}
                onChange={e => setCustomTo(e.target.value)}
                style={{
                  width: '100%', padding: '6px 10px', borderRadius: 6, fontSize: 12,
                  background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
          <button
            onClick={applyCustom}
            disabled={!customFrom || !customTo || customFrom > customTo}
            style={{
              width: '100%', padding: '7px 0', borderRadius: 7, fontSize: 12,
              fontWeight: 600, cursor: 'pointer', border: 'none',
              background: (!customFrom || !customTo || customFrom > customTo) ? '#1e293b' : '#3b82f6',
              color: (!customFrom || !customTo || customFrom > customTo) ? '#475569' : 'white',
              transition: 'all 0.15s',
            }}
          >
            Apply range
          </button>
        </div>
      )}
    </div>
  )
}

// ── Canvas Bar Chart (stacked pipeline + closed) ──────────────
// Each month shows two bars:
//   Left  — total meetings (stacked: closed | hot | moderate | cold | other)
//   Right — a single closed bar for quick comparison
const LEGEND_ITEMS = [
  { color: '#10b981', label: 'Closed' },
  { color: '#f59e0b', label: 'HOT' },
  { color: '#3b82f6', label: 'Moderate' },
  { color: '#8b5cf6', label: 'Cold' },
  { color: '#94a3b8', label: 'Other' },
]

function drawRoundedRect(ctx, x, y, w, h, radii) {
  if (h <= 0) return
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, radii)
  } else {
    ctx.rect(x, y, w, h)
  }
}

function BarChart({ data }) {
  const canvasRef = useRef(null)
  const tooltipRef = useRef(null)
  const animRef = useRef(null)
  const progressRef = useRef(0)

  const draw = useCallback((progress = 1) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    if (!rect.width) return
    const dpr = window.devicePixelRatio || 1
    const W = rect.width
    const H = 200
    canvas.width = W * dpr
    canvas.height = H * dpr
    canvas.style.height = H + 'px'
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    const PT = 10, PR = 10, PB = 32, PL = 40
    const iW = W - PL - PR
    const iH = H - PT - PB
    const maxVal = Math.max(...data.map(d => d.meetings), 1)
    const slotW = iW / data.length
    const bW = Math.floor(slotW * 0.38)
    const yTicks = 4

    // grid + y labels
    for (let i = 0; i <= yTicks; i++) {
      const y = PT + (iH / yTicks) * i
      const val = Math.round(maxVal - (maxVal / yTicks) * i)
      ctx.strokeStyle = 'rgba(148,163,184,0.12)'
      ctx.lineWidth = 0.5
      ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(W - PR, y); ctx.stroke()
      ctx.fillStyle = 'rgba(148,163,184,0.8)'
      ctx.font = '10px system-ui,sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(val, PL - 6, y + 4)
    }

    data.forEach((d, i) => {
      const cx = PL + slotW * i + slotW / 2
      const base = PT + iH // bottom of chart area
      const other = Math.max(0, d.meetings - d.closed - d.hot - d.moderate - d.cold)

      const stackOrder = [
        { val: other, color: 'rgba(148,163,184,0.45)' },
        { val: d.cold, color: '#8b5cf6' },
        { val: d.moderate, color: '#3b82f6' },
        { val: d.hot, color: '#f59e0b' },
        { val: d.closed, color: '#10b981' },
      ]

      let stackY = base
      stackOrder.forEach(({ val, color }, si) => {
        const segH = clamp((val / maxVal) * iH * progress, 0, iH)
        if (segH < 0.5) return
        ctx.fillStyle = color
        ctx.beginPath()
        const isTop = si === stackOrder.length - 1 ||
          stackOrder.slice(si + 1).every(s => (s.val / maxVal) * iH * progress < 0.5)
        drawRoundedRect(ctx, cx - bW / 2, stackY - segH, bW, segH, isTop ? [3, 3, 0, 0] : [0])
        ctx.fill()
        stackY -= segH
      })

      ctx.fillStyle = 'rgba(148,163,184,0.9)'
      ctx.font = '10px system-ui,sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(d.label, cx, H - 8)
    })
  }, [data])

  useEffect(() => {
    progressRef.current = 0
    if (animRef.current) cancelAnimationFrame(animRef.current)
    const start = performance.now()
    const animate = (now) => {
      const p = Math.min((now - start) / 700, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      progressRef.current = ease
      draw(ease)
      if (p < 1) animRef.current = requestAnimationFrame(animate)
    }
    animRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animRef.current)
  }, [draw])

  useEffect(() => {
    const ro = new ResizeObserver(() => draw(progressRef.current))
    if (canvasRef.current) ro.observe(canvasRef.current)
    return () => ro.disconnect()
  }, [draw])

  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current
    const tip = tooltipRef.current
    if (!canvas || !tip) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const PL = 40, PR = 10
    const slotW = (rect.width - PL - PR) / data.length
    const i = Math.floor((x - PL) / slotW)
    if (i < 0 || i >= data.length) { tip.style.opacity = '0'; return }
    const d = data[i]
    const other = Math.max(0, d.meetings - d.closed - d.hot - d.moderate - d.cold)
    const rows = [
      { color: '#10b981', label: 'Closed', val: d.closed },
      { color: '#f59e0b', label: 'HOT', val: d.hot },
      { color: '#3b82f6', label: 'Moderate', val: d.moderate },
      { color: '#8b5cf6', label: 'Cold', val: d.cold },
      { color: '#94a3b8', label: 'Other', val: other },
    ].filter(r => r.val > 0)

    tip.innerHTML = `
      <strong style="display:block;font-size:11px;font-weight:600;color:#1e293b;margin-bottom:6px">
        ${d.label} — ${d.meetings} meetings
      </strong>
      ${rows.map(r => `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:11px;color:#64748b;margin-top:3px">
          <div style="display:flex;align-items:center;gap:5px">
            <span style="width:7px;height:7px;border-radius:50%;background:${r.color};display:inline-block;flex-shrink:0"></span>
            ${r.label}
          </div>
          <span style="font-weight:600;color:#1e293b">${r.val}</span>
        </div>
      `).join('')}
    `
    const tipLeft = Math.min(e.clientX - rect.left + 12, rect.width - 160)
    tip.style.left = tipLeft + 'px'
    tip.style.top = Math.max(4, e.clientY - rect.top - 100) + 'px'
    tip.style.opacity = '1'
  }, [data])

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginBottom: 12 }}>
        {LEGEND_ITEMS.map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
            <span style={{ fontSize: 11, color: '#64748b' }}>{label}</span>
          </div>
        ))}
      </div>
      <div ref={tooltipRef} style={{
        position: 'absolute', background: 'white', border: '1px solid #e2e8f0',
        borderRadius: 8, padding: '8px 12px', pointerEvents: 'none',
        opacity: 0, transition: 'opacity 0.1s', zIndex: 10,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)', minWidth: 150,
      }} />
      <canvas
        ref={canvasRef}
        style={{ width: '100%', display: 'block', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { if (tooltipRef.current) tooltipRef.current.style.opacity = '0' }}
      />
    </div>
  )
}

// ── SVG Donut ─────────────────────────────────────────────────
function Donut({ slices, winRate }) {
  const r = 54, cx = 75, cy = 75, size = 150
  const total = slices.reduce((s, d) => s + d.value, 0)
  const display = winRate != null ? winRate + '%' : '—'

  if (total === 0) return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth="20" />
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize="14" fill="#94a3b8">—</text>
    </svg>
  )

  let angle = -Math.PI / 2
  const paths = slices.filter(s => s.value > 0).map(s => {
    const sweep = (s.value / total) * 2 * Math.PI
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle)
    angle += sweep
    const x2 = cx + r * Math.cos(angle), y2 = cy + r * Math.sin(angle)
    return { ...s, d: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${sweep > Math.PI ? 1 : 0},1 ${x2},${y2} Z` }
  })

  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size, flexShrink: 0 }}>
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.color} stroke="white" strokeWidth="2">
          <title>{p.label}: {p.value}</title>
        </path>
      ))}
      <circle cx={cx} cy={cy} r={r - 20} fill="white" />
      <text x={cx} y={cy - 5} textAnchor="middle" fontSize="22" fontWeight="700" fill="#1e293b">{display}</text>
      <text x={cx} y={cy + 13} textAnchor="middle" fontSize="9" fill="#94a3b8" letterSpacing="0.06em">WIN RATE</text>
    </svg>
  )
}

// ── KPI Tile ──────────────────────────────────────────────────
function KpiTile({ label, value, sub, accent, delta }) {
  const deltaColor = delta > 0 ? '#10b981' : delta < 0 ? '#ef4444' : '#64748b'
  const DeltaIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus
  const deltaBg = delta > 0 ? 'rgba(16,185,129,0.1)' : delta < 0 ? 'rgba(239,68,68,0.1)' : 'rgba(100,116,139,0.1)'

  return (
    <div style={{
      background: '#0f172a', borderRadius: 12, padding: '16px 18px',
      borderLeft: `3px solid ${accent}`, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', right: -14, top: -14, width: 68, height: 68,
        borderRadius: '50%', background: accent + '15',
      }} />
      <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#f1f5f9', lineHeight: 1, marginBottom: 6 }}>
        {value}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {delta != null && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 2,
            background: deltaBg, borderRadius: 4, padding: '1px 5px',
          }}>
            <DeltaIcon size={10} color={deltaColor} />
          </span>
        )}
        <span style={{ fontSize: 11, color: '#475569' }}>{sub}</span>
      </div>
    </div>
  )
}

// ── Funnel Step ───────────────────────────────────────────────
function FunnelStep({ label, count, total, color, isLast }) {
  const w = pct(count, total) ?? 0
  return (
    <div style={{ marginBottom: isLast ? 0 : 2 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: '#64748b' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>
          {count} <span style={{ color: '#94a3b8', fontWeight: 400 }}>({w}%)</span>
        </span>
      </div>
      <div style={{ height: 5, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden', marginBottom: isLast ? 0 : 10 }}>
        <div style={{ height: '100%', borderRadius: 99, background: color, width: w + '%', transition: 'width 0.8s ease' }} />
      </div>
      {!isLast && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
          <svg width="10" height="6"><path d="M5 6L0 0h10z" fill="#e2e8f0" /></svg>
        </div>
      )}
    </div>
  )
}

// ── Leader Row ────────────────────────────────────────────────
function LeaderRow({ agent, rank, maxClosed }) {
  const wr = pct(agent.closed, agent.total)
  const barW = pct(agent.closed, maxClosed || 1) ?? 0
  const medals = ['🥇', '🥈', '🥉']
  const wrColor = wr == null ? '#94a3b8' : wr >= 25 ? '#10b981' : wr >= 12 ? '#f59e0b' : '#ef4444'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f8fafc' }}>
      <div style={{ width: 22, textAlign: 'center', fontSize: 15, flexShrink: 0 }}>
        {medals[rank - 1] ?? <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>#{rank}</span>}
      </div>
      <div style={{
        width: 34, height: 34, borderRadius: '50%', background: '#1e40af',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0,
      }}>
        {agent.name?.[0]?.toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>{agent.name}</div>
        <div style={{ height: 4, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: '#3b82f6', borderRadius: 99, width: barW + '%', transition: 'width 0.7s ease' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 14, flexShrink: 0 }}>
        {[
          { val: agent.total, label: 'Meetings', color: '#1e293b' },
          { val: agent.closed, label: 'Closed', color: '#10b981' },
          { val: wr != null ? wr + '%' : '—', label: 'Win rate', color: wrColor },
        ].map(({ val, label, color }) => (
          <div key={label} style={{ textAlign: 'center', minWidth: 42 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color }}>{val}</div>
            <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function SalesAnalyticsPage() {
  const { profile, role, isSuperAdmin } = useAuth()
  const navigate = useNavigate()
  const isMgr = role === 'sales_manager' || isSuperAdmin

  const [leads, setLeads] = useState([])
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [agentFilter, setAgentFilter] = useState('all')
  const [refreshKey, setRefreshKey] = useState(0)

  // ── Date range state (replaces flat `range` string) ───────
  const defaultRange = useMemo(() => ({
    from: fmt(subMonths(startOfMonth(new Date()), 5)),  // Last 6 months default
    to: fmt(new Date()),
  }), [])
  const [dateRange, setDateRange] = useState(defaultRange)

  // ── Data fetching ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)

      let q = supabase
        .from('leads')
        .select(`
          id, name, sales_outcome, sales_lead_status,
          sales_quoted_amount, meeting_date, stage,
          sales_agent_id, sales_agent:sales_agent_id(id, name)
        `)
        .in('stage', MEETING_STAGES)
        .gte('meeting_date', dateRange.from)
        .lte('meeting_date', dateRange.to)
        .order('meeting_date', { ascending: true })

      if (!isMgr) q = q.eq('sales_agent_id', profile?.id)

      const { data, error } = await q
      if (cancelled) return
      if (error) console.error('leads fetch error:', error)
      setLeads(data ?? [])

      if (isMgr) {
        const { data: ag, error: agErr } = await supabase
          .from('users')
          .select('id, name')
          .eq('role', 'sales_agent')
          .eq('is_active', true)
          .order('name')
        if (!cancelled) {
          if (agErr) console.error('agents fetch error:', agErr)
          setAgents(ag ?? [])
        }
      }

      if (!cancelled) setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [dateRange.from, dateRange.to, isMgr, profile?.id, refreshKey])

  // ── Derived data ──────────────────────────────────────────
  const filtered = useMemo(() =>
    agentFilter === 'all' ? leads : leads.filter(l => l.sales_agent_id === agentFilter)
    , [leads, agentFilter])

  const kpi = useMemo(() => {
    const total = filtered.length
    const closed = filtered.filter(l => l.sales_outcome === 'meeting_done_order_closed').length
    const hot = filtered.filter(l => l.sales_outcome === 'meeting_done_hot').length
    const moderate = filtered.filter(l => l.sales_outcome === 'meeting_done_moderate').length
    const cold = filtered.filter(l => l.sales_outcome === 'meeting_done_cold').length
    const lost = filtered.filter(l => l.sales_lead_status === 'lost').length
    const pending = filtered.filter(l => l.stage === 'sale_pending_approval').length
    const metDone = filtered.filter(l => l.sales_outcome?.startsWith('meeting_done')).length
    const amounts = filtered.filter(l => l.sales_quoted_amount).map(l => Number(l.sales_quoted_amount))
    const avgDeal = amounts.length ? Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length) : null
    return { total, closed, hot, moderate, cold, lost, pending, metDone, avgDeal }
  }, [filtered])

  const winRate = pct(kpi.closed, kpi.metDone || kpi.total)

  // ── Monthly breakdown — derived from date range ───────────
  const monthly = useMemo(() => {
    const from = parseISO(dateRange.from)
    const to = parseISO(dateRange.to)
    const numMonths = differenceInCalendarMonths(to, from) + 1
    const months = Array.from({ length: numMonths }, (_, i) => {
      const d = subMonths(to, numMonths - 1 - i)
      return { key: format(d, 'yyyy-MM'), label: format(d, 'MMM yy'), meetings: 0, closed: 0, hot: 0, moderate: 0, cold: 0, lost: 0 }
    })
    filtered.forEach(l => {
      if (!l.meeting_date) return
      const m = months.find(x => x.key === l.meeting_date.substring(0, 7))
      if (!m) return
      m.meetings++
      if (l.sales_outcome === 'meeting_done_order_closed') m.closed++
      else if (l.sales_outcome === 'meeting_done_hot') m.hot++
      else if (l.sales_outcome === 'meeting_done_moderate') m.moderate++
      else if (l.sales_outcome === 'meeting_done_cold') m.cold++
      if (l.sales_lead_status === 'lost') m.lost++
    })
    return months
  }, [filtered, dateRange])

  const outcomeBreakdown = useMemo(() => {
    const map = {}
    filtered.forEach(l => {
      if (l.sales_outcome) map[l.sales_outcome] = (map[l.sales_outcome] || 0) + 1
    })
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([outcome, count]) => ({ outcome, count }))
  }, [filtered])

  const leaderboard = useMemo(() => {
    if (!isMgr) return []
    const map = {}
    leads.forEach(l => {
      if (!l.sales_agent_id) return
      if (!map[l.sales_agent_id])
        map[l.sales_agent_id] = { id: l.sales_agent_id, name: l.sales_agent?.name ?? '?', total: 0, closed: 0 }
      map[l.sales_agent_id].total++
      if (l.sales_outcome === 'meeting_done_order_closed') map[l.sales_agent_id].closed++
    })
    return Object.values(map).sort((a, b) => b.closed - a.closed || b.total - a.total)
  }, [leads, isMgr])

  const maxClosed = Math.max(...leaderboard.map(a => a.closed), 1)

  const donutSlices = [
    { label: 'Closed', value: kpi.closed, color: '#10b981' },
    { label: 'HOT', value: kpi.hot, color: '#f59e0b' },
    { label: 'Moderate', value: kpi.moderate, color: '#3b82f6' },
    { label: 'Cold', value: kpi.cold, color: '#8b5cf6' },
    { label: 'Lost', value: kpi.lost, color: '#ef4444' },
    {
      label: 'Other',
      value: Math.max(0, kpi.total - kpi.closed - kpi.hot - kpi.moderate - kpi.cold - kpi.lost),
      color: '#e2e8f0',
    },
  ]

  const hotLeads = filtered.filter(l => l.sales_outcome === 'meeting_done_hot')

  // ── Render ────────────────────────────────────────────────
  return (
    <Layout>
      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)',
        padding: '20px 24px',
        borderBottom: '1px solid #1e293b',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        }}>
          <div>
            <h1 style={{ color: '#f1f5f9', fontSize: 20, fontWeight: 700, margin: 0 }}>
              Sales Analytics
            </h1>
            <p style={{ color: '#475569', fontSize: 12, margin: '2px 0 0' }}>
              {isMgr ? 'Team performance' : 'My performance'} · {format(new Date(), 'd MMM yyyy')}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>

            {/* ── Date range picker (replaces 3M/6M/1Y buttons) ── */}
            <DateRangePicker value={dateRange} onChange={setDateRange} />

            {/* Agent filter (managers only) */}
            {isMgr && (
              <select
                value={agentFilter}
                onChange={e => setAgentFilter(e.target.value)}
                style={{
                  background: '#1e293b', border: '1px solid #334155',
                  borderRadius: 8, color: '#e2e8f0', fontSize: 12,
                  padding: '6px 12px', cursor: 'pointer',
                }}
              >
                <option value="all">All agents</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            )}

            <button
              onClick={() => setRefreshKey(k => k + 1)}
              style={{
                background: '#1e293b', border: '1px solid #334155',
                borderRadius: 8, color: '#94a3b8', padding: '6px 10px',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
              }}
              aria-label="Refresh data"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        {/* KPI tiles */}
        {!loading && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 12, marginTop: 20,
          }}>
            <KpiTile
              label="Win rate"
              value={winRate != null ? winRate + '%' : '—'}
              accent="#10b981"
              sub={`${kpi.closed} of ${kpi.metDone || kpi.total} meetings`}
              delta={1}
            />
            <KpiTile
              label="Orders closed"
              value={kpi.closed}
              accent="#3b82f6"
              sub={`${kpi.pending} pending approval`}
              delta={0}
            />
            <KpiTile
              label="HOT pipeline"
              value={kpi.hot}
              accent="#f59e0b"
              sub="Likely to close soon"
              delta={0}
            />
            <KpiTile
              label="Avg deal size"
              value={inr(kpi.avgDeal)}
              accent="#8b5cf6"
              sub="Quoted amount"
            />
            <KpiTile
              label="Total meetings"
              value={kpi.total}
              accent="#06b6d4"
              sub={`${fmtDisplay(parseISO(dateRange.from))} – ${fmtDisplay(parseISO(dateRange.to))}`}
            />
          </div>
        )}
      </div>

      {/* ── Body ── */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <Spinner size={28} />
        </div>
      ) : (
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Row 1: Bar chart + Donut */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}>
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 2 }}>
                Monthly performance
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>
                Meetings scheduled vs orders closed
              </div>
              <BarChart data={monthly} />
            </div>

            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 14 }}>
                Pipeline mix
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <Donut slices={donutSlices} winRate={winRate} />
                <div style={{ width: '100%' }}>
                  {donutSlices
                    .filter(s => s.value > 0 && s.label !== 'Other')
                    .map(s => (
                      <div key={s.label} style={{
                        display: 'flex', justifyContent: 'space-between',
                        padding: '5px 0', borderBottom: '1px solid #f8fafc',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                          <span style={{ fontSize: 12, color: '#64748b' }}>{s.label}</span>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{s.value}</span>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Funnel + Outcome breakdown */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}>
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 2 }}>
                Conversion funnel
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 14 }}>
                HOT → Close:{' '}
                <strong style={{ color: '#10b981' }}>
                  {kpi.hot > 0 ? (pct(kpi.closed, kpi.hot) ?? 0) + '%' : '—'}
                </strong>
                &nbsp;·&nbsp; Overall:{' '}
                <strong style={{ color: '#3b82f6' }}>
                  {pct(kpi.closed, kpi.total) ?? 0}%
                </strong>
              </div>
              <FunnelStep label="Total meetings" count={kpi.total} total={kpi.total} color="#94a3b8" />
              <FunnelStep label="Meeting done" count={kpi.metDone} total={kpi.total} color="#60a5fa" />
              <FunnelStep label="HOT" count={kpi.hot} total={kpi.total} color="#f59e0b" />
              <FunnelStep label="Moderate" count={kpi.moderate} total={kpi.total} color="#3b82f6" />
              <FunnelStep label="Order closed" count={kpi.closed} total={kpi.total} color="#10b981" />
              <FunnelStep label="Lost" count={kpi.lost} total={kpi.total} color="#ef4444" isLast />
            </div>

            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#627799', marginBottom: 2 }}>
                Outcome breakdown
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 14 }}>
                {outcomeBreakdown.length} distinct outcomes logged
              </div>
              {outcomeBreakdown.length === 0 ? (
                <p style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '24px 0' }}>
                  No outcomes logged yet
                </p>
              ) : (
                outcomeBreakdown.map(({ outcome, count }) => {
                  const meta = OUTCOME_META[outcome] ?? { label: outcome, color: '#94a3b8' }
                  const w = pct(count, kpi.total) ?? 0
                  return (
                    <div key={outcome} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: '#475569', width: 115, flexShrink: 0 }}>
                        {meta.label}
                      </span>
                      <div style={{ flex: 1, height: 4, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', background: meta.color, width: w + '%',
                          opacity: 0.7, borderRadius: 99,
                        }} />
                      </div>
                      <span style={{ fontSize: 11, color: '#94a3b8', minWidth: 28, textAlign: 'right' }}>
                        {w}%
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', minWidth: 20, textAlign: 'right' }}>
                        {count}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Row 3: Leaderboard (managers) */}
          {isMgr && (
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>Agent leaderboard</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>
                  Ranked by orders closed · {fmtDisplay(parseISO(dateRange.from))} – {fmtDisplay(parseISO(dateRange.to))}
                </div>
              </div>
              {leaderboard.length === 0 ? (
                <p style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '24px 0' }}>
                  No data available
                </p>
              ) : (
                leaderboard.map((a, i) => (
                  <LeaderRow key={a.id} agent={a} rank={i + 1} maxClosed={maxClosed} />
                ))
              )}
            </div>
          )}

          {/* Row 3: HOT pipeline (agents) */}
          {!isMgr && (
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 2 }}>
                My HOT pipeline
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 14 }}>
                Leads most likely to close
              </div>
              {hotLeads.length === 0 ? (
                <p style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '24px 0' }}>
                  No HOT leads right now
                </p>
              ) : (
                hotLeads.map(l => (
                  <div
                    key={l.id}
                    onClick={() => navigate(`/leads/${l.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && navigate(`/leads/${l.id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 12px', borderRadius: 8,
                      border: '1px solid #fef3c7', background: '#fffbeb',
                      marginBottom: 8, cursor: 'pointer',
                    }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#92400e' }}>{l.name}</div>
                      {l.sales_quoted_amount && (
                        <div style={{ fontSize: 11, color: '#b45309' }}>{inr(l.sales_quoted_amount)}</div>
                      )}
                    </div>
                    <ChevronRight size={14} color="#d97706" />
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </Layout>
  )
}