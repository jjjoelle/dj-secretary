import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

// Shared button / input class strings.
export const btn = {
  primary:
    'inline-flex items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent2 disabled:cursor-not-allowed disabled:opacity-40',
  ghost:
    'inline-flex items-center justify-center gap-1.5 rounded-md border border-edge bg-panel2 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-edge disabled:opacity-40',
  danger:
    'inline-flex items-center justify-center gap-1.5 rounded-md border border-rose-900/60 bg-rose-950/40 px-3 py-1.5 text-sm text-rose-300 transition hover:bg-rose-900/40',
}

export const inputCls =
  'w-full rounded-md border border-edge bg-ink px-2.5 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-accent focus:outline-none'

export const labelCls = 'mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400'

export function Modal({
  open,
  onClose,
  title,
  children,
  maxW = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  maxW?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 w-full ${maxW} rounded-xl border border-edge bg-panel shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-edge px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-zinc-400 transition hover:bg-edge hover:text-zinc-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export function TagInput({
  value,
  onChange,
  placeholder = 'Add tag…',
}: {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const t = draft.trim()
    if (t && !value.includes(t)) onChange([...value, t])
    setDraft('')
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-edge bg-ink px-2 py-1.5">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded bg-accent/15 px-1.5 py-0.5 text-xs text-violet-200"
        >
          {tag}
          <button
            onClick={() => onChange(value.filter((x) => x !== tag))}
            className="text-violet-300/70 hover:text-white"
            aria-label={`Remove ${tag}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            add()
          } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
            onChange(value.slice(0, -1))
          }
        }}
        onBlur={add}
        placeholder={value.length === 0 ? placeholder : ''}
        className="min-w-[6rem] flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
      />
    </div>
  )
}

export function RatingInput({
  value,
  onChange,
}: {
  value?: number
  onChange: (v: number | undefined) => void
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => onChange(value === n ? undefined : n)}
          className="text-lg leading-none text-amber-400 transition hover:scale-110"
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          {n <= (value ?? 0) ? '★' : <span className="text-zinc-600">★</span>}
        </button>
      ))}
    </div>
  )
}

export function Stars({ value }: { value?: number }) {
  if (!value) return <span className="text-xs text-zinc-600">unrated</span>
  return (
    <span className="text-xs text-amber-400" title={`${value}/5`}>
      {'★'.repeat(value)}
      <span className="text-zinc-700">{'★'.repeat(5 - value)}</span>
    </span>
  )
}
