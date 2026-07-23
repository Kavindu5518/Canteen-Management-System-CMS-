'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import {
  Search, ShoppingCart, Star,
  Coffee, UtensilsCrossed, Moon, Cookie, Plus, Wifi, WifiOff, CupSoda
} from 'lucide-react'
import CustomerBottomNav from '@/components/customer/CustomerBottomNav'
import { cn, formatPrice } from '@/lib/utils'
import type { MenuItem, FoodCategory, CartItem } from '@/types'
import { useRouter } from 'next/navigation'
import ItemDetailModal from '@/components/customer/ItemDetailModal'

/* ── Demo data fallback ── */
const DEMO_ITEMS: MenuItem[] = [
  { id: '1', name: 'Rice & Curry', description: 'Rice, Coconut Sambal, Dhal Curry, Soya Meat', price: 80, category: 'lunch', imageUrl: '/photos/rice-curry.jpg', available: true, outOfStock: false, rating: 0, totalRatings: 0, createdAt: new Date(), updatedAt: new Date() },
  { id: '2', name: 'Parota', description: '3 Parota, Dhal Curry and Coconut Sambal', price: 100, category: 'breakfast', imageUrl: '/photos/parota.jpg', available: true, outOfStock: false, rating: 0, totalRatings: 0, createdAt: new Date(), updatedAt: new Date() },
  { id: '3', name: 'Pittu', description: 'Pittu and Curry', price: 100, category: 'breakfast', imageUrl: '/photos/pittu.jpg', available: true, outOfStock: false, rating: 0, totalRatings: 0, createdAt: new Date(), updatedAt: new Date() },
  { id: '4', name: 'Fried Rice', description: 'Egg Fried Rice with Soy Sauce', price: 150, category: 'lunch', imageUrl: '/photos/fried-rice.jpg', available: true, outOfStock: false, rating: 0, totalRatings: 0, createdAt: new Date(), updatedAt: new Date() },
  { id: '5', name: 'Tea', description: 'Ceylon Milk Tea', price: 20, category: 'beverages', imageUrl: '/photos/tea.jpg', available: true, outOfStock: false, rating: 0, totalRatings: 0, createdAt: new Date(), updatedAt: new Date() },
  { id: '6', name: 'Devilled Chilli', description: 'Devilled Chicken with Chilli', price: 180, category: 'dinner', imageUrl: '/photos/chilli.jpg', available: true, outOfStock: false, rating: 0, totalRatings: 0, createdAt: new Date(), updatedAt: new Date() },
]

const CATEGORIES = [
  { id: 'all', label: 'All', icon: <UtensilsCrossed size={18} /> },
  { id: 'breakfast', label: 'Breakfast', icon: <Coffee size={18} /> },
  { id: 'lunch', label: 'Lunch', icon: <UtensilsCrossed size={18} /> },
  { id: 'dinner', label: 'Dinner', icon: <Moon size={18} /> },
  { id: 'snacks', label: 'Snacks', icon: <Cookie size={18} /> },
  { id: 'beverages', label: 'Beverages', icon: <CupSoda size={18} /> },
]

export default function MenuPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const [items, setItems] = useState<MenuItem[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [activeCategory, setActive] = useState('all')
  const [loading, setLoading] = useState(true)
  const [isLive, setIsLive] = useState(false)
  const [selectedItem, setSelected] = useState<MenuItem | null>(null)

  /* ── Real-time Supabase listener ── */
  useEffect(() => {
    setLoading(true)

    const fetchItems = async () => {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*');

      if (error) {
        console.error("Menu Fetch Error:", error)
        setItems(DEMO_ITEMS)
        setIsLive(false)
      } else if (data && data.length > 0) {
        // Sanitize legacy placeholder ratings (4.8, 4.3, 10, 3 etc.)
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
        setIsLive(true)
      }
      setLoading(false)
    }

    fetchItems()

    const subscription = supabase
      .channel('public:menu_items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => {
        fetchItems()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [])

  /* ── Restore cart from session ── */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('cart')
      if (raw) setCart(JSON.parse(raw))
    } catch { }
  }, [])

  const filtered = items.filter(item => {
    const matchCat = activeCategory === 'all' || item.category === activeCategory
    const matchQ = item.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchQ
  })

  // Available (not out of stock) vs unavailable
  const available = filtered.filter(i => i.available && !i.outOfStock)
  const unavailable = filtered.filter(i => !i.available || i.outOfStock)

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)
  const cartTotal = cart.reduce((s, i) => s + i.menuItem.price * i.quantity, 0)

  function addToCart(item: MenuItem) {
    if (!item.available || item.outOfStock) return
    setCart(prev => {
      const updated = prev.find(c => c.menuItem.id === item.id)
        ? prev.map(c => c.menuItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
        : [...prev, { menuItem: item, quantity: 1 }]
      sessionStorage.setItem('cart', JSON.stringify(updated))
      return updated
    })
  }

  function removeOne(item: MenuItem) {
    setCart(prev => {
      const updated = prev
        .map(c => c.menuItem.id === item.id ? { ...c, quantity: c.quantity - 1 } : c)
        .filter(c => c.quantity > 0)
      sessionStorage.setItem('cart', JSON.stringify(updated))
      return updated
    })
  }

  function getQty(id: string) {
    return cart.find(c => c.menuItem.id === id)?.quantity ?? 0
  }

  function goCheckout() {
    sessionStorage.setItem('cart', JSON.stringify(cart))
    router.push('/checkout')
  }

  return (
    <div className="bg-gray-50 has-bottom-nav min-h-screen">

      {/* Header */}
      <div className="bg-white px-5 pt-14 pb-4 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-extrabold text-gray-900">Campus Canteen</h1>
          {/* Live indicator */}
          <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold',
            isLive ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400')}>
            {isLive
              ? <><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> Live</>
              : <><WifiOff size={11} /> Demo</>
            }
          </div>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search for food or drinks"
              className="input-field pl-10 text-sm py-3" />
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-3 px-5 py-3 overflow-x-auto scrollbar-hide bg-white border-b border-gray-100">
        {CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => setActive(cat.id)}
            className={cn('flex flex-col items-center gap-1 shrink-0 px-3 py-2 rounded-2xl transition-all',
              activeCategory === cat.id ? 'text-primary' : 'text-gray-400')}>
            <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center',
              activeCategory === cat.id ? 'bg-primary text-white shadow-primary' : 'bg-gray-100')}>
              {cat.icon}
            </div>
            <span className={cn('text-[11px] font-bold whitespace-nowrap',
              activeCategory === cat.id ? 'text-primary' : 'text-gray-500')}>
              {cat.label}
            </span>
          </button>
        ))}
      </div>

      <div className="px-5 py-4">

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-3xl h-48 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Available items */}
            {available.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Recommended for You</h2>
                  <button className="text-sm text-primary font-bold">View all</button>
                </div>
                <div className="space-y-4">
                  {available.map(item => (
                    <FoodCard key={item.id} item={item}
                      qty={getQty(item.id)}
                      onAdd={() => addToCart(item)}
                      onRemove={() => removeOne(item)}
                      onSelect={() => setSelected(item)} />
                  ))}
                </div>
              </>
            )}

            {/* Unavailable items */}
            {unavailable.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-base font-bold text-gray-400">Currently Unavailable</h2>
                  <span className="bg-gray-100 text-gray-400 text-xs font-bold px-2 py-0.5 rounded-lg">
                    {unavailable.length}
                  </span>
                </div>
                <div className="space-y-4 opacity-60">
                  {unavailable.map(item => (
                    <FoodCard key={item.id} item={item}
                      qty={0} onAdd={() => { }} onRemove={() => { }} onSelect={() => setSelected(item)} />
                  ))}
                </div>
              </div>
            )}

            {/* Empty */}
            {filtered.length === 0 && (
              <div className="flex flex-col items-center py-16 text-center">
                <UtensilsCrossed size={48} className="text-gray-300 mb-3" />
                <p className="text-gray-500 font-semibold">No items found</p>
                <p className="text-gray-400 text-sm mt-1">Try a different category or search</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Cart Bottom Bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-[calc(100%-2.5rem)] max-w-[390px] z-40">
          <button onClick={goCheckout} className="btn-primary flex items-center justify-between px-5">
            <span className="bg-white/20 rounded-xl px-2.5 py-0.5 text-sm font-bold">{cartCount}</span>
            <span>View Basket</span>
            <span className="font-extrabold">{formatPrice(cartTotal)}</span>
          </button>
        </div>
      )}

      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          onClose={() => setSelected(null)}
          onAddToCart={() => addToCart(selectedItem)}
        />
      )}

      <CustomerBottomNav />
    </div>
  )
}

/* ── Food Card ── */
function FoodCard({ item, qty, onAdd, onRemove, onSelect }: {
  item: MenuItem; qty: number; onAdd: () => void; onRemove: () => void; onSelect: () => void
}) {
  const isUnavailable = !item.available || item.outOfStock
  return (
    <div className="bg-white rounded-3xl shadow-card overflow-hidden active:scale-[0.98] transition-transform"
      onClick={onSelect}>
      <div className="relative w-full h-44 bg-gray-200 cursor-pointer">
        <img src={item.imageUrl} alt={item.name}
          className={cn('w-full h-full object-cover', isUnavailable && 'grayscale opacity-60')}
          onError={e => { (e.target as HTMLImageElement).src = '/photos/placeholder.jpg' }} />
        {/* Status badge */}
        {isUnavailable ? (
          <div className="absolute top-3 right-3 bg-gray-700/80 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-xl">
            {item.outOfStock ? 'Out of Stock' : 'Unavailable'}
          </div>
        ) : (
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-xl px-2 py-1 flex items-center gap-1 shadow-sm">
            <Star size={11} className={cn("text-primary", (item.rating || 0) > 0 && "fill-primary")} />
            <span className="text-xs font-bold text-gray-900">
              {(item.rating || 0) > 0 ? item.rating : 'New'}
            </span>
            {(item.totalRatings || 0) > 0 && (item.rating || 0) > 0 && (
              <span className="text-[9px] text-gray-400 font-medium">({item.totalRatings})</span>
            )}
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-bold text-gray-900 text-base">{item.name}</h3>
        <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">{item.description}</p>

        <div className="flex items-center justify-between mt-3">
          <span className="text-primary font-extrabold text-base">{formatPrice(item.price)}</span>

          {isUnavailable ? (
            <span className="text-xs text-gray-400 font-semibold bg-gray-100 px-3 py-2 rounded-xl">
              Not Available
            </span>
          ) : qty === 0 ? (
            <button onClick={(e) => { e.stopPropagation(); onAdd(); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-primary text-white shadow-primary active:scale-95 transition-all">
              <Plus size={14} /> Add to Cart
            </button>
          ) : (
            <div className="flex items-center gap-3 bg-primary/10 rounded-xl px-3 py-1.5" onClick={e => e.stopPropagation()}>
              <button onClick={onRemove} className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-lg leading-none">−</button>
              <span className="text-primary font-extrabold text-base w-4 text-center">{qty}</span>
              <button onClick={onAdd} className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-lg leading-none">+</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
