import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { api, fmt } from '../lib/api';
import { PageHeader, Spinner, EmptyState, DataTable } from '../components/ui';

const STATUS_COLORS = {
  draft:      'var(--text-4)',
  confirmed:  'var(--amber)',
  received:   'var(--green)',
  cancelled:  'var(--red)',
};

const COLUMNS = [
  { key: 'po_number',  label: 'PO Number', mono: true, nowrap: true, render: v => <span style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{v}</span> },
  { key: 'vendor_name', label: 'Vendor', render: v => <span style={{ color: 'var(--text-1)' }}>{v}</span> },
  { key: 'category',   label: 'Category' },
  { key: 'status',     label: 'Status', render: v => (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', color: STATUS_COLORS[v] || 'var(--text-3)', letterSpacing: '0.04em' }}>{v}</span>
  )},
  { key: 'amount',     label: 'Amount', mono: true, align: 'right', render: v => <span style={{ color: 'var(--text-1)' }}>{fmt.inrFull(v)}</span> },
  { key: 'order_date', label: 'Order Date', nowrap: true, render: v => fmt.date(v) },
  { key: 'expected_delivery', label: 'Est. Delivery', nowrap: true, render: v => fmt.date(v) },
];

export function PurchaseOrders() {
  const [pos, setPos] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [offset, setOffset] = useState(0);
  const LIMIT = 40;

  const load = async () => {
    setLoading(true);
    try {
      const params = { limit: LIMIT, offset };
      if (status) params.status = status;
      const res = await api.procurement.purchaseOrders(params);
      setPos(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setOffset(0); }, [status]);
  useEffect(() => { load(); }, [status, offset]);

  return (
    <div className="animate-in">
      <PageHeader title="Purchase Orders" subtitle={`${total.toLocaleString()} total orders`} />

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ padding: '7px 12px', borderRadius: 4, fontSize: 13 }}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="confirmed">Confirmed</option>
          <option value="received">Received</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={24} /></div>
        ) : pos.length === 0 ? (
          <EmptyState icon={FileText} title="No purchase orders found" />
        ) : (
          <DataTable columns={COLUMNS} rows={pos} />
        )}
      </div>

      {total > LIMIT && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>
            {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button disabled={offset === 0} onClick={() => setOffset(o => o - LIMIT)}
              style={{ padding: '5px 12px', background: 'var(--ink-3)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-2)', fontSize: 12, cursor: offset === 0 ? 'not-allowed' : 'pointer', opacity: offset === 0 ? 0.4 : 1 }}>
              ← Prev
            </button>
            <button disabled={offset + LIMIT >= total} onClick={() => setOffset(o => o + LIMIT)}
              style={{ padding: '5px 12px', background: 'var(--ink-3)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-2)', fontSize: 12, cursor: offset + LIMIT >= total ? 'not-allowed' : 'pointer', opacity: offset + LIMIT >= total ? 0.4 : 1 }}>
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
