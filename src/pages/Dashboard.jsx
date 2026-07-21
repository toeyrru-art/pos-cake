import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Package, Cake, ShoppingCart, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [stats, setStats] = useState({
    ingredients: 0,
    products: 0,
    salesToday: 0,
    incomeToday: 0,
    lowStockIngredients: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Ingredients count
      const { count: iCount } = await supabase.from('ingredients').select('*', { count: 'exact', head: true });
      
      // Products count
      const { count: pCount } = await supabase.from('products').select('*', { count: 'exact', head: true });

      // Sales count today
      const { data: salesData } = await supabase
        .from('sales')
        .select('total_amount')
        .gte('created_at', today.toISOString());
      
      let salesCount = 0;
      let income = 0;
      
      if (salesData) {
        salesCount = salesData.length;
        income = salesData.reduce((acc, sale) => acc + Number(sale.total_amount), 0);
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
        lowStockIngredients: lowStockList
      });

      setLoading(false);
    }
    
    fetchStats();
  }, []);

  if (loading) return <div className="text-center mt-4">กำลังโหลด...</div>;

  return (
    <div>
      <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>ภาพรวมระบบ</h3>

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
