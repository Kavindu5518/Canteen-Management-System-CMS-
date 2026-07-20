'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Search, Loader2 } from 'lucide-react'
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
    setUpdating(order.id)

    // 1. Optimistic Update (Instant 0ms feedback)
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: newStatus } : o))
    showToast('success', `Order ${order.orderNumber} status changed to ${newStatus}`)

    try {
      const { error } = await supabase.from('orders').update({
        status: newStatus,
        updatedAt: new Date().toISOString()
      }).eq('id', order.id)
      
      if (error) throw error
    } catch (err) {
      console.error(">>> [AdminOrders] Update error:", err)
      // Rollback on error
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: prevStatus } : o))
      showToast('error', 'Error updating status: ' + (err as Error).message)
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
              onUpdate={status => updateStatus(order, status)} />
          ))}
        </div>
      </div>
      <AdminBottomNav />
    </div>
  )
}

function OrderRow({ order, updating, statusColors, onUpdate }: {
  order: Order; updating: boolean
  statusColors: Record<string, string>
  onUpdate: (s: OrderStatus) => void
}) {
  const [selectedStatus, setSelected] = useState<OrderStatus>(order.status)

  useEffect(() => {
    setSelected(order.status)
  }, [order.status])

  const delivery = order.deliveryType === 'self_pickup' ? 'Takeaway' : (order.deliveryAddress ?? 'Hostel')
  return (
    <div className="px-4 py-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
            <span className="text-primary text-xs font-extrabold">{order.userName.charAt(0)}</span>
          </div>
          <div>
            <p className="text-sm font-extrabold text-gray-900">{order.orderNumber} – {order.userName}</p>
            <p className="text-xs text-gray-400">{formatTime(order.createdAt || new Date())} · {delivery}</p>
          </div>
        </div>
        <span className={cn('text-[10px] font-extrabold px-2.5 py-1 rounded-xl uppercase tracking-wider', statusColors[order.status])}>
          {order.status}
        </span>
      </div>
      <p className="text-xs text-gray-500 ml-11 mb-3">
        {order.items?.map((i: any) => `${i.quantity}×${i.name}`).join(', ')} · <span className="font-bold text-primary">{formatPrice(order.total)}</span>
      </p>
      <div className="flex items-center gap-2 ml-11">
        <span className="text-xs text-gray-400 font-semibold whitespace-nowrap">Set Status:</span>
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
          className={cn('px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0',
            order.status === 'delivered' ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-primary text-white shadow-primary active:scale-95')}>
          {updating ? <Loader2 size={12} className="animate-spin" /> : 'Update'}
        </button>
      </div>
    </div>
  )
}
