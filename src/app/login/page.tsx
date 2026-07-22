'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { Eye, EyeOff, UtensilsCrossed, Loader2, ArrowLeft, User, Mail, Lock, Home, Phone, Hash, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

const ROLES = [
  { id: 'student', label: 'Student' },
  { id: 'lecturer', label: 'Lecturer' },
  { id: 'guest', label: 'Guest' },
]

type AuthMode = 'signin' | 'signup' | 'forgot'

export default function LoginPage() {
  const router = useRouter()
  const { userData, loading: authLoading } = useAuth()

  const [mode, setMode] = useState<AuthMode>('signin')
  const [role, setRole] = useState('student')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [studentId, setStudentId] = useState('')
  const [hostel, setHostel] = useState('')
  const [room, setRoom] = useState('')
  const [phone, setPhone] = useState('')

  const [empCode, setEmpCode] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  // Clear messages when mode changes
  useEffect(() => { setError(''); setMessage('') }, [mode])

  // Role-based redirection
  useEffect(() => {
    if (userData && !authLoading) {
      if (userData.role === 'admin') router.replace('/admin/dashboard')
      else if (userData.role === 'employee') router.replace('/employee/dashboard')
      else router.replace('/menu')
    }
  }, [userData, authLoading, router])

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    
    const cleanEmail = email.trim()

    if (mode === 'signin') {
      if (!cleanEmail || !password) { setError('Please fill in all fields'); return }
      setLoading(true)
      try {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password
        })
        
        if (authError) throw authError

        if (authData.user) {
          const { data: u, error: dbError } = await supabase
            .from('users')
            .select('*')
            .eq('uid', authData.user.id)
            .single()

          if (!dbError && u) {
            if (u.role === 'admin') router.replace('/admin/dashboard')
            else if (u.role === 'employee') router.replace('/employee/dashboard')
            else router.replace('/menu')
          }
        }
      } catch (err: any) {
        setError(err.message || 'Sign in failed. Please try again.')
      } finally {
        setLoading(false)
      }
    } else if (mode === 'forgot') {
      if (!cleanEmail) { setError('Please enter your email address to reset your password'); return }
      setLoading(true)
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        })
        if (error) throw error
        setMessage('Password reset email sent! Check your inbox.')
        setError('')
      } catch (err: any) {
        setError(err.message || 'Failed to send reset email. Please try again.')
      } finally {
        setLoading(false)
      }
    } else {
      if (!name || !cleanEmail || !password || !confirmPwd) { setError('Please fill in all required fields'); return }
      if (password !== confirmPwd) { setError('Passwords do not match'); return }
      if (role === 'student' && !studentId) { setError('Student ID is required'); return }
      if (role === 'employee') {
        if (empCode !== 'EMP2024') {
          setError('Invalid Employee Code. Please contact the canteen manager.')
          setLoading(false)
          return
        }
      }

      setLoading(true)
      try {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: { full_name: name }
          }
        })
        if (authError) throw authError

        if (authData.user) {
          const { error: dbError } = await supabase.from('users').insert([{
            uid: authData.user.id,
            name,
            email: cleanEmail,
            role,
            studentId: role === 'student' ? studentId : null,
            hostelBlock: role === 'student' ? hostel : null,
            roomNumber: role === 'student' ? room : null,
            phone: phone || null,
          }])

          if (dbError) throw dbError

          if (role === 'admin') router.push('/admin/dashboard')
          else if (role === 'employee') router.push('/employee/dashboard')
          else router.push('/menu')
        }
      } catch (err: any) {
        setError(err.message || 'Registration failed. Please try again.')
      } finally {
        setLoading(false)
      }
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center mb-4 animate-pulse">
          <UtensilsCrossed size={32} className="text-primary" />
        </div>
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mt-2" 
          style={{borderWidth:'3px'}}/>
        <p className="text-gray-400 text-xs font-bold mt-4 uppercase tracking-widest">
          {mode === 'signin' ? 'Signing in...' : mode === 'forgot' ? 'Sending link...' : 'Registering...'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col justify-center px-6 py-12 min-h-screen">
      {(mode === 'signup' || mode === 'forgot') && (
        <button onClick={() => setMode('signin')} className="absolute top-8 left-6 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
          <ArrowLeft size={20} />
        </button>
      )}

      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center mb-4">
          <UtensilsCrossed size={32} className="text-primary" />
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight text-center">
          {mode === 'signin' ? 'Welcome Back' : mode === 'forgot' ? 'Reset Password' : 'Create Account'}
        </h1>
        <p className="text-gray-400 text-sm mt-1.5 font-medium text-center">
          {mode === 'signup' ? 'Please select your role and details to join' : mode === 'forgot' ? 'Enter your email to receive a reset link' : 'Sign in to access your dashboard'}
        </p>
      </div>

      {mode === 'signup' && (
        <div className="mb-6">
          <div className="flex bg-gray-100 rounded-2xl p-1 gap-1 overflow-x-auto no-scrollbar">
            {ROLES.map(({ id, label }) => (
              <button key={id} type="button" onClick={() => setRole(id)}
                className={cn('flex-1 py-2.5 px-3 text-sm font-bold rounded-xl transition-all whitespace-nowrap min-w-[70px]',
                  role === id ? 'bg-white text-primary shadow-card' : 'text-gray-400 hover:text-gray-600')}>
                {label}
              </button>
            ))}
          </div>
          {/* Locked Staff tile */}
          <button type="button" onClick={() => setRole('employee')}
            className={cn(
              'w-full mt-2 py-3 px-4 rounded-2xl border-2 flex items-center gap-3 transition-all',
              role === 'employee'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-dashed border-gray-300 text-gray-400 hover:border-gray-400'
            )}>
            <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0', role === 'employee' ? 'bg-primary/10' : 'bg-gray-100')}>
              <ShieldAlert size={16} className={role === 'employee' ? 'text-primary' : 'text-gray-400'} />
            </div>
            <div className="text-left">
              <p className="text-sm font-extrabold">Staff / Employee</p>
              <p className="text-[11px] opacity-70 font-medium">Requires Employee Code from manager</p>
            </div>
            <div className="ml-auto">
              <Lock size={14} className={role === 'employee' ? 'text-primary' : 'text-gray-300'} />
            </div>
          </button>
        </div>
      )}

      <form onSubmit={handleAuth} className="space-y-4">
        {mode === 'signup' && (
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">Full Name</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" className="input-field pl-10" />
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@university.com" className="input-field pl-10" autoComplete="email" />
          </div>
        </div>

        {mode === 'signup' && role === 'student' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-bold text-gray-800 mb-2">Student ID</label>
              <div className="relative">
                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input type="text" value={studentId} onChange={e => setStudentId(e.target.value)} placeholder="ST12345" className="input-field pl-10" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2">Hostel Block</label>
              <div className="relative"><Home className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} /><input type="text" value={hostel} onChange={e => setHostel(e.target.value)} placeholder="Block A" className="input-field pl-10" /></div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2">Room No</label>
              <div className="relative"><Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} /><input type="text" value={room} onChange={e => setRoom(e.target.value)} placeholder="101" className="input-field pl-10" /></div>
            </div>
          </div>
        )}

        {mode === 'signup' && role === 'employee' && (
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">Employee Code</label>
            <div className="relative">
              <ShieldAlert className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={16} />
              <input
                type="text"
                value={empCode}
                onChange={e => setEmpCode(e.target.value.toUpperCase())}
                placeholder="Enter code from manager"
                className="input-field pl-10 border-primary/30 focus:border-primary"
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1 ml-1">Contact your canteen manager to get the Employee Code.</p>
          </div>
        )}

        {mode === 'signup' && (
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">Phone Number (Optional)</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="07X XXX XXXX" className="input-field pl-10" />
            </div>
          </div>
        )}

        {mode !== 'forgot' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-bold text-gray-800">Password</label>
              {mode === 'signin' && (
                <button type="button" onClick={(e) => { e.preventDefault(); setMode('forgot') }} className="text-xs font-bold text-primary hover:text-primary/80">Forgot Password?</button>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="input-field pl-10 pr-12" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
              <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        )}

        {mode === 'signup' && (
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">Confirm Password</label>
            <div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} /><input type={showPwd ? 'text' : 'password'} value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} placeholder="••••••••" className="input-field pl-10" autoComplete="new-password" /></div>
          </div>
        )}

        {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 font-medium">{error}</div>}
        {message && <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium">{message}</div>}

        <button type="submit" disabled={loading} className="btn-primary mt-2 flex items-center justify-center gap-2 py-4">
          {loading ? (
            <><Loader2 size={18} className="animate-spin" />{mode === 'signin' ? 'Signing in...' : mode === 'forgot' ? 'Sending...' : 'Creating...'}</>
          ) : (
            mode === 'signin' ? 'Sign In' : mode === 'forgot' ? 'Send Reset Link' : 'Create Account'
          )}
        </button>
      </form>

      {mode === 'signin' && (
        <button type="button" onClick={() => setMode('signup')} className="btn-outline py-4 mt-6">Create New Account</button>
      )}
    </div>
  )
}
