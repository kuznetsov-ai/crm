// @ts-nocheck

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'search';
  label?: string;
  error?: string;
}

export function Input({
  variant = 'default',
  label,
  error,
  className = '',
  ...props
}: InputProps) {
  const base =
    'w-full bg-surface border border-border rounded-sm px-3 py-2 text-sm text-text placeholder:text-text-subtle outline-none transition focus:border-accent focus:ring-1 focus:ring-[var(--accent-soft)]';

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-semibold text-text-muted uppercase tracking-wide font-brand">
          {label}
        </label>
      )}
      <div className="relative">
        {variant === 'search' && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </span>
        )}
        <input
          className={`${base} ${variant === 'search' ? 'pl-9' : ''} ${error ? 'border-danger' : ''} ${className}`}
          {...props}
        />
      </div>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
