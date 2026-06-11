import { useEffect, useState } from 'react';
import { ScrollText, AlertTriangle } from 'lucide-react';
import { api, fmt } from '../lib/api';
import { PageHeader, Spinner, EmptyState, DataTable, Btn } from '../components/ui';

function DaysLeft({ days }) {
  if (days == null) return <span style={{ color: 'var(--text-4)' }}>—</span>;
  const color = days <= 7 ? 'var(--red)' : days <= 14 ? 'var(--amber)' : days <= 30 ? 'var(--sand)' : 'var(--text-3)';
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color }}>
      {days < 0 ? 'EXPIRED' : `${days}d`}
    </span>
  );
}

const COLUMNS = [
  { key: 'title',          label: 'Contract Title', render: v => <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>{v}</span> },
  { key: 'vendor_name',    label: 'Vendor' },
  { key: 'contract_value', label: 'Value', mono: true, align: 'right', render: v => fmt.inrFull(v) },
  { key: 'start_date',     label: 'Start',  nowrap: true, render: v => fmt.date(v) },
  { key: 'end_date',       label: 'Expires', nowrap: true, render: v => fmt.date(v) },
  { key: 'days_remaining', label: 'Days Left', align: 'right', render: v => <DaysLeft days={v} /> },
  { key: 'auto_renew',     label: 'Auto-Renew', render: v => (
    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: v ? 'var(--green)' : 'var(--text-4)' }}>
      {v ? 'YES' : 'NO'}
    </span>
  )},
];

export function Contracts() {
  const [contracts, setContracts] = useState([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [expiringSoon, setExpiringSoon] = useState(false);
  const [offset, setOffset]       = useState(0);
  const LIMIT = 40;

  const load = async () => {
    setLoading(true);
    try {
      const params = { limit: LIMIT, offset };
      if (expiringSoon) params.expiring_soon = true;
      const res = await api.procurement.contracts(params);
      setContracts(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setOffset(0); }, [expiringSoon]);
  useEffect(() => { load(); }, [expiringSoon, offset]);

  const expiringCount = contracts.filter(c => c.days_remaining != null && c.days_remaining <= 30 && c.days_remaining >= 0).length;

  return (
    <div className="animate-in">
      <PageHeader
        title="Contracts"
        subtitle={`${total.toLocaleString()} vendor contracts`}
        actions={
          expiringCount > 0 && !expiringSoon ? (
            <Btn size="sm" variant="danger" onClick={() => setExpiringSoon(true)}>
              <AlertTriangle size={12} />
              {expiringCount} expiring soon
            </Btn>
          ) : null
        }
      />

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={expiringSoon}
            onChange={e => setExpiringSoon(e.target.checked)}
            style={{ accentColor: 'var(--amber)', width: 14, height: 14 }}
          />
          Show only expiring within 30 days
        </label>
        {expiringSoon && (
          <Btn size="sm" variant="ghost" onClick={() => setExpiringSoon(false)}>Clear</Btn>
        )}
      </div>

      <div className="card">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={24} /></div>
        ) : contracts.length === 0 ? (
          <EmptyState icon={ScrollText} title="No contracts found" body={expiringSoon ? 'No contracts expiring within 30 days.' : ''} />
        ) : (
          <DataTable columns={COLUMNS} rows={contracts} />
        )}
      </div>

      {total > LIMIT && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>
            {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button disabled={offset === 0} onClick={() => setOffset(o => o - LIMIT)}
              style={{ padding: '5px 12px', background: 'var(--ink-3)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-2)', fontSize: 12, cursor: offset === 0 ? 'not-allowed' : 'pointer', opacity: offset === 0 ? 0.4 : 1 }}>← Prev</button>
            <button disabled={offset + LIMIT >= total} onClick={() => setOffset(o => o + LIMIT)}
              style={{ padding: '5px 12px', background: 'var(--ink-3)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-2)', fontSize: 12, cursor: offset + LIMIT >= total ? 'not-allowed' : 'pointer', opacity: offset + LIMIT >= total ? 0.4 : 1 }}>Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}
