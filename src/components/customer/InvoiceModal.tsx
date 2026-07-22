'use client'
import { X, Download, UtensilsCrossed, Loader2 } from 'lucide-react'
import { cn, formatPrice, formatTime } from '@/lib/utils'
import { useToast } from '@/lib/toast'
import { toJpeg } from 'html-to-image'
import { useState } from 'react'
import type { Order } from '@/types'

interface InvoiceModalProps {
  order: Order
  onClose: () => void
}

export default function InvoiceModal({ order, onClose }: InvoiceModalProps) {
  const { showToast } = useToast()
  const [downloading, setDownloading] = useState(false)

  async function handleDownloadJPG() {
    const element = document.getElementById('invoice-content')
    if (!element) return

    try {
      setDownloading(true)
      
      // Temporarily remove max-height and overflow to capture the FULL bill
      const originalMaxHeight = element.style.maxHeight
      const originalOverflow = element.style.overflowY
      element.style.maxHeight = 'none'
      element.style.overflowY = 'visible'

      // Wait a bit for layout to expand
      await new Promise(r => setTimeout(r, 200))
      
      const dataUrl = await toJpeg(element, {
        quality: 0.95,
        backgroundColor: '#ffffff',
        pixelRatio: 3, // High resolution image
      })

      // Restore original styles
      element.style.maxHeight = originalMaxHeight
      element.style.overflowY = originalOverflow

      const link = document.createElement('a')
      link.download = `Invoice_${order.orderNumber.replace('#', '')}.jpg`
      link.href = dataUrl
      link.click()
      showToast('success', 'Receipt downloaded to gallery!')
    } catch (err) {
      console.error('Download error:', err)
      showToast('error', 'Failed to generate image. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div id="invoice-modal-container" className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        
        {/* Actions Header */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold text-gray-900">Order Invoice</span>
            <span className="text-xs font-bold text-gray-400 bg-gray-200/60 px-2 py-0.5 rounded-md">{order.orderNumber}</span>
          </div>
          <button onClick={onClose} className="w-9 h-9 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors">
            <X size={18}/>
          </button>
        </div>

        {/* Invoice Body */}
        <div id="invoice-content" className="p-8 bg-white overflow-y-auto max-h-[70vh] print:max-h-none print:overflow-visible">
          {/* Brand */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-3 print:border print:border-primary/20">
              <UtensilsCrossed size={24} className="text-primary"/>
            </div>
            <h2 className="text-xl font-black text-gray-900 tracking-tighter uppercase">Campus Canteen</h2>
            <p className="text-xs text-gray-400 font-bold tracking-widest uppercase mt-1">Order Invoice</p>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-y-4 mb-8">
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Order Number</p>
              <p className="text-sm font-black text-gray-900">{order.orderNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Date & Time</p>
              <p className="text-sm font-bold text-gray-900">{formatTime(order.createdAt)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Customer</p>
              <p className="text-sm font-bold text-gray-900">{order.userName}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Payment Method</p>
              <p className="text-sm font-bold text-gray-900">
                {order.paymentMethod === 'cash' ? 'Cash on Counter' : order.paymentMethod === 'card' ? 'Card / Online' : 'QR Scan'}
              </p>
              <p className="text-[11px] font-extrabold mt-0.5">
                {order.status === 'cancelled' ? (
                  <span className="text-red-600">Status: Cancelled</span>
                ) : order.paymentMethod === 'cash' && order.status !== 'delivered' && order.paymentStatus !== 'paid' ? (
                  <span className="text-amber-600">Status: UNPAID (CASH)</span>
                ) : (
                  <span className="text-green-600">Status: Paid</span>
                )}
              </p>
            </div>
          </div>

          {/* Table */}
          <div className="border-t border-b border-gray-100 py-6 mb-6">
            <div className="space-y-4">
              {order.items.map(item => (
                <div key={item.menuItemId} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs text-gray-400 font-medium">Qty: {item.quantity} × {formatPrice(item.price)}</p>
                  </div>
                  <p className="text-sm font-black text-gray-900 ml-4">{formatPrice(item.price * item.quantity)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400 font-medium">Subtotal</span>
              <span className="text-gray-900 font-bold">{formatPrice(order.subtotal)}</span>
            </div>
            {order.deliveryFee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400 font-medium">Delivery Fee</span>
                <span className="text-gray-900 font-bold">{formatPrice(order.deliveryFee)}</span>
              </div>
            )}
            {order.tax > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400 font-medium">Tax</span>
                <span className="text-gray-900 font-bold">{formatPrice(order.tax)}</span>
              </div>
            )}
            <div className="flex justify-between pt-4 border-t border-gray-100">
              <span className="text-lg font-black text-gray-900">Total Amount</span>
              <span className="text-xl font-black text-primary">{formatPrice(order.total)}</span>
            </div>
          </div>

          {/* Footer Note */}
          <div className="mt-10 pt-6 border-t border-dashed border-gray-200 text-center">
            <p className="text-[10px] text-gray-400 font-medium italic">
              Thank you for your order! This is a computer generated invoice.
            </p>
            <div className="flex items-center justify-center gap-2 mt-4 opacity-30">
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"/>
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"/>
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"/>
            </div>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center gap-3">
          <button
            onClick={handleDownloadJPG}
            disabled={downloading}
            className="w-full py-3.5 bg-primary text-white font-extrabold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 size={18} className="animate-spin text-white" />
            ) : (
              <Download size={18} />
            )}
            <span>{downloading ? 'Generating Image...' : 'Download Receipt (JPG)'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
