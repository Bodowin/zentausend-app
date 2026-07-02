// Kleine UI-Bausteine des Cockpits: Karten, Stat-Kacheln, Badges, Buttons,
// Modals und Formularfelder – konsistent im „Aurum“-Theme.

import { useEffect, type ReactNode } from 'react'

export function Card({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title?: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`card p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-mute">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function Stat({
  label,
  value,
  delta,
  deltaGood,
  spark,
}: {
  label: string
  value: string
  delta?: string
  /** Färbung des Deltas: true = Gewinnfarbe, false = Verlustfarbe */
  deltaGood?: boolean
  spark?: ReactNode
}) {
  return (
    <div className="card flex items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <div className="text-xs text-ink-mute">{label}</div>
        <div className="mt-1 truncate text-xl font-semibold text-ink">{value}</div>
        {delta && (
          <div
            className={`mt-0.5 text-xs font-medium ${
              deltaGood === undefined ? 'text-ink-soft' : deltaGood ? 'text-gain' : 'text-loss'
            }`}
          >
            {delta}
          </div>
        )}
      </div>
      {spark && <div className="shrink-0">{spark}</div>}
    </div>
  )
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'gain' | 'loss' | 'warn' | 'aurum'
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-raised text-ink-soft',
    gain: 'bg-gain/15 text-gain',
    loss: 'bg-loss/15 text-loss',
    warn: 'bg-warn/15 text-warn',
    aurum: 'bg-aurum/15 text-aurum',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  type = 'button',
  small,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'danger'
  disabled?: boolean
  type?: 'button' | 'submit'
  small?: boolean
}) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
  const size = small ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
  const variants: Record<string, string> = {
    primary: 'bg-aurum text-abyss hover:bg-aurum-soft',
    ghost: 'bg-raised text-ink hover:bg-edge border border-edge',
    danger: 'bg-loss/15 text-loss hover:bg-loss/25',
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${size} ${variants[variant]}`}>
      {children}
    </button>
  )
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-abyss/80 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className={`card max-h-[92vh] w-full overflow-y-auto rounded-b-none p-5 sm:rounded-2xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-mute hover:bg-raised hover:text-ink"
            aria-label="Schließen"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-mute">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-xl border border-edge bg-inset px-3 py-2 text-sm text-ink placeholder:text-ink-mute focus:border-aurum focus:outline-none'

/** wie inputClass, aber nur so breit wie der Inhalt (Filterzeilen, Header) */
export const selectCompactClass = inputClass.replace('w-full', 'w-auto max-w-56')

export function NumberInput({
  value,
  onChange,
  step = 1,
  min,
  max,
  suffix,
}: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  suffix?: string
}) {
  return (
    <div className="relative">
      <input
        type="number"
        className={`${inputClass} tnum ${suffix ? 'pr-10' : ''}`}
        value={Number.isFinite(value) ? value : ''}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-ink-mute">
          {suffix}
        </span>
      )}
    </div>
  )
}

export function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.1,
  format,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  format: (v: number) => string
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-medium text-ink-soft">{label}</span>
        <span className="tnum font-semibold text-aurum">{format(value)}</span>
      </div>
      <input
        type="range"
        className="w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  )
}

export function EmptyState({ icon, title, hint, action }: { icon: string; title: string; hint: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <div className="text-3xl">{icon}</div>
      <div className="text-sm font-medium text-ink">{title}</div>
      <div className="max-w-sm text-xs text-ink-mute">{hint}</div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function UpDown({ value }: { value: number }) {
  if (!Number.isFinite(value) || value === 0) return null
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" className="inline-block" aria-hidden>
      {value > 0 ? (
        <path d="M5 1.5l3.5 5h-7z" fill="var(--color-gain)" />
      ) : (
        <path d="M5 8.5l-3.5-5h7z" fill="var(--color-loss)" />
      )}
    </svg>
  )
}
