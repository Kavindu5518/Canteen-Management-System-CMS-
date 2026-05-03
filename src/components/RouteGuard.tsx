'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'

// Public paths - no auth needed
const PUBLIC = ['/login']
// Paths that bypass ALL routing logic (always accessible)
const BYPASS = ['/admin-setup']
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

  useEffect(() => {
    if (loading) return

    // Bypass paths — skip all routing logic
    if (BYPASS.some(p => pathname.startsWith(p))) return

    const isPublic     = PUBLIC.some(p => pathname.startsWith(p))
    const isAdmin      = ADMIN_PATHS.some(p => pathname.startsWith(p))
    const isEmployeePg = EMPLOYEE_PATHS.some(p => pathname.startsWith(p))
    const isCustomer   = CUSTOMER_PATHS.some(p => pathname.startsWith(p))

    // Not logged in → login page
    if (!supabaseUser && !isPublic) {
      router.replace('/login')
      return
    }

    // Logged in on login page → redirect to correct home
    if (supabaseUser && isPublic) {
      if (userData?.role === 'admin') router.replace('/admin/dashboard')
      else if (userData?.role === 'employee') router.replace('/employee/dashboard')
      else router.replace('/menu')
      return
    }

    // Non-admin trying to access admin → redirect
    if (supabaseUser && isAdmin && userData?.role !== 'admin') {
      if (userData?.role === 'employee') router.replace('/employee/dashboard')
      else router.replace('/menu')
      return
    }

    // Non-employee trying to access employee dashboard → redirect
    if (supabaseUser && isEmployeePg && userData?.role !== 'employee') {
      if (userData?.role === 'admin') router.replace('/admin/dashboard')
      else router.replace('/menu')
      return
    }

    // Admin trying to access customer pages → redirect
    if (supabaseUser && isCustomer && userData?.role === 'admin') {
      router.replace('/admin/dashboard')
      return
    }

    // Employee trying to access customer pages → redirect to employee dashboard
    if (supabaseUser && isCustomer && userData?.role === 'employee') {
      router.replace('/employee/dashboard')
      return
    }
  }, [supabaseUser, userData, loading, pathname, router])

  // Show loading spinner while checking auth
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
        
        {/* Fail-safe button if loading takes too long */}
        <button 
          onClick={() => window.location.reload()}
          className="mt-8 text-xs font-bold text-primary hover:underline px-4 py-2 border border-primary/20 rounded-xl"
        >
          Taking too long? Reload Page
        </button>
      </div>
    )
  }

  return <>{children}</>
}
