'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import {
  Clock, CheckCircle2, QrCode, ClipboardList,
  TrendingUp, LogOut, Loader2, Calendar, Camera, Check, Square, Banknote
} from 'lucide-react'
import { cn, formatPrice, formatTime } from '@/lib/utils'
import { useToast } from '@/lib/toast'
import type { AttendanceRecord, Order, Employee, EmployeeTask, OrderStatus } from '@/types'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Scanner } from '@yudiel/react-qr-scanner'
import CustomerBottomNav from '@/components/customer/CustomerBottomNav'

export default function EmployeeDashboard() {
  const { userData, supabaseUser, loading: authLoading } = useAuth()
  const router = useRouter()
  const { showToast } = useToast()
  const [orders, setOrders] = useState<Order[]>([])
  const [todayShifts, setTodayShifts] = useState<AttendanceRecord[]>([])
  const [employeeData, setEmpData] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [regNumber, setRegNumber] = useState('')
  const [userCode, setUserCode] = useState('')
  const [isScanned, setIsScanned] = useState(false)
  const [vCode, setVCode] = useState('')
  const [tasks, setTasks] = useState<EmployeeTask[]>([])
  const [canteenQRCode, setCanteenQRCode] = useState(process.env.NEXT_PUBLIC_CANTEEN_QR_CODE || 'CANTEEN-CMS-2024')

  // Use local date (not UTC) to avoid IST midnight crossing bug
  const todayStr = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  // Refresh security code whenever modal is opened
  const openScanner = () => {
    const now = new Date()
    setVCode(`CAN-${now.getHours()}${now.getDate()}`)
    setIsScanned(false)
    setUserCode('')
    setRegNumber('')
    setShowScanner(true)
  }

  useEffect(() => {
    // Role guard — redirect non-employees away
    if (!authLoading && userData && userData.role !== 'employee' && userData.role !== 'admin') {
      router.replace('/menu')
    }
  }, [userData, authLoading, router])

  useEffect(() => {
    let unsubs: any[] = []

    if (!supabaseUser) return

    const fetchData = async () => {
      // 0. Fetch canteen QR code from settings DB
      const { data: qrSetting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'canteen_qr_code')
        .single()
      if (qrSetting?.value) setCanteenQRCode(qrSetting.value)
      // 1. Fetch Employee Details from employees table (wage, shift, etc.)
      const { data: empData } = await supabase
        .from('employees')
        .select('*')
        .eq('email', supabaseUser.email)
        .limit(1)
      let currentEmpData: Employee | null = null
      if (empData && empData.length > 0) {
        setEmpData(empData[0] as Employee)
        currentEmpData = empData[0] as Employee
      }

      // 2. Fetch Today's Attendance (all shifts for today)
      if (currentEmpData) {
        const { data: attData } = await supabase
          .from('attendance')
          .select('*')
          .eq('employeeId', currentEmpData.id)
          .eq('date', todayStr)
          .order('checkIn', { ascending: false })
        setTodayShifts((attData as AttendanceRecord[]) || [])
      } else if (userData?.name) {
        const { data: attData } = await supabase
          .from('attendance')
          .select('*')
          .eq('employeeName', userData.name)
          .eq('date', todayStr)
          .order('checkIn', { ascending: false })
        setTodayShifts((attData as AttendanceRecord[]) || [])
      } else {
        setTodayShifts([])
      }

      // 3. Fetch Active Orders
      const { data: orderData } = await supabase
        .from('orders')
        .select('*, items:order_items(*)')
        .in('status', ['pending', 'preparing', 'ready'])
        .order('createdAt', { ascending: false })
      if (orderData) setOrders(orderData as Order[])

      // 4. Fetch Tasks assigned to this user
      const { data: taskData } = await supabase
        .from('employee_tasks')
        .select('*')
        .eq('employeeId', supabaseUser.id)
        .order('createdAt', { ascending: false })
      if (taskData) setTasks(taskData as EmployeeTask[])

      setLoading(false)
    }

    fetchData()

    // Real-time subscriptions
    const subOrders = supabase.channel('emp_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData())
      .subscribe()
    unsubs.push(subOrders)

    const subTasks = supabase.channel('emp_tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_tasks' }, () => fetchData())
      .subscribe()
    unsubs.push(subTasks)

    const subAttendance = supabase.channel('emp_attendance')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => fetchData())
      .subscribe()
    unsubs.push(subAttendance)

    return () => {
      unsubs.forEach(s => supabase.removeChannel(s))
    }
  }, [supabaseUser, userData, todayStr])

  async function handleCheckIn() {
    if (!supabaseUser || !userData || !regNumber || !userCode) {
      showToast('warning', 'Please enter both Registration Number and Security Code')
      return
    }
    if (userCode.toUpperCase() !== vCode) {
      showToast('error', 'Invalid Security Code. Please look at the canteen screen.')
      return
    }
    setActionLoading(true)
    try {
      // Only use employeeData.id if it exists in the employees table (valid FK).
      // If the user isn't in the employees table yet, set employeeId to null.
      const empId = employeeData?.id ?? null
      const { data, error } = await supabase.from('attendance').insert([{
        employeeId: empId,
        employeeName: userData.name,
        registrationNumber: regNumber,
        date: todayStr,
        checkIn: new Date().toISOString(),
        status: 'present'
      }]).select().single()

      if (error) throw error
      setTodayShifts(prev => [data as AttendanceRecord, ...prev])
      setShowScanner(false)
      setIsScanned(false)
      setUserCode('')
      showToast('success', 'Shift started successfully!')
    } catch (err: any) {
      console.error('Check-in error:', err)
      showToast('error', `Failed to sign in: ${err?.message || 'Unknown error. Try again.'}`)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleCheckOut() {
    const activeShift = todayShifts.find(s => !s.checkOut)
    if (!activeShift) return
    setActionLoading(true)
    try {
      const checkInTime = new Date(activeShift.checkIn)
      const checkOutTime = new Date()
      const diffHrs = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)

      const { data, error } = await supabase.from('attendance').update({
        checkOut: checkOutTime.toISOString(),
        hoursWorked: parseFloat(diffHrs.toFixed(2))
      }).eq('id', activeShift.id).select().single()

      if (error) throw error
      setTodayShifts(prev => prev.map(s => s.id === activeShift.id ? (data as AttendanceRecord) : s))
      setShowScanner(false)
      setIsScanned(false)
      setUserCode('')
      showToast('success', 'Shift ended successfully!')
    } catch (err) {
      console.error(err)
      showToast('error', 'Failed to sign out.')
    } finally {
      setActionLoading(false)
    }
  }

  async function toggleTask(task: EmployeeTask) {
    try {
      await supabase.from('employee_tasks').update({
        status: task.status === 'completed' ? 'pending' : 'completed'
      }).eq('id', task.id)
    } catch (e) { console.error(e) }
  }

  async function collectCash(id: string) {
    const targetOrder = orders.find(o => o.id === id)
    if (!targetOrder) return

    setActionLoading(true)

    // Optimistic Update (Remove from active list instantly)
    setOrders(prev => prev.filter(o => o.id !== id))
    showToast('success', `Cash collected for ${targetOrder.orderNumber}! Order completed.`)

    try {
      const updateData: any = {
        status: 'delivered',
        paymentStatus: 'paid',
        updatedAt: new Date().toISOString()
      }

      let { error } = await supabase.from('orders').update(updateData).eq('id', id)
      if (error) {
        console.warn("Primary collectCash update failed, trying fallback without paymentStatus:", error.message)
        delete updateData.paymentStatus
        const fallback = await supabase.from('orders').update(updateData).eq('id', id)
        if (fallback.error) throw fallback.error
      }
    } catch (err: any) {
      console.error("Collect cash error:", err)
      setOrders(prev => [targetOrder, ...prev])
      showToast('error', 'Failed to collect cash: ' + (err?.message || 'Database update error'))
    } finally {
      setActionLoading(false)
    }
  }

  async function updateStatus(id: string, s: string) {
    const targetOrder = orders.find(o => o.id === id)
    if (!targetOrder) return
    const prevStatus = targetOrder.status

    setActionLoading(true)

    // Optimistic Update (Instant UI reaction)
    setOrders(prev => {
      if (s === 'delivered') {
        return prev.filter(o => o.id !== id)
      }
      return prev.map(o => o.id === id ? { ...o, status: s as OrderStatus } : o)
    })
    showToast('success', `Order ${targetOrder.orderNumber} status changed to ${s}!`)

    try {
      const updateData: any = {
        status: s,
        updatedAt: new Date().toISOString()
      }
      if (s === 'delivered' && targetOrder.paymentMethod === 'cash') {
        updateData.paymentStatus = 'paid'
      }

      let { error } = await supabase.from('orders').update(updateData).eq('id', id)
      if (error && updateData.paymentStatus) {
        console.warn("Update status with paymentStatus failed, trying fallback:", error.message)
        delete updateData.paymentStatus
        const fallback = await supabase.from('orders').update(updateData).eq('id', id)
        if (fallback.error) throw fallback.error
      } else if (error) {
        throw error
      }
    } catch (err: any) {
      console.error("Update status error:", err)
      // Rollback on error
      setOrders(prev => {
        const exists = prev.some(o => o.id === id)
        if (!exists) return [targetOrder, ...prev]
        return prev.map(o => o.id === id ? { ...o, status: prevStatus } : o)
      })
      showToast('error', 'Failed to update order status: ' + (err?.message || 'Database update error'))
    } finally {
      setActionLoading(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="bg-white flex items-center justify-center min-h-screen px-6">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    )
  }

  const activeShift = todayShifts.find(s => !s.checkOut)
  const latestShift = todayShifts[0] || null
  const isCheckedIn = !!activeShift
  const totalHoursWorkedToday = parseFloat(
    todayShifts.reduce((acc, s) => acc + (s.hoursWorked || 0), 0).toFixed(2)
  )

  return (
    <div className="bg-gray-50 pb-20 min-h-screen">
      {/* Header */}
      <div className="bg-white px-5 pt-14 pb-6 flex items-center justify-between border-b border-gray-100 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Link href="/profile" className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm shrink-0 active:scale-95 transition-transform">
            {supabaseUser?.user_metadata?.photoURL || (userData as any)?.avatarUrl ? (
              <img src={supabaseUser?.user_metadata?.photoURL || (userData as any)?.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-primary text-sm font-extrabold">
                {userData?.name?.charAt(0)?.toUpperCase() ?? 'E'}
              </span>
            )}
          </Link>
          <div>
            <h1 className="text-xl font-black text-gray-900 leading-none">Staff Portal</h1>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1.5">
              {userData?.name} · {userData?.role}
            </p>
          </div>
        </div>
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
          className="w-10 h-10 bg-red-50 rounded-2xl flex items-center justify-center text-red-500">
          <LogOut size={18} />
        </button>
      </div>

      <div className="px-5 py-6 space-y-6">
        {/* Attendance Card */}
        <div className="bg-white rounded-[32px] p-6 shadow-card border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center">
                <Calendar size={20} className="text-primary" />
              </div>
              <div>
                <div className="font-black text-gray-900">Today's Shift</div>
                {todayShifts.length > 0 && (
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    {todayShifts.length} shift{todayShifts.length > 1 ? 's' : ''} recorded
                  </p>
                )}
              </div>
            </div>
            <span className={cn('text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest',
              isCheckedIn ? 'bg-green-100 text-green-600' : todayShifts.length > 0 ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600')}>
              {isCheckedIn ? 'On Duty' : todayShifts.length > 0 ? 'Shift Completed' : 'Not Started'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 rounded-3xl p-4 flex flex-col items-center">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Check In</p>
              <p className="text-base font-black text-gray-900">
                {activeShift ? formatTime(new Date(activeShift.checkIn)) : (latestShift ? formatTime(new Date(latestShift.checkIn)) : '--:--')}
              </p>
            </div>
            <div className="bg-gray-50 rounded-3xl p-4 flex flex-col items-center">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Check Out</p>
              <p className="text-base font-black text-gray-900">
                {activeShift ? '--:--' : (latestShift?.checkOut ? formatTime(new Date(latestShift.checkOut)) : '--:--')}
              </p>
            </div>
          </div>

          <button onClick={openScanner} disabled={actionLoading}
            className={cn('w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg',
              isCheckedIn ? 'bg-gray-900 text-white' : 'bg-primary text-white shadow-primary')}>
            {actionLoading ? <Loader2 className="animate-spin" size={20} /> : (
              <>{isCheckedIn ? <CheckCircle2 size={20} /> : <QrCode size={20} />} {isCheckedIn ? 'End Shift' : todayShifts.length > 0 ? 'Start New Shift' : 'Start Shift'}</>
            )}
          </button>
        </div>

        {/* My Earnings Card */}
        <div className="bg-gray-900 rounded-[32px] p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full -mr-16 -mt-16 blur-3xl" />
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center">
              <TrendingUp size={20} className="text-primary" />
            </div>
            <div className="font-black text-white">Daily Earnings</div>
          </div>
          <div className="flex flex-col relative z-10">
            <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-2">Estimated Wage</p>
            <div className="flex items-baseline gap-2">
              <span className="text-white text-3xl font-black">{formatPrice(totalHoursWorkedToday * ((employeeData?.dailyWage ?? 1200) / 8))}</span>
              <span className="text-primary text-[10px] font-black uppercase">Today</span>
            </div>
            <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center text-[10px] uppercase font-black tracking-widest">
              <span className="text-gray-500">Rate: {formatPrice(employeeData?.dailyWage ?? 1200)}/day</span>
              <span className="text-primary animate-pulse">{totalHoursWorkedToday} Hours</span>
            </div>
          </div>
        </div>

        {/* Today's Tasks */}
        <div className="bg-white rounded-[32px] p-6 shadow-card border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center">
              <ClipboardList size={20} className="text-blue-500" />
            </div>
            <h2 className="text-lg font-black text-gray-900 tracking-tight">Today's Tasks</h2>
          </div>
          <div className="space-y-3">
            {tasks.length === 0 ? (
              <p className="text-xs text-gray-400 font-bold text-center py-6">No tasks assigned for today</p>
            ) : (
              tasks.map((task) => (
                <div key={task.id} onClick={() => toggleTask(task)}
                  className="flex items-center gap-4 p-3.5 bg-gray-50 rounded-2xl border border-gray-100 transition-colors cursor-pointer active:scale-[0.98]">
                  <div className={cn('w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all duration-300',
                    task.status === 'completed' ? 'bg-primary border-primary text-white scale-110' : 'border-gray-200')}>
                    {task.status === 'completed' && <Check size={12} />}
                  </div>
                  <div className="flex-1">
                    <p className={cn('text-[13px] font-black transition-all', task.status === 'completed' ? 'text-gray-300 line-through' : 'text-gray-900')}>{task.taskTitle}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                      {task.status === 'completed' ? 'Done' : 'Pending'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active Orders */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-gray-900 tracking-tight">Active Orders</h2>
            <span className="bg-primary/10 text-primary text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest">{orders.length} Orders</span>
          </div>

          {orders.length === 0 ? (
            <div className="bg-white rounded-[40px] p-12 flex flex-col items-center text-center border-2 border-dashed border-gray-100">
              <div className="w-20 h-20 bg-gray-50 rounded-[32px] flex items-center justify-center mb-6">
                <CheckCircle2 size={40} className="text-gray-200" />
              </div>
              <p className="text-gray-500 font-black">All caught up!</p>
              <p className="text-[10px] text-gray-300 uppercase font-black tracking-widest mt-1.5">No orders to prepare</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map(order => {
                const isCashUnpaid = order.paymentMethod === 'cash' && order.status !== 'delivered' && order.paymentStatus !== 'paid'
                const isCashPaid = order.paymentMethod === 'cash' && (order.paymentStatus === 'paid' || order.status === 'delivered')

                return (
                  <div key={order.id} className="bg-white rounded-[28px] p-5 shadow-card border border-gray-100 flex flex-col gap-4 transition-all">
                    {/* Top Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center shrink-0 border border-gray-200/60 font-black text-gray-900 text-sm">
                          {order.orderNumber.replace('#', '').slice(-3)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-black text-gray-900 truncate leading-tight">{order.userName}</h3>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                            {order.items?.length || 0} ITEM{(order.items?.length || 0) > 1 ? 'S' : ''} · {formatTime(new Date(order.createdAt))}
                          </p>
                        </div>
                      </div>

                      {/* Status Badges */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {isCashUnpaid ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black px-2.5 py-1 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-widest">
                            <Banknote size={11} className="text-amber-500 shrink-0" />
                            UNPAID (CASH)
                          </span>
                        ) : isCashPaid ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-widest">
                            <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
                            PAID (CASH)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-widest">
                            <CheckCircle2 size={11} className="text-blue-500 shrink-0" />
                            PAID (CARD)
                          </span>
                        )}

                        <span className={cn('text-[9px] font-black px-2.5 py-1 rounded-xl uppercase tracking-widest',
                          order.status === 'pending' ? 'bg-amber-100/70 text-amber-800' :
                          order.status === 'preparing' ? 'bg-blue-100/70 text-blue-800' :
                          'bg-emerald-100/70 text-emerald-800')}>
                          {order.status}
                        </span>
                      </div>
                    </div>

                    {/* Items & Payment Details Box */}
                    <div className="bg-gray-50/70 p-3.5 rounded-2xl border border-gray-100 space-y-1.5">
                      {order.items?.map((it: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-xs font-bold text-gray-700">
                          <span>{it.quantity}x {it.name}</span>
                          <span className="text-gray-400 font-semibold">{formatPrice(it.price * it.quantity)}</span>
                        </div>
                      ))}

                      {isCashUnpaid && (
                        <div className="mt-2 pt-2 border-t border-amber-200/60 flex items-center justify-between">
                          <span className="text-[11px] font-extrabold text-amber-800 flex items-center gap-1">
                            <Banknote size={13} className="text-amber-600 shrink-0" /> Amount to Collect:
                          </span>
                          <span className="text-xs font-black text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-lg">
                            {formatPrice(order.total)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Step Action Buttons */}
                    <div className="flex items-center gap-2">
                      {order.status === 'pending' && (
                        <button
                          onClick={() => updateStatus(order.id, 'preparing')}
                          className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-wider shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                        >
                          <Clock size={15} /> Start Preparing
                        </button>
                      )}

                      {order.status === 'preparing' && (
                        <button
                          onClick={() => updateStatus(order.id, 'ready')}
                          className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-wider shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 size={15} /> Mark Ready
                        </button>
                      )}

                      {order.status === 'ready' && (
                        isCashUnpaid ? (
                          <button
                            onClick={() => collectCash(order.id)}
                            className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-wider shadow-md shadow-amber-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                          >
                            <Banknote size={16} /> Collect Cash & Complete ({formatPrice(order.total)})
                          </button>
                        ) : (
                          <button
                            onClick={() => updateStatus(order.id, 'delivered')}
                            className="flex-1 py-3.5 bg-gray-900 hover:bg-gray-800 text-white rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                          >
                            <CheckCircle2 size={16} /> Complete Order
                          </button>
                        )
                      )}

                      {/* Quick action: Early cash collection before order reaches ready state */}
                      {order.status !== 'ready' && isCashUnpaid && (
                        <button
                          onClick={() => collectCash(order.id)}
                          title="Collect cash now and mark complete"
                          className="px-3.5 py-3 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 flex items-center gap-1 shrink-0"
                        >
                          <Banknote size={14} /> Collect Cash
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* QR Scanner Modal (Simulated) */}
      {showScanner && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-white w-full max-w-sm rounded-[48px] p-8 shadow-2xl animate-in zoom-in-90 duration-300">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-primary/10 rounded-[32px] flex items-center justify-center mb-8">
                <QrCode size={40} className="text-primary" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">
                {isScanned ? 'Enter Security Code' : 'Scan Canteen QR'}
              </h2>
              <p className="text-gray-400 text-sm font-bold px-4 mb-8 leading-relaxed">
                {isScanned
                  ? "Now enter the **Security Code** displayed on the terminal screen."
                  : "Position the canteen's physical QR code within the frame to reveal the daily security code."
                }
              </p>

              {isScanned && (
                <div className="w-full bg-gray-900 rounded-3xl p-6 mb-8 relative overflow-hidden animate-in zoom-in-95 duration-500">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-primary/20 rounded-full -mr-10 -mt-10 blur-2xl" />
                  <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2 relative z-10 text-left">Terminal Security Code</p>
                  <p className="text-3xl font-black text-white tracking-[0.2em] relative z-10 animate-pulse text-left">{vCode}</p>
                </div>
              )}

              <div className="w-full space-y-4 mb-8">
                {!isScanned ? (
                  <div className="aspect-[4/3] w-full rounded-[40px] border-4 border-dashed border-gray-100 bg-gray-50 flex flex-col items-center justify-center relative overflow-hidden group">
                    <Scanner
                      onScan={(result) => {
                        if (result && result.length > 0) {
                          const scanned = result[0]?.rawValue || ''
                          if (scanned === canteenQRCode) {
                            setIsScanned(true)
                          } else {
                            showToast('error', 'Invalid QR Code! Please scan the Canteen QR on the wall.')
                          }
                        }
                      }}
                      components={{
                        onOff: false,
                        torch: false,
                        zoom: false,
                        finder: true
                      }}
                      styles={{
                        container: { width: '100%', height: '100%' },
                      }}
                    />
                    <div className="absolute inset-4 border-2 border-primary/20 rounded-[32px] animate-pulse pointer-events-none" />
                  </div>
                ) : (
                  <div className="space-y-4 animate-in slide-in-from-top-4 duration-500">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-left">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 mb-1 block">Staff Reg ID</label>
                        <input type="text" placeholder="EMP-XXX" value={regNumber}
                          onChange={(e) => setRegNumber(e.target.value)}
                          className="w-full bg-gray-50 border-2 border-transparent focus:border-primary rounded-2xl px-4 py-4 text-xs font-bold text-gray-900 outline-none transition-all"
                        />
                      </div>
                      <div className="text-left">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 mb-1 block">Enter Code</label>
                        <input type="text" placeholder="CAN-..." value={userCode}
                          onChange={(e) => setUserCode(e.target.value.toUpperCase())}
                          className="w-full bg-gray-50 border-2 border-transparent focus:border-primary rounded-2xl px-4 py-4 text-xs font-bold text-gray-900 outline-none transition-all placeholder:text-gray-300"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-4 w-full">
                <button onClick={() => { setShowScanner(false); setIsScanned(false); setUserCode('') }} className="flex-1 py-5 bg-gray-100 text-gray-500 rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all">Cancel</button>
                <button onClick={isCheckedIn ? handleCheckOut : handleCheckIn} disabled={!regNumber || (!isCheckedIn && !userCode) || actionLoading}
                  className="flex-[2] py-5 bg-primary text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-primary active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {actionLoading ? <Loader2 className="animate-spin" size={18} /> : (isCheckedIn ? 'Confirm Sign Out' : 'Confirm Sign In')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <CustomerBottomNav />
    </div>
  )
}
