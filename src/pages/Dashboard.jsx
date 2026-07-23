import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Package, Cake, ShoppingCart, DollarSign, Store as StoreIcon, BarChart3, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState({
    ingredients: 0,
    products: 0,
    salesToday: 0,
    incomeToday: 0,
    ingredients: 0,
    products: 0,
    salesToday: 0,
    incomeToday: 0,
    lowStockIngredients: [],
    revenueData: [],
    topSellers: []
  });
  const [loading, setLoading] = useState(true);
  const [isStoreOpen, setIsStoreOpen] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Ingredients count
      const { count: iCount } = await supabase.from('ingredients').select('*', { count: 'exact', head: true });
      
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
          .eq('key', 'is_store_open')
          .single();
        if (settingsData && String(settingsData.value) === 'false') setIsStoreOpen(false);
      } catch (e) {
        console.log('Error fetching store setting');
      }

      // Low Stock Ingredients
      const { data: lowStockData } = await supabase
        .from('ingredients')
        .select('*, units!ingredients_unit_id_fkey(name)')
        .lte('stock_quantity', 5); // Will be updated to compare with min_stock_level via SQL view or just filter in JS since data is small
      
      // Wait, we can't easily do `stock_quantity <= min_stock_level` in Supabase standard query without an RPC or View.
      // So we will just fetch all ingredients and filter in JavaScript.
      const { data: allIngs } = await supabase
        .from('ingredients')
        .select('*, units!ingredients_unit_id_fkey(name)');
        
      const lowStockList = (allIngs || []).filter(ing => ing.stock_quantity <= (ing.min_stock_level || 5));

      setStats({
        ingredients: iCount || 0,
        products: pCount || 0,
        salesToday: salesCount,
        incomeToday: income,
        lowStockIngredients: lowStockList,
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
    
    // Upsert store_settings
    try {
      await supabase
        .from('store_settings')
        .upsert({ key: 'is_store_open', value: newVal.toString() });
    } catch (e) {
      console.log('Error saving store status');
    }
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
        </div>
      </div>

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

        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '2rem 1rem' }}>
          <div style={{ padding: '1rem', backgroundColor: 'rgba(253, 224, 71, 0.2)', borderRadius: '50%', color: '#ca8a04', marginBottom: '1rem' }}>
            <Package size={32} />
          </div>
          <div className="text-muted" style={{ marginBottom: '0.5rem' }}>วัตถุดิบในสต๊อก</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.ingredients}</div>
          <Link to="/inventory" className="btn btn-outline" style={{ marginTop: '1rem', width: '100%' }}>จัดการสต๊อก</Link>
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

      {/* Low Stock Alerts */}
      <div style={{ marginTop: '2rem' }}>
        {stats.lowStockIngredients.length > 0 && (
          <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)', marginBottom: '1rem', fontWeight: 'bold' }}>
              <Package size={20} /> แจ้งเตือนวัตถุดิบใกล้หมด!
            </h4>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>ชื่อวัตถุดิบ</th>
                    <th>คงเหลือ</th>
                    <th>จุดสั่งซื้อ</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.lowStockIngredients.map(ing => (
                    <tr key={ing.id}>
                      <td style={{ fontWeight: 500 }}>{ing.name}</td>
                      <td style={{ color: 'var(--danger)', fontWeight: 'bold' }}>
                        {ing.stock_quantity} {ing.units?.name}
                      </td>
                      <td className="text-muted">{ing.min_stock_level} {ing.units?.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-center">
              <Link to="/inventory" className="btn btn-outline" style={{ fontSize: '0.875rem' }}>ไปหน้าจัดการสต๊อก</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
