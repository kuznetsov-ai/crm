// @ts-nocheck

interface StatCardProps {
  value: string | number;
  label: string;
  sub?: string;
  color?: string;
  trend?: 'up' | 'down' | 'neutral';
  hint?: string;
  className?: string;
}

export function StatCard({
  value,
  color = 'var(--accent)',
  label,
  sub,
  trend,
  hint,
  className = '',
}: StatCardProps) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--bg)',
        borderRadius: '0.5rem',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        border: '1px solid var(--border)',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <span
          style={{
            color,
            fontFamily: 'var(--font-brand)',
            fontWeight: 800,
            fontSize: '1.875rem',
            lineHeight: 1,
          }}
        >
          {value}
        </span>
        {hint && (
          <span
            title={hint}
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: 'var(--surface-2)',
              color: 'var(--text-subtle)',
              fontSize: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'help',
              flexShrink: 0,
              marginTop: '2px',
            }}
          >
            ?
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {trend === 'up'   && <span style={{ color: 'var(--success)', fontSize: '12px' }}>↑</span>}
        {trend === 'down' && <span style={{ color: 'var(--danger)',  fontSize: '12px' }}>↓</span>}
        <span
          style={{
            fontSize: '10px',
            color: 'var(--text-subtle)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontFamily: 'var(--font-brand)',
          }}
        >
          {label}
        </span>
      </div>
      {sub && (
        <div style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '2px' }}>
          {sub}
        </div>
      )}
    </div>
  );
}
