'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Search, Loader2, Banknote } from 'lucide-react'
import AdminBottomNav from '@/components/admin/AdminBottomNav'
import { cn, formatPrice, formatTime } from '@/lib/utils'
import { useToast } from '@/lib/toast'
import type { Order, OrderStatus } from '@/types'
import CustomSelect from '@/components/ui/CustomSelect'

const STATUS_TABS: OrderStatus[] = ['pending', 'preparing', 'ready', 'delivered']
const DEMO_ORDERS: Order[] = []

export default function AdminOrdersPage() {
  const { showToast } = useToast()
  const [orders, setOrders] = useState<Order[]>(DEMO_ORDERS)
  const [activeTab, setTab] = useState<OrderStatus>('pending')
  const [search, setSearch] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    let subscription: any

    const fetchOrders = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, items:order_items(*)')
        .order('createdAt', { ascending: false })
      
      if (!error && data) {
        setOrders(data as Order[])
      } else {
        setOrders(DEMO_ORDERS)
      }
    }

    fetchOrders()

    subscription = supabase
      .channel('admin_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders()
      })
      .subscribe()

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription)
      }
    }
  }, [])

  const filtered = orders.filter(o =>
    o.status === activeTab &&
    (search === '' || o.orderNumber.toLowerCase().includes(search.toLowerCase()) || o.userName.toLowerCase().includes(search.toLowerCase()))
  )
  const countFor = (s: OrderStatus) => orders.filter(o => o.status === s).length

  async function updateStatus(order: Order, newStatus: OrderStatus) {
    if (order.status === newStatus) return
    const prevStatus = order.status
    const updatePayload: any = {
      status: newStatus,
      updatedAt: new Date().toISOString()
    }

    if (newStatus === 'delivered' && order.paymentMethod === 'cash') {
      updatePayload.paymentStatus = 'paid'
    }

    setUpdating(order.id)

    // 1. Optimistic Update (Instant 0ms feedback)
    setOrders(prev => prev.map(o => o.id === order.id ? {
      ...o,
      status: newStatus,
      paymentStatus: (newStatus === 'delivered' && o.paymentMethod === 'cash') ? 'paid' : o.paymentStatus
    } : o))
    showToast('success', `Order ${order.orderNumber} status changed to ${newStatus}`)

    try {
      let { error } = await supabase.from('orders').update(updatePayload).eq('id', order.id)
      if (error && updatePayload.paymentStatus) {
        console.warn("Update with paymentStatus failed, trying fallback:", error.message)
        delete updatePayload.paymentStatus
        const fallback = await supabase.from('orders').update(updatePayload).eq('id', order.id)
        if (fallback.error) throw fallback.error
      } else if (error) {
        throw error
      }
    } catch (err) {
      console.error(">>> [AdminOrders] Update error:", err)
      // Rollback on error
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: prevStatus } : o))
      showToast('error', 'Error updating status: ' + (err as Error).message)
    } finally {
      setUpdating(null)
    }
  }

  async function collectCash(order: Order) {
    const prevStatus = order.status
    const prevPaymentStatus = order.paymentStatus
    setUpdating(order.id)

    // Optimistic update
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'delivered', paymentStatus: 'paid' } : o))
    showToast('success', `Cash collected for ${order.orderNumber}! Order completed.`)

    try {
      const updatePayload: any = {
        status: 'delivered',
        paymentStatus: 'paid',
        updatedAt: new Date().toISOString()
      }

      let { error } = await supabase.from('orders').update(updatePayload).eq('id', order.id)
      if (error) {
        console.warn("Collect cash update with paymentStatus failed, trying fallback:", error.message)
        delete updatePayload.paymentStatus
        const fallback = await supabase.from('orders').update(updatePayload).eq('id', order.id)
        if (fallback.error) throw fallback.error
      }
    } catch (err) {
      console.error(">>> [AdminOrders] Collect Cash error:", err)
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: prevStatus, paymentStatus: prevPaymentStatus } : o))
      showToast('error', 'Failed to collect cash: ' + (err as Error).message)
    } finally {
      setUpdating(null)
    }
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    preparing: 'bg-blue-100 text-blue-700',
    ready: 'bg-green-100 text-green-700',
    delivered: 'bg-gray-100 text-gray-600',
    cancelled: 'bg-red-100 text-red-700',
  }

  return (
    <div className="bg-gray-50 has-bottom-nav min-h-screen">
      {/* Header */}
      <div className="admin-header">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Today's Orders</h1>
          <p className="text-gray-400 text-xs mt-0.5">{orders.length} total orders today</p>
        </div>
      </div>

      {/* Inner card */}
      <div className="mx-4 mt-4 bg-white rounded-3xl overflow-hidden shadow-card">
        {/* Status Tabs */}
        <div className="flex border-b border-gray-100 px-1 pt-2">
          {STATUS_TABS.map(s => (
            <button key={s} onClick={() => setTab(s)}
              className={cn('flex-1 py-2.5 text-xs font-bold capitalize border-b-2 transition-all',
                activeTab === s ? 'border-primary text-primary' : 'border-transparent text-gray-400')}>
              {s}
              {countFor(s) > 0 && (
                <span className={cn('ml-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full',
                  activeTab === s ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500')}>
                  {countFor(s)}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-50">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search Order ID or Customer Name"
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 rounded-xl text-xs border border-gray-100 font-medium outline-none focus:border-primary" />
          </div>
        </div>

        {/* Orders */}
        <div className="divide-y divide-gray-50 max-h-[65vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-gray-400 text-sm font-semibold">No {activeTab} orders</p>
            </div>
          ) : filtered.map(order => (
            <OrderRow key={order.id} order={order}
              updating={updating === order.id}
              statusColors={statusColors}
              onUpdate={status => updateStatus(order, status)}
              onCollectCash={() => collectCash(order)} />
          ))}
        </div>
      </div>
      <AdminBottomNav />
    </div>
  )
}

function OrderRow({ order, updating, statusColors, onUpdate, onCollectCash }: {
  order: Order; updating: boolean
  statusColors: Record<string, string>
  onUpdate: (s: OrderStatus) => void
  onCollectCash: () => void
}) {
  const [selectedStatus, setSelected] = useState<OrderStatus>(order.status)

  useEffect(() => {
    setSelected(order.status)
  }, [order.status])

  const delivery = order.deliveryType === 'self_pickup' ? 'Self Pickup' : (order.deliveryAddress ?? 'Hostel Delivery')
  const isUnpaidCash = order.paymentMethod === 'cash' && order.status !== 'delivered' && order.paymentStatus !== 'paid'
  const isPaidCash = order.paymentMethod === 'cash' && (order.paymentStatus === 'paid' || order.status === 'delivered')

  return (
    <div className="p-3 sm:p-4 hover:bg-gray-50/50 transition-colors">
      <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4">
        
        {/* Header: Token, Customer & Badges */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0 border border-primary/20">
              <span className="text-primary text-sm font-black tracking-tight">{order.orderNumber.replace('#', '').slice(-3)}</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-black text-gray-900 truncate">{order.userName}</p>
                <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">
                  {order.orderNumber}
                </span>
              </div>
              <p className="text-xs text-gray-400 font-medium mt-0.5">
                {formatTime(order.createdAt || new Date())} · <span className="font-semibold text-gray-700">{delivery}</span>
              </p>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {isUnpaidCash ? (
              <span className="inline-flex items-center gap-1 text-[9px] font-black px-2.5 py-1 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-widest">
                <Banknote size={11} className="text-amber-500 shrink-0" />
                UNPAID (CASH)
              </span>
            ) : isPaidCash ? (
              <span className="inline-flex items-center gap-1 text-[9px] font-black px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-widest">
                PAID (CASH)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[9px] font-black px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-widest">
                PAID (CARD)
              </span>
            )}

            <span className={cn('text-[9px] font-black px-2.5 py-1 rounded-xl uppercase tracking-widest', statusColors[order.status])}>
              {order.status}
            </span>
          </div>
        </div>

        {/* Order Items Table Box */}
        <div className="bg-gray-50/80 rounded-2xl p-3.5 border border-gray-100/80 space-y-1.5">
          {order.items?.map((item: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between text-xs">
              <span className="font-bold text-gray-800">{item.quantity}× {item.name}</span>
              <span className="font-medium text-gray-400">{formatPrice(item.price * item.quantity)}</span>
            </div>
          ))}
          <div className="pt-2 mt-2 border-t border-gray-200/60 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Amount</span>
            <span className="text-sm font-black text-primary">{formatPrice(order.total)}</span>
          </div>
        </div>

        {/* Collect Cash Action Button (for unpaid cash orders) */}
        {isUnpaidCash && order.status !== 'delivered' && (
          <button
            onClick={onCollectCash}
            disabled={updating}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-amber-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
          >
            {updating ? <Loader2 size={16} className="animate-spin" /> : <Banknote size={16} />}
            <span>COLLECT CASH & COMPLETE ({formatPrice(order.total)})</span>
          </button>
        )}

        {/* Status Control Row */}
        <div className="flex items-center gap-2 pt-1 border-t border-gray-50">
          <span className="text-xs text-gray-400 font-bold uppercase tracking-wider whitespace-nowrap">Status:</span>
          <CustomSelect
            value={selectedStatus}
            onChange={v => setSelected(v as OrderStatus)}
            disabled={order.status === 'delivered'}
            className="flex-1"
            options={[
              { value: 'pending',   label: 'Pending',   color: 'bg-amber-400' },
              { value: 'preparing', label: 'Preparing', color: 'bg-blue-400' },
              { value: 'ready',     label: 'Ready',     color: 'bg-green-400' },
              { value: 'delivered', label: 'Delivered', color: 'bg-gray-400' },
            ]}
          />
          <button onClick={() => onUpdate(selectedStatus)}
            disabled={updating || selectedStatus === order.status || order.status === 'delivered'}
            className={cn('px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0',
              order.status === 'delivered' ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-900 text-white hover:bg-gray-800 shadow-md active:scale-95')}>
            {updating ? <Loader2 size={14} className="animate-spin" /> : 'Update'}
          </button>
        </div>

      </div>
    </div>
  )
}
