'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
  color?: string
}

interface CustomSelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  disabled?: boolean
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  className,
  disabled = false,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState({ top: 0, left: 0, width: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const selected = options.find(o => o.value === value)

  // Calculate dropdown position from button's viewport rect
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    setDropdownStyle({
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
      width: rect.width,
    })
  }, [])

  const handleOpen = () => {
    if (disabled) return
    updatePosition()
    setOpen(v => !v)
  }

  // Close on outside click or scroll
  useEffect(() => {
    if (!open) return
    function handleClose(e: MouseEvent | Event) {
      if (e instanceof MouseEvent && buttonRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClose)
    window.addEventListener('scroll', handleClose, true)
    return () => {
      document.removeEventListener('mousedown', handleClose)
      window.removeEventListener('scroll', handleClose, true)
    }
  }, [open])

  const dropdown = (
    <div
      style={{
        position: 'absolute',
        top: dropdownStyle.top,
        left: dropdownStyle.left,
        width: dropdownStyle.width,
        zIndex: 9999,
      }}
      className="bg-white border border-gray-200 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.15)] overflow-hidden"
    >
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onMouseDown={e => {
            e.preventDefault()
            onChange(opt.value)
            setOpen(false)
          }}
          className={cn(
            'w-full flex items-center justify-between gap-3 px-4 py-3 text-sm font-bold transition-colors text-left border-b border-gray-50 last:border-0',
            opt.value === value
              ? 'bg-primary/10 text-primary'
              : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100'
          )}
        >
          <span className="flex items-center gap-2">
            {opt.color && (
              <span className={cn('w-2 h-2 rounded-full shrink-0', opt.color)} />
            )}
            {opt.label}
          </span>
          {opt.value === value && <Check size={14} className="text-primary shrink-0" />}
        </button>
      ))}
    </div>
  )

  return (
    <div className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl border-2 bg-white text-sm font-bold transition-all',
          open
            ? 'border-primary shadow-[0_0_0_3px_rgba(244,161,27,0.15)]'
            : 'border-gray-200 hover:border-primary/50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span className="flex items-center gap-2">
          {selected?.color && (
            <span className={cn('w-2 h-2 rounded-full shrink-0', selected.color)} />
          )}
          <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
            {selected?.label ?? placeholder}
          </span>
        </span>
        <ChevronDown
          size={16}
          className={cn(
            'text-primary shrink-0 transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>

      {/* Rendered into document.body via portal — escapes all overflow:hidden containers */}
      {open && typeof document !== 'undefined' && createPortal(dropdown, document.body)}
    </div>
  )
}
