import { useState } from 'react'

export function useTableControls() {
  const [globalSearch, setGlobalSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [filterOpen, setFilterOpen] = useState(null)
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [selectedIds, setSelectedIds] = useState(new Set())

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  function applyColFilter(colKey, f) {
    setFilters(p => ({ ...p, [colKey]: f }))
    setFilterOpen(null)
  }

  function clearColFilter(colKey) {
    setFilters(p => { const n = { ...p }; delete n[colKey]; return n })
    setFilterOpen(null)
  }

  function clearAllFilters() {
    setFilters({})
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll(sortedLeads) {
    if (selectedIds.size === sortedLeads.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(sortedLeads.map(l => l.id)))
    }
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  return {
    globalSearch, setGlobalSearch,
    filters, filterOpen, setFilterOpen,
    sortCol, sortDir, toggleSort,
    applyColFilter, clearColFilter, clearAllFilters,
    selectedIds, toggleSelect, toggleSelectAll, clearSelection,
  }
}
