'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'

// Public paths - no auth needed
const PUBLIC = ['/login']
// Paths that bypass ALL routing logic
const BYPASS = ['/admin-setup', '/auth']
// Admin-only paths
const ADMIN_PATHS = ['/admin']
// Employee-only paths
const EMPLOYEE_PATHS = ['/employee']
// Customer paths
const CUSTOMER_PATHS = ['/menu', '/checkout', '/orders', '/profile']

export default function RouteGuard({ children }: { children: React.ReactNode }) {
  const { supabaseUser, userData, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const isBypass     = BYPASS.some(p => pathname.startsWith(p))
  const isPublic     = PUBLIC.some(p => pathname.startsWith(p))
  const isAdmin      = ADMIN_PATHS.some(p => pathname.startsWith(p))
  const isEmployeePg = EMPLOYEE_PATHS.some(p => pathname.startsWith(p))
  const isCustomer   = CUSTOMER_PATHS.some(p => pathname.startsWith(p))

  useEffect(() => {
    if (loading || isBypass) return

    // 1. Not logged in → redirect to /login
    if (!supabaseUser && !isPublic) {
      router.replace('/login')
      return
    }

    // 2. Logged in on public login page → redirect to role home
    if (supabaseUser && isPublic) {
      const role = userData?.role || 'student'
      if (role === 'admin') router.replace('/admin/dashboard')
      else if (role === 'employee') router.replace('/employee/dashboard')
      else router.replace('/menu')
      return
    }

    // 3. Verify role permissions if userData is available
    if (supabaseUser && userData) {
      if (isAdmin && userData.role !== 'admin') {
        router.replace(userData.role === 'employee' ? '/employee/dashboard' : '/menu')
        return
      }
      if (isEmployeePg && userData.role !== 'employee') {
        router.replace(userData.role === 'admin' ? '/admin/dashboard' : '/menu')
        return
      }
    }
  }, [supabaseUser, userData, loading, isBypass, isPublic, isAdmin, isEmployeePg, isCustomer, pathname, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#F4A11B" strokeWidth="2">
            <path d="M3 11l19-9-9 19-2-8-8-2z"/>
          </svg>
        </div>
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mt-2" 
          style={{borderWidth:'3px'}}/>
      </div>
    )
  }

  return <>{children}</>
}
