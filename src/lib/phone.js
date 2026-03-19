// Ported from your existing clean_phone() in dialer_service.py
export function cleanPhone(phone) {
  if (!phone) return ''
  let p = String(phone).trim().replace(/\s+/g, '')
  if (p.startsWith('+91')) p = p.slice(3)
  if (p.startsWith('0')) p = p.slice(1)
  return p
}

export function formatPhone(phone) {
  const p = cleanPhone(phone)
  if (p.length === 10) return `+91 ${p.slice(0, 5)} ${p.slice(5)}`
  return p
}

export function waLink(phone) {
  return `https://wa.me/91${cleanPhone(phone)}`
}

export function callLink(phone) {
  return `tel:+91${cleanPhone(phone)}`
}
