// Ported from your existing clean_phone() in dialer_service.py
export function cleanPhone(phone) {
  if (!phone) return ''
  let p = String(phone).trim()

  // Excel scientific notation fix (e.g. 9.19877E+11 → 919876543278)
  if (p.toUpperCase().includes('E+') || p.toUpperCase().includes('E-')) {
    p = String(Math.round(Number(p)))
  }

  // Remove all non-digit characters
  p = p.replace(/[^\d]/g, '')

  // Remove +91 or 91 prefix
  if (p.startsWith('91') && p.length === 12) p = p.slice(2)
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