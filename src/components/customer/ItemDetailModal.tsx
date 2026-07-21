'use client'
import { useState, useEffect } from 'react'
import { X, Star, MessageSquare, Clock, ThumbsUp, ShoppingCart } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn, formatPrice } from '@/lib/utils'
import type { MenuItem, OrderFeedback } from '@/types'

interface ItemDetailModalProps {
  item: MenuItem
  onClose: () => void
  onAddToCart: () => void
}

export default function ItemDetailModal({ item, onClose, onAddToCart }: ItemDetailModalProps) {
  const [feedbacks, setFeedbacks] = useState<OrderFeedback[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchFeedbacks() {
      setLoading(true)
      try {
        let { data, error } = await supabase
          .from('order_feedback')
          .select('*')
          .contains('items', [item.name])
          .order('createdAt', { ascending: false })
          .limit(10)

        if (error || !data || data.length === 0) {
          const { data: allData } = await supabase
            .from('order_feedback')
            .select('*')
            .order('createdAt', { ascending: false })
            .limit(20)

          if (allData) {
            data = allData.filter((f: any) =>
              Array.isArray(f.items)
                ? f.items.includes(item.name)
                : typeof f.items === 'string'
                ? f.items.includes(item.name)
                : true
            )
          }
        }

        if (data) {
          setFeedbacks(data as OrderFeedback[])
        }
      } catch (err) {
        console.error("Error fetching feedbacks:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchFeedbacks()
  }, [item.name])

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />
      
      <div className="bg-white w-full max-w-md rounded-t-[40px] sm:rounded-[40px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300 relative z-10 flex flex-col max-h-[90vh]">
        
        {/* Close Button */}
        <button onClick={onClose} className="absolute top-5 right-5 z-20 w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white active:scale-90 transition-transform">
          <X size={20} />
        </button>

        {/* Hero Image */}
        <div className="relative h-64 shrink-0">
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" 
            onError={e => { (e.target as HTMLImageElement).src = '/photos/placeholder.jpg' }} />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
          
          <div className="absolute bottom-6 left-6 right-6">
            <div className="flex items-center gap-2 mb-2">
               <span className="bg-primary text-white text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest shadow-sm">
                {item.category}
              </span>
              <div className="flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1 shadow-sm">
                <Star size={12} className={cn("text-primary", (item.rating || 0) > 0 && "fill-primary")} />
                <span className="text-xs font-bold text-gray-900">
                  {(item.rating || 0) > 0 ? item.rating : 'New'}
                </span>
                {(item.totalRatings || 0) > 0 && (
                  <span className="text-[10px] text-gray-400 font-medium">({item.totalRatings})</span>
                )}
              </div>
            </div>
            <h2 className="text-2xl font-black text-gray-900 leading-tight">{item.name}</h2>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-24 scrollbar-hide">
          <div className="py-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Description</h3>
            <p className="text-gray-600 text-sm leading-relaxed font-medium">
              {item.description || "No description available for this delicious item."}
            </p>
          </div>

          <div className="py-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Customer Reviews</h3>
              <div className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg">
                {feedbacks.length} REVIEWS
              </div>
            </div>

            {loading ? (
              <div className="space-y-4">
                {[1, 2].map(i => <div key={i} className="h-20 bg-gray-50 rounded-2xl animate-pulse" />)}
              </div>
            ) : feedbacks.length === 0 ? (
              <div className="bg-gray-50 rounded-3xl p-8 text-center">
                <MessageSquare size={32} className="text-gray-200 mx-auto mb-2" />
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No reviews yet</p>
                <p className="text-[10px] text-gray-300 mt-1">Be the first to rate this item!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {feedbacks.map(fb => (
                  <div key={fb.id} className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100/50">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {fb.userName?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900">{fb.userName || 'Anonymous'}</p>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map(s => (
                              <Star key={s} size={8} className={cn(s <= fb.rating ? 'text-primary fill-primary' : 'text-gray-200')} />
                            ))}
                          </div>
                        </div>
                      </div>
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                        {new Date(fb.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {fb.comment && <p className="text-xs text-gray-600 font-medium leading-relaxed">{fb.comment}</p>}
                    {fb.tags && fb.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {fb.tags.map(t => (
                          <span key={t} className="text-[9px] font-bold text-primary bg-white px-2 py-0.5 rounded-md border border-primary/10">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Action */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-xl border-t border-gray-100 shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Total Price</p>
              <p className="text-xl font-black text-primary">{formatPrice(item.price)}</p>
            </div>
            <button 
              onClick={() => { onAddToCart(); onClose(); }}
              disabled={!item.available || item.outOfStock}
              className="flex-1 btn-primary py-4 rounded-2xl flex items-center justify-center gap-3 shadow-primary active:scale-95 transition-all disabled:opacity-50"
            >
              <ShoppingCart size={18} />
              <span className="font-bold">Add to Basket</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
