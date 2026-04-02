// src/pages/UsersPage.jsx
import { useEffect, useState } from 'react'
import Layout from '@/components/layout/Layout'
import { PageHeader, Avatar, Spinner, Modal } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { Plus, RefreshCw, MapPin, X, Pencil, Trash2 } from 'lucide-react'

const LOCATION_ROLES_TEAMS = ['presales', 'sales']

const TEAM_COLORS = {
  presales: '#7F77DD', sales: '#378ADD', finance: '#1D9E75',
  ops: '#D85A30', amc: '#BA7517',
}

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [locationUser, setLocationUser] = useState(null)
  const [editRoleUser, setEditRoleUser] = useState(null)  // ✅ role edit modal

  async function load() {
    setLoading(true)
    const [{ data: usersData }, { data: rolesData }] = await Promise.all([
      supabase
        .from('users')
        .select('*, role_data:role_id(id, name, label, team, is_manager)')
        .order('team').order('name'),
      supabase
        .from('roles')
        .select('*')
        .eq('is_active', true)
        .order('label'),
    ])
    setUsers(usersData ?? [])
    setRoles(rolesData ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggleActive(user) {
    await supabase.from('users').update({ is_active: !user.is_active }).eq('id', user.id)
    load()
  }

  // ✅ Delete user
  async function handleDelete(user) {
    if (!confirm(`"${user.name}" ko delete karna chahte ho? Yeh action undo nahi hoga.`)) return
    await supabase.from('users').delete().eq('id', user.id)
    load()
  }

  function getRoleLabel(user) {
    if (user.role_data?.label) return user.role_data.label
    return user.role?.replace(/_/g, ' ') ?? '—'
  }

  function getTeam(user) {
    return user.role_data?.team ?? user.team ?? '—'
  }

  function canEditLocation(user) {
    const team = user.role_data?.team ?? user.team
    return LOCATION_ROLES_TEAMS.includes(team)
  }

  function getColor(user) {
    const team = user.role_data?.team ?? user.team
    return TEAM_COLORS[team] ?? '#378ADD'
  }

  return (
    <Layout>
      <PageHeader title="Manage users" subtitle={`${users.length} users`}>
        <button onClick={load} className="btn"><RefreshCw size={13} /></button>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus size={13} /> Add user
        </button>
      </PageHeader>

      <div className="card p-0 overflow-hidden">
        {/* ✅ Extra columns for Edit + Delete */}
        <div className="grid grid-cols-[1fr_180px_110px_150px_80px_80px_60px] gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <span>Name</span>
          <span>Role</span>
          <span>Team</span>
          <span>Cities / State</span>
          <span>Status</span>
          <span>Toggle</span>
          <span>Actions</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner size={22} /></div>
        ) : (
          users.map(user => (
            <div
              key={user.id}
              className="grid grid-cols-[1fr_180px_110px_150px_80px_80px_60px] gap-3 px-4 py-3 border-b border-slate-100 items-center"
            >
              {/* Name */}
              <div className="flex items-center gap-2.5">
                <Avatar name={user.name} size={28} color={getColor(user)} />
                <div>
                  <div className="text-sm font-medium text-slate-800">{user.name}</div>
                  <div className="text-xs text-slate-400">{user.email}</div>
                </div>
              </div>

              {/* ✅ Role — click karo to edit */}
              <button
                onClick={() => setEditRoleUser(user)}
                className="flex items-center gap-1.5 group text-left w-full"
                title="Role change karo"
              >
                <span className="text-xs font-medium text-slate-600 capitalize group-hover:text-blue-600 transition-colors truncate">
                  {getRoleLabel(user)}
                </span>
                <Pencil size={11} className="text-slate-300 group-hover:text-blue-500 flex-shrink-0 transition-colors" />
              </button>

              {/* Team */}
              <span className="text-xs text-slate-500 capitalize">{getTeam(user)}</span>

              {/* Cities */}
              <div className="flex flex-col gap-0.5">
                {canEditLocation(user) ? (
                  <button
                    onClick={() => setLocationUser(user)}
                    className="flex items-center gap-1 text-xs text-left text-slate-500 hover:text-blue-600 transition-colors group"
                  >
                    <MapPin size={11} className="shrink-0 text-slate-400 group-hover:text-blue-500" />
                    <span className="truncate">
                      {(user.assigned_cities?.length > 0 || user.assigned_state)
                        ? [...(user.assigned_cities ?? []), user.assigned_state ? `[${user.assigned_state}]` : null]
                          .filter(Boolean).join(', ')
                        : <span className="text-slate-300 italic">Set cities…</span>
                      }
                    </span>
                  </button>
                ) : (
                  <span className="text-xs text-slate-300">—</span>
                )}
              </div>

              {/* Status */}
              <span className={`text-xs font-semibold ${user.is_active ? 'text-green-600' : 'text-red-500'}`}>
                {user.is_active ? 'Active' : 'Inactive'}
              </span>

              {/* Toggle active */}
              <button
                onClick={() => toggleActive(user)}
                className={`text-xs px-2 py-1 rounded-lg border font-medium transition-colors ${user.is_active
                  ? 'border-red-200 text-red-600 hover:bg-red-50'
                  : 'border-green-200 text-green-600 hover:bg-green-50'
                  }`}
              >
                {user.is_active ? 'Disable' : 'Enable'}
              </button>

              {/* ✅ Delete */}
              <button
                onClick={() => handleDelete(user)}
                className="text-slate-300 hover:text-red-500 transition-colors flex justify-center"
                title="User delete karo"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))
        )}
      </div>

      <AddUserModal
        open={showAdd}
        roles={roles}
        onClose={() => { setShowAdd(false); load() }}
      />

      <LocationModal
        user={locationUser}
        onClose={() => { setLocationUser(null); load() }}
      />

      {/* ✅ Edit Role Modal */}
      <EditRoleModal
        user={editRoleUser}
        roles={roles}
        onClose={() => { setEditRoleUser(null); load() }}
      />
    </Layout>
  )
}

// ── EDIT ROLE MODAL ──────────────────────────────────────────
function EditRoleModal({ user, roles, onClose }) {
  const [roleId, setRoleId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    setRoleId(user.role_id ?? '')
    setError('')
  }, [user])

  async function handleSave() {
    if (!roleId) { setError('Role select karo'); return }
    setSaving(true); setError('')
    try {
      const selectedRole = roles.find(r => r.id === roleId)
      const { error: err } = await supabase
        .from('users')
        .update({
          role_id: roleId,
          role: selectedRole?.name ?? null,
          team: selectedRole?.team ?? null,
        })
        .eq('id', user.id)
      if (err) throw err
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  return (
    <Modal open={!!user} onClose={onClose} title={`Role change — ${user.name}`} width={400}>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <div className="flex flex-col gap-4">
        <div>
          <label className="label">New Role</label>
          <select className="select" value={roleId} onChange={e => setRoleId(e.target.value)}>
            <option value="">— Role select karo —</option>
            {roles.map(r => (
              <option key={r.id} value={r.id}>
                {r.label} {r.team ? `(${r.team})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn flex-1 justify-center">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving...' : 'Save role'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── ADD USER MODAL ───────────────────────────────────────────
function AddUserModal({ open, onClose, roles }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role_id: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (roles.length > 0 && !form.role_id) {
      setForm(x => ({ ...x, role_id: roles[0].id }))
    }
  }, [roles])

  function set(f, v) { setForm(x => ({ ...x, [f]: v })) }

  async function handleSave() {
    if (!form.email || !form.password || !form.name || !form.role_id) {
      setError('Sab fields zaroori hain'); return
    }
    setSaving(true); setError('')
    try {
      const selectedRole = roles.find(r => r.id === form.role_id)
      const { data, error: authErr } = await supabase.auth.admin.createUser({
        email: form.email, password: form.password, email_confirm: true
      })
      if (authErr) throw authErr
      await supabase.from('users').insert({
        id: data.user.id,
        name: form.name,
        email: form.email,
        role: selectedRole?.name ?? null,
        team: selectedRole?.team ?? null,
        role_id: form.role_id,
      })
      setForm({ name: '', email: '', password: '', role_id: roles[0]?.id ?? '' })
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add new user" width={420}>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <div className="flex flex-col gap-3">
        <div><label className="label">Full name</label>
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} /></div>
        <div><label className="label">Email</label>
          <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
        <div><label className="label">Password</label>
          <input className="input" type="password" value={form.password} onChange={e => set('password', e.target.value)} /></div>
        <div>
          <label className="label">Role</label>
          <select className="select" value={form.role_id} onChange={e => set('role_id', e.target.value)}>
            {roles.map(r => (
              <option key={r.id} value={r.id}>
                {r.label} {r.team ? `(${r.team})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 mt-1">
          <button onClick={onClose} className="btn flex-1 justify-center">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Creating...' : 'Create user'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── LOCATION MODAL ───────────────────────────────────────────
function LocationModal({ user, onClose }) {
  const [cities, setCities] = useState([])
  const [state, setState] = useState('')
  const [cityInput, setCityInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    setCities(user.assigned_cities ?? [])
    setState(user.assigned_state ?? '')
    setCityInput(''); setError('')
  }, [user])

  function addCity() {
    const trimmed = cityInput.trim()
    if (!trimmed) return
    if (cities.map(c => c.toLowerCase()).includes(trimmed.toLowerCase())) { setCityInput(''); return }
    setCities(prev => [...prev, trimmed])
    setCityInput('')
  }

  async function handleSave() {
    setSaving(true); setError('')
    try {
      const { error: err } = await supabase
        .from('users')
        .update({ assigned_cities: cities, assigned_state: state.trim() || null })
        .eq('id', user.id)
      if (err) throw err
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  return (
    <Modal open={!!user} onClose={onClose} title={`City / State — ${user.name}`} width={460}>
      <p className="text-xs text-slate-500 mb-4">
        Lead assignment: <strong>City match</strong> → <strong>State match</strong> → round-robin
      </p>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <div className="mb-4">
        <label className="label">Assigned Cities</label>
        <div className="flex gap-2 mb-2">
          <input className="input flex-1" placeholder="City likhein, Enter dabayein…"
            value={cityInput} onChange={e => setCityInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCity())} />
          <button onClick={addCity} className="btn px-3">Add</button>
        </div>
        {cities.length === 0 ? (
          <p className="text-xs text-slate-400 italic">Koi city nahi hai abhi</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {cities.map((city, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-medium">
                {city}
                <button onClick={() => setCities(prev => prev.filter((_, j) => j !== i))} className="hover:text-red-500">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="mb-5">
        <label className="label">Assigned State</label>
        <input className="input" placeholder="e.g. Rajasthan" value={state} onChange={e => setState(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button onClick={onClose} className="btn flex-1 justify-center">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Modal>
  )
}