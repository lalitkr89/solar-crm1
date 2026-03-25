import { Search, X, Filter } from 'lucide-react'

export default function SearchBar({ value, onChange, activeFilters, onClearFilters, resultCount }) {
  return (
    <div className="flex items-center gap-2 mb-3 flex-wrap">
      <div className="relative min-w-[220px]">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input pl-8 pr-8"
          placeholder="Search name, phone, city..."
          value={value}
          onChange={e => onChange(e.target.value)}
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
            <X size={13} />
          </button>
        )}
      </div>

      {activeFilters > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
          <Filter size={11} className="text-blue-500" />
          <span className="text-xs text-blue-700 font-medium">
            {activeFilters} filter{activeFilters > 1 ? 's' : ''}
          </span>
          <button onClick={onClearFilters} className="text-blue-400 hover:text-blue-600 ml-1">
            <X size={11} />
          </button>
        </div>
      )}

      <span className="text-xs text-slate-400 ml-auto">{resultCount} results</span>
    </div>
  )
}
