'use client'
import { X, Printer, Download, UtensilsCrossed, Loader2 } from 'lucide-react'
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

  function handlePrint() {
    const originalTitle = document.title
    document.title = `Invoice_${order.orderNumber.replace('#', '')}`
    window.print()
    setTimeout(() => {
      document.title = originalTitle
    }, 1000)
  }

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
        pixelRatio: 3, // Even higher quality
      })

      // Restore original styles
      element.style.maxHeight = originalMaxHeight
      element.style.overflowY = originalOverflow

      const link = document.createElement('a')
      link.download = `Invoice_${order.orderNumber.replace('#', '')}.jpg`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Download error:', err)
      showToast('warning', 'Failed to generate image. Please use the Print button instead.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm print:p-0 print:bg-white">
      {/* CSS to hide everything else during print */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #invoice-modal-container, #invoice-modal-container * {
            visibility: visible;
          }
          #invoice-modal-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div id="invoice-modal-container" className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 print:rounded-none print:shadow-none">
        
        {/* Actions Header */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between no-print">
          <div className="flex gap-2">
            <button onClick={handlePrint} className="w-10 h-10 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center text-gray-600 hover:text-primary transition-colors" title="Print/Save as PDF">
              <Printer size={18}/>
            </button>
            <button 
              onClick={handleDownloadJPG} 
              disabled={downloading}
              className="w-10 h-10 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center text-gray-600 hover:text-primary transition-colors disabled:opacity-50" 
              title="Download JPG Image"
            >
              {downloading ? <Loader2 size={18} className="animate-spin text-primary" /> : <Download size={18}/>}
            </button>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors">
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
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Payment</p>
              <p className="text-sm font-bold text-gray-900 capitalize">{order.paymentMethod.replace('_', ' ')}</p>
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
            <div className="flex justify-between text-sm">
              <span className="text-gray-400 font-medium">Tax (GST 5%)</span>
              <span className="text-gray-900 font-bold">{formatPrice(order.tax)}</span>
            </div>
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
            <div className="flex items-center justify-center gap-2 mt-4 opacity-30 no-print">
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"/>
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"/>
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"/>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
