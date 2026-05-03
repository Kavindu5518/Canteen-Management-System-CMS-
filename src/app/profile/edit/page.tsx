'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { ArrowLeft, Save, User, Mail, Shield, Smartphone, Loader2 } from 'lucide-react'

export default function EditProfilePage() {
  const router = useRouter()
  const { userData, supabaseUser } = useAuth()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Initialize form fields when userData loads
  useEffect(() => {
    if (userData && !initialized) {
      setName(userData.name ?? '')
      setPhone(supabaseUser?.user_metadata?.phone ?? '')
      setInitialized(true)
    }
  }, [userData, supabaseUser, initialized])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!supabaseUser) return

    setLoading(true)
    try {
      // 1. Update Supabase Auth metadata
      const { error: authErr } = await supabase.auth.updateUser({ 
        data: { 
          full_name: name, 
          phone: phone 
        } 
      })
      if (authErr) throw authErr

      // 2. Update Postgres Table (using column names from schema.sql)
      const { error: dbErr } = await supabase.from('users').update({
        name: name,
        phone: phone,
        // createdAt exists, updatedAt does not in schema.sql for users table
      }).eq('uid', supabaseUser.id)
      
      if (dbErr) throw dbErr

      alert('Profile updated successfully!')
      router.back()
    } catch (error) {
      console.error('Error updating profile:', error)
      alert('Failed to update profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white px-5 pt-14 pb-4 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-40">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center transition-transform active:scale-95">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-extrabold flex-1 text-center text-gray-900">Edit Profile</h1>
        <div className="w-9" />
      </div>

      <div className="p-5">
        <form onSubmit={handleSave} className="bg-white rounded-3xl p-5 shadow-card space-y-5">

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Full Name</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <User size={18} />
              </div>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                placeholder="Enter your full name"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Email Address</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <Mail size={18} />
              </div>
              <input
                type="email"
                disabled
                value={userData?.email ?? ''}
                className="w-full bg-gray-100 border border-gray-100 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-semibold text-gray-500 cursor-not-allowed"
              />
            </div>
            <p className="text-[10px] text-gray-400 ml-1">Email cannot be changed directly.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Phone Number</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <Smartphone size={18} />
              </div>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                placeholder="Enter your phone number"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Account Role</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <Shield size={18} />
              </div>
              <input
                type="text"
                disabled
                value={(userData?.role ?? 'student').toUpperCase()}
                className="w-full bg-gray-100 border border-gray-100 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-bold text-gray-500 cursor-not-allowed"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !initialized}
            className="w-full btn-primary py-4 rounded-2xl flex items-center justify-center gap-2 mt-4 active:scale-95 transition-transform"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {loading ? 'Saving Changes...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  )
}
