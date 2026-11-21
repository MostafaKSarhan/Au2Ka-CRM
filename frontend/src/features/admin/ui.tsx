import React from 'react';
import { Search, X } from 'lucide-react';

/** Shared building blocks for the master-data screens, so each tab stays short. */

export function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
      <div className="flex items-center gap-2.5">
        <span className="rounded-lg bg-primary/15 p-2 text-primary">
          <Icon size={18} />
        </span>
        <div>
          <h2 className="text-lg font-bold text-white">{title}</h2>
          {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
  required,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-zinc-400">
        {label}
        {required && <span className="ms-1 text-primary">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-zinc-600">{hint}</p>}
    </div>
  );
}

const controlClass =
  'w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-primary/60';

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${controlClass} ${props.className || ''}`} />;
}

/**
 * The search box every master-data tab uses, so the magnifier sits on the
 * right in Arabic and on the left in English without each tab repeating the
 * positioning.
 */
export function SearchBox({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <Search size={16} className="absolute top-1/2 start-3 -translate-y-1/2 text-zinc-600" />
      <TextInput
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="ps-9"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="clear"
          className="absolute top-1/2 end-3 -translate-y-1/2 text-zinc-600 transition hover:text-white"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${controlClass} ${props.className || ''}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${controlClass} cursor-pointer ${props.className || ''}`} />;
}

export function PrimaryButton({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 ${rest.className || ''}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50 ${rest.className || ''}`}
    >
      {children}
    </button>
  );
}

export function IconButton({
  children,
  tone = 'default',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'default' | 'danger' }) {
  const toneClass =
    tone === 'danger'
      ? 'text-zinc-500 hover:text-red-400'
      : 'text-zinc-500 hover:text-primary';
  return (
    <button
      {...rest}
      className={`cursor-pointer rounded p-1.5 transition ${toneClass} ${rest.className || ''}`}
    >
      {children}
    </button>
  );
}

export function Banner({ message }: { message: string }) {
  if (!message) return null;
  const isError = message.startsWith('❌');
  return (
    <div
      className={`rounded-lg border p-2.5 text-xs font-bold ${
        isError
          ? 'border-red-500/20 bg-red-500/10 text-red-400'
          : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
      }`}
    >
      {message}
    </div>
  );
}

export function StatusPill({ active, activeText, inactiveText }: { active: boolean; activeText: string; inactiveText: string }) {
  return (
    <span
      className={`rounded border px-2 py-0.5 text-[11px] font-bold ${
        active
          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
          : 'border-zinc-700 bg-zinc-800/60 text-zinc-500'
      }`}
    >
      {active ? activeText : inactiveText}
    </span>
  );
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <div className="glass-panel mt-10 w-full max-w-lg rounded-xl p-6">
        <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button onClick={onClose} className="cursor-pointer text-zinc-500 transition hover:text-white">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function TableShell({
  headers,
  children,
  empty,
  isEmpty,
  loading,
  loadingText,
}: {
  headers: string[];
  children: React.ReactNode;
  empty: string;
  isEmpty: boolean;
  loading: boolean;
  loadingText: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-xs text-zinc-500">
            {headers.map(h => (
              <th key={h} className="px-3 py-2 text-start font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={headers.length} className="px-3 py-8 text-center text-zinc-500">
                {loadingText}
              </td>
            </tr>
          ) : isEmpty ? (
            <tr>
              <td colSpan={headers.length} className="px-3 py-8 text-center text-zinc-500">
                {empty}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}
