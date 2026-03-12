import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type UserRole = 'farmer' | 'restaurant' | 'admin'

interface Profile {
  id: string
  email: string
  role: UserRole
  shop_name: string
  representative_name: string | null
  address: string | null
  avatar_url: string | null
  delivery_address: string | null
  delivery_memo: string | null
  line_user_id: string | null
}

type ProfileUpdates = Partial<Pick<Profile,
  'shop_name' | 'representative_name' | 'address' |
  'avatar_url' | 'delivery_address' | 'delivery_memo' | 'line_user_id'
>>

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  role: UserRole | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  updateProfile: (updates: ProfileUpdates) => Promise<{ error: Error | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (!error && data) setProfile(data as Profile)
    setLoading(false)
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
  }

  async function updateProfile(updates: ProfileUpdates): Promise<{ error: Error | null }> {
    if (!user) return { error: new Error('Not authenticated') }
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id)
    if (!error) setProfile(prev => prev ? { ...prev, ...updates } : prev)
    return { error: error as Error | null }
  }

  return (
    <AuthContext.Provider value={{
      user, session, profile,
      role: profile?.role ?? null,
      loading, signIn, signOut, updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
