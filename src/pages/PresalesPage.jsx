import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import Layout from '@/components/layout/Layout'
import { PageHeader, Spinner } from '@/components/ui'
import { format } from 'date-fns'
import { Plus, RefreshCw, Phone, PhoneOff } from 'lucide-react'

// Hooks
import { usePresalesLeads } from './presales/hooks/usePresalesLeads'
import { useCallingMode } from './presales/hooks/useCallingMode'
import { useTableControls } from './presales/hooks/useTableControls'
import { useFilteredLeads } from './presales/hooks/useFilteredLeads'

// Components
import CallingBanner from './presales/components/CallingBanner'
import SearchBar from './presales/components/SearchBar'
import BulkActionBar from './presales/components/BulkActionBar'
import MobileLeadCard from './presales/components/MobileLeadCard'
import LeadsTable from './presales/components/LeadsTable'

// Modals
import AddLeadModal from './presales/modals/AddLeadModal'
import BulkEditModal from './presales/modals/BulkEditModal'

export default function PresalesPage() {
  const { profile, isManager, isSuperAdmin } = useAuth()
  const isAgent = !isManager && !isSuperAdmin
  const today = format(new Date(), 'yyyy-MM-dd')

  const { leads, loading, reload } = usePresalesLeads()
  const { callingMode, queueLoading, handleStartCalling, handleStopCalling } = useCallingMode(profile?.id)
  const {
    globalSearch, setGlobalSearch,
    filters, filterOpen, setFilterOpen,
    sortCol, sortDir, toggleSort,
    applyColFilter, clearColFilter, clearAllFilters,
    selectedIds, toggleSelect, toggleSelectAll, clearSelection,
  } = useTableControls()

  const sorted = useFilteredLeads(leads, { globalSearch, filters, sortCol, sortDir })

  const [showAdd, setShowAdd] = useState(false)
  const [showBulkEdit, setShowBulkEdit] = useState(false)

  return (
    <Layout>
      <PageHeader title="Pre-sales — calling dashboard" subtitle={`${sorted.length} of ${leads.length} leads`}>
        <button onClick={reload} className="btn"><RefreshCw size={13} /></button>

        {isAgent && (
          callingMode ? (
            <button onClick={handleStopCalling}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer border-0"
              style={{ background: '#dc2626', color: '#fff' }}>
              <PhoneOff size={13} /> Stop Calling
            </button>
          ) : (
            <button onClick={handleStartCalling} disabled={queueLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer border-0 disabled:opacity-60"
              style={{ background: '#16a34a', color: '#fff' }}>
              {queueLoading
                ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Loading...</>
                : <><Phone size={13} /> Start Calling</>
              }
            </button>
          )
        )}

        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus size={13} /> Add lead
        </button>
      </PageHeader>

      {callingMode && <CallingBanner onStop={handleStopCalling} />}

      <SearchBar
        value={globalSearch}
        onChange={setGlobalSearch}
        activeFilters={Object.keys(filters).length}
        onClearFilters={clearAllFilters}
        resultCount={sorted.length}
      />

      {(isManager || isSuperAdmin) && selectedIds.size > 0 && (
        <BulkActionBar
          count={selectedIds.size}
          onBulkEdit={() => setShowBulkEdit(true)}
          onClear={clearSelection}
        />
      )}

      {/* Mobile view */}
      <div className="block lg:hidden flex flex-col gap-2 pb-4">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={20} /></div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16 text-sm text-slate-400">No leads found</div>
        ) : sorted.map(lead => (
          <MobileLeadCard key={lead.id} lead={lead} today={today} />
        ))}
      </div>

      {/* Desktop view */}
      <div className="hidden lg:block">
        <LeadsTable
          leads={sorted}
          loading={loading}
          today={today}
          isManager={isManager}
          isSuperAdmin={isSuperAdmin}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          sortCol={sortCol}
          sortDir={sortDir}
          onSort={toggleSort}
          filters={filters}
          filterOpen={filterOpen}
          onFilterOpen={setFilterOpen}
          onApplyFilter={applyColFilter}
          onClearFilter={clearColFilter}
        />
      </div>

      <AddLeadModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdded={() => { setShowAdd(false); reload() }}
        isAgent={isAgent}
        agentId={profile?.id}
        isManager={isManager || isSuperAdmin}
      />

      <BulkEditModal
        open={showBulkEdit}
        onClose={() => setShowBulkEdit(false)}
        selectedIds={[...selectedIds]}
        onDone={() => {
          setShowBulkEdit(false)
          clearSelection()
          reload()
        }}
      />
    </Layout>
  )
}
