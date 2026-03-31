import { useEffect, useState } from 'react'
import Layout from '@/components/layout/Layout'
import { PageHeader, Avatar, Spinner, Modal } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { UserCog, Plus, RefreshCw, MapPin, ChevronDown, ChevronUp, X } from 'lucide-react'

const ROLES = [
  'super_admin',
  'presales_manager', 'presales_agent',
  'sales_manager', 'sales_agent',
  'finance_manager', 'finance_agent',
  'ops_manager', 'ops_agent',
  'amc_manager', 'amc_agent',
]

const TEAM_MAP = {
  presales_manager: 'presales', presales_agent: 'presales',
  sales_manager: 'sales', sales_agent: 'sales',
  finance_manager: 'finance', finance_agent: 'finance',
  ops_manager: 'ops', ops_agent: 'ops',
  amc_manager: 'amc', amc_agent: 'amc',
}

const ROLE_COLOR = {
  super_admin: '#7F77DD', presales_manager: '#7F77DD', presales_agent: '#AFA9EC',
  sales_manager: '#378ADD', sales_agent: '#85B7EB',
  finance_manager: '#1D9E75', finance_agent: '#5DCAA5',
  ops_manager: '#D85A30', ops_agent: '#F0997B',
  amc_manager: '#BA7517', amc_agent: '#EF9F27',
}

// Only presales and sales agents get city/state assignment
const LOCATION_ROLES = ['presales_agent', 'sales_agent']

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [locationUser, setLocationUser] = useState(null)  // user being edited for city/state

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('users').select('*').order('team').order('name')
    setUsers(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggleActive(user) {
    await supabase.from('users').update({ is_active: !user.is_active }).eq('id', user.id)
    load()
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
        <div className="grid grid-cols-[1fr_160px_120px_140px_80px_80px] gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <span>Name</span><span>Role</span><span>Team</span><span>Cities / State</span><span>Status</span><span>Action</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner size={22} /></div>
        ) : (
          users.map(user => (
            <div key={user.id}
              className="grid grid-cols-[1fr_160px_120px_140px_80px_80px] gap-3 px-4 py-3 border-b border-slate-100 items-center">
              <div className="flex items-center gap-2.5">
                <Avatar name={user.name} size={28} color={ROLE_COLOR[user.role] ?? '#378ADD'} />
                <div>
                  <div className="text-sm font-medium text-slate-800">{user.name}</div>
                  <div className="text-xs text-slate-400">{user.email}</div>
                </div>
              </div>

              <span className="text-xs font-medium text-slate-600 capitalize">
                {user.role?.replace('_', ' ')}
              </span>

              <span className="text-xs text-slate-500 capitalize">{user.team ?? '—'}</span>

              {/* City/State column — only for presales/sales agents */}
              <div className="flex flex-col gap-0.5">
                {LOCATION_ROLES.includes(user.role) ? (
                  <button
                    onClick={() => setLocationUser(user)}
                    className="flex items-center gap-1 text-xs text-left text-slate-500 hover:text-blue-600 transition-colors group"
                  >
                    <MapPin size={11} className="shrink-0 text-slate-400 group-hover:text-blue-500" />
                    <span className="truncate">
                      {(user.assigned_cities?.length > 0 || user.assigned_state)
                        ? [
                          ...(user.assigned_cities ?? []),
                          user.assigned_state ? `[${user.assigned_state}]` : null,
                        ].filter(Boolean).join(', ')
                        : <span className="text-slate-300 italic">Set cities…</span>
                      }
                    </span>
                  </button>
                ) : (
                  <span className="text-xs text-slate-300">—</span>
                )}
              </div>

              <span className={`text-xs font-semibold ${user.is_active ? 'text-green-600' : 'text-red-500'}`}>
                {user.is_active ? 'Active' : 'Inactive'}
              </span>

              <button
                onClick={() => toggleActive(user)}
                className={`text-xs px-2 py-1 rounded-lg border font-medium transition-colors ${user.is_active
                  ? 'border-red-200 text-red-600 hover:bg-red-50'
                  : 'border-green-200 text-green-600 hover:bg-green-50'
                  }`}>
                {user.is_active ? 'Disable' : 'Enable'}
              </button>
            </div>
          ))
        )}
      </div>

      <AddUserModal open={showAdd} onClose={() => { setShowAdd(false); load() }} />
      <LocationModal user={locationUser} onClose={() => { setLocationUser(null); load() }} />
    </Layout>
  )
}

// ─────────────────────────────────────────────────────────────
// ADD USER MODAL  ← UNCHANGED
// ─────────────────────────────────────────────────────────────
function AddUserModal({ open, onClose }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'presales_agent' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(f, v) { setForm(x => ({ ...x, [f]: v })) }

  async function handleSave() {
    if (!form.email || !form.password || !form.name) { setError('All fields required'); return }
    setSaving(true); setError('')
    try {
      const { data, error: authErr } = await supabase.auth.admin.createUser({
        email: form.email, password: form.password, email_confirm: true
      })
      if (authErr) throw authErr

      await supabase.from('users').insert({
        id: data.user.id,
        name: form.name,
        email: form.email,
        role: form.role,
        team: TEAM_MAP[form.role] ?? null,
      })
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
        <div><label className="label">Role</label>
          <select className="select" value={form.role} onChange={e => set('role', e.target.value)}>
            {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
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

// ─────────────────────────────────────────────────────────────
// LOCATION MODAL  (NEW)
// Manager yahan agent ko cities + state assign karta hai
// ─────────────────────────────────────────────────────────────
function LocationModal({ user, onClose }) {
  const [cities, setCities] = useState([])   // array of strings
  const [state, setState] = useState('')
  const [cityInput, setCityInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Jab user change ho — form reset karo
  useEffect(() => {
    if (!user) return
    setCities(user.assigned_cities ?? [])
    setState(user.assigned_state ?? '')
    setCityInput('')
    setError('')
  }, [user])

  function addCity() {
    const trimmed = cityInput.trim()
    if (!trimmed) return
    if (cities.map(c => c.toLowerCase()).includes(trimmed.toLowerCase())) {
      setCityInput(''); return  // duplicate skip
    }
    setCities(prev => [...prev, trimmed])
    setCityInput('')
  }

  function removeCity(idx) {
    setCities(prev => prev.filter((_, i) => i !== idx))
  }

  function handleCityKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); addCity() }
  }

  async function handleSave() {
    setSaving(true); setError('')
    try {
      const { error: err } = await supabase
        .from('users')
        .update({
          assigned_cities: cities,
          assigned_state: state.trim() || null,
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
    <Modal open={!!user} onClose={onClose} title={`City / State — ${user.name}`} width={460}>
      <p className="text-xs text-slate-500 mb-4">
        Lead assignment order: <strong>City match</strong> → <strong>State match</strong> → round-robin fallback
      </p>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {/* Cities */}
      <div className="mb-4">
        <label className="label">Assigned Cities</label>
        <div className="flex gap-2 mb-2">
          <input
            className="input flex-1"
            placeholder="City name likhein, Enter dabayein…"
            value={cityInput}
            onChange={e => setCityInput(e.target.value)}
            onKeyDown={handleCityKeyDown}
          />
          <button onClick={addCity} className="btn px-3">Add</button>
        </div>

        {cities.length === 0 ? (
          <p className="text-xs text-slate-400 italic">Koi city assign nahi hai abhi</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {cities.map((city, i) => (
              <span key={i}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-medium">
                {city}
                <button onClick={() => removeCity(i)} className="hover:text-red-500 transition-colors">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* State */}
      <div className="mb-5">
        <label className="label">Assigned State <span className="text-slate-400 font-normal">(fallback — city match nahi toh)</span></label>
        <input
          className="input"
          placeholder="e.g. Rajasthan"
          value={state}
          onChange={e => setState(e.target.value)}
        />
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