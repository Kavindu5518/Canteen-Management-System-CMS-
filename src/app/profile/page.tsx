'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { ArrowLeft, Camera, User, Bell, Lock, Monitor, ChevronRight, LogOut, Loader2 } from 'lucide-react'
import CustomerBottomNav from '@/components/customer/CustomerBottomNav'
import { cn } from '@/lib/utils'

const SECTIONS = [
  {
    title: 'ACCOUNT SETTINGS', items: [
      { icon: <User size={18} className="text-primary" />, label: 'Personal Information', sub: 'Manage names and contacts', bg: 'bg-primary/10', href: '/profile/edit' },
      { icon: <Bell size={18} className="text-blue-500" />, label: 'Notifications', sub: 'Order alerts and status', bg: 'bg-blue-50', href: '/profile/notifications' },
    ]
  },
  {
    title: 'SECURITY & ACCESS', items: [
      { icon: <Lock size={18} className="text-green-600" />, label: 'Password & Security', sub: 'Change password and 2FA', bg: 'bg-green-50', href: '/profile/security' },
      { icon: <Monitor size={18} className="text-purple-500" />, label: 'Logged Devices', sub: 'Monitor active sessions', bg: 'bg-purple-50', href: '/profile/devices' },
    ]
  },
]

export default function ProfilePage() {
  const router = useRouter()
  const { userData, supabaseUser } = useAuth()
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const roleLabel: Record<string, string> = {
    admin: 'CANTEEN ADMIN',
    student: 'STUDENT',
    lecturer: 'LECTURER',
    guest: 'GUEST',
    employee: 'EMPLOYEE',
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !supabaseUser) return

    // 2MB size limit
    const MAX_SIZE = 2 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      alert('Image size must be less than 2MB. Please choose a smaller image.')
      e.target.value = ''
      return
    }

    try {
      setUploading(true)
      const filePath = `${supabaseUser.id}_${Date.now()}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
      const photoURL = data.publicUrl

      await supabase.auth.updateUser({ data: { photoURL } })
      await supabase.from('users').update({ avatarUrl: photoURL }).eq('uid', supabaseUser.id)

      window.location.reload()
    } catch (error: any) {
      console.error('Error uploading avatar:', error)
      alert('Failed to upload photo: ' + (error.message || 'Please ensure the avatars storage bucket exists in Supabase.'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="bg-gray-50 has-bottom-nav min-h-screen">
      {/* Header */}
      <div className="bg-white px-5 pt-14 pb-4 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-40">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center transition-transform active:scale-95">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-extrabold flex-1 text-center text-gray-900">Profile</h1>
        <div className="w-9" />
      </div>

      {/* Avatar */}
      <div className="flex flex-col items-center pt-8 pb-6 px-5 bg-white border-b border-gray-100">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
            {supabaseUser?.user_metadata?.photoURL || (userData as any)?.avatarUrl ? (
              <img src={supabaseUser?.user_metadata?.photoURL || (userData as any)?.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-primary text-4xl font-extrabold">
                {userData?.name?.charAt(0)?.toUpperCase() ?? 'U'}
              </span>
            )}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-primary active:scale-95 hover:bg-orange-600 transition-all border-2 border-white">
            {uploading ? <Loader2 size={14} className="text-white animate-spin" /> : <Camera size={14} className="text-white" />}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageChange}
            accept="image/*"
            className="hidden"
          />
        </div>
        <h2 className="text-xl font-extrabold text-gray-900 mt-4">{userData?.name ?? 'User'}</h2>
        <p className="text-primary text-sm font-bold mt-0.5 tracking-wide">
          {roleLabel[userData?.role ?? 'student'] ?? 'STUDENT'}
        </p>
        <p className="text-gray-400 text-sm mt-1">{userData?.email ?? ''}</p>
        {userData?.studentId && (
          <p className="text-gray-400 text-xs mt-0.5">ID: {userData.studentId}</p>
        )}
        <Link href="/profile/edit" className="btn-primary mt-5 max-w-xs flex items-center justify-center gap-2 py-3 w-full active:scale-95 transition-transform hover:shadow-lg">
          <Camera size={16} /> Edit Profile
        </Link>
      </div>

      {/* Settings */}
      <div className="px-5 space-y-5 py-5">
        {SECTIONS.map(section => (
          <div key={section.title}>
            <p className="text-xs font-extrabold text-gray-400 tracking-widest mb-3">{section.title}</p>
            <div className="bg-white rounded-3xl overflow-hidden shadow-card">
              {section.items.map(({ icon, label, sub, bg, href }, i) => (
                <Link key={label} href={href}
                  className={cn('w-full flex items-center gap-4 px-4 py-4 hover:bg-gray-50 active:bg-gray-100 transition-colors',
                    i < section.items.length - 1 && 'border-b border-gray-100')}>
                  <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center shrink-0', bg)}>
                    {icon}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-bold text-gray-900">{label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300" />
                </Link>
              ))}
            </div>
          </div>
        ))}

        <button onClick={handleLogout}
          className="w-full py-4 rounded-2xl border-2 border-red-200 bg-red-50 text-red-600 font-bold flex items-center justify-center gap-2 active:scale-95 hover:bg-red-100 transition-all">
          <LogOut size={18} /> Logout Account
        </button>
      </div>

      <CustomerBottomNav />
    </div>
  )
}
