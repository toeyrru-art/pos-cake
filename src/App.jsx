import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Outlet } from 'react-router-dom';
import { Award, Cake, Wheat, LayoutDashboard, Store, Wallet, CalendarClock, Calendar as CalendarIcon, Ticket, Menu as MenuIcon, X } from 'lucide-react';
import { supabase } from './lib/supabase';
import './index.css';

import Inventory from './pages/Inventory';
import Menu from './pages/Menu';
import POS from './pages/POS';
import Transactions from './pages/Transactions';
import Dashboard from './pages/Dashboard';
import Preorders from './pages/Preorders';
import BakingCalendar from './pages/BakingCalendar';
import CustomerShop from './pages/CustomerShop';
import Members from './pages/Members';
import Promotions from './pages/Promotions';
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
    fetchPendingCount();

    const channel = supabase
      .channel('preorders-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'preorders' },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new?.status === 'pending') {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.play().catch(e => console.log('Audio play failed:', e));
          }
          fetchPendingCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  React.useEffect(() => {
    if (pendingCount > 0) {
      document.title = `(${pendingCount}) ออร์เดอร์ใหม่ - บ้านทุ่ง เบเกอรี่`;
    } else {
      document.title = "บ้านทุ่ง เบเกอรี่ (Admin)";
    }
  }, [pendingCount]);

  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="app-container">
      {/* Backdrop overlay for mobile drawer */}
      {isSidebarOpen && (
        <div className="sidebar-backdrop" onClick={closeSidebar} />
      )}

      {/* Sidebar Drawer */}
      <aside className={`sidebar ${isSidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <img src="/logo.jpg" alt="บ้านทุ่ง เบเกอรี่ Logo" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary-light)', flexShrink: 0 }} />
            <div>
              <h1 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 'bold', color: 'var(--primary-dark)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>บ้านทุ่ง เบเกอรี่</h1>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.05em' }}>BAKERY HOME MADE</div>
            </div>
          </div>
          <button 
            type="button"
            className="sidebar-close-btn"
            onClick={closeSidebar}
          >
            <X size={20} />
          </button>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeSidebar} end>
            <LayoutDashboard size={20} />
            <span>แดชบอร์ด</span>
          </NavLink>
          <NavLink to="/pos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeSidebar}>
            <Store size={20} />
            <span>บันทึกออร์เดอร์</span>
          </NavLink>
          <NavLink to="/menu" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeSidebar}>
            <Cake size={20} />
            <span>เมนูเค้ก</span>
          </NavLink>
          <NavLink to="/preorders" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeSidebar} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
          <NavLink to="/calendar" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeSidebar}>
            <CalendarIcon size={20} />
            <span>ปฏิทินวางแผนทำเค้ก</span>
          </NavLink>
          <NavLink to="/transactions" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeSidebar}>
            <Wallet size={20} />
            <span>บัญชี/รายรับรายจ่าย</span>
          </NavLink>
          <NavLink to="/members" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeSidebar}>
            <Award size={20} />
            <span>ระบบสมาชิก/แต้ม</span>
          </NavLink>
          <NavLink to="/promotions" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeSidebar}>
            <Ticket size={20} />
            <span>โค้ดส่วนลด/บรอดแคสต์</span>
          </NavLink>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            className="mobile-menu-btn btn btn-outline" 
            style={{ padding: '0.4rem', border: 'none', background: 'var(--primary-light)', color: 'var(--primary-dark)', borderRadius: '50%', cursor: 'pointer' }}
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open Menu"
          >
            <MenuIcon size={22} />
          </button>
          <h2 style={{ flex: 1, margin: 0, fontSize: '1.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>บ้านทุ่ง เบเกอรี่ (Bakery & Cafe)</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button 
              onClick={logout}
              style={{
                background: 'transparent',
                border: '1px solid #ff4757',
                color: '#ff4757',
                padding: '0.3rem 0.75rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem'
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
            <Route path="members" element={<Members />} />
            <Route path="promotions" element={<Promotions />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="preorders" element={<Preorders />} />
            <Route path="calendar" element={<BakingCalendar />} />
            <Route path="transactions" element={<Transactions />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
