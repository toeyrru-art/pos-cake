import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { Cake, ShoppingCart, DollarSign, Store as StoreIcon, BarChart3, TrendingUp, Calendar, Settings, X, ChevronDown, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState({
    products: 0,
    salesToday: 0,
    incomeToday: 0,
    financeData: [],
    topSellers: [],
    totalIncome7Days: 0,
    totalExpense7Days: 0,
    totalProfit7Days: 0
  });
  const [loading, setLoading] = useState(true);
  const [isStoreOpen, setIsStoreOpen] = useState(true);
  const [pickupDateMode, setPickupDateMode] = useState('customer');
  const [fixedPickupDate, setFixedPickupDate] = useState('');
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  
  const [salesDateStart, setSalesDateStart] = useState('');
  const [salesDateEnd, setSalesDateEnd] = useState('');
  const [salesProductFilters, setSalesProductFilters] = useState([]);
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [rawSaleItems, setRawSaleItems] = useState([]);
  const [productList, setProductList] = useState([]);
  const [filteredTopSellers, setFilteredTopSellers] = useState([]);

  useEffect(() => {
    let filtered = rawSaleItems;
    if (salesDateStart) {
      const startDate = new Date(salesDateStart);
      startDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(item => new Date(item.created_at) >= startDate);
    }
    if (salesDateEnd) {
      const endDate = new Date(salesDateEnd);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(item => new Date(item.created_at) <= endDate);
    }
    if (salesProductFilters.length > 0) {
      filtered = filtered.filter(item => salesProductFilters.includes(item.products?.name));
    }
    
    const sellerMap = {};
    filtered.forEach(item => {
      const pName = item.products?.name || 'Unknown';
      if (!sellerMap[pName]) sellerMap[pName] = { quantity: 0, revenue: 0 };
      sellerMap[pName].quantity += item.quantity;
      sellerMap[pName].revenue += (item.quantity * (item.price_at_time || 0));
    });
    
    const topSellers = Object.keys(sellerMap)
      .map(key => ({ name: key, sales: sellerMap[key].quantity, revenue: sellerMap[key].revenue }))
      .sort((a, b) => b.sales - a.sales);
      
    setFilteredTopSellers(topSellers);
  }, [rawSaleItems, salesDateStart, salesDateEnd, salesProductFilters]);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Products count
      const { count: pCount } = await supabase.from('products').select('*', { count: 'exact', head: true });

      // Fetch 7 days sales for chart
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const { data: allSalesData } = await supabase
        .from('sales')
        .select('total_amount, created_at')
        .gte('created_at', today.toISOString());
      
      let salesCount = allSalesData ? allSalesData.length : 0;

      // Fetch 7 days transactions for chart
      const { data: allTxData } = await supabase
        .from('transactions')
        .select('amount, type, created_at')
        .gte('created_at', sevenDaysAgo.toISOString());

      // Compute Daily Finance Data
      const financeMap = {};
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' });
        financeMap[dateStr] = { name: dateStr, รายรับ: 0, รายจ่าย: 0, กำไร: 0 };
      }

      let income = 0;
      let totalIncome7Days = 0;
      let totalExpense7Days = 0;
      
      if (allTxData) {
        allTxData.forEach(tx => {
          const d = new Date(tx.created_at);
          const dateStr = d.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' });
          
          if (tx.type === 'income') totalIncome7Days += Number(tx.amount);
          if (tx.type === 'expense') totalExpense7Days += Number(tx.amount);

          if (financeMap[dateStr]) {
            if (tx.type === 'income') {
              financeMap[dateStr].รายรับ += Number(tx.amount);
            } else if (tx.type === 'expense') {
              financeMap[dateStr].รายจ่าย += Number(tx.amount);
            }
            financeMap[dateStr].กำไร = financeMap[dateStr].รายรับ - financeMap[dateStr].รายจ่าย;
          }
          
          if (d >= today && tx.type === 'income') {
            income += Number(tx.amount);
          }
        });
      }

      // Convert finance map to array (oldest to newest)
      const financeData = Object.keys(financeMap).reverse().map(key => financeMap[key]);

      // Top Sellers (now fetched with created_at for filtering)
      const { data: saleItemsData } = await supabase
        .from('sale_items')
        .select('quantity, price_at_time, created_at, products(name)');
        
      if (saleItemsData) {
        setRawSaleItems(saleItemsData);
        const uniqueProducts = Array.from(new Set(saleItemsData.map(item => item.products?.name).filter(Boolean))).sort();
        setProductList(uniqueProducts);
      }

      // Store settings
      try {
        const { data: settingsData } = await supabase
          .from('store_settings')
          .select('*')
          .in('key', ['is_store_open', 'pickup_date_mode', 'fixed_pickup_date']);
          
        if (settingsData) {
          settingsData.forEach(setting => {
            if (setting.key === 'is_store_open' && String(setting.value) === 'false') setIsStoreOpen(false);
            if (setting.key === 'pickup_date_mode') setPickupDateMode(setting.value);
            if (setting.key === 'fixed_pickup_date') setFixedPickupDate(setting.value);
            if (setting.key === 'slack_webhook_url') setSlackWebhookUrl(setting.value);
          });
        }
      } catch (e) {
        console.log('Error fetching store setting');
      }

      setStats({
        products: pCount || 0,
        salesToday: salesCount,
        incomeToday: income,
        financeData,
        totalIncome7Days,
        totalExpense7Days,
        totalProfit7Days: totalIncome7Days - totalExpense7Days
      });

      setLoading(false);
    }
    
    fetchStats();
  }, []);

  const toggleStore = async () => {
    const newVal = !isStoreOpen;
    setIsStoreOpen(newVal);
    
    try {
      const { error } = await supabase
        .from('store_settings')
        .upsert({ key: 'is_store_open', value: newVal.toString() }, { onConflict: 'key' });

      if (error) {
        setIsStoreOpen(!newVal); // revert state on error
        alert('เกิดข้อผิดพลาดในการเปลี่ยนสถานะร้าน: ' + error.message);
      }
    } catch (e) {
      console.log('Error saving store status', e);
    }
  };

  const saveDateSettings = async () => {
    setSavingSettings(true);
    try {
      await supabase
        .from('store_settings')
        .upsert([
          { key: 'pickup_date_mode', value: pickupDateMode },
          { key: 'fixed_pickup_date', value: fixedPickupDate },
          { key: 'slack_webhook_url', value: slackWebhookUrl }
        ], { onConflict: 'key' });
      alert('บันทึกการตั้งค่าสำเร็จ');
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการบันทึกการตั้งค่า: ' + e.message);
    }
    setSavingSettings(false);
  };

  if (loading) return <div className="text-center mt-4">กำลังโหลด...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>ภาพรวมระบบ</h3>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: 'white', padding: '0.75rem 1.5rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
            <StoreIcon size={20} color={isStoreOpen ? 'var(--success)' : 'var(--danger)'} />
            สถานะหน้าร้าน
          </div>
          <button 
            onClick={toggleStore}
            style={{ 
              backgroundColor: isStoreOpen ? 'var(--success)' : 'var(--danger)', 
              color: 'white', 
              border: 'none', 
              padding: '0.5rem 1.25rem', 
              borderRadius: '24px', 
              cursor: 'pointer', 
              fontWeight: 'bold',
              transition: 'background-color 0.2s',
              minWidth: '100px'
            }}
          >
            {isStoreOpen ? 'กำลังเปิด' : 'ปิดร้านอยู่'}
          </button>
          <button
            onClick={() => setIsSettingsModalOpen(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.25rem'
            }}
            title="ตั้งค่าระบบ"
          >
            <Settings size={24} />
          </button>
        </div>
      </div>

      {isSettingsModalOpen && createPortal(
        <div className="modal-overlay" onClick={() => setIsSettingsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Settings size={20} /> ตั้งค่าระบบ
              </h3>
              <button onClick={() => setIsSettingsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={24} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem', fontSize: '1.1rem', color: 'var(--primary-dark)' }}>
                  <Calendar size={20} /> ตั้งค่าวันนัดรับเค้ก
                </h4>
                <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.5rem', fontWeight: 500 }}>
                      <input type="radio" name="dateMode" value="customer" checked={pickupDateMode === 'customer'} onChange={() => setPickupDateMode('customer')} />
                      ให้ลูกค้าเลือกวันรับเอง
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 500 }}>
                      <input type="radio" name="dateMode" value="fixed" checked={pickupDateMode === 'fixed'} onChange={() => setPickupDateMode('fixed')} />
                      กำหนดวันรับเค้ก (รอบส่ง)
                    </label>
                  </div>
                  {pickupDateMode === 'fixed' && (
                    <div>
                      <input 
                        type="date" 
                        className="form-control premium-input" 
                        value={fixedPickupDate} 
                        onChange={(e) => setFixedPickupDate(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: 0 }} />
              <div>
                <h4 style={{ margin: '0 0 1rem', fontSize: '1.1rem', color: 'var(--primary-dark)' }}>
                  ตั้งค่าแจ้งเตือน (Slack Webhook URL)
                </h4>
                <input 
                  type="text" 
                  className="form-control premium-input" 
                  placeholder="วาง Slack Webhook URL ที่นี่..." 
                  value={slackWebhookUrl} 
                  onChange={(e) => setSlackWebhookUrl(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: 0 }} />
              <div>
                <h4 style={{ margin: '0 0 1rem', fontSize: '1.1rem', color: 'var(--primary-dark)' }}>
                  การแจ้งเตือนผ่านบราวเซอร์ (Push Notifications)
                </h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  กดปุ่มด้านล่างเพื่ออนุญาตให้เครื่องนี้รับการแจ้งเตือน (เช่น เมื่อมีออร์เดอร์ใหม่) ได้แม้จะปิดหน้าเว็บไปแล้ว (ต้องติดตั้งเว็บนี้เป็นแอป PWA ในมือถือก่อน)
                </p>
                <button 
                  className="btn" 
                  style={{ background: 'var(--primary)', color: 'white' }}
                  onClick={async () => {
                    try {
                      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                        alert('เบราว์เซอร์นี้ไม่รองรับ Push Notifications');
                        return;
                      }
                      const permission = await Notification.requestPermission();
                      if (permission !== 'granted') {
                        alert('กรุณาอนุญาตการแจ้งเตือนในตั้งค่าเบราว์เซอร์');
                        return;
                      }
                      
                      const urlBase64ToUint8Array = (base64String) => {
                        const padding = '='.repeat((4 - base64String.length % 4) % 4);
                        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
                        const rawData = window.atob(base64);
                        const outputArray = new Uint8Array(rawData.length);
                        for (let i = 0; i < rawData.length; ++i) {
                          outputArray[i] = rawData.charCodeAt(i);
                        }
                        return outputArray;
                      };

                      const reg = await navigator.serviceWorker.register('/sw.js');
                      await navigator.serviceWorker.ready;
                      
                      const sub = await reg.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlBase64ToUint8Array('BOIRzc9lq2BvR35CAOJetY5L1MWMarQsgzdueym9jI9wJx191ZoUqdVx4eF1F18fUoCinLjx8V-099VCDAR879g')
                      });
                      
                      const { data: currentSettings } = await supabase.from('store_settings').select('value').eq('key', 'push_subscriptions').maybeSingle();
                      let currentSubs = [];
                      if (currentSettings && currentSettings.value) {
                        currentSubs = JSON.parse(currentSettings.value);
                      }
                      
                      // Check if already subscribed
                      const isSubscribed = currentSubs.some(s => s.endpoint === sub.endpoint);
                      if (!isSubscribed) {
                        currentSubs.push(sub);
                        await supabase.from('store_settings').update({ value: JSON.stringify(currentSubs) }).eq('key', 'push_subscriptions');
                        alert('บันทึกการรับแจ้งเตือนบนเครื่องนี้เรียบร้อยแล้ว!');
                      } else {
                        alert('เครื่องนี้เปิดรับการแจ้งเตือนไว้แล้วครับ');
                      }
                    } catch (err) {
                      console.error('Push subscription failed:', err);
                      alert('เกิดข้อผิดพลาด: ' + err.message);
                    }
                  }}
                >
                  เปิดรับการแจ้งเตือนบนเครื่องนี้ 🔔
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button 
                  className="btn btn-primary" 
                  onClick={async () => {
                    await saveDateSettings();
                    setIsSettingsModalOpen(false);
                  }} 
                  disabled={savingSettings || (pickupDateMode === 'fixed' && !fixedPickupDate)}
                >
                  {savingSettings ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
        
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '2rem 1rem' }}>
          <div style={{ padding: '1rem', backgroundColor: 'var(--primary-light)', borderRadius: '50%', color: 'var(--primary-dark)', marginBottom: '1rem' }}>
            <DollarSign size={32} />
          </div>
          <div className="text-muted" style={{ marginBottom: '0.5rem' }}>ยอดขายวันนี้</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary-dark)' }}>฿{stats.incomeToday.toFixed(2)}</div>
          <div style={{ fontSize: '0.875rem', marginTop: '0.5rem' }} className="text-muted">จำนวน {stats.salesToday} บิล</div>
          <Link to="/transactions" className="btn btn-outline" style={{ marginTop: '1rem', width: '100%' }}>ดูรายรับ-รายจ่าย</Link>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '2rem 1rem' }}>
          <div style={{ padding: '1rem', backgroundColor: 'rgba(134, 239, 172, 0.2)', borderRadius: '50%', color: 'var(--success)', marginBottom: '1rem' }}>
            <ShoppingCart size={32} />
          </div>
          <div className="text-muted" style={{ marginBottom: '0.5rem' }}>ระบบหน้าร้าน</div>
          <div style={{ fontSize: '1rem', fontWeight: '500', margin: '1rem 0' }}>พร้อมให้บริการขายสินค้า</div>
          <Link to="/pos" className="btn btn-primary" style={{ marginTop: 'auto', width: '100%', backgroundColor: 'var(--success)' }}>เปิดหน้าขาย (POS)</Link>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '2rem 1rem' }}>
          <div style={{ padding: '1rem', backgroundColor: 'rgba(252, 165, 165, 0.2)', borderRadius: '50%', color: 'var(--danger)', marginBottom: '1rem' }}>
            <Cake size={32} />
          </div>
          <div className="text-muted" style={{ marginBottom: '0.5rem' }}>เมนูเค้กทั้งหมด</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.products}</div>
          <Link to="/menu" className="btn btn-outline" style={{ marginTop: '1rem', width: '100%' }}>จัดการเมนู</Link>
        </div>

      </div>

      {/* Analytics Section */}
      <div style={{ display: 'flex', gap: '1.5rem', marginTop: '2rem', flexWrap: 'wrap' }}>
        {/* Main Charts Area */}
        <div style={{ flex: '1 1 60%', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* 7-Days Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ padding: '1.5rem', textAlign: 'center', backgroundColor: 'var(--success)', color: 'white', border: 'none' }}>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>รายรับ (7 วัน)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '0.5rem' }}>฿{stats.totalIncome7Days.toFixed(2)}</div>
            </div>
            <div className="card" style={{ padding: '1.5rem', textAlign: 'center', backgroundColor: 'var(--danger)', color: 'white', border: 'none' }}>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>รายจ่าย (7 วัน)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '0.5rem' }}>฿{stats.totalExpense7Days.toFixed(2)}</div>
            </div>
            <div className="card" style={{ padding: '1.5rem', textAlign: 'center', backgroundColor: 'var(--primary-dark)', color: 'white', border: 'none' }}>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>กำไรสุทธิ (7 วัน)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '0.5rem' }}>฿{stats.totalProfit7Days.toFixed(2)}</div>
            </div>
          </div>

          {/* Income & Expense Chart */}
          <div className="card" style={{ height: '320px', display: 'flex', flexDirection: 'column' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontWeight: 'bold', color: 'var(--primary-dark)' }}>
              <BarChart3 size={20} /> กราฟรายรับและรายจ่าย 7 วันย้อนหลัง
            </h4>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.financeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                <Tooltip cursor={{ fill: 'var(--bg-sidebar)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }} />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                <Bar dataKey="รายรับ" fill="var(--success)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="รายจ่าย" fill="var(--danger)" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Profit Area Chart */}
          <div className="card" style={{ height: '280px', display: 'flex', flexDirection: 'column' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontWeight: 'bold', color: 'var(--primary-dark)' }}>
              <TrendingUp size={20} /> กราฟกำไรสุทธิ
            </h4>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.financeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary-dark)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--primary-dark)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }} />
                <Area type="monotone" dataKey="กำไร" stroke="var(--primary-dark)" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Sellers */}
        <div className="card" style={{ flex: '1 1 35%', minWidth: '300px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', color: 'var(--primary-dark)', margin: 0 }}>
              <TrendingUp size={20} /> ยอดขายสินค้าทั้งหมด
            </h4>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              
              {/* Date Range Picker */}
              <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f8f9fa', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.2rem 0.5rem' }}>
                <input 
                  type="date" 
                  value={salesDateStart}
                  onChange={(e) => setSalesDateStart(e.target.value)}
                  style={{ border: 'none', backgroundColor: 'transparent', outline: 'none', padding: '0.4rem', fontSize: '0.85rem', color: 'var(--primary-dark)', cursor: 'pointer' }}
                />
                <span style={{ color: '#cbd5e1', margin: '0 0.25rem' }}>-</span>
                <input 
                  type="date" 
                  value={salesDateEnd}
                  onChange={(e) => setSalesDateEnd(e.target.value)}
                  style={{ border: 'none', backgroundColor: 'transparent', outline: 'none', padding: '0.4rem', fontSize: '0.85rem', color: 'var(--primary-dark)', cursor: 'pointer' }}
                />
              </div>

              {/* Product Multi-select */}
              <div style={{ position: 'relative' }}>
                <button 
                  onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.5rem 1rem', fontSize: '0.9rem', borderRadius: '10px', 
                    backgroundColor: salesProductFilters.length > 0 ? 'var(--primary-light)' : 'white', 
                    border: salesProductFilters.length > 0 ? '1px solid var(--primary-dark)' : '1px solid #e2e8f0',
                    color: salesProductFilters.length > 0 ? 'var(--primary-dark)' : '#64748b',
                    cursor: 'pointer', transition: 'all 0.2s', minWidth: '160px', justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Filter size={16} />
                    {salesProductFilters.length === 0 ? 'ทุกสินค้า' : `เลือกแล้ว ${salesProductFilters.length}`}
                  </div>
                  <ChevronDown size={16} style={{ opacity: 0.6 }} />
                </button>
                
                {isProductDropdownOpen && (
                  <div style={{ 
                    position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', 
                    backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', 
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', 
                    zIndex: 20, minWidth: '220px', maxHeight: '300px', overflowY: 'auto' 
                  }}>
                    <div 
                      style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--primary-dark)', display: 'flex', justifyContent: 'center' }}
                      onClick={() => { setSalesProductFilters([]); setIsProductDropdownOpen(false); }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                    >
                      ล้างตัวเลือกทั้งหมด
                    </div>
                    {productList.map((p, i) => (
                      <label key={i} style={{ 
                        display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', 
                        cursor: 'pointer', borderBottom: '1px solid #f8f9fa', transition: 'background-color 0.1s' 
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <input 
                          type="checkbox" 
                          checked={salesProductFilters.includes(p)}
                          style={{ accentColor: 'var(--primary-dark)', width: '16px', height: '16px', cursor: 'pointer' }}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSalesProductFilters([...salesProductFilters, p]);
                            } else {
                              setSalesProductFilters(salesProductFilters.filter(item => item !== p));
                            }
                          }}
                        />
                        <span style={{ fontSize: '0.9rem', color: '#334155' }}>{p}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          {filteredTopSellers.length === 0 ? (
            <div className="text-center text-muted" style={{ padding: '2rem 0' }}>ยังไม่มีข้อมูลการขาย</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {filteredTopSellers.map((item, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', backgroundColor: 'var(--primary-light)', borderRadius: '8px' }}>
                  <div style={{ width: '28px', height: '28px', backgroundColor: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--primary-dark)' }}>
                    {index + 1}
                  </div>
                  <div style={{ flex: 1, fontWeight: 500 }}>{item.name}</div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--primary-dark)' }}>{item.sales} ชิ้น</div>
                    {item.revenue > 0 && <div style={{ fontSize: '0.8rem', color: '#64748b' }}>฿{item.revenue.toLocaleString()}</div>}
                  </div>
                </div>
              ))}
              
              <div style={{ 
                marginTop: '0.5rem', paddingTop: '1rem', borderTop: '2px dashed #e2e8f0', 
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold' 
              }}>
                <div style={{ color: '#334155' }}>รวมยอดขายทั้งหมด:</div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: 'var(--primary-dark)', fontSize: '1.1rem' }}>
                    {filteredTopSellers.reduce((sum, item) => sum + item.sales, 0)} ชิ้น
                  </div>
                  <div style={{ color: 'var(--success)', fontSize: '1.1rem' }}>
                    ฿{filteredTopSellers.reduce((sum, item) => sum + item.revenue, 0).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
