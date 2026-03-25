import { cleanPhone } from '@/lib/phone'
import { applyFilter } from '../config/utils'

export function useFilteredLeads(leads, { globalSearch, filters, sortCol, sortDir }) {
  const filtered = leads.filter(lead => {
    if (globalSearch) {
      const s = globalSearch.toLowerCase()
      const p = cleanPhone(globalSearch)
      if (
        !lead.name?.toLowerCase().includes(s) &&
        !lead.phone_clean?.includes(p) &&
        !lead.city?.toLowerCase().includes(s)
      ) return false
    }
    for (const [col, f] of Object.entries(filters)) {
      if (!applyFilter(lead[col], f)) return false
    }
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (!sortCol) return 0
    const av = String(a[sortCol] ?? '').toLowerCase()
    const bv = String(b[sortCol] ?? '').toLowerCase()
    return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
  })

  return sorted
}
