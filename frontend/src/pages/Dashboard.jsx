import { useEffect, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { api, fmt } from '../lib/api';
import { KpiCard, PageHeader, Btn, Spinner, SeverityBadge, TypeBadge } from '../components/ui';

const COLORS = ['#e8a020', '#6ea8d5', '#5aaa7a', '#d95050', '#a078d5', '#78c5b5', '#d5a078', '#7878d5'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--ink-3)', border: '1px solid var(--border-2)',
      borderRadius: 6, padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 12,
    }}>
      <div style={{ color: 'var(--text-3)', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || 'var(--amber)' }}>
          {fmt.inr(p.value)}
        </div>
      ))}
    </div>
  );
};

export function Dashboard() {
  const [kpis, setKpis] = useState(null);
  const [trend, setTrend] = useState([]);
  const [categories, setCategories] = useState([]);
  const [concentration, setConcentration] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [k, t, c, conc, a] = await Promise.all([
        api.analytics.kpis(),
        api.analytics.monthlyTrend(12),
        api.analytics.spendByCategory(12),
        api.analytics.concentrationRisk(12),
        api.anomalies.alerts({ limit: 8 }),
      ]);
      setKpis(k);
      setTrend(t.map(r => ({ ...r, month: r.month_str?.slice(0, 7) })));
      setCategories(c.slice(0, 8));
      setConcentration(conc);
      setAlerts(a);
    } finally {
      setLoading(false);
    }
  };

  const runScan = async () => {
    setScanning(true);
    try {
      await api.anomalies.scan();
      await loadAll();
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, gap: 12 }}>
      <Spinner size={24} />
      <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>Loading procurement data...</span>
    </div>
  );

  const riskColor = { low: 'var(--green)', moderate: 'var(--amber)', high: 'var(--red)', unknown: 'var(--text-3)' };

  return (
    <div className="animate-in">
      <PageHeader
        title="Procurement Overview"
        subtitle="Spend intelligence · Vendor risk · Anomaly monitoring"
        actions={
          <Btn onClick={runScan} disabled={scanning} variant="primary" size="sm">
            <RefreshCw size={13} style={{ animation: scanning ? 'spin 1s linear infinite' : 'none' }} />
            {scanning ? 'Scanning...' : 'Run Anomaly Scan'}
          </Btn>
        }
      />

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <KpiCard
          label="This Month Spend"
          value={fmt.inr(kpis?.this_month_spend)}
          trend={kpis?.mom_change_pct}
          trendLabel="vs last month"
          accent
        />
        <KpiCard label="Active Vendors" value={kpis?.total_active_vendors?.toLocaleString()} sub="suppliers" />
        <KpiCard label="Purchase Orders" value={kpis?.total_purchase_orders?.toLocaleString()} sub="total" />
        <KpiCard
          label="Pending Invoices"
          value={kpis?.pending_invoices?.toLocaleString()}
          sub={`${kpis?.overdue_invoices || 0} overdue`}
        />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 14, marginBottom: 14 }}>
        {/* Monthly trend */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
            Monthly Spend Trend (12 months)
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-4)', fontSize: 11, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: 'var(--text-4)', fontSize: 11, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} tickFormatter={v => fmt.inr(v)} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="total_spend" stroke="var(--amber)" strokeWidth={2} dot={{ fill: 'var(--amber)', r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Vendor concentration */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Vendor Concentration Risk
          </div>
          {concentration && (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 36, color: riskColor[concentration.risk_level] }}>
                  {concentration.hhi.toFixed(0)}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>HHI</span>
              </div>
              <div style={{ fontSize: 12, color: riskColor[concentration.risk_level], marginBottom: 12, fontWeight: 500 }}>
                {concentration.risk_level.toUpperCase()} CONCENTRATION
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>
                Top 3 vendors: <span style={{ color: 'var(--text-1)', fontFamily: 'var(--font-mono)' }}>{concentration.top_3_share_pct}%</span> of spend
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={concentration.vendors.slice(0, 6)} dataKey="share_pct" nameKey="vendor_name" innerRadius={30} outerRadius={55}>
                    {concentration.vendors.slice(0, 6).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={0.85} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${v.toFixed(1)}%`, n]} contentStyle={{ background: 'var(--ink-3)', border: '1px solid var(--border-2)', fontSize: 11, fontFamily: 'var(--font-mono)' }} />
                </PieChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Spend by category */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
            Spend by Category
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={categories} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'var(--text-4)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} tickFormatter={v => fmt.inr(v)} />
              <YAxis type="category" dataKey="category" tick={{ fill: 'var(--text-2)', fontSize: 11 }} tickLine={false} axisLine={false} width={110} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="total_spend" fill="var(--amber)" radius={[0, 3, 3, 0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent alerts */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Active Anomaly Alerts
            </div>
            <a href="/anomalies" style={{ fontSize: 11, color: 'var(--amber)', textDecoration: 'none' }}>View all →</a>
          </div>
          {alerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-3)', fontSize: 13 }}>
              <AlertTriangle size={24} style={{ marginBottom: 8, opacity: 0.3 }} />
              <div>No active alerts</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {alerts.map(a => (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px',
                  background: 'var(--ink-3)', borderRadius: 6,
                  border: '1px solid var(--border)',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-1)', fontWeight: 500, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {a.title}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                      {a.value ? fmt.inr(a.value) : ''} · {new Date(a.detected_at).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <TypeBadge type={a.anomaly_type} />
                    <SeverityBadge severity={a.severity} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
