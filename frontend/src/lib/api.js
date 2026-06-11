const BASE = import.meta.env.VITE_API_URL || '';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Analytics ──────────────────────────────────────────────────────────────

export const api = {
  analytics: {
    kpis: () => apiFetch('/api/analytics/kpis'),
    spendByCategory: (months = 12) => apiFetch(`/api/analytics/spend-by-category?months=${months}`),
    spendByVendor: (months = 12, topN = 10) => apiFetch(`/api/analytics/spend-by-vendor?months=${months}&top_n=${topN}`),
    concentrationRisk: (months = 12) => apiFetch(`/api/analytics/concentration-risk?months=${months}`),
    monthlyTrend: (months = 12) => apiFetch(`/api/analytics/monthly-trend?months=${months}`),
  },

  anomalies: {
    scan: () => apiFetch('/api/anomalies/scan', { method: 'POST' }),
    alerts: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return apiFetch(`/api/anomalies/alerts?${qs}`);
    },
    summary: () => apiFetch('/api/anomalies/summary'),
    resolve: (id) => apiFetch(`/api/anomalies/alerts/${id}/resolve`, { method: 'PATCH' }),
  },

  rag: {
    query: (question, k = 6, filterType = null) => apiFetch('/api/rag/query', {
      method: 'POST',
      body: JSON.stringify({ question, k, filter_type: filterType }),
    }),
    history: (limit = 20) => apiFetch(`/api/rag/history?limit=${limit}`),
    rebuildIndex: () => apiFetch('/api/rag/rebuild-index', { method: 'POST' }),
    config: () => apiFetch('/api/rag/config'),
  },

  procurement: {
    vendors: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return apiFetch(`/api/procurement/vendors?${qs}`);
    },
    vendor: (id) => apiFetch(`/api/procurement/vendors/${id}`),
    vendorCategories: () => apiFetch('/api/procurement/vendor-categories'),
    purchaseOrders: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return apiFetch(`/api/procurement/purchase-orders?${qs}`);
    },
    invoices: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return apiFetch(`/api/procurement/invoices?${qs}`);
    },
    contracts: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return apiFetch(`/api/procurement/contracts?${qs}`);
    },
  },

  health: () => apiFetch('/health'),
};

// Formatting helpers
export const fmt = {
  inr: (n) => {
    if (n == null) return '—';
    if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`;
    if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
    if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
    return `₹${n.toFixed(0)}`;
  },
  inrFull: (n) => n != null ? `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—',
  date: (s) => s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
  pct: (n) => n != null ? `${n > 0 ? '+' : ''}${n.toFixed(1)}%` : '—',
};
