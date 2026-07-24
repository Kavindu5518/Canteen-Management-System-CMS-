'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Search, Plus, AlertTriangle, Package, Edit2, Trash2, X, Loader2, TrendingUp, Truck, ChevronDown } from 'lucide-react'
import AdminBottomNav from '@/components/admin/AdminBottomNav'
import CustomSelect from '@/components/ui/CustomSelect'
import { cn } from '@/lib/utils'
import { useToast } from '@/lib/toast'
import { useConfirm } from '@/lib/confirm'
import type { InventoryItem } from '@/types'

const CATEGORIES = ['All', 'Grains', 'Protein', 'Dairy', 'Oils', 'Condiments', 'Beverages']

export default function AdminInventoryPage() {
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<InventoryItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    const fetchItems = async () => {
      const { data, error } = await supabase.from('inventory').select('*')
      if (data && !error) {
        setItems(data as InventoryItem[])
        setIsLive(true)
      } else {
        setIsLive(false)
      }
    }

    fetchItems()

    const sub = supabase.channel('admin_inventory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
        fetchItems()
      })
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [])

  const lowStock = items.filter(i => i.currentStock <= i.minStockLevel)
  const filtered = items.filter(i => {
    const matchCat = category === 'All' || i.category === category
    return matchCat && i.name.toLowerCase().includes(search.toLowerCase())
  })

  function getStatus(item: InventoryItem) {
    const r = item.currentStock / item.minStockLevel
    if (r <= 1) return { label: 'Low Stock', color: 'text-red-600', bg: 'bg-red-50', bar: 'bg-red-400', border: 'border-red-200' }
    if (r <= 1.5) return { label: 'Warning', color: 'text-amber-600', bg: 'bg-amber-50', bar: 'bg-amber-400', border: 'border-amber-200' }
    return { label: 'Good', color: 'text-green-600', bg: 'bg-green-50', bar: 'bg-green-400', border: 'border-gray-200' }
  }

  async function handleReorder(item: InventoryItem) {
    const isConfirmed = await confirm({
      title: 'Reorder Item',
      message: `Create a reorder request for ${item.name}?`
    })
    if (!isConfirmed) return
    try {
      // Assuming reorder_requests table is created or will be.
      await supabase.from('reorder_requests').insert([{
        itemId: item.id,
        itemName: item.name,
        currentStock: item.currentStock,
        minStockLevel: item.minStockLevel,
        status: 'pending',
        createdAt: new Date().toISOString()
      }])
      showToast('success', 'Reorder request sent to suppliers.')
    } catch (err) {
      console.error(err)
      showToast('error', 'Failed to create reorder request.')
    }
  }

  async function save(data: Partial<InventoryItem>) {
    setSaving(true)

    try {
      if (editing) {
        await supabase.from('inventory').update({
          ...data,
          updatedAt: new Date().toISOString()
        }).eq('id', editing.id)
      } else {
        await supabase.from('inventory').insert([{
          ...data,
          createdAt: new Date().toISOString(),
          lastRestocked: new Date().toISOString()
        }])
      }
    } catch (err: any) {
      console.error(err)
      showToast('error', 'Error saving: ' + err.message)
    }
    setSaving(false); setModal(false); setEditing(null)
  }

  async function del(id: string) {
    const isConfirmed = await confirm({
      title: 'Delete Item',
      message: 'Are you sure you want to permanently delete this inventory item?'
    })
    if (!isConfirmed) return
    try { await supabase.from('inventory').delete().eq('id', id) } catch { }
  }

  return (
    <div className="has-bottom-nav min-h-screen bg-gray-50">
      <div className="admin-header">
        <div>
          <h1 className="text-xl font-extrabold text-text-primary">Inventory</h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className={cn('w-2 h-2 rounded-full', isLive ? 'bg-green-400' : 'bg-gray-300')} />
            <p className="text-text-muted text-xs">{isLive ? 'Live sync' : 'Connecting...'}</p>
          </div>
        </div>
        <button onClick={() => { setEditing(null); setModal(true) }}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-2xl font-bold text-sm shadow-primary active:scale-95 transition-all">
          <Plus size={16} /> Add Item
        </button>
      </div>

      {/* Low Stock Banner */}
      {lowStock.length > 0 && (
        <div className="mx-5 mt-3 bg-red-50 border border-red-200 rounded-[32px] px-6 py-4 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
              <AlertTriangle size={24} className="text-red-500" />
            </div>
            <div>
              <p className="text-red-900 text-sm font-black tracking-tight">{lowStock.length} items need restocking</p>
              <p className="text-red-400 text-[10px] font-bold uppercase tracking-widest">{lowStock.map(i => i.name).slice(0, 3).join(', ')}{lowStock.length > 3 ? '...' : ''}</p>
            </div>
          </div>
          <button onClick={async () => {
            const isConfirmed = await confirm({
              title: 'Restock All Items',
              message: `Create reorder requests for all ${lowStock.length} low-stock items?`
            })
            if (!isConfirmed) return
            for (const i of lowStock) {
              try {
                await supabase.from('reorder_requests').insert([{
                  itemId: i.id,
                  itemName: i.name,
                  currentStock: i.currentStock,
                  minStockLevel: i.minStockLevel,
                  status: 'pending',
                  createdAt: new Date().toISOString()
                }])
              } catch (err) {
                console.error('Reorder request failed for', i.name, err)
              }
            }
            showToast('success', 'Reorder requests sent to suppliers.')
          }}
            className="bg-red-500 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-red transition-all active:scale-95">
            Restock All
          </button>
        </div>
      )}

      {/* Usage Analytics */}
      <div className="px-5 mt-6 mb-4">
        <div className="bg-gray-900 rounded-[40px] p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full -mr-16 -mt-16 blur-3xl" />
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center">
              <TrendingUp size={20} className="text-primary" />
            </div>
            <h2 className="text-lg font-black text-white tracking-tight">Usage Analytics</h2>
          </div>
          <div className="flex items-end gap-2 h-32 relative">
            {[40, 65, 30, 85, 50, 90, 75].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                <div className="w-full bg-white/5 rounded-t-xl relative overflow-hidden h-24">
                  <div className="absolute bottom-0 w-full bg-primary rounded-t-xl transition-all duration-1000 ease-out" style={{ height: `${h}%` }}>
                    <div className="absolute top-0 left-0 w-full h-1 bg-white/20" />
                  </div>
                </div>
                <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Day {i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-5 pt-3">
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search inventory..."
            className="input-field pl-9 py-3 text-sm" />
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-4">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={cn('px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all',
                category === cat ? 'bg-primary text-white shadow-primary' : 'bg-white text-text-secondary shadow-card')}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pb-4 space-y-3">
        {filtered.map(item => {
          const st = getStatus(item)
          const pct = Math.min(100, Math.round((item.currentStock / item.maxStockLevel) * 100))
          return (
            <div key={item.id} className={cn('bg-white rounded-[32px] shadow-card p-5 border border-transparent transition-all', st.border)}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center shrink-0">
                    <Package size={22} className="text-gray-400" />
                  </div>
                  <div>
                    <p className="text-text-primary font-black text-sm leading-tight">{item.name}</p>
                    <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mt-0.5">{item.category}</p>
                  </div>
                </div>
                <span className={cn('text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest', st.bg, st.color)}>
                  {st.label}
                </span>
              </div>
              <div className="mb-4 bg-gray-50/50 p-4 rounded-2xl border border-gray-50">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-text-muted font-bold uppercase tracking-tighter">Current stock</span>
                  <span className="text-text-primary font-black">{item.currentStock} {item.unit}</span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all duration-700', st.bar)} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-[9px] mt-2 font-black text-gray-400 uppercase tracking-widest">
                  <span>Min: {item.minStockLevel}</span>
                  <span>Max: {item.maxStockLevel}</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                <span className="text-gray-900 font-black text-sm">Rs.{item.unitPrice}<span className="text-[10px] text-gray-400 font-bold ml-1">/{item.unit}</span></span>
                <div className="flex gap-4">
                  <button onClick={() => handleReorder(item)} disabled={item.currentStock > item.minStockLevel}
                    className={cn('flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all',
                      item.currentStock <= item.minStockLevel ? 'text-amber-500' : 'text-gray-200 cursor-not-allowed')}>
                    <Truck size={14} /> Reorder
                  </button>
                  <button onClick={() => { setEditing(item); setModal(true) }} className="text-primary hover:scale-110 transition-transform">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => del(item.id)} className="text-red-400 hover:scale-110 transition-transform">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {modal && (
        <InvModal item={editing} onSave={save} onClose={() => { setModal(false); setEditing(null) }} loading={saving} />
      )}
      <AdminBottomNav />
    </div>
  )
}

function InvModal({ item, onSave, onClose, loading }: { item: InventoryItem | null; onSave: (d: Partial<InventoryItem>) => void; onClose: () => void; loading: boolean }) {
  const [name, setName] = useState(item?.name ?? '')
  const [cat, setCat] = useState(item?.category ?? 'Grains')
  const [unit, setUnit] = useState(item?.unit ?? 'kg')
  const [current, setCurrent] = useState(item?.currentStock?.toString() ?? '')
  const [min, setMin] = useState(item?.minStockLevel?.toString() ?? '')
  const [max, setMax] = useState(item?.maxStockLevel?.toString() ?? '')
  const [price, setPrice] = useState(item?.unitPrice?.toString() ?? '')

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-end justify-center animate-in fade-in duration-300"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full max-w-mobile rounded-t-[40px] flex flex-col max-h-[92vh] shadow-2xl animate-in slide-in-from-bottom duration-500 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-7 pb-4 border-b border-gray-50 flex items-center justify-between shrink-0">
          <h2 className="font-black text-gray-900 text-xl tracking-tight">{item ? 'Edit Item' : 'Add Inventory Item'}</h2>
          <button onClick={onClose} className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center transition-transform active:scale-90">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-hide">
          {[{ l: 'Item Name', v: name, s: setName, p: 'e.g. Rice', t: 'text' }, { l: 'Category', v: cat, s: setCat, p: 'e.g. Grains', t: 'select' }, { l: 'Unit', v: unit, s: setUnit, p: 'kg / l / pcs', t: 'text' }, { l: 'Current Stock', v: current, s: setCurrent, p: '0', t: 'number' }, { l: 'Min Stock Level', v: min, s: setMin, p: '0', t: 'number' }, { l: 'Max Stock Level', v: max, s: setMax, p: '0', t: 'number' }, { l: 'Unit Price (Rs)', v: price, s: setPrice, p: '0', t: 'number' }].map(({ l, v, s, p, t }) => (
            <div key={l}>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-2">{l}</label>
              {t === 'select' ? (
                <CustomSelect
                  value={v}
                  onChange={s}
                  options={[
                    { value: 'Grains', label: 'Grains' },
                    { value: 'Protein', label: 'Protein' },
                    { value: 'Dairy', label: 'Dairy' },
                    { value: 'Oils', label: 'Oils' },
                    { value: 'Condiments', label: 'Condiments' },
                    { value: 'Beverages', label: 'Beverages' }
                  ]}
                  className="w-full"
                />
              ) : (
                <input type={t} value={v} onChange={e => s(e.target.value)} placeholder={p} className="input-field py-4 bg-gray-50 border-transparent focus:bg-white focus:border-primary transition-all" />
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 pt-4 pb-12 border-t border-gray-50 flex gap-4 bg-white shrink-0">
          <button onClick={onClose} className="btn-outline flex-1 py-4 font-black uppercase text-[11px] tracking-widest text-gray-400 border-gray-100">Cancel</button>
          <button onClick={() => onSave({ name, category: cat, unit, currentStock: +current, minStockLevel: +min, maxStockLevel: +max, unitPrice: +price })}
            disabled={loading || !name} className="btn-primary flex-1 py-4 font-black uppercase text-[11px] tracking-widest gap-2">
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Save Item'}
          </button>
        </div>
      </div>
    </div>
  )
}
