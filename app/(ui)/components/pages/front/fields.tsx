import type { ReactNode } from 'react';

const CONTROL =
  'w-full rounded-xl border bg-canvas px-4 py-3 text-[15px] text-ink placeholder:text-faint transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong';

const border = (error?: string) => (error ? 'border-az-error' : 'border-line hover:border-faint');

export function FieldShell({ id, label, error, hint, required, children }: { id: string; label: string; error?: string; hint?: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
        {required && <span aria-hidden className="text-az-error"> *</span>}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="mt-1.5 text-xs text-faint">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-medium text-az-error">
          {error}
        </p>
      )}
    </div>
  );
}

const describedBy = (id: string, error?: string, hint?: string) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined);

interface BaseProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
}

export function TextField({ type = 'text', placeholder, autoComplete, ...p }: BaseProps & { type?: string; placeholder?: string; autoComplete?: string }) {
  return (
    <FieldShell {...p}>
      <input
        id={p.id}
        name={p.id}
        type={type}
        value={p.value}
        onChange={(e) => p.onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={p.error ? true : undefined}
        aria-describedby={describedBy(p.id, p.error, p.hint)}
        className={`${CONTROL} ${border(p.error)}`}
      />
    </FieldShell>
  );
}

export function SelectField({ options, placeholder = 'Select…', ...p }: BaseProps & { options: string[]; placeholder?: string }) {
  return (
    <FieldShell {...p}>
      <select
        id={p.id}
        name={p.id}
        value={p.value}
        onChange={(e) => p.onChange(e.target.value)}
        aria-invalid={p.error ? true : undefined}
        aria-describedby={describedBy(p.id, p.error, p.hint)}
        className={`${CONTROL} ${border(p.error)}`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </FieldShell>
  );
}

export function TextAreaField({ rows = 4, maxLength, ...p }: BaseProps & { rows?: number; maxLength?: number }) {
  return (
    <FieldShell {...p}>
      <textarea
        id={p.id}
        name={p.id}
        rows={rows}
        maxLength={maxLength}
        value={p.value}
        onChange={(e) => p.onChange(e.target.value)}
        aria-invalid={p.error ? true : undefined}
        aria-describedby={describedBy(p.id, p.error, p.hint)}
        className={`${CONTROL} resize-y ${border(p.error)}`}
      />
      {maxLength && <p className="mt-1 text-right text-xs text-faint">{p.value.length}/{maxLength}</p>}
    </FieldShell>
  );
}

export function CheckField({ id, checked, onChange, error, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-muted">
        <input
          id={id}
          name={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-1 h-4 w-4 shrink-0 rounded border-line accent-[var(--accent-strong)]"
        />
        <span>{children}</span>
      </label>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-medium text-az-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function SubmitButton({ children, disabled = false }: { children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="focus-ring inline-flex items-center justify-center gap-2 rounded-full bg-accent px-8 py-3.5 text-[15px] font-semibold text-on-accent shadow-[0_8px_30px_-8px_var(--glow)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
