'use client'
import { createContext, useContext, useState, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextType>({
  confirm: () => Promise.resolve(false),
})

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [resolveFn, setResolveFn] = useState<((value: boolean) => void) | null>(null)

  const confirm = (opts: ConfirmOptions) => {
    setOptions(opts)
    setIsOpen(true)
    return new Promise<boolean>((resolve) => {
      setResolveFn(() => resolve)
    })
  }

  const handleConfirm = () => {
    resolveFn?.(true)
    setIsOpen(false)
  }

  const handleCancel = () => {
    resolveFn?.(false)
    setIsOpen(false)
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {isOpen && options && (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-5">
                <AlertTriangle size={24} className="text-amber-500" />
              </div>
              <h3 className="text-lg font-black text-gray-900 leading-tight">
                {options.title}
              </h3>
              <p className="text-sm text-gray-400 mt-2 font-medium leading-relaxed">
                {options.message}
              </p>
              <div className="mt-8 flex gap-3">
                <button
                  onClick={handleCancel}
                  className="flex-1 py-4 border border-gray-100 hover:bg-gray-50 rounded-2xl font-black uppercase text-[11px] tracking-widest text-gray-400 transition-all active:scale-95"
                >
                  {options.cancelText || 'Cancel'}
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 py-4 bg-gray-900 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-gray-800 transition-all active:scale-95 shadow-lg shadow-gray-950/10"
                >
                  {options.confirmText || 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export const useConfirm = () => useContext(ConfirmContext)
