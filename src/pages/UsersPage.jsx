import { useEffect, useState } from 'react'
import Layout from '@/components/layout/Layout'
import { PageHeader, Avatar, Spinner, Modal } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { UserCog, Plus, RefreshCw } from 'lucide-react'

const ROLES = [
  'super_admin',
  'presales_manager','presales_agent',
  'sales_manager','sales_agent',
  'finance_manager','finance_agent',
  'ops_manager','ops_agent',
  'amc_manager','amc_agent',
]

const TEAM_MAP = {
  presales_manager: 'presales', presales_agent: 'presales',
  sales_manager: 'sales',       sales_agent: 'sales',
  finance_manager: 'finance',   finance_agent: 'finance',
  ops_manager: 'ops',           ops_agent: 'ops',
  amc_manager: 'amc',           amc_agent: 'amc',
}

const ROLE_COLOR = {
  super_admin: '#7F77DD', presales_manager: '#7F77DD', presales_agent: '#AFA9EC',
  sales_manager: '#378ADD', sales_agent: '#85B7EB',
  finance_manager: '#1D9E75', finance_agent: '#5DCAA5',
  ops_manager: '#D85A30', ops_agent: '#F0997B',
  amc_manager: '#BA7517', amc_agent: '#EF9F27',
}

export default function UsersPage() {
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

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
        <div className="grid grid-cols-[1fr_160px_120px_80px_80px] gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <span>Name</span><span>Role</span><span>Team</span><span>Status</span><span>Action</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner size={22} /></div>
        ) : (
          users.map(user => (
            <div key={user.id}
              className="grid grid-cols-[1fr_160px_120px_80px_80px] gap-3 px-4 py-3 border-b border-slate-100 items-center">
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
              <span className={`text-xs font-semibold ${user.is_active ? 'text-green-600' : 'text-red-500'}`}>
                {user.is_active ? 'Active' : 'Inactive'}
              </span>
              <button
                onClick={() => toggleActive(user)}
                className={`text-xs px-2 py-1 rounded-lg border font-medium transition-colors ${
                  user.is_active
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
    </Layout>
  )
}

function AddUserModal({ open, onClose }) {
  const [form,   setForm]   = useState({ name: '', email: '', password: '', role: 'presales_agent' })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  function set(f, v) { setForm(x => ({ ...x, [f]: v })) }

  async function handleSave() {
    if (!form.email || !form.password || !form.name) { setError('All fields required'); return }
    setSaving(true); setError('')
    try {
      // Create auth user
      const { data, error: authErr } = await supabase.auth.admin.createUser({
        email: form.email, password: form.password, email_confirm: true
      })
      if (authErr) throw authErr

      // Insert into public.users
      await supabase.from('users').insert({
        id:    data.user.id,
        name:  form.name,
        email: form.email,
        role:  form.role,
        team:  TEAM_MAP[form.role] ?? null,
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
