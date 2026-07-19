'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { ArrowLeft, BellRing, MessageSquare, Mail, Smartphone, Save, Loader2 } from 'lucide-react'
import { useToast } from '@/lib/toast'
import { cn } from '@/lib/utils'

export default function NotificationsPage() {
  const router = useRouter()
  const { userData, supabaseUser } = useAuth()
  const { showToast } = useToast()

  const [orderAlerts, setOrderAlerts] = useState(true)
  const [promoAlerts, setPromoAlerts] = useState(false)
  const [emailNotifs, setEmailNotifs] = useState(true)
  const [pushNotifs, setPushNotifs] = useState(true)
  const [loading, setLoading] = useState(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (supabaseUser && !initialized) {
      const prefs = supabaseUser.user_metadata?.notificationPrefs || {}
      setOrderAlerts(prefs.orderAlerts ?? true)
      setPromoAlerts(prefs.promoAlerts ?? false)
      setEmailNotifs(prefs.emailNotifs ?? true)
      setPushNotifs(prefs.pushNotifs ?? true)
      setInitialized(true)
    }
  }, [supabaseUser, initialized])

  async function handleSave() {
    if (!supabaseUser) return
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          notificationPrefs: {
            orderAlerts,
            promoAlerts,
            emailNotifs,
            pushNotifs
          }
        }
      })
      if (error) throw error
      
      showToast('success', 'Notification preferences saved.')
      router.back()
    } catch (error) {
      console.error('Error saving preferences:', error)
      showToast('error', 'Failed to save preferences. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const Toggle = ({ label, desc, icon, checked, onChange }: any) => (
    <div className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-gray-50">
      <div className="flex items-center gap-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", checked ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-400")}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">{label}</p>
          <p className="text-[10px] text-gray-500 mt-0.5 leading-tight max-w-[200px]">{desc}</p>
        </div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", checked ? "bg-primary" : "bg-gray-200")}
      >
        <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform", checked ? "translate-x-6" : "translate-x-1")} />
      </button>
    </div>
  )

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white px-5 pt-14 pb-4 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-40">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center transition-transform active:scale-95">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-extrabold flex-1 text-center text-gray-900">Notifications</h1>
        <div className="w-9" />
      </div>

      <div className="p-5 space-y-6">
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 mb-3">Alert Types</p>
          <div className="space-y-3">
            <Toggle
              label="Order Alerts"
              desc="Get real-time updates when your order status changes."
              icon={<BellRing size={18} />}
              checked={orderAlerts}
              onChange={setOrderAlerts}
            />
            <Toggle
              label="Promotions & Offers"
              desc="Receive special deals, discounts, and event news."
              icon={<MessageSquare size={18} />}
              checked={promoAlerts}
              onChange={setPromoAlerts}
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 mb-3">Delivery Methods</p>
          <div className="space-y-3">
            <Toggle
              label="Email Notifications"
              desc="Receive critical updates directly to your inbox."
              icon={<Mail size={18} />}
              checked={emailNotifs}
              onChange={setEmailNotifs}
            />
            <Toggle
              label="Push Notifications"
              desc="Receive notifications to your connected device."
              icon={<Smartphone size={18} />}
              checked={pushNotifs}
              onChange={setPushNotifs}
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={loading || !initialized}
          className="w-full btn-primary py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {loading ? 'Saving Preferences...' : 'Save Preferences'}
        </button>

      </div>
    </div>
  )
}
