'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Search, Plus, ArrowLeft, Edit2, Trash2,
  Camera, ChevronDown, Loader2, X, Wifi, WifiOff
} from 'lucide-react'
import AdminBottomNav from '@/components/admin/AdminBottomNav'
import { cn, formatPrice } from '@/lib/utils'
import type { MenuItem, FoodCategory } from '@/types'

const DEMO_ITEMS: MenuItem[] = []
const CATEGORIES: FoodCategory[] = ['breakfast', 'lunch', 'dinner', 'snacks', 'beverages']
type ModalMode = 'add' | 'edit' | null

export default function AdminMenuPage() {
  const [items, setItems] = useState<MenuItem[]>(DEMO_ITEMS)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalMode>(null)
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [isLive, setIsLive] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  /* ── Real-time listener — same as customer page ── */
  useEffect(() => {
    const fetchMenu = async () => {
      const { data, error } = await supabase.from('menu_items').select('*')
      if (data && !error) {
        setItems(data as MenuItem[])
        setIsLive(true)
      } else {
        setItems(DEMO_ITEMS)
        setIsLive(false)
      }
    }

    fetchMenu()

    const sub = supabase.channel('admin_menu')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => {
        fetchMenu()
      })
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [])

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase())
  )

  /* ── Toggle availability — writes to Postgres → customer sees instantly ── */
  async function toggleAvailability(item: MenuItem) {
    const newAvailable = !item.available || item.outOfStock ? true : false
    const newOutOfStock = newAvailable ? false : true

    // Optimistic UI update
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
      // Postgres changes will automatically update both
      // this admin page AND the customer menu page in real-time ✓
    } catch (err) {
      console.error("Error toggling availability:", err)
      // Revert on error
      setItems(prev => prev.map(i =>
        i.id === item.id ? { ...i, available: item.available, outOfStock: item.outOfStock } : i
      ))
    }
    setToggling(null)
  }

  async function deleteItem(id: string) {
    if (!confirm('Delete this menu item?')) return
    setItems(prev => prev.filter(i => i.id !== id))
    try {
      await supabase.from('menu_items').delete().eq('id', id)
    } catch (err) {
      console.error("Error deleting item:", err)
    }
  }

  async function saveItem(data: Partial<MenuItem>, imageFile?: File, preview?: string) {
    setLoading(true)
    let imageUrl = data.imageUrl ?? ''

    try {
      if (imageFile) {
        try {
          const filePath = `${Date.now()}_${imageFile.name}`
          // Try 'menu-items' bucket first, then 'menu_items'
          let uploadError: any = null
          let result = await supabase.storage.from('menu-items').upload(filePath, imageFile)
          uploadError = result.error
          
          if (uploadError) {
            // Try underscore variant
            result = await supabase.storage.from('menu_items').upload(filePath, imageFile)
            uploadError = result.error
          }
          
          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage.from('menu-items').getPublicUrl(filePath)
            imageUrl = publicUrlData.publicUrl
          } else {
            // Silently fall back - no alert popup
            console.warn("Storage bucket not configured, using placeholder image.")
            imageUrl = preview || '/photos/placeholder.jpg'
          }
        } catch (uploadErr) {
          console.warn("Image upload skipped:", uploadErr)
          imageUrl = preview || '/photos/placeholder.jpg'
        }
      }

      if (modal === 'add') {
        await supabase.from('menu_items').insert([{
          ...data,
          imageUrl,
          rating: 0,
          totalRatings: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }])
      } else if (editing) {
        await supabase.from('menu_items').update({
          ...data,
          imageUrl,
          updatedAt: new Date().toISOString()
        }).eq('id', editing.id)
      }
    } catch (err: any) {
      console.error(">>> [DB ERROR]:", err)
      alert("Error saving: " + err.message)
    } finally {
      setLoading(false)
      setModal(null)
      setEditing(null)
    }
  }

  return (
    <div className="bg-gray-50 has-bottom-nav min-h-screen">

      {/* Header */}
      <div className="admin-header">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Menu</h1>
          <div className={cn('flex items-center gap-1.5 mt-0.5 text-xs font-bold',
            isLive ? 'text-green-600' : 'text-gray-400')}>
            {isLive
              ? <><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse inline-block" /> Live sync on</>
              : <><WifiOff size={10} /> Demo mode</>
            }
          </div>
        </div>
        <button onClick={() => { setEditing(null); setModal('add') }}
          className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center shadow-primary">
          <Plus size={20} className="text-white" />
        </button>
      </div>

      {/* Search */}
      <div className="px-5 py-3">
        <div className="relative">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search food items..."
            className="input-field pl-10 text-sm" />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-3 px-5 mb-3">
        {[
          { label: 'Total Items', value: filtered.length, color: 'text-gray-900' },
          { label: 'Available', value: filtered.filter(i => i.available && !i.outOfStock).length, color: 'text-green-600' },
          { label: 'Unavailable', value: filtered.filter(i => !i.available || i.outOfStock).length, color: 'text-red-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex-1 bg-white rounded-2xl py-3 text-center shadow-card">
            <p className={cn('text-xl font-extrabold', color)}>{value}</p>
            <p className="text-gray-400 text-[10px] font-semibold mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Items */}
      <div className="px-5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-gray-900 font-bold">
            Active Items <span className="text-gray-400">({filtered.length})</span>
          </p>
        </div>

        <div className="space-y-4">
          {filtered.map(item => (
            <MenuItemCard key={item.id} item={item}
              toggling={toggling === item.id}
              onEdit={() => { setEditing(item); setModal('edit') }}
              onDelete={() => deleteItem(item.id)}
              onToggle={() => toggleAvailability(item)} />
          ))}
        </div>
      </div>

      {modal && (
        <MenuItemModal mode={modal} item={editing}
          onSave={saveItem} onClose={() => { setModal(null); setEditing(null) }} loading={loading} />
      )}

      <AdminBottomNav />
    </div>
  )
}

/* ── Menu Item Card ── */
function MenuItemCard({ item, toggling, onEdit, onDelete, onToggle }: {
  item: MenuItem; toggling: boolean
  onEdit: () => void; onDelete: () => void; onToggle: () => void
}) {
  const isActive = item.available && !item.outOfStock
  return (
    <div className="bg-white rounded-3xl overflow-hidden shadow-card">
      <div className="relative w-full h-40">
        <img src={item.imageUrl} alt={item.name}
          className={cn('w-full h-full object-cover transition-all duration-300',
            !isActive && 'grayscale opacity-70')}
          onError={e => { (e.target as HTMLImageElement).src = '/photos/placeholder.jpg' }} />
        <div className={cn('absolute top-3 right-3 px-3 py-1.5 rounded-xl text-xs font-bold',
          isActive ? 'bg-green-500 text-white' : 'bg-gray-700 text-white')}>
          {isActive ? 'Available' : (item.outOfStock ? 'Out of Stock' : 'Unavailable')}
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-gray-900">{item.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
          </div>
          <span className="text-primary font-extrabold text-sm shrink-0 ml-2">{formatPrice(item.price)}</span>
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <button onClick={onEdit} className="flex items-center gap-1.5 text-xs text-primary font-bold">
              <Edit2 size={13} /> EDIT
            </button>
            <button onClick={onDelete} className="flex items-center gap-1.5 text-xs text-red-500 font-bold">
              <Trash2 size={13} /> DELETE
            </button>
          </div>

          {/* Toggle — writes to Postgres → customer menu updates instantly */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-semibold">
              {isActive ? 'ACTIVE' : 'INACTIVE'}
            </span>
            <button onClick={onToggle} disabled={toggling}
              className={cn('w-12 h-6 rounded-full relative transition-colors duration-300',
                isActive ? 'bg-primary' : 'bg-gray-200',
                toggling && 'opacity-60 cursor-not-allowed')}>
              {toggling ? (
               <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 size={12} className="animate-spin text-white" />
                </div>
              ) : (
                <div className={cn('w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-transform duration-300',
                  isActive ? 'translate-x-6' : 'translate-x-0.5')} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Add/Edit Modal ── */
function MenuItemModal({ mode, item, onSave, onClose, loading }: {
  mode: ModalMode; item: MenuItem | null
  onSave: (data: Partial<MenuItem>, img?: File) => void
  onClose: () => void; loading: boolean
}) {
  const [name, setName] = useState(item?.name ?? '')
  const [desc, setDesc] = useState(item?.description ?? '')
  const [price, setPrice] = useState(item?.price?.toString() ?? '')
  const [category, setCategory] = useState<FoodCategory>(item?.category ?? 'breakfast')
  const [imageFile, setImageFile] = useState<File | undefined>()
  const [preview, setPreview] = useState(item?.imageUrl ?? '')

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setPreview(URL.createObjectURL(file))
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-end justify-center animate-in fade-in duration-300"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full max-w-mobile rounded-t-[40px] flex flex-col max-h-[92vh] shadow-2xl animate-in slide-in-from-bottom duration-500 overflow-hidden">
        {/* Sticky Header */}
        <div className="px-6 pt-7 pb-4 border-b border-gray-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center transition-transform active:scale-90">
              <ArrowLeft size={18} className="text-gray-400" />
            </button>
            <h2 className="font-extrabold text-gray-900 text-lg tracking-tight">
              {mode === 'add' ? 'Add New Menu Item' : 'Edit Menu Item'}
            </h2>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center transition-transform active:scale-90">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
          {/* Image Upload */}
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-2">Item Image</p>
            <label className="block w-full h-44 bg-gray-50 border-2 border-dashed border-gray-100 rounded-[32px] cursor-pointer overflow-hidden hover:border-primary transition-all">
              {preview ? (
                <img src={preview} alt="" className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).src = '' }} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Camera size={24} className="text-primary" />
                  </div>
                  <span className="text-[10px] text-primary font-black uppercase tracking-widest">Upload photo</span>
                </div>
              )}
              <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-2">Item Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Fried Rice" className="input-field py-4 bg-gray-50 border-transparent focus:bg-white focus:border-primary transition-all" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-2">Category</label>
              <div className="relative">
                <select value={category} onChange={e => setCategory(e.target.value as FoodCategory)} className="input-field py-4 bg-gray-50 border-transparent focus:bg-white focus:border-primary transition-all appearance-none capitalize">
                  {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-2">Price</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-bold text-sm">Rs.</span>
                <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="150.00" className="input-field py-4 bg-gray-50 border-transparent focus:bg-white focus:border-primary transition-all pl-12" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-2">Description</label>
              <textarea value={desc} onChange={e => setDesc(e.target.value)}
                placeholder="Describe the ingredients and preparation..."
                rows={3} className="input-field py-4 bg-gray-50 border-transparent focus:bg-white focus:border-primary transition-all resize-none" />
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="px-6 pt-4 pb-12 border-t border-gray-50 bg-white flex gap-3 shrink-0">
          <button onClick={onClose} className="btn-outline flex-1 py-4 font-black uppercase text-[11px] tracking-widest text-gray-400 border-gray-100">Discard</button>
          <button
            onClick={() => {
              const itemData = { name, description: desc, price: parseFloat(price), category, available: true, outOfStock: false, imageUrl: preview }
              onSave(itemData, imageFile);
            }}
            disabled={loading || !name || !price}
            className="btn-primary flex-1 py-4 font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-2">
            {loading ? <><Loader2 size={16} className="animate-spin" />Saving...</> : 'Save Menu Item'}
          </button>
        </div>
      </div>
    </div>
  )
}
