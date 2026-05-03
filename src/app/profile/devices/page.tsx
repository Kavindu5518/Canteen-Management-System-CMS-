'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, MonitorSmartphone, Smartphone, CheckCircle2, LogOut, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function DevicesPage() {
  const router = useRouter()
  const [deviceInfo, setDeviceInfo] = useState('Unknown Device')
  const [loading, setLoading] = useState(false)
  const [loggedOutOthers, setLoggedOutOthers] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent
    let os = 'Unknown OS'
    let browser = 'Unknown Browser'
    
    if (ua.includes('Windows')) os = 'Windows'
    else if (ua.includes('Mac OS')) os = 'macOS'
    else if (ua.includes('Linux')) os = 'Linux'
    else if (ua.includes('Android')) os = 'Android'
    else if (ua.includes('iOS') || ua.includes('iPhone')) os = 'iOS'

    if (ua.includes('Chrome')) browser = 'Chrome'
    else if (ua.includes('Firefox')) browser = 'Firefox'
    else if (ua.includes('Safari')) browser = 'Safari'
    else if (ua.includes('Edge')) browser = 'Edge'

    setDeviceInfo(`${os} • ${browser}`)
  }, [])

  async function handleLogoutOthers() {
    if (!confirm('Are you sure you want to log out from all other devices?')) return
    
    setLoading(true)
    try {
      const { error } = await supabase.auth.signOut({ scope: 'others' })
      if (error) throw error
      setLoggedOutOthers(true)
      alert('Successfully logged out from all other devices.')
    } catch (err) {
      console.error(err)
      alert('Error logging out others. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogoutCurrent() {
    if (!confirm('Log out from this device?')) return
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white px-5 pt-14 pb-4 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-40">
        <button onClick={()=>router.back()} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center transition-transform active:scale-95">
          <ArrowLeft size={18}/>
        </button>
        <h1 className="text-lg font-extrabold flex-1 text-center text-gray-900">Logged Devices</h1>
        <div className="w-9"/>
      </div>

      <div className="p-5 space-y-4">
        
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 mb-2">Current Session</p>
        
        <div className="bg-white rounded-3xl p-4 shadow-card flex items-center gap-4 border-2 border-primary/20">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <MonitorSmartphone size={22} className="text-primary"/>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-gray-900">This Device</h3>
              <CheckCircle2 size={14} className="text-green-500"/>
            </div>
            <p className="text-xs text-gray-500 font-medium mt-0.5">{deviceInfo}</p>
            <p className="text-[10px] text-green-600 font-bold mt-1 bg-green-50 px-2 py-0.5 rounded inline-block">Active Now</p>
          </div>
        </div>

        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 mt-6 mb-2">Other Devices</p>

        {!loggedOutOthers ? (
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center shrink-0">
              <Smartphone size={22} className="text-gray-500"/>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-extrabold text-gray-900">Other Active Sessions</h3>
              <p className="text-xs text-gray-500 font-medium mt-0.5">May include mobile or other browsers</p>
              <p className="text-[10px] text-gray-400 font-bold mt-1">Status: Potentially active</p>
            </div>
            <button 
              onClick={handleLogoutOthers}
              disabled={loading}
              className="text-xs font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-lg active:scale-95 transition-all hover:bg-red-100 disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : 'Log Out All'}
            </button>
          </div>
        ) : (
          <div className="bg-gray-100/50 rounded-3xl p-8 border border-dashed border-gray-200 text-center">
            <CheckCircle2 size={24} className="text-gray-300 mx-auto mb-2"/>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No other active devices</p>
          </div>
        )}

        <div className="mt-8 pt-8 border-t border-gray-100">
           <button 
            onClick={handleLogoutCurrent}
            className="w-full flex items-center justify-center gap-2 py-4 bg-white border border-gray-200 text-red-500 font-bold rounded-2xl text-sm shadow-sm active:scale-[0.98] transition-all"
           >
             <LogOut size={18}/>
             Log Out From This Device
           </button>
        </div>

        <div className="mt-8 text-center pt-4">
          <p className="text-xs text-gray-400 max-w-[250px] mx-auto leading-relaxed">
            If you see a device you don't recognize, please change your password immediately to secure your account.
          </p>
        </div>

      </div>
    </div>
  )
}
