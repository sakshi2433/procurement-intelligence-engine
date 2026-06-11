import { useEffect, useState } from 'react';
import { Receipt } from 'lucide-react';
import { api, fmt } from '../lib/api';
import { PageHeader, Spinner, EmptyState, DataTable } from '../components/ui';

const STATUS_COLORS = {
  draft:     'var(--text-4)',
  posted:    'var(--amber)',
  paid:      'var(--green)',
  cancelled: 'var(--red)',
};

const COLUMNS = [
  { key: 'invoice_number', label: 'Invoice #', mono: true, nowrap: true, render: v => <span style={{ color: 'var(--blue)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{v}</span> },
  { key: 'vendor_name',   label: 'Vendor',   render: v => <span style={{ color: 'var(--text-1)' }}>{v}</span> },
  { key: 'status',        label: 'Status',   render: v => (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', color: STATUS_COLORS[v] || 'var(--text-3)', letterSpacing: '0.04em' }}>{v}</span>
  )},
  { key: 'amount',        label: 'Amount',   mono: true, align: 'right', render: v => <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>{fmt.inrFull(v)}</span> },
  { key: 'invoice_date',  label: 'Invoice Date', nowrap: true, render: v => fmt.date(v) },
  { key: 'due_date',      label: 'Due Date',     nowrap: true, render: (v, row) => {
    const overdue = v && new Date(v) < new Date() && row.status === 'posted';
    return <span style={{ color: overdue ? 'var(--red)' : 'var(--text-3)' }}>{fmt.date(v)}</span>;
  }},
];

export function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus]   = useState('');
  const [offset, setOffset]   = useState(0);
  const LIMIT = 40;

  const load = async () => {
    setLoading(true);
    try {
      const params = { limit: LIMIT, offset };
      if (status) params.status = status;
      const res = await api.procurement.invoices(params);
      setInvoices(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setOffset(0); }, [status]);
  useEffect(() => { load(); }, [status, offset]);

  return (
    <div className="animate-in">
      <PageHeader title="Invoices" subtitle={`${total.toLocaleString()} vendor invoices`} />

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ padding: '7px 12px', borderRadius: 4, fontSize: 13 }}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="posted">Posted (Pending)</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={24} /></div>
        ) : invoices.length === 0 ? (
          <EmptyState icon={Receipt} title="No invoices found" />
        ) : (
          <DataTable columns={COLUMNS} rows={invoices} />
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
