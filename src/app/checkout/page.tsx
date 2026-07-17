'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft, ShoppingBag, Home, CreditCard,
  QrCode, Plus, Loader2, CheckCircle2
} from 'lucide-react'
import CustomerBottomNav from '@/components/customer/CustomerBottomNav'
import { cn, formatPrice } from '@/lib/utils'
import type { CartItem, DeliveryType, PaymentMethod } from '@/types'
import { Scanner } from '@yudiel/react-qr-scanner'
// 1. PayHere Hash import එක මෙතනට එනවා
import { generatePayHereHash } from '@/app/actions/payhere'

export default function CheckoutPage() {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [deliveryType, setDelivery] = useState<DeliveryType>('self_pickup')
  const [deliveryAddress, setAddress] = useState('Block B, Room 402, Girls Hostel')
  const [paymentMethod, setPayment] = useState<PaymentMethod>('card')
  const [placing, setPlacing] = useState(false)
  const [success, setSuccess] = useState(false)
  const [orderId, setOrderId] = useState('')
  const [qrScanned, setQrScanned] = useState(false)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('cart')
      if (raw) setCart(JSON.parse(raw))
    } catch { }
  }, [])

  const subtotal = cart.reduce((s, i) => s + i.menuItem.price * i.quantity, 0)
  const deliveryFee = deliveryType === 'hostel_delivery' ? 30 : 0
  const tax = Math.round(subtotal * 0.05)
  const total = subtotal + deliveryFee + tax

  function updateQty(id: string, delta: number) {
    setCart(prev => {
      const updated = prev.map(c =>
        c.menuItem.id === id ? { ...c, quantity: c.quantity + delta } : c
      ).filter(c => c.quantity > 0)
      sessionStorage.setItem('cart', JSON.stringify(updated))
      return updated
    })
  }

  // 2. PayHere Payment පටන් ගන්නා function එක මෙතනට එනවා
  async function startPayHerePayment(orderNum: string, amount: number) {
    const hash = await generatePayHereHash(orderNum, amount);
    const { data: { user } } = await supabase.auth.getUser();

    const payment = {
      sandbox: true, // Testing නිසා true දාන්න. Live යනකොට false කරන්න.
      merchant_id: process.env.NEXT_PUBLIC_PAYHERE_MERCHANT_ID,
      return_url: `${window.location.origin}/orders`,
      cancel_url: `${window.location.origin}/checkout`,
      notify_url: 'https://canteen-management-system-cms-v9yw.vercel.app/api/payhere-notify',
      order_id: orderNum,
      items: 'Canteen Food Order',
      amount: amount,
      currency: 'LKR',
      hash: hash,
      first_name: user?.user_metadata?.full_name?.split(' ')[0] || 'Customer',
      last_name: user?.user_metadata?.full_name?.split(' ')[1] || 'User',
      email: user?.email || '',
      phone: '0771234567',
      address: 'Campus Canteen',
      city: 'Colombo',
      country: 'Sri Lanka',
    };

    if (typeof window !== 'undefined' && (window as any).payhere) {
      (window as any).payhere.startPayment(payment);

      (window as any).payhere.onCompleted = function onCompleted(orderId: string) {
        setOrderId(orderId);
        sessionStorage.removeItem('cart');
        setSuccess(true);
      };
    } else {
      alert("PayHere is not loaded. Please refresh the page.");
    }
  }

  async function placeOrder() {
    if (cart.length === 0) return
    if (paymentMethod === 'qr_scan' && !qrScanned) {
      alert("Please scan the canteen's QR code first to complete payment.")
      return
    }
    setPlacing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const orderNum = `#${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`

      const { data: orderDoc, error: orderError } = await supabase.from('orders').insert([{
        orderNumber: orderNum,
        userId: user?.id || null,
        userName: user?.user_metadata?.full_name ?? 'Guest User',
        status: 'pending',
        deliveryType,
        deliveryAddress: deliveryType === 'hostel_delivery' ? deliveryAddress : null,
        paymentMethod,
        subtotal,
        deliveryFee,
        tax,
        total,
      }]).select().single()

      if (orderError) throw orderError

      const orderItemsData = cart.map(c => ({
        orderId: orderDoc.id,
        menuItemId: c.menuItem.id,
        name: c.menuItem.name,
        price: c.menuItem.price,
        quantity: c.quantity,
        imageUrl: c.menuItem.imageUrl,
      }))

      const { error: itemsError } = await supabase.from('order_items').insert(orderItemsData)
      if (itemsError) throw itemsError

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

      // 3. මෙතනදී Payment Method එක අනුව තීරණය කරනවා
      if (paymentMethod === 'card') {
        // PayHere පටන් ගන්න
        await startPayHerePayment(orderNum, total);
      } else {
        // QR Scan නම් සාමාන්‍ය විදිහටම Success පෙන්නන්න
        setOrderId(orderNum)
        sessionStorage.removeItem('cart')
        setSuccess(true)
      }

    } catch (e: any) {
      console.error("Order Place Error:", e)
      alert("Failed to place order: " + e.message)
    } finally {
      setPlacing(false)
    }
  }

  /* ── Success Screen ── */
  if (success) {
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
        <button
          onClick={() => router.push('/orders')}
          className="btn-primary mt-10 max-w-xs w-full py-3"
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
                  const a = prompt('Enter delivery address:', deliveryAddress)
                  if (a) setAddress(a)
                }}
                className="text-sm text-primary font-bold"
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
            <label className={cn(
              'flex items-center gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition-all',
              paymentMethod === 'qr_scan' ? 'border-primary bg-primary/5' : 'border-gray-200'
            )}>
              <QrCode size={20} className={paymentMethod === 'qr_scan' ? 'text-primary' : 'text-gray-400'} />
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900">Direct QR Scan</p>
                <p className="text-xs text-gray-400">Scan at Canteen Counter</p>
              </div>
              <input
                type="radio"
                name="payment"
                checked={paymentMethod === 'qr_scan'}
                onChange={() => { setPayment('qr_scan'); setQrScanned(false) }}
                className="accent-primary w-4 h-4"
              />
            </label>

            {/* QR Visualization... (ඉතිරි code එක කලින් විදිහටම තියෙනවා) */}
            {paymentMethod === 'qr_scan' && (
              <div className="mt-4 p-6 bg-white border-2 border-primary/20 rounded-3xl flex flex-col items-center animate-in zoom-in duration-300">
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest text-center mb-4">
                  {qrScanned ? "Payment Verified" : `Scan Canteen QR to Pay ${formatPrice(total)}`}
                </p>
                {!qrScanned ? (
                  <div className="relative w-full aspect-square max-w-[200px] bg-gray-50 flex flex-col items-center justify-center overflow-hidden rounded-3xl border-4 border-dashed border-gray-200 group">
                    <Scanner
                      onScan={(result) => {
                        if (result && result.length > 0) {
                          setQrScanned(true)
                        }
                      }}
                      components={{ onOff: false, torch: false, zoom: false, finder: true }}
                      styles={{ container: { width: '100%', height: '100%' } }}
                    />
                    <div className="absolute inset-4 border-2 border-primary/20 rounded-[24px] animate-pulse pointer-events-none" />
                  </div>
                ) : (
                  <div className="w-full max-w-[200px] aspect-square bg-green-50 rounded-3xl flex flex-col items-center justify-center border-2 border-green-200 animate-in zoom-in">
                    <CheckCircle2 size={48} className="text-green-500 mb-2" />
                    <span className="text-xs font-black text-green-600 uppercase tracking-widest px-4 text-center">Payment Captured</span>
                  </div>
                )}
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
              ['Delivery Fee', deliveryFee === 0 ? 'Rs.0' : formatPrice(deliveryFee)],
              ['Tax (GST 5%)', `Rs. ${tax}`],
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
          disabled={placing || cart.length === 0 || (paymentMethod === 'qr_scan' && !qrScanned)}
          className="btn-primary flex items-center justify-center gap-2 transition-all w-full py-4 text-base"
        >
          {placing
            ? <><Loader2 size={18} className="animate-spin" /> Processing...</>
            : paymentMethod === 'card'
              ? `Pay with PayHere • ${formatPrice(total)}`
              : `Place Order • ${formatPrice(total)} →`
          }
        </button>
      </div>

      <CustomerBottomNav />
    </div>
  )
}
