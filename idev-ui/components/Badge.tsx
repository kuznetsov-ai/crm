// @ts-nocheck

type BadgeColor = 'orange' | 'green' | 'yellow' | 'blue' | 'red' | 'gray';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  color?: BadgeColor;
  size?: BadgeSize;
  children: React.ReactNode;
  className?: string;
}

const colorStyles: Record<BadgeColor, { background: string; color: string }> = {
  orange: { background: 'var(--accent-soft)',   color: 'var(--accent)'    },
  green:  { background: 'var(--success-soft)',  color: 'var(--success)'   },
  yellow: { background: 'var(--warning-soft)',  color: 'var(--warning)'   },
  blue:   { background: 'var(--info-soft)',     color: 'var(--info)'      },
  red:    { background: 'var(--danger-soft)',   color: 'var(--danger)'    },
  gray:   { background: 'var(--surface-2)',     color: 'var(--text-muted)'},
};

const sizeStyles: Record<BadgeSize, { padding: string; fontSize: string }> = {
  sm: { padding: '2px 8px',  fontSize: '10px' },
  md: { padding: '3px 10px', fontSize: '11px' },
};

export function Badge({
  color = 'gray',
  size = 'md',
  children,
  className = '',
}: BadgeProps) {
  const cs = colorStyles[color];
  const ss = sizeStyles[size];
  return (
    <span
      className={className}
      style={{
        display: 'inline-block',
        fontWeight: 600,
        borderRadius: '9999px',
        fontFamily: 'var(--font-brand)',
        whiteSpace: 'nowrap',
        background: cs.background,
        color: cs.color,
        padding: ss.padding,
        fontSize: ss.fontSize,
      }}
    >
      {children}
    </span>
  );
}

export const STATUS_COLOR: Record<string, BadgeColor> = {
  ON_PROJECT:  'green',
  BENCH:       'orange',
  IN_FUNNEL:   'yellow',
  SCREENING:   'blue',
  LEFT:        'red',
  ARCHIVED:    'gray',
};
