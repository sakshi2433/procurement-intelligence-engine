import { TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';

export function KpiCard({ label, value, sub, trend, trendLabel, accent = false }) {
  const trendColor = trend > 0 ? 'var(--red)' : trend < 0 ? 'var(--green)' : 'var(--text-3)';
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;

  return (
    <div className="card" style={{
      padding: '20px 22px',
      borderLeft: accent ? `3px solid var(--amber)` : undefined,
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, fontFamily: 'var(--font-mono)' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500, color: 'var(--text-1)', lineHeight: 1, marginBottom: 8 }}>
        {value ?? '—'}
      </div>
      {(sub || trend != null) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {trend != null && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: trendColor }}>
              <TrendIcon size={12} />
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
          {trendLabel && (
            <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{trendLabel}</span>
          )}
          {sub && !trendLabel && (
            <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{sub}</span>
          )}
        </div>
      )}
    </div>
  );
}

const SEVERITY_STYLE = {
  high:   'badge-high',
  medium: 'badge-medium',
  low:    'badge-low',
  info:   'badge-info',
};

export function SeverityBadge({ severity }) {
  return (
    <span className={`badge ${SEVERITY_STYLE[severity] || 'badge-info'}`}>
      {severity}
    </span>
  );
}

export function TypeBadge({ type }) {
  const labels = {
    zscore: 'Z-Score',
    iqr: 'IQR',
    duplicate: 'Duplicate',
    contract_expiry: 'Contract',
  };
  return (
    <span className="badge badge-info" style={{ background: 'var(--ink-3)', color: 'var(--text-2)', border: '1px solid var(--border-2)' }}>
      {labels[type] || type}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 24,
      paddingBottom: 20,
      borderBottom: '1px solid var(--border)',
    }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 400, color: 'var(--text-1)', lineHeight: 1.2 }}>
          {title}
        </h1>
        {subtitle && (
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>{subtitle}</div>
        )}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </div>
  );
}

export function Btn({ children, onClick, variant = 'default', size = 'md', disabled, style = {} }) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--font-body)',
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'all 0.15s',
    padding: size === 'sm' ? '5px 12px' : '8px 16px',
    fontSize: size === 'sm' ? 12 : 13,
  };

  const variants = {
    default: { background: 'var(--ink-4)', color: 'var(--text-1)', border: '1px solid var(--border-2)' },
    primary: { background: 'var(--amber)', color: 'var(--ink)', border: 'none' },
    danger:  { background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red-dim)' },
    ghost:   { background: 'transparent', color: 'var(--text-2)', border: '1px solid var(--border)' },
  };

  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

export function Spinner({ size = 20 }) {
  return (
    <Loader2
      size={size}
      color="var(--amber)"
      style={{ animation: 'spin 1s linear infinite' }}
    />
  );
}

export function EmptyState({ icon: Icon, title, body }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-3)' }}>
      {Icon && <Icon size={36} style={{ marginBottom: 12, opacity: 0.4 }} />}
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--text-2)', marginBottom: 8 }}>{title}</div>
      {body && <div style={{ fontSize: 13 }}>{body}</div>}
    </div>
  );
}

export function DataTable({ columns, rows, keyField = 'id' }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {columns.map(col => (
              <th key={col.key} style={{
                padding: '8px 14px',
                textAlign: col.align || 'left',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-4)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                whiteSpace: 'nowrap',
                fontWeight: 400,
              }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row[keyField] || i} style={{
              borderBottom: '1px solid var(--border)',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--ink-3)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {columns.map(col => (
                <td key={col.key} style={{
                  padding: '10px 14px',
                  fontSize: col.mono ? 12 : 13,
                  fontFamily: col.mono ? 'var(--font-mono)' : 'var(--font-body)',
                  color: 'var(--text-2)',
                  textAlign: col.align || 'left',
                  whiteSpace: col.nowrap ? 'nowrap' : undefined,
                }}>
                  {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Add spinner keyframes globally
const style = document.createElement('style');
style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(style);
