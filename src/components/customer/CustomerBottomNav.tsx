'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UtensilsCrossed, ClipboardList, User, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/AuthContext'

export default function CustomerBottomNav() {
  const pathname = usePathname()
  const { userData } = useAuth()

  const isEmployee = userData?.role === 'employee'
  const isAdmin = userData?.role === 'admin'
  const isStaff = isEmployee || isAdmin
  const menuHref = isEmployee ? '/employee/menu' : isAdmin ? '/admin/menu' : '/menu'
  const ordersHref = isEmployee ? '/employee/dashboard' : isAdmin ? '/admin/dashboard' : '/orders'

  const navItems = [
    { href: menuHref, label: 'Menu', icon: UtensilsCrossed },
    { href: ordersHref, label: isStaff ? 'Dash' : 'Orders', icon: isStaff ? LayoutDashboard : ClipboardList },
    { href: '/profile', label: 'Profile', icon: User },
  ]

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-mobile bg-white border-t border-gray-100 z-50 safe-bottom">
      <div className="flex items-center justify-around px-4 py-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href)
          return (
            <Link
              key={label}
              href={href}
              className={cn(
                'flex flex-col items-center gap-1 px-5 py-1.5 rounded-2xl transition-all',
                active ? 'text-primary' : 'text-gray-400 hover:text-gray-600'
              )}
            >
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

