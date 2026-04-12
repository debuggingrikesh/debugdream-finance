import { forwardRef, useState } from 'react'
import { X, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import clsx from 'clsx'

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, className, onClick, hover = false, glow = false }) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-[#111111] border border-[#2a2a2a] rounded-xl',
        hover && 'cursor-pointer transition-all duration-200 hover:border-[#444] hover:bg-[#161616]',
        glow && 'hover:shadow-[0_0_20px_rgba(232,25,44,0.1)]',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, icon: Icon, accent = false, trend = null, loading = false }) {
  return (
    <Card className="p-5" hover glow={accent}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-body text-[#555] uppercase tracking-widest">{label}</span>
        {Icon && (
          <div className={clsx(
            'w-8 h-8 rounded-lg flex items-center justify-center',
            accent ? 'bg-[#E8192C]/10 text-[#E8192C]' : 'bg-[#1a1a1a] text-[#555]'
          )}>
            <Icon size={16} />
          </div>
        )}
      </div>
      {loading ? (
        <div className="h-8 bg-[#1a1a1a] rounded animate-pulse" />
      ) : (
        <div className={clsx('font-display text-xl font-bold', accent ? 'text-[#E8192C]' : 'text-white')}>
          {value}
        </div>
      )}
      {sub && <div className="mt-1 text-xs text-[#555] font-body">{sub}</div>}
      {trend !== null && (
        <div className={clsx('mt-1 text-xs font-mono', trend >= 0 ? 'text-green-400' : 'text-red-400')}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
        </div>
      )}
    </Card>
  )
}

// ─── Button ───────────────────────────────────────────────────────────────────
export function Button({ children, onClick, variant = 'primary', size = 'md', disabled = false, loading = false, className = '', type = 'button', icon: Icon }) {
  const variants = {
    primary: 'bg-[#E8192C] hover:bg-[#ff2233] text-white border-transparent',
    secondary: 'bg-[#1a1a1a] hover:bg-[#222] text-white border-[#2a2a2a]',
    ghost: 'bg-transparent hover:bg-[#1a1a1a] text-[#888] hover:text-white border-transparent',
    danger: 'bg-[#ef4444] hover:bg-[#dc2626] text-white border-transparent',
    outline: 'bg-transparent hover:bg-[#1a1a1a] text-white border-[#2a2a2a]',
    success: 'bg-[#22c55e] hover:bg-[#16a34a] text-white border-transparent',
  }
  const sizes = {
    xs: 'px-2.5 py-1 text-xs gap-1',
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center rounded-lg border font-body font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : Icon && <Icon size={14} />}
      {children}
    </button>
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────────
export function Badge({ children, variant = 'default', size = 'sm' }) {
  const variants = {
    default: 'bg-[#1a1a1a] text-[#888] border-[#2a2a2a]',
    success: 'bg-green-500/10 text-green-400 border-green-500/20',
    warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    danger: 'bg-red-500/10 text-red-400 border-red-500/20',
    info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    accent: 'bg-[#E8192C]/10 text-[#E8192C] border-[#E8192C]/20',
  }
  return (
    <span className={clsx(
      'inline-flex items-center border rounded-md font-body font-medium',
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
      variants[variant]
    )}>
      {children}
    </span>
  )
}

// ─── Input ────────────────────────────────────────────────────────────────────
export const Input = forwardRef(({ label, error, prefix, suffix, className = '', wrapperClass = '', ...props }, ref) => {
  return (
    <div className={clsx('flex flex-col gap-1', wrapperClass)}>
      {label && <label className="text-xs text-[#888] font-body font-medium uppercase tracking-wider">{label}</label>}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-sm text-[#555] font-mono pointer-events-none">{prefix}</span>
        )}
        <input
          ref={ref}
          className={clsx(
            'w-full bg-[#1a1a1a] border rounded-lg text-white font-body text-sm placeholder-[#333]',
            'focus:outline-none focus:ring-1 focus:ring-[#E8192C] focus:border-[#E8192C]',
            'transition-colors duration-150',
            error ? 'border-red-500' : 'border-[#2a2a2a]',
            prefix ? 'pl-8' : 'pl-3',
            suffix ? 'pr-8' : 'pr-3',
            'py-2',
            className
          )}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 text-sm text-[#555] font-mono pointer-events-none">{suffix}</span>
        )}
      </div>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
})
Input.displayName = 'Input'

// ─── Select ───────────────────────────────────────────────────────────────────
export const Select = forwardRef(({ label, error, children, className = '', wrapperClass = '', ...props }, ref) => {
  return (
    <div className={clsx('flex flex-col gap-1', wrapperClass)}>
      {label && <label className="text-xs text-[#888] font-body font-medium uppercase tracking-wider">{label}</label>}
      <select
        ref={ref}
        className={clsx(
          'w-full bg-[#1a1a1a] border rounded-lg text-white font-body text-sm',
          'focus:outline-none focus:ring-1 focus:ring-[#E8192C] focus:border-[#E8192C]',
          'transition-colors duration-150 px-3 py-2',
          error ? 'border-red-500' : 'border-[#2a2a2a]',
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
})
Select.displayName = 'Select'

// ─── Textarea ─────────────────────────────────────────────────────────────────
export const Textarea = forwardRef(({ label, error, className = '', wrapperClass = '', rows = 3, ...props }, ref) => {
  return (
    <div className={clsx('flex flex-col gap-1', wrapperClass)}>
      {label && <label className="text-xs text-[#888] font-body font-medium uppercase tracking-wider">{label}</label>}
      <textarea
        ref={ref}
        rows={rows}
        className={clsx(
          'w-full bg-[#1a1a1a] border rounded-lg text-white font-body text-sm placeholder-[#333]',
          'focus:outline-none focus:ring-1 focus:ring-[#E8192C] focus:border-[#E8192C]',
          'transition-colors duration-150 px-3 py-2 resize-none',
          error ? 'border-red-500' : 'border-[#2a2a2a]',
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
})
Textarea.displayName = 'Textarea'

// ─── Modal ────────────────────────────────────────────────────────────────────
export function Modal({ isOpen, onClose, title, children, size = 'md', footer }) {
  if (!isOpen) return null

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-6xl',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className={clsx(
        'relative w-full bg-[#111111] border border-[#2a2a2a] rounded-2xl shadow-[0_25px_50px_rgba(0,0,0,0.8)]',
        'flex flex-col max-h-[90vh]',
        sizes[size]
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a] shrink-0">
          <h2 className="font-display font-bold text-lg text-white">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-[#1a1a1a] hover:bg-[#222] flex items-center justify-center text-[#888] hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {/* Footer */}
        {footer && (
          <div className="p-5 border-t border-[#2a2a2a] shrink-0 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ConfirmDialog ────────────────────────────────────────────────────────────
export function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirm', variant = 'danger', loading = false }) {
  if (!isOpen) return null
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      }
    >
      <p className="text-[#888] font-body text-sm">{message}</p>
    </Modal>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center text-[#333] mb-4">
          <Icon size={28} />
        </div>
      )}
      <h3 className="font-display font-bold text-white text-lg mb-2">{title}</h3>
      <p className="text-[#555] text-sm font-body max-w-xs mb-6">{description}</p>
      {action}
    </div>
  )
}

// ─── Loading Spinner ──────────────────────────────────────────────────────────
export function Spinner({ size = 20 }) {
  return (
    <div className="flex items-center justify-center">
      <Loader2 size={size} className="animate-spin text-[#E8192C]" />
    </div>
  )
}

// ─── Toast/Alert ──────────────────────────────────────────────────────────────
export function Alert({ type = 'info', message, onClose }) {
  const config = {
    success: { icon: CheckCircle, className: 'bg-green-500/10 border-green-500/20 text-green-400' },
    error: { icon: AlertCircle, className: 'bg-red-500/10 border-red-500/20 text-red-400' },
    info: { icon: AlertCircle, className: 'bg-blue-500/10 border-blue-500/20 text-blue-400' },
    warning: { icon: AlertCircle, className: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' },
  }
  const { icon: Icon, className } = config[type] || config.info
  return (
    <div className={clsx('flex items-start gap-3 p-3 rounded-lg border text-sm font-body', className)}>
      <Icon size={16} className="shrink-0 mt-0.5" />
      <span className="flex-1">{message}</span>
      {onClose && <button onClick={onClose}><X size={14} /></button>}
    </div>
  )
}

// ─── Table ────────────────────────────────────────────────────────────────────
export function Table({ columns, data, onRowClick, emptyMessage = 'No data', loading = false }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 bg-[#1a1a1a] rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (!data?.length) {
    return (
      <div className="py-8 text-center text-[#555] text-sm font-body">{emptyMessage}</div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#2a2a2a]">
            {columns.map((col, i) => (
              <th
                key={i}
                className="pb-3 text-left text-xs text-[#555] font-body font-medium uppercase tracking-wider"
                style={{ textAlign: col.align || 'left' }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1a1a1a]">
          {data.map((row, ri) => (
            <tr
              key={row.id || ri}
              onClick={() => onRowClick?.(row)}
              className={clsx(
                'transition-colors duration-100',
                onRowClick && 'cursor-pointer hover:bg-[#1a1a1a]'
              )}
            >
              {columns.map((col, ci) => (
                <td
                  key={ci}
                  className="py-3 text-sm font-body text-[#888]"
                  style={{ textAlign: col.align || 'left' }}
                >
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────
export function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-white">{title}</h1>
        {subtitle && <p className="text-sm text-[#555] font-body mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

// ─── Amount Display ───────────────────────────────────────────────────────────
export function Amount({ value, positive = null, large = false, className = '' }) {
  const isPositive = positive !== null ? positive : value >= 0
  return (
    <span className={clsx(
      'font-mono',
      large ? 'text-2xl font-bold' : 'text-sm font-medium',
      isPositive ? 'text-white' : 'text-red-400',
      className
    )}>
      {value}
    </span>
  )
}

// ─── Source Badge ─────────────────────────────────────────────────────────────
export function SourceBadge({ source }) {
  return (
    <Badge variant={source === 'bank' ? 'info' : 'warning'}>
      {source === 'bank' ? '🏦 Bank' : '💵 Cash'}
    </Badge>
  )
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
export function ProgressBar({ value, max, color = '#E8192C', label = '', showPercent = true }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div>
      {(label || showPercent) && (
        <div className="flex justify-between text-xs font-body text-[#555] mb-1.5">
          <span>{label}</span>
          {showPercent && <span>{pct.toFixed(1)}%</span>}
        </div>
      )}
      <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

// ─── Divider ──────────────────────────────────────────────────────────────────
export function Divider({ label }) {
  if (!label) return <div className="border-t border-[#2a2a2a] my-4" />
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 border-t border-[#2a2a2a]" />
      <span className="text-xs text-[#555] font-body">{label}</span>
      <div className="flex-1 border-t border-[#2a2a2a]" />
    </div>
  )
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
export function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div className="relative">
        <input type="checkbox" className="sr-only" checked={checked} onChange={e => onChange(e.target.checked)} disabled={disabled} />
        <div className={clsx(
          'w-10 h-5 rounded-full transition-colors duration-200',
          checked ? 'bg-[#E8192C]' : 'bg-[#2a2a2a]',
          disabled && 'opacity-50 cursor-not-allowed'
        )} />
        <div className={clsx(
          'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200',
          checked && 'translate-x-5'
        )} />
      </div>
      {label && <span className="text-sm font-body text-[#888]">{label}</span>}
    </label>
  )
}
