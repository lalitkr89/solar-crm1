export const NOT_CONNECTED_DISPOSITIONS = [
  'Not Connected 1st-Attempt',
  'Not Connected 2nd-Attempt',
  'Not Connected 3rd-Attempt',
  'Not Connected 4th-Attempt',
  'Invalid/Wrong Number',
]

export const CONNECTED_DISPOSITIONS = [
  'Meeting Scheduled (BD)',
  'Meet Later (Qualified)',
  'Call Later (Interested)',
  'Call Later (Under Construction)',
  'Language Barrier',
  'Non Qualified - Roof Area Insufficient',
  'Non Qualified - Bill Amount Insufficient',
  'Non Qualified - No Roof Ownership',
  'Non Qualified - Not Govt Meter',
  'Non Qualified - Meter Connection Not Yet Available',
  'Not Serviceable - Offgrid Enquiry',
  'Not Serviceable - SS not in location',
  'Not Interested in Solar',
  'Not Interested in Solar - Price Issue',
  'Housing Society Enquiry',
  'Commercial Lead',
  'SolarPro Enquiry',
]

export const ALL_DISPOSITIONS = [
  ...NOT_CONNECTED_DISPOSITIONS,
  ...CONNECTED_DISPOSITIONS,
]

export function getDispositionStyle(val) {
  if (!val) return { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' }
  if (val.includes('Meeting')) return { bg: '#DCFCE7', text: '#14532D', border: '#86EFAC' }
  if (val.includes('Not Connected')) return { bg: '#FEE2E2', text: '#7F1D1D', border: '#FCA5A5' }
  if (val.includes('Call Later')) return { bg: '#DBEAFE', text: '#1E3A8A', border: '#93C5FD' }
  if (val.includes('Meet Later')) return { bg: '#DBEAFE', text: '#1E3A8A', border: '#93C5FD' }
  if (val.includes('Non Qualified')) return { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' }
  if (val.includes('Not Interested')) return { bg: '#F8FAFC', text: '#64748B', border: '#E2E8F0' }
  if (val.includes('Not Serviceable')) return { bg: '#FFF7ED', text: '#7C2D12', border: '#FDBA74' }
  if (val.includes('Commercial')) return { bg: '#EDE9FE', text: '#4C1D95', border: '#C4B5FD' }
  if (val.includes('Invalid')) return { bg: '#FEE2E2', text: '#7F1D1D', border: '#FCA5A5' }
  if (val.includes('Housing')) return { bg: '#FAF5FF', text: '#581C87', border: '#D8B4FE' }
  if (val.includes('SolarPro')) return { bg: '#FDF4FF', text: '#701A75', border: '#E879F9' }
  if (val.includes('Language')) return { bg: '#F8FAFC', text: '#64748B', border: '#E2E8F0' }
  return { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' }
}

export function isMeetingDisposition(val) {
  return val?.includes('Meeting') ?? false
}

export function isCallbackDisposition(val) {
  return (
    val?.includes('Call Later') ||
    val?.includes('Meet Later')
  ) ?? false
}

export function isTerminalDisposition(val) {
  return (
    val?.includes('Not Interested') ||
    val?.includes('Not Serviceable') ||
    val?.includes('Non Qualified') ||
    val?.includes('Invalid') ||
    val?.includes('Housing Society') ||
    val?.includes('Commercial') ||
    val?.includes('SolarPro')
  ) ?? false
}