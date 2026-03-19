import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)   // auth.users row
  const [profile, setProfile] = useState(null)   // public.users row (has role/team)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(authUser) {
    if (!authUser) { setProfile(null); return }
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single()
    setProfile(data)
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      fetchProfile(session?.user ?? null).finally(() => setLoading(false))
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      fetchProfile(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  // Role helpers
  const role        = profile?.role ?? null
  const team        = profile?.team ?? null
  const isSuperAdmin  = role === 'super_admin'
  const isManager     = role?.endsWith('_manager') || isSuperAdmin
  const isPresales    = role?.startsWith('presales')
  const isSales       = role?.startsWith('sales')
  const isFinance     = role?.startsWith('finance')
  const isOps         = role?.startsWith('ops')
  const isAmc         = role?.startsWith('amc')

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      role, team,
      isSuperAdmin, isManager,
      isPresales, isSales, isFinance, isOps, isAmc,
      signIn, signOut,
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
