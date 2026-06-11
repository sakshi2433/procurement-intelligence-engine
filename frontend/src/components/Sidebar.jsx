import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, AlertTriangle, MessageSquare,
  Users, FileText, Receipt, ScrollText, Settings, Zap
} from 'lucide-react';

const NAV = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/anomalies', icon: AlertTriangle,   label: 'Anomalies' },
  { to: '/query',     icon: MessageSquare,   label: 'NL Query' },
  null, // divider
  { to: '/vendors',   icon: Users,           label: 'Vendors' },
  { to: '/orders',    icon: FileText,        label: 'Purchase Orders' },
  { to: '/invoices',  icon: Receipt,         label: 'Invoices' },
  { to: '/contracts', icon: ScrollText,      label: 'Contracts' },
];

export function Sidebar({ llmConfig }) {
  return (
    <aside style={{
      width: 'var(--sidebar-w)',
      background: 'var(--ink-2)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      height: '100vh',
      position: 'sticky',
      top: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          paddingBottom: 16, borderBottom: '1px solid var(--border)',
        }}>
          <div style={{
            width: 32, height: 32,
            background: 'var(--amber)',
            borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={16} color="var(--ink)" />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, color: 'var(--text-1)', lineHeight: 1.2 }}>
              Procurement
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Intelligence
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '4px 12px', overflowY: 'auto' }}>
        {NAV.map((item, i) =>
          item === null ? (
            <div key={i} style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                textDecoration: 'none',
                color: isActive ? 'var(--text-1)' : 'var(--text-3)',
                background: isActive ? 'var(--ink-4)' : 'transparent',
                fontWeight: isActive ? 500 : 400,
                fontSize: 13,
                marginBottom: 1,
                transition: 'all 0.1s',
              })}
            >
              {({ isActive }) => (
                <>
                  <item.icon size={15} color={isActive ? 'var(--amber)' : 'currentColor'} />
                  {item.label}
                </>
              )}
            </NavLink>
          )
        )}
      </nav>

      {/* LLM badge */}
      {llmConfig && (
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          fontFamily: 'var(--font-mono)',
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-4)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            LLM Engine
          </div>
          <div style={{ fontSize: 11, color: 'var(--amber)', wordBreak: 'break-all' }}>
            {llmConfig.provider} / {llmConfig.model}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 2 }}>
            embed: {llmConfig.embedding_provider}
          </div>
        </div>
      )}
    </aside>
  );
}
