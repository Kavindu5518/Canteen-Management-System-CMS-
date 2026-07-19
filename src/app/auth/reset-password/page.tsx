'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, UtensilsCrossed, Loader2, Lock, CheckCircle2, AlertCircle } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    // Supabase sends the recovery token in the URL hash
    // onAuthStateChange picks up PASSWORD_RECOVERY event automatically
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
        setCheckingSession(false)
      } else if (event === 'SIGNED_IN' && session) {
        // Also handle if already exchanged
        setSessionReady(true)
        setCheckingSession(false)
      }
    })

    // Fallback: check existing session after short delay
    const timer = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setSessionReady(true)
      }
      setCheckingSession(false)
    }, 2000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!password || !confirmPwd) {
      setError('Please fill in all fields')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPwd) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      setSuccess(true)
      // Redirect to login after 2.5 seconds
      setTimeout(() => {
        router.push('/login')
      }, 2500)
    } catch (err: any) {
      setError(err.message || 'Failed to update password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const strength = (() => {
    if (password.length === 0) return null
    if (password.length < 6) return { label: 'Too short', color: 'bg-red-400', width: '25%' }
    if (password.length < 8) return { label: 'Weak', color: 'bg-orange-400', width: '50%' }
    if (/[A-Z]/.test(password) && /[0-9]/.test(password)) return { label: 'Strong', color: 'bg-green-500', width: '100%' }
    return { label: 'Medium', color: 'bg-yellow-400', width: '75%' }
  })()

  if (checkingSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center">
          <UtensilsCrossed size={32} className="text-primary" />
        </div>
        <Loader2 size={28} className="animate-spin text-primary" />
        <p className="text-gray-400 text-sm font-medium">Verifying your reset link...</p>
      </div>
    )
  }

  if (!sessionReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-4">
        <div className="w-16 h-16 bg-red-100 rounded-3xl flex items-center justify-center">
          <AlertCircle size={32} className="text-red-500" />
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900">Link Expired</h1>
        <p className="text-gray-400 text-sm text-center max-w-xs">
          This password reset link is invalid or has expired. Please request a new one.
        </p>
        <button onClick={() => router.push('/login')} className="btn-primary mt-2 px-8 py-3">
          Back to Login
        </button>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-4">
        <div className="w-20 h-20 bg-green-100 rounded-3xl flex items-center justify-center animate-bounce">
          <CheckCircle2 size={40} className="text-green-500" />
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900">Password Updated!</h1>
        <p className="text-gray-400 text-sm text-center max-w-xs">
          Your password has been changed successfully. Redirecting to login...
        </p>
        <div className="flex gap-1 mt-2">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col justify-center px-6 py-12 min-h-screen">
      {/* Header */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center mb-4">
          <UtensilsCrossed size={32} className="text-primary" />
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight text-center">
          Set New Password
        </h1>
        <p className="text-gray-400 text-sm mt-1.5 font-medium text-center">
          Enter your new password below
        </p>
      </div>

      <form onSubmit={handleReset} className="space-y-4">
        {/* New Password */}
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">New Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter new password"
              className="input-field pl-10 pr-12"
              autoComplete="new-password"
            />
            <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
              {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Strength Bar */}
          {strength && (
            <div className="mt-2">
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                  style={{ width: strength.width }}
                />
              </div>
              <p className={`text-[11px] mt-1 font-semibold ${
                strength.label === 'Strong' ? 'text-green-500' :
                strength.label === 'Medium' ? 'text-yellow-500' :
                strength.label === 'Weak' ? 'text-orange-400' : 'text-red-400'
              }`}>{strength.label}</p>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">Confirm Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPwd}
              onChange={e => setConfirmPwd(e.target.value)}
              placeholder="Re-enter new password"
              className="input-field pl-10 pr-12"
              autoComplete="new-password"
            />
            <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Match indicator */}
          {confirmPwd.length > 0 && (
            <p className={`text-[11px] mt-1 font-semibold ${password === confirmPwd ? 'text-green-500' : 'text-red-400'}`}>
              {password === confirmPwd ? '✓ Passwords match' : '✗ Passwords do not match'}
            </p>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 font-medium">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary mt-2 flex items-center justify-center gap-2 py-4">
          {loading ? (
            <><Loader2 size={18} className="animate-spin" /> Updating Password...</>
          ) : (
            'Update Password'
          )}
        </button>
      </form>
    </div>
  )
}
