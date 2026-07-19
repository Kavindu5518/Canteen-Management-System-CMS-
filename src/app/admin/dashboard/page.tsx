'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { Package, Users, Truck, UtensilsCrossed, TrendingUp, ClipboardList, AlertTriangle, Bell, LogOut, BarChart3, X, CheckCircle2, MessageSquare, Clock, ShieldCheck, Save, Loader2, QrCode, Printer } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import AdminBottomNav from '@/components/admin/AdminBottomNav'
import { cn, formatPrice } from '@/lib/utils'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const DEMO_TREND = [
  { day: 'MON', sales: 18000 }, { day: 'TUE', sales: 22000 }, { day: 'WED', sales: 19000 },
  { day: 'THU', sales: 28000 }, { day: 'FRI', sales: 35000 }, { day: 'SAT', sales: 30000 }, { day: 'SUN', sales: 25000 },
]

const QUICK_ACTIONS = [
  { href: '/admin/inventory', icon: Package, label: 'Inventory', bg: 'bg-primary/10', iconColor: 'text-primary' },
  { href: '/admin/employees', icon: Users, label: 'Employees', bg: 'bg-blue-50', iconColor: 'text-blue-500' },
  { href: '/admin/suppliers', icon: Truck, label: 'Suppliers', bg: 'bg-green-50', iconColor: 'text-green-600' },
  { href: '/admin/reports', icon: BarChart3, label: 'Reports', bg: 'bg-amber-50', iconColor: 'text-amber-600' },
]

export default function AdminDashboard() {
  const { userData } = useAuth()
  const router = useRouter()
  const [todaySales, setTodaySales] = useState(0)
  const [totalOrders, setTotalOrders] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [lowStock, setLowStock] = useState(0)
  const [trend, setTrend] = useState(DEMO_TREND)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('Last 7 Days')
  const [showNotifs, setShowNotifs] = useState(false)
  const [lowStockItems, setLowStockItems] = useState<string[]>([])
  const [reorderReqs, setReorderReqs] = useState<{ id: string, itemName: string, status: string }[]>([])
  const [recentFeedbacks, setFeedbacks] = useState<any[]>([])
  const [todayAttendance, setAttendance] = useState<any[]>([])
  const [showConfig, setShowConfig] = useState(false)
  const [empRegCode, setEmpRegCode] = useState('EMP2024')
  const [canteenQR, setCanteenQR] = useState(process.env.NEXT_PUBLIC_CANTEEN_QR_CODE || 'CANTEEN-CMS-2024')
  const [qrRefreshing, setQrRefreshing] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    setLoading(true)

    // Fetch current canteen QR from DB
    const fetchQR = async () => {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'canteen_qr_code')
        .single()
      if (data?.value) setCanteenQR(data.value)
    }
    fetchQR()

    const fetchDashboardData = async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
      const dayMap: Record<string, number> = { MON: 0, TUE: 0, WED: 0, THU: 0, FRI: 0, SAT: 0, SUN: 0 }

      // 1. Orders
      const { data: orders } = await supabase.from('orders').select('*')
      if (orders) {
        let sales = 0, pending = 0
        orders.forEach((o: any) => {
          const created = new Date(o.createdAt || o.created_at)
          if (created >= today) sales += (o.total ?? 0)
          if (o.status === 'pending') pending++
          
          const dayName = days[created.getDay()]
          if (dayMap[dayName] !== undefined) {
             dayMap[dayName] += (o.total ?? 0)
          }
        })
        setTodaySales(sales)
        setTotalOrders(orders.length)
        setPendingCount(pending)
        setTrend(Object.entries(dayMap).map(([day, sales]) => ({ day, sales })))
      }

      // 2. Inventory
      const { data: inv } = await supabase.from('inventory').select('*')
      if (inv) {
        const lowDocs = inv.filter((d: any) => (d.currentStock ?? 0) <= (d.minStockLevel ?? 0))
        setLowStock(lowDocs.length)
        setLowStockItems(lowDocs.map((d: any) => d.name))
      }

      // 3. Feedback
      const { data: fb } = await supabase.from('order_feedback').select('*').order('createdAt', { ascending: false }).limit(5)
      if (fb) setFeedbacks(fb)

      // 4. Attendance
      const todayStr = new Date().toISOString().split('T')[0]
      const { data: att } = await supabase.from('attendance').select('*').eq('date', todayStr)
      if (att) setAttendance(att)
      
      setReorderReqs([]) // Not implemented in supabase_schema yet
      
      const savedCode = localStorage.getItem('empRegCode')
      if (savedCode) setEmpRegCode(savedCode)
      
      setLoading(false)
    }

    fetchDashboardData()

    const sub = supabase.channel('admin_dashboard')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        fetchDashboardData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(sub)
    }
  }, [])

  return (
    <div className="bg-gray-50 has-bottom-nav min-h-screen">
      {/* Header */}
      <div className="admin-header">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Canteen Admin</h1>
          <p className="text-gray-400 text-xs mt-0.5 font-medium">Welcome, {userData?.name ?? 'Admin'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNotifs(true)}
            className="relative w-10 h-10 bg-gray-100 rounded-2xl flex items-center justify-center transition-all active:scale-95">
            <Bell size={18} className="text-gray-600" />
            {(pendingCount > 0 || lowStock > 0 || reorderReqs.length > 0 || recentFeedbacks.length > 0) && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full animate-pulse" />
            )}
          </button>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
            className="w-10 h-10 bg-red-50 rounded-2xl flex items-center justify-center">
            <LogOut size={16} className="text-red-500" />
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-5 py-4">
        <div className="grid grid-cols-4 gap-2">
          {QUICK_ACTIONS.map(({ href, icon: Icon, label, bg, iconColor }) => (
            <Link key={href} href={href}>
              <div className="flex flex-col items-center gap-2 py-3 bg-white rounded-2xl shadow-card card-press">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', bg)}>
                  <Icon size={18} className={iconColor} />
                </div>
                <span className="text-[10px] font-bold text-gray-500 text-center leading-tight">{label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-5 grid grid-cols-2 gap-3 mb-3">
        <div className="bg-white rounded-3xl p-4 shadow-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-400 text-xs font-bold">Today's Sales</p>
            <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
              <TrendingUp size={14} className="text-primary" />
            </div>
          </div>
          <p className="text-gray-900 text-lg font-extrabold leading-none">{loading ? '—' : formatPrice(todaySales)}</p>
          <span className="text-green-500 text-[10px] font-bold mt-1 block">↑ 12% vs yesterday</span>
        </div>

        <div className="bg-white rounded-3xl p-4 shadow-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-400 text-xs font-bold">Orders</p>
            <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center">
              <ClipboardList size={14} className="text-blue-500" />
            </div>
          </div>
          <p className="text-gray-900 text-lg font-extrabold leading-none">{loading ? '—' : totalOrders}</p>
          <span className="text-blue-500 text-[10px] font-bold mt-1 block">{pendingCount} pending</span>
        </div>

        <div className={cn('rounded-3xl p-4 shadow-card', lowStock > 0 ? 'bg-red-50 border border-red-100' : 'bg-white')}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-400 text-xs font-bold">Stock</p>
            <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertTriangle size={14} className="text-red-500" />
            </div>
          </div>
          <p className="text-red-500 text-lg font-extrabold leading-none">{loading ? '—' : lowStock} items</p>
          <span className="text-red-400 text-[10px] font-semibold underline mt-1 block">View details</span>
        </div>

        <div onClick={() => setShowConfig(true)} className="bg-gray-900 rounded-3xl p-4 shadow-card card-press cursor-pointer">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-400 text-xs font-bold">Access</p>
            <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center">
              <ShieldCheck size={14} className="text-primary" />
            </div>
          </div>
          <p className="text-white text-lg font-extrabold leading-none truncate">{empRegCode}</p>
          <span className="text-gray-500 text-[10px] font-bold mt-1 block">Staff Reg Code</span>
        </div>

        <Link href="/admin/orders">
          <div className="bg-primary rounded-3xl p-4 shadow-primary h-full flex flex-col justify-between card-press cursor-pointer">
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
              <ClipboardList size={14} className="text-white" />
            </div>
            <div className="mt-8">
              <p className="text-white/70 text-xs font-bold">Manage</p>
              <p className="text-white font-extrabold text-sm">Today's Orders</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Canteen QR Code Card */}
      <div className="mx-5 mb-4">
        <div className="bg-gray-900 rounded-[32px] overflow-hidden shadow-2xl relative">
          {/* Decorative blobs */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary/20 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full -ml-16 -mb-16 blur-2xl pointer-events-none" />

          {/* Header */}
          <div className="relative z-10 px-6 pt-6 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <QrCode size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-white font-black text-sm tracking-tight">Attendance QR Code</p>
                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mt-0.5">Staff Shift Access</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Refresh Button */}
              <button
                onClick={async () => {
                  setQrRefreshing(true)
                  try {
                    const newCode = 'CANTEEN-' + Math.random().toString(36).substring(2, 8).toUpperCase()
                    const { error } = await supabase
                      .from('settings')
                      .upsert({ key: 'canteen_qr_code', value: newCode }, { onConflict: 'key' })
                    if (!error) {
                      setCanteenQR(newCode)
                      showToast('success', 'QR Code regenerated. Print the new QR and replace the one on the wall.')
                    } else {
                      showToast('error', 'Failed to regenerate QR: ' + error.message)
                    }
                  } finally {
                    setQrRefreshing(false)
                  }
                }}
                disabled={qrRefreshing}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white text-[10px] font-black uppercase tracking-widest px-3 py-2.5 rounded-xl active:scale-95 transition-all disabled:opacity-40 border border-white/10"
              >
                {qrRefreshing
                  ? <Loader2 size={12} className="animate-spin" />
                  : <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
                }
                Regenerate
              </button>
              {/* Print Button */}
              <button
                onClick={() => {
                  const printWin = window.open('', '_blank')
                  if (printWin) {
                    const svgEl = document.getElementById('canteen-qr-svg')?.querySelector('svg')
                    const svgHTML = svgEl?.outerHTML || ''
                    printWin.document.write(`
                      <html><head><title>Canteen QR</title></head>
                      <body style="margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#fff;font-family:'Segoe UI',sans-serif;gap:20px;">
                        <div style="border:2px solid #eee;border-radius:24px;padding:32px;display:flex;flex-direction:column;align-items:center;gap:16px;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
                          <p style="font-size:11px;color:#aaa;font-weight:800;text-transform:uppercase;letter-spacing:0.15em;margin:0;">Campus Canteen</p>
                          ${svgHTML}
                          <div style="text-align:center;">
                            <p style="font-size:14px;font-weight:800;color:#111;margin:0 0 4px;">Scan to Clock In / Out</p>
                            <p style="font-size:11px;color:#aaa;margin:0;">Use the Staff Portal app to scan</p>
                          </div>
                        </div>
                        <script>window.onload=function(){window.print();window.close();}<\/script>
                      </body></html>
                    `)
                    printWin.document.close()
                  }
                }}
                className="flex items-center gap-2 bg-primary text-white text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl active:scale-95 transition-all shadow-lg shadow-primary/30"
              >
                <Printer size={13} />
                Print
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/5 mx-6" />

          {/* QR Body */}
          <div className="relative z-10 flex flex-col items-center gap-4 px-6 py-6">
            <div id="canteen-qr-svg" className="p-5 bg-white rounded-[28px] shadow-xl">
              <QRCodeSVG
                value={canteenQR}
                size={168}
                bgColor="#ffffff"
                fgColor="#111111"
                level="H"
              />
            </div>
            <div className="flex flex-col items-center gap-1">
              <p className="text-gray-400 text-xs font-bold text-center">
                Employees scan this code to start or end their shift
              </p>
            </div>
            <div className="w-full bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3 flex items-center gap-3">
              <div className="w-7 h-7 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle size={13} className="text-amber-400" />
              </div>
              <p className="text-amber-300 text-[10px] font-bold leading-relaxed">
                After regenerating, print the new QR and replace the one on the wall before the next shift.
              </p>
            </div>
          </div>
        </div>
      </div>


      {/* Chart */}
      <div className="mx-5 bg-white rounded-3xl p-4 mb-4 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-gray-900 font-bold">Sales Trends</p>
            <p className="text-gray-400 text-xs">Weekly performance</p>
          </div>
          <select value={period} onChange={e => setPeriod(e.target.value)}
            className="bg-gray-100 text-gray-500 text-xs font-bold rounded-xl px-3 py-1.5 border-0 outline-none">
            <option>Last 7 Days</option><option>Last 30 Days</option><option>This Month</option>
          </select>
        </div>
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart data={trend} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F4A11B" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#F4A11B" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
            <XAxis dataKey="day" tick={{ fill: '#9B9B9B', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#9B9B9B', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v / 1000}k`} />
            <Tooltip contentStyle={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, fontSize: 12 }}
              formatter={(v: number) => [formatPrice(v), 'Sales']} />
            <Area type="monotone" dataKey="sales" stroke="#F4A11B" strokeWidth={2.5}
              fill="url(#sg)" dot={{ fill: '#F4A11B', strokeWidth: 0, r: 3 }} activeDot={{ r: 5, fill: '#F4A11B' }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <AdminBottomNav />

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-bottom-4 fade-in duration-300`}>
          <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl backdrop-blur-sm ${
            toast.type === 'success'
              ? 'bg-gray-900 border border-green-500/30'
              : 'bg-gray-900 border border-red-500/30'
          }`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              toast.type === 'success' ? 'bg-green-500/20' : 'bg-red-500/20'
            }`}>
              {toast.type === 'success'
                ? <CheckCircle2 size={16} className="text-green-400" />
                : <X size={16} className="text-red-400" />
              }
            </div>
            <p className={`text-sm font-bold max-w-[240px] leading-snug ${
              toast.type === 'success' ? 'text-green-300' : 'text-red-300'
            }`}>
              {toast.message}
            </p>
            <button onClick={() => setToast(null)} className="ml-2 text-gray-500 hover:text-gray-300 transition-colors shrink-0">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Notifications Modal */}
      {showNotifs && (
        <NotificationModal
          onClose={() => setShowNotifs(false)}
          pendingOrders={pendingCount}
          lowStockItems={lowStockItems}
          reorderReqs={reorderReqs}
          feedbacks={recentFeedbacks}
          attendance={todayAttendance}
          router={router}
        />
      )}

      {/* Staff Config Modal */}
      {showConfig && (
        <ConfigModal
          currentCode={empRegCode}
          onClose={() => setShowConfig(false)}
          setEmpRegCode={setEmpRegCode}
        />
      )}
    </div>
  )
}

function NotificationModal({ onClose, pendingOrders, lowStockItems, reorderReqs, feedbacks, attendance, router }: any) {
  const hasNotifications = pendingOrders > 0 || lowStockItems.length > 0 || reorderReqs.filter((r: any) => r.status === 'pending').length > 0 || feedbacks.length > 0

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-end justify-center animate-in fade-in duration-300"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full max-w-mobile rounded-t-[40px] flex flex-col max-h-[85vh] shadow-2xl animate-in slide-in-from-bottom duration-500">

        {/* Header */}
        <div className="px-6 pt-8 pb-4 border-b border-gray-50 flex items-center justify-between">
          <div>
            <h2 className="font-black text-gray-900 text-xl tracking-tight">Important Tasks</h2>
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">Real-time alerts</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center transition-transform active:scale-90">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
          {!hasNotifications ? (
            <div className="py-12 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 size={32} className="text-green-500" />
              </div>
              <p className="font-black text-gray-900">All caught up!</p>
              <p className="text-xs text-gray-400 font-medium mt-1">No urgent actions required right now.</p>
            </div>
          ) : (
            <>
              {/* Pending Orders */}
              {pendingOrders > 0 && (
                <div
                  onClick={() => { onClose(); router.push('/admin/orders') }}
                  className="bg-blue-50/50 border border-blue-100 rounded-3xl p-4 flex items-center gap-4 cursor-pointer active:scale-95 transition-all"
                >
                  <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center shrink-0">
                    <ClipboardList size={22} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-blue-900 leading-tight">New Orders Pending</p>
                    <p className="text-[10px] text-blue-600 font-bold mt-0.5 uppercase tracking-wide">
                      {pendingOrders} {pendingOrders === 1 ? 'order' : 'orders'} waiting for action
                    </p>
                  </div>
                </div>
              )}

              {/* Low Stock Items */}
              {lowStockItems.length > 0 && (
                <div
                  onClick={() => { onClose(); router.push('/admin/inventory') }}
                  className="bg-red-50/50 border border-red-100 rounded-3xl p-4 flex items-start gap-4 cursor-pointer active:scale-95 transition-all"
                >
                  <div className="w-12 h-12 bg-red-500 rounded-2xl flex items-center justify-center shrink-0">
                    <AlertTriangle size={22} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-red-900 leading-tight">Inventory Attention</p>
                    <p className="text-[10px] text-red-600 font-bold mt-0.5 uppercase tracking-wide">
                      {lowStockItems.length} items low on stock:
                    </p>
                    <p className="text-[10px] text-red-400 font-medium mt-0.5 truncate">
                      {lowStockItems.join(', ')}
                    </p>
                  </div>
                </div>
              )}

              {/* Feedbacks */}
              {feedbacks.length > 0 && (
                <div
                  onClick={() => { onClose(); router.push('/admin/reports') }}
                  className="bg-purple-50/50 border border-purple-100 rounded-3xl p-4 flex items-start gap-4 cursor-pointer active:scale-95 transition-all"
                >
                  <div className="w-12 h-12 bg-purple-500 rounded-2xl flex items-center justify-center shrink-0">
                    <MessageSquare size={22} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-purple-900 leading-tight">Customer Feedback</p>
                    <p className="text-[10px] text-purple-600 font-bold mt-0.5 uppercase tracking-wide">
                      {feedbacks.length} new reviews received
                    </p>
                    <p className="text-[10px] text-purple-400 font-medium mt-0.5 truncate italic">
                      "{feedbacks[0].comment || 'No comment'}" - {feedbacks[0].userName}
                    </p>
                  </div>
                </div>
              )}

              {/* Attendance */}
              {attendance.length > 0 && (
                <div
                  onClick={() => { onClose(); router.push('/admin/reports') }}
                  className="bg-emerald-50/50 border border-emerald-100 rounded-3xl p-4 flex items-center gap-4 cursor-pointer active:scale-95 transition-all"
                >
                  <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shrink-0">
                    <Clock size={22} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-emerald-900 leading-tight">Staff Presence</p>
                    <p className="text-[10px] text-emerald-600 font-bold mt-0.5 uppercase tracking-wide">
                      {attendance.length} employees active today
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 pb-10">
          <button
            onClick={onClose}
            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-lg active:scale-95 transition-all"
          >
            Close Panel
          </button>
        </div>
      </div>
    </div>
  )
}

function ConfigModal({ currentCode, onClose, setEmpRegCode }: { currentCode: string; onClose: () => void, setEmpRegCode: any }) {
  const { showToast } = useToast()
  const [newCode, setNewCode] = useState(currentCode)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!newCode) return
    setSaving(true)
    try {
      localStorage.setItem('empRegCode', newCode.toUpperCase())
      setEmpRegCode(newCode.toUpperCase())
      showToast('success', 'Registration code updated successfully!')
      onClose()
    } catch (err) {
      console.error(err)
      showToast('error', 'Failed to update code.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in duration-300">
        <div className="p-8">
          <div className="w-14 h-14 bg-gray-900 rounded-2xl flex items-center justify-center mb-6">
            <ShieldCheck size={28} className="text-primary" />
          </div>
          <h2 className="text-xl font-black text-gray-900 tracking-tight">Staff Registration</h2>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Access Control</p>

          <div className="mt-8">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Current Access Code</label>
            <input
              type="text"
              value={newCode}
              onChange={e => setNewCode(e.target.value.toUpperCase())}
              className="input-field py-4 text-center text-lg font-black tracking-widest"
              placeholder="e.g. EMP2024"
            />
            <p className="text-[10px] text-gray-400 mt-2 font-medium leading-relaxed">
              New employees must enter this exact code during signup to gain access to the system.
            </p>
          </div>

          <div className="mt-8 flex gap-3">
            <button onClick={onClose} className="btn-outline flex-1 py-4 text-[11px] font-black uppercase tracking-widest">Cancel</button>
            <button onClick={handleSave} disabled={saving || !newCode}
              className="btn-primary flex-1 py-4 text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
