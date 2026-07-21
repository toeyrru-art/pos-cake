import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Outlet } from 'react-router-dom';
import { Cake, Wheat, LayoutDashboard, Store, Wallet, CalendarClock, Menu as MenuIcon, X } from 'lucide-react';
import './index.css';

import Inventory from './pages/Inventory';
import Menu from './pages/Menu';
import POS from './pages/POS';
import Transactions from './pages/Transactions';
import Dashboard from './pages/Dashboard';
import Preorders from './pages/Preorders';
import CustomerShop from './pages/CustomerShop';

// Admin Layout Component
const AdminLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  React.useEffect(() => {
    document.title = "TT Bakery POS (Admin)";
  }, []);

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Cake size={24} color="var(--primary-dark)" style={{ flexShrink: 0 }} />
            <h1 style={{ margin: 0, fontSize: '1.2rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>TT Bakery POS</h1>
          </div>
          <button 
            type="button"
            className="sidebar-close-btn"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
            <LayoutDashboard size={20} />
            <span>แดชบอร์ด</span>
          </NavLink>
          <NavLink to="/pos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Store size={20} />
            <span>ขายสินค้า (POS)</span>
          </NavLink>
          <NavLink to="/menu" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Cake size={20} />
            <span>เมนูเค้ก</span>
          </NavLink>
          <NavLink to="/inventory" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Wheat size={20} />
            <span>สต๊อกวัตถุดิบ</span>
          </NavLink>
          <NavLink to="/preorders" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <CalendarClock size={20} />
            <span>ออร์เดอร์ล่วงหน้า</span>
          </NavLink>
          <NavLink to="/transactions" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Wallet size={20} />
            <span>รายรับรายจ่าย</span>
          </NavLink>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {!isSidebarOpen && (
            <button 
              className="btn btn-outline" 
              style={{ padding: '0.5rem', border: 'none', background: 'var(--primary-light)', color: 'var(--primary-dark)', borderRadius: '50%' }}
              onClick={() => setIsSidebarOpen(true)}
            >
              <MenuIcon size={20} />
            </button>
          )}
          <h2 style={{ flex: 1, margin: 0 }}>ระบบจัดการร้านขายขนมเค้ก</h2>
          <div>
            <span className="text-muted" style={{ fontWeight: 500 }}>🍰 ผู้ดูแลระบบ</span>
          </div>
        </header>
        
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Customer Route (No Sidebar) */}
        <Route path="/shop" element={<CustomerShop />} />

        {/* Admin Routes (With Sidebar) */}
        <Route path="/" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="pos" element={<POS />} />
          <Route path="menu" element={<Menu />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="preorders" element={<Preorders />} />
          <Route path="transactions" element={<Transactions />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
