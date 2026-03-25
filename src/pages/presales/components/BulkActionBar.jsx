export default function BulkActionBar({ count, onBulkEdit, onClear }) {
  return (
    <div className="mb-3 px-4 py-2.5 rounded-xl flex items-center gap-3"
      style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
      <span className="text-sm font-semibold text-blue-800">
        {count} lead{count > 1 ? 's' : ''} selected
      </span>
      <button
        onClick={onBulkEdit}
        className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700">
        Bulk Edit
      </button>
      <button
        onClick={onClear}
        className="ml-auto text-xs text-blue-500 hover:text-blue-700">
        Clear selection
      </button>
    </div>
  )
}
