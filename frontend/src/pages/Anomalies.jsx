import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, CheckCircle, Filter } from 'lucide-react';
import { api, fmt } from '../lib/api';
import { PageHeader, Btn, Spinner, SeverityBadge, TypeBadge, EmptyState, DataTable } from '../components/ui';

const TYPE_LABELS = {
  zscore: 'Z-Score Spike',
  iqr: 'IQR Outlier',
  duplicate: 'Duplicate Invoice',
  contract_expiry: 'Contract Expiry',
};

function AlertCard({ alert, onResolve }) {
  const [resolving, setResolving] = useState(false);

  const resolve = async () => {
    setResolving(true);
    try {
      await api.anomalies.resolve(alert.id);
      onResolve(alert.id);
    } finally {
      setResolving(false);
    }
  };

  const borderColor = {
    high: 'var(--red)',
    medium: 'var(--amber)',
    low: 'var(--green)',
  }[alert.severity] || 'var(--border)';

  return (
    <div className="card animate-in" style={{
      padding: '16px 18px',
      borderLeft: `3px solid ${borderColor}`,
      display: 'flex',
      gap: 16,
      alignItems: 'flex-start',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <TypeBadge type={alert.anomaly_type} />
          <SeverityBadge severity={alert.severity} />
          {alert.z_score != null && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>
              z={alert.z_score.toFixed(2)}σ
            </span>
          )}
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', marginBottom: 4 }}>
          {alert.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 8 }}>
          {alert.description}
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-4)' }}>
          {alert.value != null && <span>Value: <span style={{ color: 'var(--text-2)' }}>{fmt.inrFull(alert.value)}</span></span>}
          {alert.threshold != null && alert.anomaly_type !== 'duplicate' && (
            <span>Threshold: <span style={{ color: 'var(--text-2)' }}>{fmt.inrFull(alert.threshold)}</span></span>
          )}
          <span>Detected: <span style={{ color: 'var(--text-2)' }}>{fmt.date(alert.detected_at)}</span></span>
        </div>
      </div>
      <Btn onClick={resolve} disabled={resolving} variant="ghost" size="sm" style={{ flexShrink: 0 }}>
        {resolving ? <Spinner size={12} /> : <CheckCircle size={12} />}
        Resolve
      </Btn>
    </div>
  );
}

function SummaryBar({ summary }) {
  const items = [
    { key: 'zscore',          label: 'Z-Score',    color: 'var(--blue)' },
    { key: 'iqr',             label: 'IQR',        color: 'var(--amber)' },
    { key: 'duplicate',       label: 'Duplicate',  color: 'var(--red)' },
    { key: 'contract_expiry', label: 'Contract',   color: 'var(--green)' },
  ];
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
      {items.map(({ key, label, color }) => {
        const data = summary[key] || {};
        const total = data.total || 0;
        return (
          <div key={key} className="card" style={{
            padding: '14px 18px', flex: 1, minWidth: 140,
            borderTop: `2px solid ${total > 0 ? color : 'var(--border)'}`,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              {label}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: total > 0 ? color : 'var(--text-4)', lineHeight: 1 }}>
              {total}
            </div>
            {total > 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                {data.high || 0}H · {data.medium || 0}M · {data.low || 0}L
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Anomalies() {
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [severity, setSeverity] = useState('');
  const [type, setType] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (severity) params.severity = severity;
      if (type) params.anomaly_type = type;
      const [a, s] = await Promise.all([
        api.anomalies.alerts({ limit: 100, ...params }),
        api.anomalies.summary(),
      ]);
      setAlerts(a);
      setSummary(s);
    } finally {
      setLoading(false);
    }
  };

  const runScan = async () => {
    setScanning(true);
    try {
      await api.anomalies.scan();
      await load();
    } finally {
      setScanning(false);
    }
  };

  const handleResolve = (id) => setAlerts(a => a.filter(x => x.id !== id));

  useEffect(() => { load(); }, [severity, type]);

  return (
    <div className="animate-in">
      <PageHeader
        title="Anomaly Alerts"
        subtitle="Z-score · IQR · Duplicate detection · Contract expiry"
        actions={
          <Btn onClick={runScan} disabled={scanning} variant="primary" size="sm">
            <RefreshCw size={13} style={{ animation: scanning ? 'spin 1s linear infinite' : 'none' }} />
            {scanning ? 'Scanning...' : 'Run Full Scan'}
          </Btn>
        }
      />

      <SummaryBar summary={summary} />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center' }}>
        <Filter size={14} color="var(--text-4)" />
        <select value={severity} onChange={e => setSeverity(e.target.value)} style={{ padding: '5px 10px', fontSize: 12, borderRadius: 4 }}>
          <option value="">All severities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={type} onChange={e => setType(e.target.value)} style={{ padding: '5px 10px', fontSize: 12, borderRadius: 4 }}>
          <option value="">All types</option>
          <option value="zscore">Z-Score</option>
          <option value="iqr">IQR</option>
          <option value="duplicate">Duplicate</option>
          <option value="contract_expiry">Contract Expiry</option>
        </select>
        {(severity || type) && (
          <Btn size="sm" variant="ghost" onClick={() => { setSeverity(''); setType(''); }}>
            Clear filters
          </Btn>
        )}
        <span style={{ fontSize: 12, color: 'var(--text-4)', marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>
          {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={24} /></div>
      ) : alerts.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="No active alerts" body="Run a scan or adjust your filters." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {alerts.map(a => <AlertCard key={a.id} alert={a} onResolve={handleResolve} />)}
        </div>
      )}
    </div>
  );
}
