import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [user, setUser] = useState(null)
  const [role, setRole] = useState('staff') // 'staff' | 'cashier'

  const fetchRole = useCallback(async (userId) => {
    if (!userId) { setRole('staff'); return }
    try {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()
      setRole(data?.role ?? 'staff')
    } catch {
      setRole('staff')
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      fetchRole(session?.user?.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      fetchRole(session?.user?.id)
    })

    return () => subscription.unsubscribe()
  }, [fetchRole])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setRole('staff')
  }

  /** true for regular workshop staff (can create/edit) */
  const isStaff    = role === 'staff'
  /** true for cashier role (read-only + pricing view) */
  const isCashier  = role === 'cashier'

  return (
    <AuthContext.Provider value={{ session, user, role, isStaff, isCashier, signIn, signOut, loading: session === undefined }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
