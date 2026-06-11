import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';

import './index.css';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Anomalies } from './pages/Anomalies';
import { NLQuery } from './pages/NLQuery';
import { Vendors } from './pages/Vendors';
import { PurchaseOrders } from './pages/PurchaseOrders';
import { Invoices } from './pages/Invoices';
import { Contracts } from './pages/Contracts';
import { api } from './lib/api';

function Layout() {
  const [llmConfig, setLlmConfig] = useState(null);

  useEffect(() => {
    api.rag.config().then(setLlmConfig).catch(() => {});
  }, []);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar llmConfig={llmConfig} />
      <main style={{
        flex: 1,
        overflowY: 'auto',
        padding: '28px 32px',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <Outlet />
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/"          element={<Dashboard />} />
          <Route path="/anomalies" element={<Anomalies />} />
          <Route path="/query"     element={<NLQuery />} />
          <Route path="/vendors"   element={<Vendors />} />
          <Route path="/orders"    element={<PurchaseOrders />} />
          <Route path="/invoices"  element={<Invoices />} />
          <Route path="/contracts" element={<Contracts />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
