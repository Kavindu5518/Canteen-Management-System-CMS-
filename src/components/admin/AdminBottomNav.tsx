'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, UtensilsCrossed, ClipboardList, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/admin/dashboard', label: 'Dash',   icon: LayoutDashboard },
  { href: '/admin/menu',      label: 'Menu',   icon: UtensilsCrossed },
  { href: '/admin/orders',    label: 'Orders', icon: ClipboardList },
  { href: '/admin/reports',   label: 'Reports',icon: BarChart3 },
]

export default function AdminBottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-mobile bg-white border-t border-gray-100 z-50 safe-bottom">
      <div className="flex items-center justify-around px-4 py-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link key={href} href={href}
              className={cn('flex flex-col items-center gap-1 px-5 py-1.5 rounded-2xl transition-all',
                active ? 'text-primary' : 'text-gray-400 hover:text-gray-600')}>
              <Icon size={22} strokeWidth={active ? 2.5 : 2} />
              <span className={cn('text-[11px] font-semibold tracking-wide', active && 'text-primary')}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
