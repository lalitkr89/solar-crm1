// src/pages/RolesPage.jsx
import { useEffect, useState } from 'react'
import Layout from '@/components/layout/Layout'
import { PageHeader, Modal, Spinner } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { Plus, Shield, ChevronDown, ChevronUp, Save, Trash2, RefreshCw } from 'lucide-react'

const ALL_PAGES = [
  { path: '/', label: 'Dashboard' },
  { path: '/today', label: "Today's actions" },
  { path: '/kanban', label: 'Pipeline kanban' },
  { path: '/presales', label: 'Calling dashboard' },
  { path: '/bulk-import', label: 'Bulk import' },
  { path: '/ps-disposition-approvals', label: 'Disposition approvals' },
  { path: '/attendance', label: 'Attendance' },
  { path: '/sales', label: 'Meetings & leads' },
  { path: '/sales-analytics', label: 'Sales analytics' },
  { path: '/sales-approval', label: 'Order approvals' },
  { path: '/finance', label: 'Payments' },
  { path: '/ops', label: 'Docs & installation' },
  { path: '/amc', label: 'Service & renewals' },
  { path: '/users', label: 'Manage users' },
  { path: '/roles', label: 'Manage roles' },
]

const ALL_STAGES = [
  { key: 'new', label: 'New Lead' },
  { key: 'meeting_scheduled', label: 'Meeting Scheduled' },
  { key: 'meeting_done', label: 'Meeting Done' },
  { key: 'qc_followup', label: 'Rearrange Meeting' },
  { key: 'sale_pending_approval', label: 'Pending Approval' },
  { key: 'sale_closed', label: 'Sale Closed' },
  { key: 'sale_rejected', label: 'Sale Rejected' },
  { key: 'finance_approval', label: 'Finance Approval' },
  { key: 'ops_documents', label: 'Ops — Documents' },
  { key: 'name_load_change', label: 'Name/Load Change' },
  { key: 'net_metering', label: 'Net Metering' },
  { key: 'installation', label: 'Installation' },
  { key: 'installed', label: 'Installed' },
  { key: 'amc_active', label: 'AMC Active' },
  { key: 'not_interested', label: 'Not Interested' },
  { key: 'non_qualified', label: 'Non Qualified' },
  { key: 'lost', label: 'Lost' },
]

const TEAMS = ['presales', 'sales', 'finance', 'ops', 'amc']

export default function RolesPage() {
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [showAdd, setShowAdd] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('roles')
      .select('*')
      .order('created_at')
    setRoles(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function handleToggle(id) {
    setExpanded(prev => prev === id ? null : id)
  }

  return (
    <Layout>
      <PageHeader title="Manage roles" subtitle={`${roles.length} roles`}>
        <button onClick={load} className="btn"><RefreshCw size={13} /></button>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus size={13} /> New role
        </button>
      </PageHeader>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={22} /></div>
      ) : (
        <div className="flex flex-col gap-3">
          {roles.map(role => (
            <RoleCard
              key={role.id}
              role={role}
              isExpanded={expanded === role.id}
              onToggle={() => handleToggle(role.id)}
              onDeleted={load}
            />
          ))}
        </div>
      )}

      <AddRoleModal
        open={showAdd}
        onClose={() => { setShowAdd(false); load() }}
      />
    </Layout>
  )
}

// ── Role Card ───────────────────────────────────────────────
function RoleCard({ role, isExpanded, onToggle, onDeleted }) {
  const [pagePerms, setPagePerms] = useState([])
  const [stagePerms, setStagePerms] = useState([])
  const [fetching, setFetching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)

  // Fetch fresh data every time card is expanded
  useEffect(() => {
    if (!isExpanded) return

    async function fetchPerms() {
      setFetching(true)
      const [{ data: pp }, { data: sp }] = await Promise.all([
        supabase.from('page_access').select('page, can_access').eq('role_id', role.id),
        supabase.from('stage_access').select('stage_name, can_view, can_move_lead').eq('role_id', role.id),
      ])
      setPagePerms(pp ?? [])
      setStagePerms(sp ?? [])
      setFetching(false)
    }

    fetchPerms()
  }, [isExpanded, role.id])

  function isPageAllowed(path) {
    return pagePerms.some(p => p.page === path && p.can_access)
  }

  function togglePage(path) {
    setPagePerms(prev => {
      const existing = prev.find(p => p.page === path)
      if (existing) return prev.map(p => p.page === path ? { ...p, can_access: !p.can_access } : p)
      return [...prev, { page: path, can_access: true }]
    })
  }

  function isStageAllowed(key) {
    return stagePerms.some(s => s.stage_name === key && s.can_view)
  }

  function toggleStage(key) {
    setStagePerms(prev => {
      const existing = prev.find(s => s.stage_name === key)
      if (existing) {
        return prev.map(s => s.stage_name === key
          ? { ...s, can_view: !s.can_view, can_move_lead: !s.can_view }
          : s)
      }
      return [...prev, { stage_name: key, can_view: true, can_move_lead: true }]
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const pageUpserts = ALL_PAGES.map(p => ({
        role_id: role.id,
        page: p.path,
        can_access: isPageAllowed(p.path),
      }))
      await supabase
        .from('page_access')
        .upsert(pageUpserts, { onConflict: 'role_id,page' })

      const stageUpserts = ALL_STAGES.map(s => ({
        role_id: role.id,
        stage_name: s.key,
        can_view: isStageAllowed(s.key),
        can_move_lead: isStageAllowed(s.key),
      }))
      await supabase
        .from('stage_access')
        .upsert(stageUpserts, { onConflict: 'role_id,stage_name' })

      // ✅ FIX: onUpdated() hata diya — wo re-render + useEffect trigger karta tha
      // jisse DB se purana data wapas fetch hokar local checkbox state override ho jaati thi
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`"${role.label}" role delete karna chahte ho? Isse assigned users affect honge.`)) return
    await supabase.from('roles').delete().eq('id', role.id)
    onDeleted() // ✅ Sirf delete ke baad parent reload — ye sahi hai
  }

  const TEAM_COLORS = {
    presales: 'bg-purple-100 text-purple-700',
    sales: 'bg-blue-100 text-blue-700',
    finance: 'bg-green-100 text-green-700',
    ops: 'bg-orange-100 text-orange-700',
    amc: 'bg-amber-100 text-amber-700',
  }

  const PROTECTED_ROLES = [
    'super_admin', 'presales_manager', 'presales_agent',
    'sales_manager', 'sales_agent', 'finance_manager', 'finance_agent',
    'ops_manager', 'ops_agent', 'amc_manager', 'amc_agent',
  ]

  return (
    <div className="card p-0 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors text-left"
      >
        <Shield size={15} className="text-slate-400 flex-shrink-0" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-800">{role.label}</div>
          <div className="text-xs text-slate-400">{role.name}</div>
        </div>
        {role.team && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TEAM_COLORS[role.team] ?? 'bg-slate-100 text-slate-600'}`}>
            {role.team}
          </span>
        )}
        {role.is_manager && (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700">
            manager
          </span>
        )}
        {isExpanded ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
      </button>

      {isExpanded && (
        <div className="border-t border-slate-100 px-4 pt-4 pb-5">
          {fetching ? (
            <div className="flex justify-center py-6"><Spinner size={18} /></div>
          ) : (
            <>
              {/* Pages */}
              <div className="mb-5">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Page Access</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {ALL_PAGES.map(p => (
                    <label key={p.path} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={isPageAllowed(p.path)}
                        onChange={() => togglePage(p.path)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs text-slate-600 group-hover:text-slate-800">{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Stages */}
              <div className="mb-5">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Pipeline Stage Access</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {ALL_STAGES.map(s => (
                    <label key={s.key} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={isStageAllowed(s.key)}
                        onChange={() => toggleStage(s.key)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs text-slate-600 group-hover:text-slate-800">{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary flex items-center gap-1.5"
                >
                  <Save size={13} />
                  {saving ? 'Saving...' : savedMsg ? '✓ Saved!' : 'Save permissions'}
                </button>

                {!PROTECTED_ROLES.includes(role.name) && (
                  <button
                    onClick={handleDelete}
                    className="btn text-red-600 hover:bg-red-50 flex items-center gap-1.5"
                  >
                    <Trash2 size={13} /> Delete role
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Add Role Modal ───────────────────────────────────────────
function AddRoleModal({ open, onClose }) {
  const [form, setForm] = useState({ name: '', label: '', team: '', is_manager: false })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(f, v) { setForm(x => ({ ...x, [f]: v })) }

  function handleLabelChange(val) {
    const autoName = val.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    setForm(x => ({ ...x, label: val, name: autoName }))
  }

  async function handleSave() {
    if (!form.name || !form.label) { setError('Name aur label dono zaroori hain'); return }
    setSaving(true); setError('')
    try {
      const { error: err } = await supabase.from('roles').insert({
        name: form.name,
        label: form.label,
        team: form.team || null,
        is_manager: form.is_manager,
      })
      if (err) throw err
      setForm({ name: '', label: '', team: '', is_manager: false })
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New role banana" width={420}>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <div className="flex flex-col gap-3">
        <div>
          <label className="label">Display name <span className="text-slate-400 font-normal">(e.g. Survey Agent)</span></label>
          <input className="input" value={form.label} onChange={e => handleLabelChange(e.target.value)} placeholder="Survey Agent" />
        </div>
        <div>
          <label className="label">Internal key <span className="text-slate-400 font-normal">(auto-generated)</span></label>
          <input className="input bg-slate-50 font-mono text-sm" value={form.name} onChange={e => set('name', e.target.value)} placeholder="survey_agent" />
        </div>
        <div>
          <label className="label">Team <span className="text-slate-400 font-normal">(optional)</span></label>
          <select className="select" value={form.team} onChange={e => set('team', e.target.value)}>
            <option value="">— Koi team nahi —</option>
            {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.is_manager} onChange={e => set('is_manager', e.target.checked)} className="rounded border-slate-300 text-blue-600" />
          <span className="text-sm text-slate-700">Manager role hai (kanban access etc.)</span>
        </label>
        <p className="text-xs text-slate-400 bg-slate-50 rounded-lg p-3">
          Role banane ke baad usse expand karke pages aur stages ki permissions set karo.
        </p>
        <div className="flex gap-2 mt-1">
          <button onClick={onClose} className="btn flex-1 justify-center">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Creating...' : 'Create role'}
          </button>
        </div>
      </div>
    </Modal>
  )
}