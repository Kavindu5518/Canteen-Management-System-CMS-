'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft, ShoppingBag, Home, CreditCard,
  Plus, Loader2, CheckCircle2, Banknote, AlertCircle
} from 'lucide-react'
import CustomerBottomNav from '@/components/customer/CustomerBottomNav'
import { cn, formatPrice } from '@/lib/utils'
import { useToast } from '@/lib/toast'
import type { CartItem, DeliveryType, PaymentMethod } from '@/types'
// 1. PayHere Hash import එක මෙතනට එනවා
import { generatePayHereHash } from '@/app/actions/payhere'

export default function CheckoutPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [cart, setCart] = useState<CartItem[]>([])
  const [deliveryType, setDelivery] = useState<DeliveryType>('self_pickup')
  const [deliveryAddress, setAddress] = useState('Block B, Room 402, Girls Hostel')
  const [paymentMethod, setPayment] = useState<PaymentMethod>('card')
  const [placing, setPlacing] = useState(false)
  const [success, setSuccess] = useState(false)
  const [orderId, setOrderId] = useState('')
  const [orderTotal, setOrderTotal] = useState(0)
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [tempAddress, setTempAddress] = useState(deliveryAddress)
  const [inventory, setInventory] = useState<any[]>([])

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('cart')
      if (raw) setCart(JSON.parse(raw))
    } catch { }

    const fetchInventory = async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
      if (data && !error) {
        setInventory(data)
      }
    }
    fetchInventory()
  }, [])

  const subtotal = cart.reduce((s, i) => s + i.menuItem.price * i.quantity, 0)
  const deliveryFee = 0
  const tax = 0
  const total = subtotal + deliveryFee + tax

  function updateQty(id: string, delta: number) {
    setCart(prev => {
      const item = prev.find(c => c.menuItem.id === id)
      if (item && delta === 1 && item.menuItem.category === 'beverages') {
        const invItem = inventory.find(i => i.name.toLowerCase() === item.menuItem.name.toLowerCase())
        if (invItem && item.quantity + 1 > (invItem.currentStock ?? 0)) {
          showToast('error', `Only ${invItem.currentStock} items left in stock!`)
          return prev
        }
      }

      const updated = prev.map(c =>
        c.menuItem.id === id ? { ...c, quantity: c.quantity + delta } : c
      ).filter(c => c.quantity > 0)
      sessionStorage.setItem('cart', JSON.stringify(updated))
      return updated
    })
  }

  // 2. PayHere Payment පටන් ගන්නා function එක මෙතනට එනවා
  async function startPayHerePayment(orderNum: string, amount: number) {
    try {
      const config = await generatePayHereHash(orderNum, amount);
      const { data: { user } } = await supabase.auth.getUser();

      const payment = {
        sandbox: config.sandbox,
        merchant_id: config.merchantId,
        return_url: `${window.location.origin}/orders`,
        cancel_url: `${window.location.origin}/checkout`,
        notify_url: `${window.location.origin}/api/payhere-notify`,
        order_id: orderNum,
        items: 'Canteen Food Order',
        amount: amount,
        currency: config.currency,
        hash: config.hash,
        first_name: user?.user_metadata?.full_name?.split(' ')[0] || 'Customer',
        last_name: user?.user_metadata?.full_name?.split(' ')[1] || 'User',
        email: user?.email || '',
        phone: '0771234567',
        address: 'Campus Canteen',
        city: 'Colombo',
        country: 'Sri Lanka',
      };

      if (!payment.merchant_id || !payment.hash) {
        throw new Error('PayHere credentials or hash are invalid. Please check configuration.');
      }

      if (typeof window !== 'undefined' && (window as any).payhere) {
        (window as any).payhere.onCompleted = function onCompleted(orderId: string) {
          setOrderId(orderId);
          sessionStorage.removeItem('cart');
          setSuccess(true);
        };

        (window as any).payhere.onDismissed = function onDismissed() {
          console.log("PayHere payment modal closed by user.");
          showToast('info', 'Payment process was cancelled.');
          setPlacing(false);
        };

        (window as any).payhere.onError = function onError(error: any) {
          console.error("PayHere Error:", error);
          showToast('error', 'Payment Error: ' + (error || 'Transaction failed'));
          setPlacing(false);
        };

        (window as any).payhere.startPayment(payment);
      } else {
        showToast('error', 'PayHere script is not loaded. Please refresh the page.');
        setPlacing(false);
      }
    } catch (err: any) {
      console.error("PayHere Init Error:", err);
      showToast('error', err?.message || 'Failed to initialize PayHere payment.');
      setPlacing(false);
    }
  }

  async function placeOrder() {
    if (cart.length === 0) return
    setPlacing(true)
    try {
      // Live stock check for Beverages
      for (const item of cart) {
        if (item.menuItem.category === 'beverages') {
          const { data: invData } = await supabase
            .from('inventory')
            .select('currentStock')
            .eq('name', item.menuItem.name)
            .maybeSingle()
          
          const currentStock = invData?.currentStock ?? 0
          if (item.quantity > currentStock) {
            throw new Error(`Sorry, there is not enough stock for ${item.menuItem.name}. Only ${currentStock} left.`);
          }
        }
      }

      const { data: { user } } = await supabase.auth.getUser()
      const orderNum = `ORD-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`

      const payload: any = {
        orderNumber: orderNum,
        userId: user?.id || null,
        userName: user?.user_metadata?.full_name ?? 'Guest User',
        status: 'pending',
        deliveryType,
        deliveryAddress: deliveryType === 'hostel_delivery' ? deliveryAddress : null,
        paymentMethod,
        paymentStatus: paymentMethod === 'cash' ? 'unpaid' : 'paid',
        subtotal,
        deliveryFee,
        tax,
        total,
      }

      let orderDoc: any = null
      let { data, error: orderError } = await supabase.from('orders').insert([payload]).select().single()

      if (orderError) {
        // Fallback: If paymentStatus column is missing in Supabase orders schema, insert without it
        console.warn("Primary insert failed, attempting fallback insert without paymentStatus:", orderError.message)
        delete payload.paymentStatus
        const fallback = await supabase.from('orders').insert([payload]).select().single()
        if (fallback.error) throw fallback.error
        orderDoc = fallback.data
      } else {
        orderDoc = data
      }

      if (cart.length > 0 && orderDoc?.id) {
        const orderItemsData = cart.map(c => ({
          orderId: orderDoc.id,
          menuItemId: c.menuItem.id,
          name: c.menuItem.name,
          price: c.menuItem.price,
          quantity: c.quantity,
          imageUrl: c.menuItem.imageUrl || '',
        }))

        const { error: itemsError } = await supabase.from('order_items').insert(orderItemsData)
        if (itemsError) {
          console.warn("Order items insert warning:", itemsError)
        }
      }

      // Inventory Sync
      try {
        for (const item of cart) {
          const { data: invData } = await supabase
            .from('inventory')
            .select('id, currentStock')
            .eq('name', item.menuItem.name)
            .limit(1)

          if (invData && invData.length > 0) {
            const invDoc = invData[0]
            const currentStock = invDoc.currentStock ?? 0
            await supabase
              .from('inventory')
              .update({ currentStock: Math.max(0, currentStock - item.quantity) })
              .eq('id', invDoc.id)
          }
        }
      } catch (invErr) {
        console.warn("Inventory Sync failed:", invErr)
      }

      // 3. Payment Method এর উপর ভিত্তি করে তীরণয় করন
      if (paymentMethod === 'card') {
        // PayHere start
        await startPayHerePayment(orderNum, total);
      } else {
        // Cash on Pickup — instantly confirm, paymentStatus = 'unpaid'
        setOrderId(orderNum)
        setOrderTotal(total)
        sessionStorage.removeItem('cart')
        setSuccess(true)
      }

    } catch (e: any) {
      console.error("Order Place Error:", e)
      showToast('error', 'Failed to place order: ' + (e?.message || e?.error_description || 'Unknown database error'))
    } finally {
      setPlacing(false)
    }
  }

  /* ── Success Screen ── */
  if (success) {
    const isCash = paymentMethod === 'cash'
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-8 text-center bg-white">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 size={48} className="text-green-500" />
        </div>
        <h2 className="text-2xl font-extrabold text-gray-900">Order Placed!</h2>
        <p className="text-gray-600 mt-2 font-medium">
          Your order <span className="text-primary font-bold">{orderId}</span> has been received
        </p>
        <p className="text-gray-400 text-sm mt-1">We'll notify you when it's ready</p>

        {isCash && (
          <div className="mt-6 w-full max-w-xs bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left">
            <p className="text-xs font-black text-amber-800 uppercase tracking-wider mb-1">Cash Payment Note</p>
            <p className="text-xs font-bold text-amber-900 leading-relaxed">
              {deliveryType === 'hostel_delivery'
                ? `Please pay Rs. ${orderTotal.toFixed(2)} in cash to the delivery staff at your door.`
                : `Please bring Rs. ${orderTotal.toFixed(2)} in cash when collecting your order at the counter.`
              }
            </p>
          </div>
        )}

        <button
          onClick={() => router.push('/orders')}
          className="btn-primary mt-8 max-w-xs w-full py-3"
        >
          Track My Order
        </button>
        <button
          onClick={() => router.push('/menu')}
          className="btn-outline mt-3 max-w-xs w-full py-3"
        >
          Back to Menu
        </button>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 has-bottom-nav min-h-screen">
      {/* Header */}
      <div className="bg-white px-5 pt-14 pb-4 sticky top-0 z-40 flex items-center gap-3 border-b border-gray-100">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-extrabold flex-1">Review Order</h1>
        <span className="bg-primary/10 text-primary text-xs font-bold px-3 py-1.5 rounded-xl">
          {cart.reduce((s, i) => s + i.quantity, 0)} Items
        </span>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Basket */}
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-3">Your Basket</h2>
          <div className="space-y-3">
            {cart.map(({ menuItem, quantity }) => (
              <div key={menuItem.id} className="flex items-center gap-3">
                <img
                  src={menuItem.imageUrl}
                  alt={menuItem.name}
                  className="w-14 h-14 rounded-2xl object-cover bg-gray-100 shrink-0"
                  onError={e => { (e.target as HTMLImageElement).src = '/photos/placeholder.jpg' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm truncate">{menuItem.name}</p>
                  <p className="text-primary font-bold text-sm">{formatPrice(menuItem.price)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQty(menuItem.id, -1)}
                    className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center text-gray-900 font-bold"
                  >−</button>
                  <span className="w-4 text-center font-extrabold text-sm">{quantity}</span>
                  <button
                    onClick={() => updateQty(menuItem.id, 1)}
                    className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center text-white font-bold"
                  >+</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Delivery Option */}
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-3">Delivery Option</h2>
          <div className="grid grid-cols-2 gap-3">
            {(['self_pickup', 'hostel_delivery'] as DeliveryType[]).map(type => (
              <button
                key={type}
                onClick={() => setDelivery(type)}
                className={cn(
                  'flex flex-col items-center gap-2 py-4 px-3 rounded-2xl border-2 transition-all',
                  deliveryType === type
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 bg-gray-50'
                )}
              >
                {type === 'self_pickup'
                  ? <ShoppingBag size={22} className={deliveryType === type ? 'text-primary' : 'text-gray-400'} />
                  : <Home size={22} className={deliveryType === type ? 'text-primary' : 'text-gray-400'} />
                }
                <span className={cn(
                  'text-xs font-bold text-center leading-tight',
                  deliveryType === type ? 'text-primary' : 'text-gray-500'
                )}>
                  {type === 'self_pickup' ? 'Self Pickup' : 'Hostel Delivery'}
                </span>
                {deliveryType === type && (
                  <div className="w-3 h-3 bg-primary rounded-full mt-1" />
                )}
              </button>
            ))}
          </div>

          {deliveryType === 'hostel_delivery' && (
            <div className="mt-3 bg-gray-50 rounded-2xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 font-semibold tracking-wider">DELIVERY ADDRESS</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{deliveryAddress}</p>
              </div>
              <button
                onClick={() => {
                  setTempAddress(deliveryAddress)
                  setShowAddressModal(true)
                }}
                className="text-sm text-primary font-bold active:scale-95 transition-transform"
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {/* Payment Method */}
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-3">Payment Method</h2>
          <div className="space-y-2">
            {/* Card */}
            <label className={cn(
              'flex items-center gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition-all',
              paymentMethod === 'card' ? 'border-primary bg-primary/5' : 'border-gray-200'
            )}>
              <CreditCard size={20} className={paymentMethod === 'card' ? 'text-primary' : 'text-gray-400'} />
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900">Card / LankaPay / JustPay</p>
                <p className="text-xs text-gray-400">Visa, Master, FriMi, Genie</p>
              </div>
              <input
                type="radio"
                name="payment"
                checked={paymentMethod === 'card'}
                onChange={() => setPayment('card')}
                className="accent-primary w-4 h-4"
              />
            </label>

            {/* QR */}
            {/* Cash on Pickup */}
            <label className={cn(
              'flex items-center gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition-all',
              paymentMethod === 'cash' ? 'border-amber-400 bg-amber-50' : 'border-gray-200'
            )}>
              <Banknote size={20} className={paymentMethod === 'cash' ? 'text-amber-500' : 'text-gray-400'} />
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900">Cash on Pickup / Pay at Counter</p>
                <p className="text-xs text-gray-400">Pay at Counter / On Delivery</p>
              </div>
              <input
                type="radio"
                name="payment"
                checked={paymentMethod === 'cash'}
                onChange={() => setPayment('cash')}
                className="accent-amber-500 w-4 h-4"
              />
            </label>

            {/* Cash info notice */}
            {paymentMethod === 'cash' && (
              <div className="mt-1 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 animate-in fade-in duration-300">
                <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 font-semibold leading-relaxed">
                  Your order will be confirmed instantly. Please have the exact cash amount ready when picking up at counter or delivery.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-3">Summary</h2>
          <div className="space-y-2.5">
            {[
              ['Subtotal', formatPrice(subtotal)],
              ['Delivery Fee', deliveryFee === 0 ? 'Free' : formatPrice(deliveryFee)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="text-gray-500 text-sm font-medium">{label}</span>
                <span className="text-gray-900 text-sm font-bold">{value}</span>
              </div>
            ))}
            <div className="border-t border-gray-100 pt-2.5 flex justify-between mt-2">
              <span className="font-bold text-gray-900">Total</span>
              <span className="text-primary font-extrabold text-lg">{formatPrice(total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Place Order Button */}
      <div className="px-5 pb-24 pt-4">
        <button
          onClick={placeOrder}
          disabled={placing || cart.length === 0}
          className={cn(
            'flex items-center justify-center gap-2 transition-all w-full py-4 text-base font-extrabold rounded-2xl',
            paymentMethod === 'cash'
              ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-200'
              : 'btn-primary'
          )}
        >
          {placing
            ? <><Loader2 size={18} className="animate-spin" /> Processing...</>
            : paymentMethod === 'card'
              ? `Pay with PayHere • ${formatPrice(total)}`
              : paymentMethod === 'cash'
                ? `Place Order • Pay Rs. ${total.toFixed(2)} at Counter`
                : `Place Order • ${formatPrice(total)} →`
          }
        </button>
      </div>

      <CustomerBottomNav />

      {/* Custom Address Editing Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-8">
              <h3 className="text-lg font-black text-gray-900 leading-tight">Delivery Address</h3>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Specify Hostel Location</p>
              
              <div className="mt-6">
                <textarea
                  value={tempAddress}
                  onChange={(e) => setTempAddress(e.target.value)}
                  placeholder="e.g. Block B, Room 402, Girls Hostel"
                  className="w-full h-24 p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-semibold text-gray-800 focus:outline-none focus:border-primary/40 resize-none transition-all"
                />
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowAddressModal(false)}
                  className="flex-1 py-4 border border-gray-100 hover:bg-gray-50 rounded-2xl font-black uppercase text-[11px] tracking-widest text-gray-400 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (tempAddress.trim()) {
                      setAddress(tempAddress.trim())
                      setShowAddressModal(false)
                    }
                  }}
                  className="flex-1 py-4 bg-gray-900 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-gray-800 transition-all active:scale-95 shadow-lg shadow-gray-950/10"
                >
                  Save Address
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
