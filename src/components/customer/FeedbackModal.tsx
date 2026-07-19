'use client'
import { useState, useRef } from 'react'
import { Star, X, Loader2, MessageSquare, Camera, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useToast } from '@/lib/toast'
import type { Order } from '@/types'

const FEEDBACK_TAGS = ['Taste', 'Freshness', 'Portion', 'Value', 'Speed']

interface FeedbackModalProps {
  order: Order
  onClose: () => void
  onSuccess: () => void
}

export default function FeedbackModal({ order, onClose, onSuccess }: FeedbackModalProps) {
  const { showToast } = useToast()
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [selectedTags, setTags] = useState<string[]>([])
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const toggleTag = (tag: string) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPhoto(file)
      setPreview(URL.createObjectURL(file))
    }
  }

  async function handleSubmit() {
    setLoading(true)
    try {
      let photoUrl = ''
      if (photo) {
        const filePath = `${order.id}_${Date.now()}`
        const { error: uploadError } = await supabase.storage
          .from('feedbacks')
          .upload(filePath, photo)
          
        if (!uploadError) {
          const { data } = supabase.storage.from('feedbacks').getPublicUrl(filePath)
          photoUrl = data.publicUrl
        }
      }

      // 1. Save feedback to 'order_feedback' table
      await supabase.from('order_feedback').insert([{
        orderId: order.id,
        orderNumber: order.orderNumber,
        userId: order.userId,
        userName: order.userName,
        rating,
        comment,
        tags: selectedTags,
        photoUrl: photoUrl,
        items: order.items?.map((i: any) => i.name) || [],
      }])

      // 2. Update individual menu item ratings
      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          // Get current rating data
          const { data: menuData } = await supabase
            .from('menu_items')
            .select('rating, totalRatings')
            .eq('id', item.menuItemId)
            .single()

          if (menuData) {
            const currentTotal = menuData.totalRatings || 0
            const currentAvg = menuData.rating || 0
            const newTotal = currentTotal + 1
            const newAvg = Number(((currentAvg * currentTotal + rating) / newTotal).toFixed(1))

            await supabase.from('menu_items').update({
              rating: newAvg,
              totalRatings: newTotal
            }).eq('id', item.menuItemId)
          }
        }
      }

      // 3. Mark order as feedback submitted
      await supabase.from('orders').update({
        feedbackSubmitted: true,
      }).eq('id', order.id)

      onSuccess()
    } catch (err) {
      console.error("Error submitting feedback:", err)
      showToast('error', 'Failed to submit feedback. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-end justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center">
              <MessageSquare size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">How's the food?</h2>
              <p className="text-gray-400 text-xs font-medium">Rate your order {order.orderNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* Stars */}
        <div className="flex flex-col items-center mb-8">
          <p className="text-sm font-bold text-gray-600 mb-4">Your Rating</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(s => (
              <button key={s} onClick={() => setRating(s)}
                className="transition-transform active:scale-90 pb-1">
                <Star size={36} className={cn('transition-colors',
                  s <= rating ? 'text-primary fill-primary' : 'text-gray-200'
                )} />
              </button>
            ))}
          </div>
          <p className="text-primary font-extrabold text-lg mt-3">
            {rating === 5 ? 'Excellent!' : rating === 4 ? 'Great!' : rating === 3 ? 'Good' : rating === 2 ? 'Okay' : 'Poor'}
          </p>
        </div>

        {/* Tags */}
        <div className="mb-6">
          <p className="text-sm font-bold text-gray-600 mb-3 text-center">What was good?</p>
          <div className="flex flex-wrap justify-center gap-2">
            {FEEDBACK_TAGS.map(tag => (
              <button key={tag} onClick={() => toggleTag(tag)}
                className={cn('px-4 py-2 rounded-full text-xs font-bold border transition-all',
                  selectedTags.includes(tag)
                    ? 'bg-primary border-primary text-white'
                    : 'bg-white border-gray-200 text-gray-500 hover:border-primary/50'
                )}>
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Comment */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-800 mb-2">Leave a comment (Optional)</label>
          <textarea value={comment} onChange={e => setComment(e.target.value)}
            placeholder="Tell us what you liked or how we can improve..."
            rows={3} className="input-field resize-none !rounded-2xl" />
        </div>

        {/* Photo Upload */}
        <div className="mb-8">
          <p className="text-sm font-bold text-gray-800 mb-2">Add a photo (Optional)</p>
          <div className="flex items-center gap-4">
            <button onClick={() => fileInputRef.current?.click()}
              className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-primary hover:text-primary transition-all overflow-hidden relative group">
              {photoPreview ? (
                <>
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera size={20} className="text-white" />
                  </div>
                </>
              ) : (
                <>
                  <Camera size={20} />
                  <span className="text-[10px] font-bold">Add</span>
                </>
              )}
            </button>
            <input type="file" ref={fileInputRef} onChange={handlePhotoChange} accept="image/*" className="hidden" />
            {photoPreview && (
              <div className="flex-1">
                <p className="text-xs font-bold text-gray-900 truncate">{photo?.name}</p>
                <button onClick={() => { setPhoto(null); setPreview(null) }} className="text-primary text-[10px] font-black uppercase mt-1">Remove Photo</button>
              </div>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-outline flex-1 py-4">Skip</button>
          <button onClick={handleSubmit} disabled={loading}
            className="btn-primary flex-1 flex items-center justify-center gap-2 py-4">
            {loading ? <><Loader2 size={18} className="animate-spin" /> Submitting...</> : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  )
}
