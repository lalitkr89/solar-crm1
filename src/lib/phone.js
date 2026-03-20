// Clean phone number — handles all formats:
// 9876543210, +919876543210, 919876543210, 09876543210, spaces/dashes
export function cleanPhone(phone) {
  if (!phone) return ''

  let p = String(phone).trim()

  // Remove spaces, dashes, dots, brackets
  p = p.replace(/[\s\-().]/g, '')

  // Remove +91 prefix
  if (p.startsWith('+91')) p = p.slice(3)
  // Remove 91 prefix (only if result would be 10 digits)
  else if (p.startsWith('91') && p.length === 12) p = p.slice(2)
  // Remove leading 0
  else if (p.startsWith('0') && p.length === 11) p = p.slice(1)

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