import { useEffect, useState } from 'react';
import { Search, Users } from 'lucide-react';
import { api, fmt } from '../lib/api';
import { PageHeader, Spinner, EmptyState, DataTable } from '../components/ui';

const STATUS_STYLE = {
  active:      { color: 'var(--green)',  bg: 'var(--green-bg)',  border: 'var(--green-dim)' },
  inactive:    { color: 'var(--text-3)', bg: 'var(--ink-3)',     border: 'var(--border)' },
  blacklisted: { color: 'var(--red)',    bg: 'var(--red-bg)',    border: 'var(--red-dim)' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.inactive;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px',
      borderRadius: 4, fontSize: 11, fontFamily: 'var(--font-mono)',
      textTransform: 'uppercase', letterSpacing: '0.04em',
      color: s.color, background: s.bg, border: `1px solid ${s.border}`,
    }}>
      {status}
    </span>
  );
}

const COLUMNS = [
  { key: 'name',              label: 'Vendor Name',     render: (v) => <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>{v}</span> },
  { key: 'category',         label: 'Category' },
  { key: 'country',          label: 'Country' },
  { key: 'payment_terms_days', label: 'Payment Terms', mono: true, align: 'right', render: v => `Net ${v}` },
  { key: 'status',           label: 'Status',  render: v => <StatusBadge status={v} /> },
  { key: 'email',            label: 'Email',   render: v => <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{v || '—'}</span> },
];

export function Vendors() {
  const [vendors, setVendors] = useState([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [offset, setOffset] = useState(0);
  const LIMIT = 40;

  const load = async () => {
    setLoading(true);
    try {
      const params = { limit: LIMIT, offset };
      if (search)   params.search   = search;
      if (status)   params.status   = status;
      if (category) params.category = category;
      const [res, cats] = await Promise.all([
        api.procurement.vendors(params),
        categories.length ? Promise.resolve(categories) : api.procurement.vendorCategories(),
      ]);
      setVendors(res.items);
      setTotal(res.total);
      if (!categories.length) setCategories(cats);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setOffset(0); }, [search, status, category]);
  useEffect(() => { load(); }, [search, status, category, offset]);

  return (
    <div className="animate-in">
      <PageHeader
        title="Vendors"
        subtitle={`${total.toLocaleString()} suppliers in database`}
      />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search vendor name..."
            style={{ width: '100%', padding: '7px 12px 7px 32px', borderRadius: 4 }}
          />
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ padding: '7px 12px', borderRadius: 4, fontSize: 13 }}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="blacklisted">Blacklisted</option>
        </select>
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ padding: '7px 12px', borderRadius: 4, fontSize: 13 }}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={24} /></div>
        ) : vendors.length === 0 ? (
          <EmptyState icon={Users} title="No vendors found" body="Try adjusting your filters." />
        ) : (
          <DataTable columns={COLUMNS} rows={vendors} />
        )}
      </div>

      {/* Pagination */}
      {total > LIMIT && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>
            Showing {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              disabled={offset === 0}
              onClick={() => setOffset(o => Math.max(0, o - LIMIT))}
              style={{ padding: '5px 12px', background: 'var(--ink-3)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-2)', fontSize: 12, cursor: offset === 0 ? 'not-allowed' : 'pointer', opacity: offset === 0 ? 0.4 : 1 }}
            >
              ← Prev
            </button>
            <button
              disabled={offset + LIMIT >= total}
              onClick={() => setOffset(o => o + LIMIT)}
              style={{ padding: '5px 12px', background: 'var(--ink-3)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-2)', fontSize: 12, cursor: offset + LIMIT >= total ? 'not-allowed' : 'pointer', opacity: offset + LIMIT >= total ? 0.4 : 1 }}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
