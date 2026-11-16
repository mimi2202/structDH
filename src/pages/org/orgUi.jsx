// Building blocks for the organisation pages: a technical, data-dense look
// (thin rules, numbered panels, monospace codes and timestamps).
import React, { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { FiX, FiAlertTriangle, FiInfo, FiCheckCircle } from 'react-icons/fi'
import { roleLabel } from '../../utils/orgRbac'

export function Panel({ index, title, actions, children, className = '', bodyClass = 'p-4' }) {
  return (
    <section className={`rounded-md border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1f2937] ${className}`}>
      {(title || actions) && (
        <header className="flex min-h-[44px] flex-wrap items-center justify-between gap-2 border-b border-[#e2e8f0] dark:border-[#334155] px-4 py-2">
          <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#475569] dark:text-[#94a3b8]">
            {index && <span className="font-mono text-[#0A2F44] dark:text-[#66a4c2]">{index}</span>}
            {title}
          </h3>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  )
}

const ROLE_STYLE = {
  owner: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300',
  admin: 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300',
  editor: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300',
  member: 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/10 dark:text-slate-300',
}

export function RoleBadge({ role }) {
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${ROLE_STYLE[role] || ROLE_STYLE.member}`}>
      {roleLabel(role)}
    </span>
  )
}

export function StatusTag({ status }) {
  const invited = status === 'invited'
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider ${invited ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${invited ? 'bg-amber-500' : 'bg-emerald-500'}`} />
      {invited ? 'Invited' : 'Active'}
    </span>
  )
}

const BTN = {
  primary: 'bg-[#0A2F44] text-white hover:bg-[#0d3a54] dark:bg-[#66a4c2] dark:text-[#0b1620] dark:hover:bg-[#7db3cd]',
  secondary: 'border border-[#cbd5e1] dark:border-[#475569] text-[#0F172A] dark:text-white hover:bg-[#f1f5f9] dark:hover:bg-[#334155]',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  dangerOutline: 'border border-red-300 dark:border-red-500/50 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10',
  ghost: 'text-[#475569] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#334155]',
}

export function Btn({ variant = 'secondary', size = 'md', className = '', children, ...props }) {
  const sz = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm'
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${sz} ${BTN[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

// The label points at the control by id (not by wrapping it: a wrapping
// <label> re-fires clicks on a Dropdown's button, so it opened and closed).
export function Field({ label, hint, error, children }) {
  const id = useId()
  const child = React.isValidElement(children) ? React.cloneElement(children, { id: children.props.id || id }) : children
  return (
    <div className="block">
      {label && <label htmlFor={id} className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#475569] dark:text-[#94a3b8]">{label}</label>}
      {child}
      {error ? <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{error}</span>
        : hint ? <span className="mt-1 block text-xs text-[#64748b] dark:text-[#94a3b8]">{hint}</span> : null}
    </div>
  )
}

export function TextInput({ className = '', mono = false, ...props }) {
  return (
    <input
      className={`w-full rounded border border-[#cbd5e1] dark:border-[#475569] bg-white dark:bg-[#0f172a] px-3 py-2 text-sm text-[#0F172A] dark:text-white placeholder:text-[#94a3b8] focus:border-[#0A2F44] dark:focus:border-[#66a4c2] focus:outline-none focus:ring-2 focus:ring-[#0A2F44]/15 disabled:opacity-60 ${mono ? 'font-mono' : ''} ${className}`}
      {...props}
    />
  )
}

export function TextArea({ className = '', ...props }) {
  return (
    <textarea
      className={`w-full rounded border border-[#cbd5e1] dark:border-[#475569] bg-white dark:bg-[#0f172a] px-3 py-2 text-sm text-[#0F172A] dark:text-white placeholder:text-[#94a3b8] focus:border-[#0A2F44] dark:focus:border-[#66a4c2] focus:outline-none focus:ring-2 focus:ring-[#0A2F44]/15 disabled:opacity-60 ${className}`}
      {...props}
    />
  )
}

const NOTICE = {
  info: ['border-[#bfd7e4] bg-[#f0f7fb] text-[#0A2F44] dark:border-[#1e3a4a] dark:bg-[#132b3a] dark:text-[#cce1eb]', FiInfo],
  warn: ['border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200', FiAlertTriangle],
  error: ['border-red-300 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300', FiAlertTriangle],
  ok: ['border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300', FiCheckCircle],
}

export function Notice({ tone = 'info', children, className = '' }) {
  const [cls, Icon] = NOTICE[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded border px-3 py-2 text-sm ${cls} ${className}`}>
      <Icon className="mt-0.5 flex-shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function Modal({ title, onClose, children, footer, width = 'max-w-lg' }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`w-full ${width} rounded-md border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1f2937] shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-[#e2e8f0] dark:border-[#334155] px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#0F172A] dark:text-white">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-[#64748b] hover:bg-[#f1f5f9] dark:hover:bg-[#334155]"><FiX /></button>
        </div>
        <div className="space-y-4 px-4 py-4 text-sm text-[#334155] dark:text-[#cbd5e1]">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-[#e2e8f0] dark:border-[#334155] px-4 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

// Square monogram for an organisation.
export function OrgMark({ name, size = 'md' }) {
  const letters = String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  const sz = size === 'lg' ? 'h-14 w-14 text-lg' : size === 'sm' ? 'h-8 w-8 text-[11px]' : 'h-10 w-10 text-sm'
  return (
    <div className={`${sz} flex flex-shrink-0 items-center justify-center rounded border border-white/25 bg-white/10 font-mono font-bold tracking-wider text-white`}>
      {letters}
    </div>
  )
}

export function Th({ children, className = '' }) {
  return <th className={`px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b] dark:text-[#94a3b8] ${className}`}>{children}</th>
}

export function Empty({ children }) {
  return <div className="px-4 py-10 text-center font-mono text-xs uppercase tracking-wider text-[#94a3b8]">{children}</div>
}

// "Type "<name>" to confirm" label. Field labels are uppercase; the name keeps
// its exact case, because the confirmation is case-sensitive.
export function ConfirmLabel({ name }) {
  return (
    <>
      Type <span data-confirm-name className="rounded bg-[#f1f5f9] dark:bg-[#0f172a] px-1 font-mono normal-case tracking-normal text-[#0F172A] dark:text-white">{name}</span> to confirm (case-sensitive)
    </>
  )
}

// Heading for a group of separate cards (no surrounding box).
export function SectionHeading({ index, title, actions }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#475569] dark:text-[#94a3b8]">
        {index && <span className="font-mono text-[#0A2F44] dark:text-[#66a4c2]">{index}</span>}
        {title}
      </h3>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

// One card in a card grid: its own border, radius and hover lift.
export const CARD_CLASS = 'rounded-xl border border-[#e2e8f0] bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#0A2F44]/40 hover:shadow-md dark:border-[#334155] dark:bg-[#1f2937] dark:hover:border-[#66a4c2]/50'
