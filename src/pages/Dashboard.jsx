import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { Cake, ShoppingCart, DollarSign, Store as StoreIcon, BarChart3, TrendingUp, Calendar, Settings, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState({
    products: 0,
    salesToday: 0,
    incomeToday: 0,
    revenueData: [],
    topSellers: []
  });
  const [loading, setLoading] = useState(true);
  const [isStoreOpen, setIsStoreOpen] = useState(true);
  const [pickupDateMode, setPickupDateMode] = useState('customer');
  const [fixedPickupDate, setFixedPickupDate] = useState('');
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

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
        .gte('created_at', sevenDaysAgo.toISOString());
      
      // Compute Daily Revenue Data
      const revenueMap = {};
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' });
        revenueMap[dateStr] = 0;
      }

      let salesCount = 0;
      let income = 0;
      
      if (allSalesData) {
        allSalesData.forEach(sale => {
          const d = new Date(sale.created_at);
          const dateStr = d.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' });
          if (revenueMap[dateStr] !== undefined) {
            revenueMap[dateStr] += Number(sale.total_amount);
          }
          
          if (d >= today) {
            salesCount++;
            income += Number(sale.total_amount);
          }
        });
      }

      // Convert revenue map to array (oldest to newest)
      const revenueData = Object.keys(revenueMap).reverse().map(key => ({
        name: key,
        ยอดขาย: revenueMap[key]
      }));

      // Top Sellers
      const { data: saleItemsData } = await supabase
        .from('sale_items')
        .select('quantity, products(name)');
        
      const sellerMap = {};
      if (saleItemsData) {
        saleItemsData.forEach(item => {
          const pName = item.products?.name || 'Unknown';
          sellerMap[pName] = (sellerMap[pName] || 0) + item.quantity;
        });
      }
      
      const topSellers = Object.keys(sellerMap)
        .map(key => ({ name: key, sales: sellerMap[key] }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5);

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
        revenueData,
        topSellers
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
        {/* Revenue Chart */}
        <div className="card" style={{ flex: '1 1 60%', minWidth: '320px' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontWeight: 'bold', color: 'var(--primary-dark)' }}>
            <BarChart3 size={20} /> กราฟยอดขาย 7 วันย้อนหลัง
          </h4>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                <Tooltip cursor={{ fill: 'var(--primary-light)', opacity: 0.4 }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }} />
                <Bar dataKey="ยอดขาย" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Sellers */}
        <div className="card" style={{ flex: '1 1 35%', minWidth: '300px' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontWeight: 'bold', color: 'var(--primary-dark)' }}>
            <TrendingUp size={20} /> สินค้าขายดี 5 อันดับแรก
          </h4>
          {stats.topSellers.length === 0 ? (
            <div className="text-center text-muted" style={{ padding: '2rem 0' }}>ยังไม่มีข้อมูลการขาย</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {stats.topSellers.map((item, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', backgroundColor: 'var(--primary-light)', borderRadius: '8px' }}>
                  <div style={{ width: '28px', height: '28px', backgroundColor: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--primary-dark)' }}>
                    {index + 1}
                  </div>
                  <div style={{ flex: 1, fontWeight: 500 }}>{item.name}</div>
                  <div style={{ fontWeight: 'bold', color: 'var(--primary-dark)' }}>{item.sales} ชิ้น</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
