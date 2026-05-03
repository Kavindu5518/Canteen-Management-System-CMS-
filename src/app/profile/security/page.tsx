'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { ArrowLeft, Lock, KeyRound, Loader2, ShieldCheck } from 'lucide-react'

export default function SecurityPage() {
  const router = useRouter()
  const { supabaseUser } = useAuth()
  
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!supabaseUser) return

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.')
      return
    }
    if (newPassword.length < 6) {
      setError('Password should be at least 6 characters.')
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError
      
      setSuccess('Password updated successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      console.error('Password change error:', err)
      setError(err.message || 'Failed to update password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white px-5 pt-14 pb-4 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-40">
        <button onClick={()=>router.back()} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center transition-transform active:scale-95">
          <ArrowLeft size={18}/>
        </button>
        <h1 className="text-lg font-extrabold flex-1 text-center text-gray-900">Security</h1>
        <div className="w-9"/>
      </div>

      <div className="p-5">
        
        <div className="bg-primary/10 rounded-3xl p-5 mb-6 flex items-start gap-4">
          <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center shrink-0">
            <ShieldCheck size={24} className="text-primary"/>
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-primary mb-1">Secure your account</h3>
            <p className="text-xs text-primary/70 leading-relaxed font-semibold">Make sure your password is at least 6 characters long and includes a mix of numbers and letters.</p>
          </div>
        </div>

        <form onSubmit={handlePasswordChange} className="bg-white rounded-3xl p-5 shadow-card space-y-4">
          <h2 className="text-sm font-extrabold text-gray-900 mb-2">Change Password</h2>
          
          {error && <div className="bg-red-50 text-red-600 text-xs font-bold p-3 rounded-xl border border-red-100">{error}</div>}
          {success && <div className="bg-green-50 text-green-600 text-xs font-bold p-3 rounded-xl border border-green-100">{success}</div>}

          <div className="space-y-1.5">
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <KeyRound size={18}/>
              </div>
              <input 
                type="password" 
                required
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                placeholder="Current Password"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <Lock size={18}/>
              </div>
              <input 
                type="password" 
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                placeholder="New Password"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <Lock size={18}/>
              </div>
              <input 
                type="password" 
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                placeholder="Confirm New Password"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full btn-primary py-4 rounded-2xl flex items-center justify-center gap-2 mt-4 active:scale-95 transition-transform"
          >
            {loading ? <Loader2 size={18} className="animate-spin"/> : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
