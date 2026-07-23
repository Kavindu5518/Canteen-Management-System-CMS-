'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Search, Plus, Truck, Phone, Mail, MapPin, X, Loader2, Edit2, Trash2, Calendar, AlertCircle, PackageCheck, Coins } from 'lucide-react'
import AdminBottomNav from '@/components/admin/AdminBottomNav'
import CustomSelect from '@/components/ui/CustomSelect'
import { cn, formatPrice } from '@/lib/utils'
import { useToast } from '@/lib/toast'
import { useConfirm } from '@/lib/confirm'
import type { Supplier, InventoryItem } from '@/types'

export default function AdminSuppliersPage() {
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [supplyMod, setSupplyMod] = useState<Supplier | null>(null)
  const [saving, setSaving] = useState(false)
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    const fetchSuppliers = async () => {
      const { data, error } = await supabase.from('suppliers').select('*')
      if (data && !error) {
        setSuppliers(data as Supplier[])
        setIsLive(true)
      } else {
        setIsLive(false)
      }
    }

    const fetchInventory = async () => {
      const { data, error } = await supabase.from('inventory').select('*')
      if (data && !error) {
        setInventory(data as InventoryItem[])
      }
    }

    fetchSuppliers()
    fetchInventory()

    const subSup = supabase.channel('admin_suppliers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, fetchSuppliers)
      .subscribe()
    
    const subInv = supabase.channel('admin_inv_suppliers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, fetchInventory)
      .subscribe()

    return () => { supabase.removeChannel(subSup); supabase.removeChannel(subInv) }
  }, [])

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.contactPerson.toLowerCase().includes(search.toLowerCase())
  )

  async function del(id: string) {
    const isConfirmed = await confirm({
      title: 'Remove Supplier',
      message: 'Are you sure you want to permanently remove this supplier?'
    })
    if (!isConfirmed) return
    try { await supabase.from('suppliers').delete().eq('id', id) } catch { }
  }

  async function save(data: Partial<Supplier>) {
    setSaving(true)
    try {
      if (editing) {
        await supabase.from('suppliers').update(data).eq('id', editing.id)
      } else {
        await supabase.from('suppliers').insert([{
          ...data,
          outstandingAmount: 0,
          createdAt: new Date().toISOString()
        }])
      }
    } catch (err) {
      console.error(err)
    }
    setSaving(false); setModal(false); setEditing(null)
  }

  async function handleConfirmSupply(supplierId: string, itemId: string, qty: number, totalCost: number) {
    setSaving(true)
    try {
      // 1. Update Inventory
      const item = inventory.find(i => i.id === itemId)
      if (item) {
        await supabase.from('inventory').update({
          currentStock: (item.currentStock || 0) + qty,
          lastRestocked: new Date().toISOString()
        }).eq('id', itemId)
      }

      // 2. Update Supplier Balance
      const sup = suppliers.find(s => s.id === supplierId)
      if (sup) {
        await supabase.from('suppliers').update({
          outstandingAmount: (sup.outstandingAmount || 0) + totalCost,
          nextPaymentDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }).eq('id', supplierId)
      }

      // 3. Record History
      await supabase.from('supply_history').insert([{
        supplierId,
        supplierName: sup?.name,
        itemId,
        itemName: item?.name,
        quantity: qty,
        unit: item?.unit,
        totalCost,
        createdAt: new Date().toISOString()
      }])

      showToast('success', 'Supply confirmed and inventory updated!')
      setSupplyMod(null)
    } catch (err) {
      console.error(err)
      showToast('error', 'Failed to confirm supply.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="has-bottom-nav min-h-screen">
      <div className="admin-header">
        <div>
          <h1 className="text-xl font-extrabold text-text-primary">Suppliers</h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className={cn('w-2 h-2 rounded-full', isLive ? 'bg-green-400' : 'bg-gray-300')} />
            <p className="text-text-muted text-xs">{isLive ? 'Live sync' : 'Connecting...'}</p>
          </div>
        </div>
        <button onClick={() => { setEditing(null); setModal(true) }}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-2xl font-bold text-sm shadow-primary">
          <Plus size={16} /> Add Supplier
        </button>
      </div>

      <div className="flex gap-3 px-5 pt-3 mb-3">
        {[{ l: 'Total', v: suppliers.length }, { l: 'Categories', v: new Set(suppliers.flatMap(s => s.itemCategories)).size }].map(({ l, v }) => (
          <div key={l} className="flex-1 bg-white rounded-2xl shadow-card py-4 text-center">
            <p className="text-2xl font-extrabold text-text-primary">{v}</p>
            <p className="text-text-muted text-xs font-semibold mt-0.5">{l}</p>
          </div>
        ))}
      </div>

      <div className="px-5 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search suppliers..."
            className="input-field pl-9 py-3 text-sm" />
        </div>
      </div>

      <div className="px-5 pb-4 space-y-4">
        {filtered.map(s => {
          const isOverdue = s.nextPaymentDate && new Date(s.nextPaymentDate) < new Date()
          return (
            <div key={s.id} className="bg-white rounded-[32px] shadow-card p-5 border border-gray-50">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0">
                    <Truck size={22} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-text-primary font-black text-sm leading-tight">{s.name}</p>
                    <p className="text-text-muted text-xs font-bold uppercase tracking-tight">{s.contactPerson}</p>
                  </div>
                </div>
                {s.outstandingAmount && s.outstandingAmount > 0 ? (
                  <div className={cn('px-3 py-1.5 rounded-xl flex items-center gap-1.5', isOverdue ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600')}>
                    <AlertCircle size={12} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{isOverdue ? 'Overdue' : 'Payment Due'}</span>
                  </div>
                ) : (
                  <div className="px-3 py-1.5 rounded-xl bg-green-50 text-green-600 flex items-center gap-1.5">
                    <PackageCheck size={12} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Cleared</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gray-50 rounded-2xl p-3">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Outstanding</p>
                  <p className="text-sm font-black text-gray-900">{formatPrice(s.outstandingAmount || 0)}</p>
                </div>
                <div className="bg-gray-50 rounded-2xl p-3">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Next Payment</p>
                  <p className="text-sm font-black text-gray-900">{s.nextPaymentDate ? new Date(s.nextPaymentDate).toLocaleDateString('en-LK') : 'N/A'}</p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-3 text-xs text-gray-500 font-bold">
                  <Phone size={12} className="text-primary" /> {s.phone}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 font-bold">
                  <Mail size={12} className="text-primary" /> {s.email}
                </div>
              </div>

              <div className="flex gap-2 mb-5">
                {s.itemCategories?.map(cat => (
                  <span key={cat} className="bg-white border border-gray-100 text-gray-400 text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest">{cat}</span>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                <div className="flex gap-4">
                  <button onClick={() => { setEditing(s); setModal(true) }} className="text-primary hover:scale-110 transition-transform"><Edit2 size={16} /></button>
                  <button onClick={() => del(s.id)} className="text-red-400 hover:scale-110 transition-transform"><Trash2 size={16} /></button>
                </div>
                <button onClick={() => setSupplyMod(s)}
                  className="bg-gray-900 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2 active:scale-95 transition-all">
                  <PackageCheck size={14} /> Confirm Supply
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {modal && <SupModal supplier={editing} onSave={save} onClose={() => { setModal(false); setEditing(null) }} loading={saving} />}

      {supplyMod && (
        <SupplyConfirmModal
          supplier={supplyMod}
          inventoryItems={inventory}
          onConfirm={handleConfirmSupply}
          onClose={() => setSupplyMod(null)}
          loading={saving}
        />
      )}

      <AdminBottomNav />
    </div>
  )
}

function SupplyConfirmModal({ supplier, inventoryItems, onConfirm, onClose, loading }: {
  supplier: Supplier;
  inventoryItems: InventoryItem[];
  onConfirm: (supId: string, itemId: string, qty: number, cost: number) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [itemId, setItemId] = useState('')
  const [qty, setQty] = useState('')
  const [cost, setCost] = useState('')

  return (
    <div className="fixed inset-0 bg-black/70 z-[110] flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center mb-6">
            <PackageCheck size={32} className="text-primary" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">Confirm Supply</h2>
          <p className="text-gray-400 text-xs font-bold mb-8 uppercase tracking-widest">Entry from {supplier.name}</p>

          <div className="w-full space-y-4 mb-8">
            <div className="text-left">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2 mb-1.5 block">Inventory Item</label>
              <CustomSelect
                value={itemId}
                onChange={setItemId}
                placeholder="Select an item..."
                options={inventoryItems.map(i => ({
                  value: i.id,
                  label: `${i.name} (${i.unit})`
                }))}
                className="w-full text-left"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="text-left">
               <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2 mb-1.5 block">Quantity</label>
                <input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" className="input-field py-4 bg-gray-50 border-transparent focus:bg-white focus:border-primary transition-all" />
              </div>
              <div className="text-left">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2 mb-1.5 block">Total Cost</label>
                <input type="number" value={cost} onChange={e => setCost(e.target.value)} placeholder="0.00" className="input-field py-4 bg-gray-50 border-transparent focus:bg-white focus:border-primary transition-all" />
              </div>
            </div>
          </div>

          <div className="flex gap-3 w-full">
            <button onClick={onClose} className="btn-outline flex-1 py-4 font-black uppercase text-[11px] tracking-widest text-gray-400 border-gray-100">Cancel</button>
            <button
              onClick={() => onConfirm(supplier.id, itemId, +qty, +cost)}
              disabled={!itemId || !qty || !cost || loading}
              className="btn-primary flex-1 py-4 font-black uppercase text-[11px] tracking-widest shadow-primary transition-all flex items-center justify-center gap-2">
              {loading ? <Loader2 className="animate-spin" size={16} /> : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SupModal({ supplier, onSave, onClose, loading }: { supplier: Supplier | null; onSave: (d: Partial<Supplier>) => void; onClose: () => void; loading: boolean }) {
  const [name, setName] = useState(supplier?.name ?? '')
  const [contact, setContact] = useState(supplier?.contactPerson ?? '')
  const [phone, setPhone] = useState(supplier?.phone ?? '')
  const [email, setEmail] = useState(supplier?.email ?? '')
  const [address, setAddress] = useState(supplier?.address ?? '')
  const [cats, setCats] = useState(supplier?.itemCategories?.join(', ') ?? '')
  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-end justify-center animate-in fade-in duration-300"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full max-w-mobile rounded-t-[40px] flex flex-col max-h-[92vh] shadow-2xl animate-in slide-in-from-bottom duration-500 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-7 pb-4 border-b border-gray-50 flex items-center justify-between shrink-0">
          <h2 className="font-extrabold text-gray-900 text-lg tracking-tight">{supplier ? 'Edit Supplier' : 'Add Supplier'}</h2>
          <button onClick={onClose} className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center transition-transform active:scale-90">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-hide text-left">
          {[{ l: 'Company Name', v: name, s: setName, p: 'Lanka Grains Co.' }, { l: 'Contact Person', v: contact, s: setContact, p: 'Ranjith Perera' }, { l: 'Phone', v: phone, s: setPhone, p: '011-XXX-XXXX' }, { l: 'Email', v: email, s: setEmail, p: 'info@company.lk' }, { l: 'Address', v: address, s: setAddress, p: 'Street, City' }, { l: 'Item Categories (comma-separated)', v: cats, s: setCats, p: 'Rice, Dhal, Flour' }].map(({ l, v, s, p }) => (
            <div key={l}>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-2">{l}</label>
              <input value={v} onChange={e => s(e.target.value)} placeholder={p} className="input-field py-4 bg-gray-50 border-transparent focus:bg-white focus:border-primary transition-all" />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 pt-4 pb-12 border-t border-gray-50 bg-white flex gap-4 shrink-0">
          <button onClick={onClose} className="btn-outline flex-1 py-4 font-black uppercase text-[11px] tracking-widest text-gray-400 border-gray-100">Cancel</button>
          <button onClick={() => onSave({ name, contactPerson: contact, phone, email, address, itemCategories: cats.split(',').map(c => c.trim()).filter(Boolean) })}
            disabled={loading || !name} className="btn-primary flex-1 py-4 font-black uppercase text-[11px] tracking-widest gap-2">
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Save Supplier'}
          </button>
        </div>
      </div>
    </div>
  )
}
