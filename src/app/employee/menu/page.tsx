'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Search, Plus, ArrowLeft, Edit2, Trash2,
  Camera, ChevronDown, Loader2, X, Wifi, WifiOff, UtensilsCrossed
} from 'lucide-react'
import CustomerBottomNav from '@/components/customer/CustomerBottomNav'
import { cn, formatPrice } from '@/lib/utils'
import { useToast } from '@/lib/toast'
import { useConfirm } from '@/lib/confirm'
import type { MenuItem, FoodCategory } from '@/types'

const CATEGORIES: FoodCategory[] = ['breakfast', 'lunch', 'dinner', 'snacks', 'beverages']
type ModalMode = 'add' | 'edit' | null

export default function EmployeeMenuPage() {
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const [items, setItems] = useState<MenuItem[]>([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalMode>(null)
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [isLive, setIsLive] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  /* ── Real-time Supabase listener ── */
  useEffect(() => {
    const fetchMenu = async () => {
      const { data, error } = await supabase.from('menu_items').select('*').order('createdAt', { ascending: false })
      if (data && !error) {
        const sanitized = data.map((item: any) => {
          if ((item.rating === 4.8 && item.totalRatings === 10) || (item.rating === 4.3 && item.totalRatings === 3)) {
            supabase.from('menu_items').update({ rating: 0, totalRatings: 0 }).eq('id', item.id).then()
            return { ...item, rating: 0, totalRatings: 0 }
          }
          return item
        })
        setItems(sanitized as MenuItem[])
        setIsLive(true)
      } else {
        setItems([])
        setIsLive(false)
      }
    }

    fetchMenu()

    const sub = supabase.channel('employee_menu')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => {
        fetchMenu()
      })
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [])

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.category?.toLowerCase().includes(search.toLowerCase())
  )

  const totalItems = items.length
  const availableCount = items.filter(i => i.available && !i.outOfStock).length
  const unavailableCount = totalItems - availableCount

  /* ── Toggle availability — writes to Supabase in real-time ── */
  async function toggleAvailability(item: MenuItem) {
    const newAvailable = !item.available || item.outOfStock ? true : false
    const newOutOfStock = newAvailable ? false : true

    setToggling(item.id)
    setItems(prev => prev.map(i =>
      i.id === item.id
        ? { ...i, available: newAvailable, outOfStock: newOutOfStock }
        : i
    ))

    try {
      await supabase.from('menu_items').update({
        available: newAvailable,
        outOfStock: newOutOfStock,
        updatedAt: new Date().toISOString(),
      }).eq('id', item.id)
      showToast('success', `${item.name} is now ${newAvailable ? 'Available' : 'Unavailable'}`)
    } catch (err) {
      console.error("Error toggling availability:", err)
      setItems(prev => prev.map(i =>
        i.id === item.id ? { ...i, available: item.available, outOfStock: item.outOfStock } : i
      ))
      showToast('error', 'Failed to update item availability')
    }
    setToggling(null)
  }

  async function deleteItem(id: string) {
    const isConfirmed = await confirm({
      title: 'Delete Menu Item',
      message: 'Are you sure you want to delete this menu item from the canteen menu?'
    })
    if (!isConfirmed) return

    setItems(prev => prev.filter(i => i.id !== id))
    try {
      await supabase.from('menu_items').delete().eq('id', id)
      showToast('success', 'Menu item deleted successfully.')
    } catch (err) {
      console.error("Error deleting item:", err)
      showToast('error', 'Failed to delete menu item.')
    }
  }

  async function saveItem(data: Partial<MenuItem>, imageFile?: File, preview?: string) {
    setLoading(true)
    let imageUrl = data.imageUrl ?? ''

    try {
      if (imageFile) {
        try {
          const filePath = `${Date.now()}_${imageFile.name}`
          let uploadError: any = null
          let result = await supabase.storage.from('menu-items').upload(filePath, imageFile)
          uploadError = result.error

          if (uploadError) {
            result = await supabase.storage.from('menu_items').upload(filePath, imageFile)
            uploadError = result.error
          }

          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage.from('menu-items').getPublicUrl(filePath)
            imageUrl = publicUrlData.publicUrl
          } else {
            imageUrl = preview || '/photos/placeholder.jpg'
          }
        } catch (uploadErr) {
          imageUrl = preview || '/photos/placeholder.jpg'
        }
      }

      if (modal === 'add') {
        const { error } = await supabase.from('menu_items').insert([{
          ...data,
          imageUrl: imageUrl || '/photos/placeholder.jpg',
          rating: 0,
          totalRatings: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }])
        if (error) throw error
        showToast('success', 'New menu item added!')
      } else if (editing) {
        const { error } = await supabase.from('menu_items').update({
          ...data,
          imageUrl: imageUrl || editing.imageUrl,
          updatedAt: new Date().toISOString()
        }).eq('id', editing.id)
        if (error) throw error
        showToast('success', 'Menu item updated!')
      }
      setModal(null)
      setEditing(null)
    } catch (err: any) {
      console.error("Error saving menu item:", err)
      showToast('error', 'Failed to save item: ' + (err?.message || 'Database error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gray-50 min-h-screen pb-24">
      {/* Top Header */}
      <div className="bg-white px-5 pt-14 pb-4 sticky top-0 z-40 shadow-sm border-b border-gray-100 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900 leading-none">Menu Editor</h1>
          <p className="text-gray-400 text-xs font-bold mt-1 flex items-center gap-1.5">
            {isLive ? (
              <span className="text-green-500 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" /> Live sync on
              </span>
            ) : (
              <span className="text-gray-400 font-bold flex items-center gap-1">
                <WifiOff size={11} /> Offline
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setModal('add') }}
          className="w-11 h-11 bg-primary rounded-2xl flex items-center justify-center text-white shadow-primary active:scale-95 transition-transform"
        >
          <Plus size={22} strokeWidth={2.5} />
        </button>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search food items..."
            className="w-full bg-white border border-gray-100 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
              <X size={16} />
            </button>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-3 text-center shadow-card border border-gray-100">
            <p className="text-xl font-black text-gray-900">{totalItems}</p>
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mt-0.5">Total Items</p>
          </div>
          <div className="bg-white rounded-2xl p-3 text-center shadow-card border border-gray-100">
            <p className="text-xl font-black text-green-600">{availableCount}</p>
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mt-0.5">Available</p>
          </div>
          <div className="bg-white rounded-2xl p-3 text-center shadow-card border border-gray-100">
            <p className="text-xl font-black text-red-500">{unavailableCount}</p>
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mt-0.5">Unavailable</p>
          </div>
        </div>

        {/* Items List */}
        <div>
          <p className="text-gray-900 font-extrabold text-sm mb-3">
            Active Items <span className="text-gray-400">({filtered.length})</span>
          </p>

          {filtered.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center border border-dashed border-gray-200">
              <UtensilsCrossed size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-bold text-sm">No food items found</p>
              <p className="text-gray-400 text-xs mt-1">Tap + above to add a new food item</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map(item => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  toggling={toggling === item.id}
                  onEdit={() => { setEditing(item); setModal('edit') }}
                  onDelete={() => deleteItem(item.id)}
                  onToggle={() => toggleAvailability(item)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {modal && (
        <MenuItemModal
          mode={modal}
          item={editing}
          onSave={saveItem}
          onClose={() => { setModal(null); setEditing(null) }}
          loading={loading}
        />
      )}

      <CustomerBottomNav />
    </div>
  )
}

/* ── Menu Item Card Component ── */
function MenuItemCard({ item, toggling, onEdit, onDelete, onToggle }: {
  item: MenuItem; toggling: boolean
  onEdit: () => void; onDelete: () => void; onToggle: () => void
}) {
  const isActive = item.available && !item.outOfStock
  return (
    <div className="bg-white rounded-3xl shadow-card overflow-hidden border border-gray-100">
      <div className="relative w-full h-44 bg-gray-200">
        <img
          src={item.imageUrl}
          alt={item.name}
          className={cn('w-full h-full object-cover', !isActive && 'grayscale opacity-75')}
          onError={e => { (e.target as HTMLImageElement).src = '/photos/placeholder.jpg' }}
        />
        <div className={cn('absolute top-3 right-3 px-3 py-1.5 rounded-xl text-xs font-bold',
          isActive ? 'bg-green-500 text-white' : 'bg-gray-800 text-white')}>
          {isActive ? 'Available' : (item.outOfStock ? 'Out of stock' : 'Unavailable')}
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-extrabold text-gray-900 text-base">{item.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{item.description}</p>
          </div>
          <span className="text-primary font-black text-base shrink-0 ml-3">{formatPrice(item.price)}</span>
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-4">
            <button onClick={onEdit} className="flex items-center gap-1.5 text-xs text-primary font-extrabold hover:underline">
              <Edit2 size={14} /> EDIT
            </button>
            <button onClick={onDelete} className="flex items-center gap-1.5 text-xs text-red-500 font-extrabold hover:underline">
              <Trash2 size={14} /> DELETE
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
              {isActive ? 'ACTIVE' : 'OFF'}
            </span>
            <button
              onClick={onToggle}
              disabled={toggling}
              className={cn('w-12 h-6 rounded-full transition-colors relative flex items-center px-1',
                isActive ? 'bg-primary' : 'bg-gray-200')}
            >
              <span className={cn('w-4 h-4 rounded-full bg-white transition-transform shadow-sm',
                isActive ? 'translate-x-6' : 'translate-x-0')} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Add / Edit Modal Component ── */
function MenuItemModal({ mode, item, onSave, onClose, loading }: {
  mode: ModalMode
  item: MenuItem | null
  onSave: (data: Partial<MenuItem>, imageFile?: File, preview?: string) => void
  onClose: () => void
  loading: boolean
}) {
  const [name, setName] = useState(item?.name ?? '')
  const [desc, setDesc] = useState(item?.description ?? '')
  const [price, setPrice] = useState(item?.price ? String(item.price) : '')
  const [category, setCategory] = useState<FoodCategory>(item?.category ?? 'lunch')
  const [preview, setPreview] = useState(item?.imageUrl ?? '')
  const [imageFile, setImageFile] = useState<File | undefined>()

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      setPreview(URL.createObjectURL(file))
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full max-w-mobile rounded-t-[40px] sm:rounded-[32px] flex flex-col max-h-[85vh] shadow-2xl animate-in slide-in-from-bottom duration-300 overflow-hidden relative">
        {/* Modal Header */}
        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-extrabold text-gray-900">
            {mode === 'add' ? 'Add New Food Item' : 'Edit Food Item'}
          </h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 active:scale-95 transition-transform">
            <X size={18} />
          </button>
        </div>

        {/* Modal Form Content & Action Buttons (Scrollable together) */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 pb-10">
          {/* Image Upload Box */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Item Photo</label>
            <div className="relative w-full h-40 bg-gray-100 rounded-3xl overflow-hidden border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer group">
              {preview ? (
                <img src={preview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center text-gray-400">
                  <Camera size={28} className="mb-2" />
                  <span className="text-xs font-bold">Upload Food Image</span>
                </div>
              )}
              <input type="file" accept="image/*" onChange={handleImage} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>
          </div>

          {/* Item Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Food Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Steam Hoppers / Rice & Curry"
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Category & Price Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Category</label>
              <div className="relative">
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as FoodCategory)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-sm font-semibold appearance-none capitalize focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Price (Rs.) *</label>
              <input
                type="number"
                required
                min="0"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="100"
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Description</label>
            <textarea
              rows={3}
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Ingredients, portion details..."
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>

          {/* Action Buttons inside scrollable area */}
          <div className="pt-4 border-t border-gray-100 flex gap-3">
            <button onClick={onClose} type="button" className="btn-outline flex-1 py-4 font-bold text-xs uppercase tracking-wider text-gray-400 border-gray-200">
              Cancel
            </button>
            <button
              onClick={() => {
                if (!name || !price) return
                onSave(
                  { name, description: desc, price: parseFloat(price), category, available: true, outOfStock: false, imageUrl: preview },
                  imageFile,
                  preview
                )
              }}
              disabled={loading || !name || !price}
              type="button"
              className="btn-primary flex-1 py-4 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : 'Save Menu Item'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
