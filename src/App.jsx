import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Outlet } from 'react-router-dom';
import { Cake, Wheat, LayoutDashboard, Store, Wallet, CalendarClock, Menu as MenuIcon, X } from 'lucide-react';
import { supabase } from './lib/supabase';
import './index.css';

import Inventory from './pages/Inventory';
import Menu from './pages/Menu';
import POS from './pages/POS';
import Transactions from './pages/Transactions';
import Dashboard from './pages/Dashboard';
import Preorders from './pages/Preorders';
import CustomerShop from './pages/CustomerShop';
import Login from './pages/Login';
import { AuthProvider, useAuth } from './lib/AuthContext';

// Admin Layout Component
const AdminLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [pendingCount, setPendingCount] = React.useState(0);
  const { logout } = useAuth();
  
  const fetchPendingCount = async () => {
    const { count } = await supabase
      .from('preorders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    setPendingCount(count || 0);
  };

  React.useEffect(() => {
    document.title = "Taii & Tang bakery (Admin)";
    fetchPendingCount();

    const channel = supabase
      .channel('preorders-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'preorders' },
        (payload) => {
          if (payload.new.status === 'pending') {
            setPendingCount(prev => prev + 1);
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.play().catch(e => console.log('Audio play failed:', e));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'preorders' },
        (payload) => {
          fetchPendingCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Cake size={24} color="var(--primary-dark)" style={{ flexShrink: 0 }} />
            <h1 style={{ margin: 0, fontSize: '1.2rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>Taii & Tang bakery</h1>
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
            <span>บันทึกออร์เดอร์</span>
          </NavLink>
          <NavLink to="/menu" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Cake size={20} />
            <span>เมนูเค้ก</span>
          </NavLink>
          <NavLink to="/inventory" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Wheat size={20} />
            <span>สต๊อกวัตถุดิบ</span>
          </NavLink>
          <NavLink to="/preorders" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <CalendarClock size={20} />
              <span>ออร์เดอร์ล่วงหน้า</span>
            </div>
            {pendingCount > 0 && (
              <div style={{
                backgroundColor: '#ff4757',
                color: 'white',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                padding: '2px 8px',
                borderRadius: '12px',
                minWidth: '24px',
                textAlign: 'center'
              }}>
                {pendingCount}
              </div>
            )}
          </NavLink>
          <NavLink to="/transactions" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Wallet size={20} />
            <span>บัญชี/รายรับรายจ่าย</span>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span className="text-muted" style={{ fontWeight: 500 }}>🍰 ผู้ดูแลระบบ</span>
            <button 
              onClick={logout}
              style={{
                background: 'transparent',
                border: '1px solid #ff4757',
                color: '#ff4757',
                padding: '0.25rem 0.75rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem'
              }}
            >
              ออกระบบ
            </button>
          </div>
        </header>
        
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) return null;
  
  if (!isAuthenticated) {
    return <Login />;
  }
  
  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Customer Route (No Sidebar) */}
          <Route path="/shop" element={<CustomerShop />} />

          {/* Admin Routes (With Sidebar & Protected) */}
          <Route path="/" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="pos" element={<POS />} />
            <Route path="menu" element={<Menu />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="preorders" element={<Preorders />} />
            <Route path="transactions" element={<Transactions />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
