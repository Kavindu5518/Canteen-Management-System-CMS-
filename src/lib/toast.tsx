'use client'
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
}

interface ToastContextType {
  showToast: (type: ToastType, message: string) => void
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  const dismiss = (id: string) => setToasts(prev => prev.filter(t => t.id !== id))

  const config: Record<ToastType, { icon: React.ReactNode; border: string; iconBg: string; text: string }> = {
    success: {
      icon: <CheckCircle2 size={16} className="text-green-400" />,
      border: 'border-green-500/30',
      iconBg: 'bg-green-500/20',
      text: 'text-green-300',
    },
    error: {
      icon: <XCircle size={16} className="text-red-400" />,
      border: 'border-red-500/30',
      iconBg: 'bg-red-500/20',
      text: 'text-red-300',
    },
    warning: {
      icon: <AlertTriangle size={16} className="text-amber-400" />,
      border: 'border-amber-500/30',
      iconBg: 'bg-amber-500/20',
      text: 'text-amber-300',
    },
    info: {
      icon: <Info size={16} className="text-blue-400" />,
      border: 'border-blue-500/30',
      iconBg: 'bg-blue-500/20',
      text: 'text-blue-300',
    },
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast Container */}
      <div className="fixed bottom-24 left-0 right-0 z-[999] flex flex-col items-center gap-2 px-4 pointer-events-none">
        {toasts.map((toast) => {
          const c = config[toast.type]
          return (
            <div
              key={toast.id}
              className={cn(
                'flex items-center gap-3 px-4 py-3.5 rounded-2xl shadow-2xl border bg-gray-900 pointer-events-auto w-full max-w-sm',
                'animate-in slide-in-from-bottom-4 fade-in duration-300',
                c.border
              )}
            >
              <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0', c.iconBg)}>
                {c.icon}
              </div>
              <p className={cn('text-sm font-semibold flex-1 leading-snug', c.text)}>
                {toast.message}
              </p>
              <button
                onClick={() => dismiss(toast.id)}
                className="text-gray-600 hover:text-gray-300 transition-colors shrink-0 ml-1"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
