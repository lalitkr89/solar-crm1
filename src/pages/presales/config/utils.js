export function getSalesOutcomeStyle(o) {
  if (!o) return {}
  if (o.includes('order_closed')) return { background: '#dcfce7', color: '#14532d', borderColor: '#86efac' }
  if (o.includes('hot')) return { background: '#fef3c7', color: '#92400e', borderColor: '#fcd34d' }
  if (o.includes('moderate')) return { background: '#dbeafe', color: '#1e3a8a', borderColor: '#93c5fd' }
  if (o.includes('cold')) return { background: '#ede9fe', color: '#4c1d95', borderColor: '#c4b5fd' }
  if (o === 'meeting_rescheduled') return { background: '#f3e8ff', color: '#6b21a8', borderColor: '#d8b4fe' }
  if (o.includes('not_interested') || o.includes('non_qualified') || o.includes('not_serviceable'))
    return { background: '#fee2e2', color: '#7f1d1d', borderColor: '#fca5a5' }
  if (o.includes('call_later')) return { background: '#dbeafe', color: '#1e3a8a', borderColor: '#93c5fd' }
  if (o.includes('not_connected') || o.includes('invalid'))
    return { background: '#fef9c3', color: '#713f12', borderColor: '#fde047' }
  return { background: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1' }
}

export function applyFilter(cellVal, f) {
  if (!f) return true

  if (f.isDate) {
    if (!f.from && !f.to) return true
    if (!cellVal) return false
    if (f.from && f.to) return cellVal >= f.from && cellVal <= f.to
    if (f.from) return cellVal >= f.from
    if (f.to) return cellVal <= f.to
    return true
  }

  const hasVal1 = f.val?.trim() || f.op === 'blank' || f.op === 'not_blank'
  const hasVal2 = f.val2?.trim() || f.op2 === 'blank' || f.op2 === 'not_blank'
  if (!hasVal1) return true

  const v = String(cellVal ?? '').toLowerCase()
  function match(op, fv) {
    const fvl = (fv ?? '').toLowerCase()
    switch (op) {
      case 'contains': return v.includes(fvl)
      case 'not_contains': return !v.includes(fvl)
      case 'equals': return v === fvl
      case 'starts_with': return v.startsWith(fvl)
      case 'blank': return !v
      case 'not_blank': return !!v
      default: return v.includes(fvl)
    }
  }

  const r1 = match(f.op, f.val)
  if (!hasVal2) return r1
  const r2 = match(f.op2, f.val2)
  return f.join === 'OR' ? r1 || r2 : r1 && r2
}

// ── Calling mode helpers (sessionStorage) ────────────────────
export function isCallingModeActive() {
  return sessionStorage.getItem('callingMode') === 'true'
}
export function getCallingQueueFromSession() {
  try { return JSON.parse(sessionStorage.getItem('callingQueue') ?? '[]') } catch { return [] }
}
export function getCallingIndexFromSession() {
  return parseInt(sessionStorage.getItem('callingIndex') ?? '0', 10)
}
export function setCallingIndex(idx) {
  sessionStorage.setItem('callingIndex', String(idx))
}
export function stopCallingMode() {
  sessionStorage.removeItem('callingMode')
  sessionStorage.removeItem('callingQueue')
  sessionStorage.removeItem('callingIndex')
}
