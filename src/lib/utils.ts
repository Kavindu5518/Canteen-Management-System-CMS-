import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(amount?: number): string {
  return `Rs.${(amount ?? 0).toLocaleString()}`
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = date instanceof Date ? date : new Date(date)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-LK', {
    day: '2-digit', month: 'short', year: 'numeric'
  }).format(d)
}

export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = date instanceof Date ? date : new Date(date)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-LK', {
    hour: '2-digit', minute: '2-digit', hour12: true
  }).format(d)
}

export function getOrderStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending:   'badge-pending',
    preparing: 'badge-preparing',
    ready:     'badge-ready',
    delivered: 'badge-delivered',
    cancelled: 'bg-red-100 text-red-700',
  }
  return map[status] ?? 'bg-gray-100 text-gray-600'
}
