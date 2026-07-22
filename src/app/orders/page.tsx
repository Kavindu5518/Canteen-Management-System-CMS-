'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { ClipboardList, Clock, CheckCircle2, Truck, XCircle, FileText, Star } from 'lucide-react'
import CustomerBottomNav from '@/components/customer/CustomerBottomNav'
import FeedbackModal from '@/components/customer/FeedbackModal'
import InvoiceModal from '@/components/customer/InvoiceModal'
import { cn, formatPrice, formatTime } from '@/lib/utils'
import { useToast } from '@/lib/toast'
import type { Order, OrderStatus } from '@/types'
import Link from 'next/link'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-100', icon: <Clock size={12} /> },
  preparing: { label: 'Preparing', color: 'text-blue-700', bg: 'bg-blue-100', icon: <Clock size={12} /> },
  ready: { label: 'Ready!', color: 'text-green-700', bg: 'bg-green-100', icon: <CheckCircle2 size={12} /> },
  delivered: { label: 'Delivered', color: 'text-gray-600', bg: 'bg-gray-100', icon: <Truck size={12} /> },
  cancelled: { label: 'Cancelled', color: 'text-red-700', bg: 'bg-red-100', icon: <XCircle size={12} /> },
}

const PROGRESS: Record<string, number> = {
  pending: 20, preparing: 50, ready: 80, delivered: 100, cancelled: 0
}

const DEMO_ORDERS: Order[] = [
  {
    id: 'o1', orderNumber: '#8293', userId: 'demo', userName: 'Kasun',
    items: [{ menuItemId: '1', name: 'Rice & Curry', price: 80, quantity: 2, imageUrl: '/photos/rice-curry.jpg' }],
    status: 'preparing', deliveryType: 'hostel_delivery', deliveryAddress: 'Boys Hostel',
    paymentMethod: 'qr_scan', subtotal: 160, deliveryFee: 30, tax: 8, total: 198,
    createdAt: new Date(Date.now() - 15 * 60000), updatedAt: new Date()
  },
  {
    id: 'o2', orderNumber: '#8201', userId: 'demo', userName: 'Kasun',
    items: [
      { menuItemId: '2', name: 'Parota', price: 100, quantity: 1, imageUrl: '/photos/parota.jpg' },
      { menuItemId: '5', name: 'Tea', price: 20, quantity: 1, imageUrl: '/photos/tea.jpg' }
    ],
    status: 'delivered', deliveryType: 'self_pickup', paymentMethod: 'card',
    subtotal: 120, deliveryFee: 0, tax: 6, total: 126,
    createdAt: new Date(Date.now() - 2 * 60 * 60000), updatedAt: new Date()
  },
]

export default function OrdersPage() {
  const { userData } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const { showToast } = useToast()
  const [tab, setTab] = useState<'active' | 'history'>('active')
  const [loading, setLoading] = useState(true)
  const [feedbackOrder, setFeedback] = useState<Order | null>(null)
  const [invoiceOrder, setInvoice] = useState<Order | null>(null)

  useEffect(() => {
    let subscription: any

    const fetchOrders = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setOrders(DEMO_ORDERS)
        setLoading(false)
        return
      }

      const getInitial = async () => {
        const { data, error } = await supabase
          .from('orders')
          .select('*, items:order_items(*)')
          .eq('userId', user.id)
          .order('createdAt', { ascending: false })

        if (!error && data) {
          setOrders(data as Order[])
        } else {
          setOrders(DEMO_ORDERS)
        }
        setLoading(false)
      }

      await getInitial()

      subscription = supabase
        .channel(`orders_${user.id}_${Date.now()}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload: any) => {
          if (payload?.new) {
            const num = payload.new.orderNumber || 'your order'
            const status = payload.new.status
            const statusMsgs: Record<string, string> = {
              preparing: `👨‍🍳 Order ${num} is being prepared!`,
              ready: `🎉 Order ${num} is Ready for pickup!`,
              delivered: `✅ Order ${num} has been delivered!`,
              cancelled: `❌ Order ${num} was cancelled.`
            }
            if (statusMsgs[status]) {
              showToast(status === 'ready' ? 'success' : 'info', statusMsgs[status])
            }
          }
          getInitial()
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
          getInitial()
        })
        .subscribe()
    }

    fetchOrders()

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription).catch(() => {})
      }
    }
  }, [])

  const activeOrders = orders.filter(o => !['delivered', 'cancelled'].includes(o.status))
  const historyOrders = orders.filter(o => ['delivered', 'cancelled'].includes(o.status))
  const shown = tab === 'active' ? activeOrders : historyOrders

  async function handleCancelOrder(orderId: string, createdAt: any) {
    const orderTime = new Date(createdAt).getTime()
    const now = new Date().getTime()
    const diffMinutes = (now - orderTime) / (1000 * 60)

    if (diffMinutes > 5) {
      showToast('warning', 'Orders can only be cancelled within 5 minutes of placing.')
      return
    }

    try {
      await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'cancelled' } : o))
      showToast('success', 'Order cancelled successfully.')
    } catch (err) {
      console.error(err)
      showToast('error', 'Failed to cancel order.')
    }
  }

  return (
    <div className="bg-gray-50 has-bottom-nav min-h-screen">
      <div className="bg-white px-5 pt-14 pb-4 sticky top-0 z-40 border-b border-gray-100">
        <h1 className="text-xl font-extrabold text-gray-900">My Orders</h1>
        <p className="text-gray-400 text-xs mt-0.5">Hi {userData?.name ?? 'there'}</p>
        <div className="flex bg-gray-100 rounded-2xl p-1 mt-3 gap-1">
          {(['active', 'history'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('flex-1 py-2.5 text-sm font-bold rounded-xl capitalize transition-all',
                tab === t ? 'bg-white text-primary shadow-card' : 'text-gray-400')}>
              {t === 'active' ? `Active (${activeOrders.length})` : `History (${historyOrders.length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map(i => <div key={i} className="bg-white rounded-3xl h-36 animate-pulse" />)}
          </div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center mb-4 text-gray-300">
              <ClipboardList size={36} />
            </div>
            <p className="text-gray-500 font-bold">No {tab} orders</p>
            {tab === 'active' && (
              <Link href="/menu">
                <button className="btn-primary mt-6 px-8 py-3 max-w-xs">Browse Menu</button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {shown.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onViewInvoice={() => setInvoice(order)}
                onRate={() => setFeedback(order)}
                onCancel={() => handleCancelOrder(order.id, order.createdAt)}
              />
            ))}
          </div>
        )}
      </div>

      {feedbackOrder && (
        <FeedbackModal
          order={feedbackOrder}
          onClose={() => setFeedback(null)}
          onSuccess={() => setFeedback(null)}
        />
      )}

      {invoiceOrder && (
        <InvoiceModal
          order={invoiceOrder}
          onClose={() => setInvoice(null)}
        />
      )}

      <CustomerBottomNav />
    </div>
  )
}

function OrderCard({ order, onViewInvoice, onRate, onCancel }: {
  order: Order;
  onViewInvoice: () => void;
  onRate: () => void;
  onCancel: () => void;
}) {
  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending
  const isActive = !['delivered', 'cancelled'].includes(order.status)
  const isPendingFeedback = order.status === 'delivered' && !order.feedbackSubmitted

  return (
    <div className="bg-white rounded-3xl shadow-card p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="font-black text-gray-900 text-lg tracking-tight">{order.orderNumber}</p>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">
            {formatTime(new Date(order.createdAt))} · {order.deliveryType === 'self_pickup' ? 'Takeaway' : 'Hostel'}
          </p>
        </div>
        <span className={cn('text-[10px] font-black px-3 py-1.5 rounded-xl flex items-center gap-1.5 uppercase tracking-widest', cfg.bg, cfg.color)}>
          {cfg.icon} {cfg.label}
        </span>
      </div>

      <div className="space-y-3 mb-4">
        {order.items?.map((item: any) => (
          <div key={item.menuItemId} className="flex items-center gap-3">
            <img src={item.imageUrl} alt={item.name} className="w-11 h-11 rounded-2xl object-cover bg-gray-100 shrink-0 shadow-sm"
              onError={e => { (e.target as HTMLImageElement).src = '/photos/placeholder.jpg' }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 font-bold truncate">{item.name}</p>
              <p className="text-xs text-gray-400 font-semibold">{item.quantity} Unit{item.quantity > 1 ? 's' : ''}</p>
            </div>
            <span className="text-sm text-gray-900 font-black">{formatPrice(item.price * item.quantity)}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-100 mb-4">
        <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Total Amount</span>
        <span className="text-primary font-black text-lg">{formatPrice(order.total)}</span>
      </div>

      {isActive && (
        <div className="mb-4">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
            <div className="h-full bg-primary rounded-full transition-all duration-1000"
              style={{ width: `${PROGRESS[order.status]}%` }} />
          </div>
          <div className="flex justify-between">
            {['Pending', 'Preparing', 'Ready', 'Delivered'].map(s => (
              <span key={s} className={cn('text-[9px] font-black uppercase tracking-tighter',
                order.status === s.toLowerCase() ? 'text-primary' : 'text-gray-300')}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button onClick={onViewInvoice} className="flex items-center justify-center gap-2 py-3 bg-gray-50 text-gray-600 rounded-2xl text-xs font-bold hover:bg-gray-100 transition-colors">
          <FileText size={14} /> View Invoice
        </button>
        {isPendingFeedback ? (
          <button onClick={onRate} className="flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-2xl text-xs font-bold shadow-primary active:scale-95 transition-all">
            <Star size={14} className="fill-white" /> Rate Order
          </button>
        ) : isActive && (new Date().getTime() - new Date(order.createdAt).getTime()) < 5 * 60000 ? (
          <button onClick={onCancel} className="flex items-center justify-center gap-2 py-3 bg-red-50 text-red-600 rounded-2xl text-xs font-bold hover:bg-red-100 transition-colors">
            <XCircle size={14} /> Cancel Order
          </button>
        ) : (
          <button disabled className="flex items-center justify-center gap-2 py-3 bg-gray-100 text-gray-400 rounded-2xl text-xs font-bold cursor-not-allowed">
            {order.status === 'delivered' ? 'Review Submitted' : order.status === 'cancelled' ? 'Order Cancelled' : 'Track Status'}
          </button>
        )}
      </div>
    </div>
  )
}
