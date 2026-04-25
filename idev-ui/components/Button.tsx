// @ts-nocheck

type Variant = 'primary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: React.ReactNode;
}

const base =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-pill transition cursor-pointer border-none font-brand disabled:opacity-50 disabled:cursor-not-allowed';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover',
  outline: 'bg-transparent text-accent border border-accent hover:bg-accent-soft',
  ghost:   'bg-surface text-text-muted hover:bg-surface-2',
  danger:  'bg-[var(--danger-soft)] text-danger hover:opacity-80',
};

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-5 py-2 text-sm',
  lg: 'px-7 py-3 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
