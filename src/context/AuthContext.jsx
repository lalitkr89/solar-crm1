import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [roleData, setRoleData] = useState(null)
  const [pages, setPages] = useState([])
  const [stages, setStages] = useState([])
  const [loading, setLoading] = useState(true)

  const initialLoadDone = useRef(false)

  const fetchProfile = useCallback(async (authUser) => {
    if (!authUser) {
      setProfile(null); setRoleData(null)
      setPages([]); setStages([])
      return
    }
    const { data: prof } = await supabase
      .from('users')
      .select('*, role_data:role_id(id, name, label, team, is_manager)')
      .eq('id', authUser.id)
      .single()

    setProfile(prof)

    if (!prof?.role_id) {
      setRoleData(null); setPages([]); setStages([])
      return
    }

    setRoleData(prof.role_data)

    const { data: pageRows } = await supabase
      .from('page_access')
      .select('page')
      .eq('role_id', prof.role_id)
      .eq('can_access', true)

    setPages((pageRows ?? []).map(r => r.page))

    const { data: stageRows } = await supabase
      .from('stage_access')
      .select('stage_name, can_view, can_move_lead')
      .eq('role_id', prof.role_id)
      .eq('can_view', true)

    setStages(stageRows ?? [])
  }, [])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!initialLoadDone.current) return
      const u = session?.user ?? null
      setUser(u)
      fetchProfile(u)
    })

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        const u = session?.user ?? null
        setUser(u)
        return fetchProfile(u)
      })
      .finally(() => {
        initialLoadDone.current = true
        setLoading(false)
      })

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null); setProfile(null); setRoleData(null)
    setPages([]); setStages([])
  }

  const role = profile?.role ?? null
  const team = roleData?.team ?? profile?.team ?? null

  const isSuperAdmin = role === 'super_admin'
  const isManager = roleData?.is_manager || isSuperAdmin
  const isPresales = team === 'presales' || isSuperAdmin
  const isSales = team === 'sales' || isSuperAdmin
  const isFinance = team === 'finance' || isSuperAdmin
  const isOps = team === 'ops' || isSuperAdmin
  const isAmc = team === 'amc' || isSuperAdmin

  function canAccessPage(path) {
    if (isSuperAdmin) return true
    return pages.includes(path)
  }

  function canViewStage(stageName) {
    if (isSuperAdmin) return true
    return stages.some(s => s.stage_name === stageName && s.can_view)
  }

  function canMoveLead(stageName) {
    if (isSuperAdmin) return true
    return stages.some(s => s.stage_name === stageName && s.can_move_lead)
  }

  const allowedStages = isSuperAdmin ? null : stages.map(s => s.stage_name)

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      role, team,
      isSuperAdmin, isManager,
      isPresales, isSales, isFinance, isOps, isAmc,
      signIn, signOut,
      roleData, pages, stages, allowedStages,
      canAccessPage, canViewStage, canMoveLead,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}