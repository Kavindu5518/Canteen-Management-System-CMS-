'use client'
import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react'
import { User as SupabaseUser } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { User } from '@/types'

interface AuthContextType {
  supabaseUser: SupabaseUser | null
  userData: User | null
  loading: boolean
  isAdmin: boolean
  isEmployee: boolean
}

const AuthContext = createContext<AuthContextType>({
  supabaseUser: null,
  userData: null,
  loading: true,
  isAdmin: false,
  isEmployee: false,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null)
  const [userData, setUserData] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const initialized = useRef(false)

  const fetchUserData = async (uid: string, email?: string, fullName?: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('uid', uid)
        .single();
      
      if (data && !error) {
        setUserData(data as User);
      } else {
        setUserData({
          uid: uid,
          name: fullName || email?.split('@')[0] || 'User',
          email: email || '',
          role: 'student',
          createdAt: new Date()
        } as User);
      }
    } catch (err) {
      console.error("AuthContext Error:", err);
      setUserData({
        uid: uid,
        name: fullName || email?.split('@')[0] || 'User',
        email: email || '',
        role: 'student',
        createdAt: new Date()
      } as User);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    console.log("AuthContext: Initializing...");
    
    // Safety fallback: Force loading to false after 5 seconds
    const timer = setTimeout(() => {
      setLoading(false);
      console.warn("AuthContext: Loading forced to false via timeout.");
    }, 5000);

    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user ?? null;
        console.log("AuthContext: Session found:", user?.email);
        setSupabaseUser(user);
        
        if (user) {
          await fetchUserData(user.id, user.email, user.user_metadata?.full_name);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("AuthContext Init Error:", err);
        setLoading(false);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setSupabaseUser(user);
      if (user) {
        fetchUserData(user.id, user.email, user.user_metadata?.full_name);
      } else {
        setUserData(null);
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    supabaseUser,
    userData,
    loading,
    isAdmin: userData?.role === 'admin',
    isEmployee: userData?.role === 'employee'
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
