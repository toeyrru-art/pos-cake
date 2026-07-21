import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Clock, CheckCircle, PackageCheck, XCircle, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

export default function Preorders() {
  const [preorders, setPreorders] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch preorders
    const { data: preorderData } = await supabase
      .from('preorders')
      .select(`
        *,
        preorder_items (
          product_id,
          quantity,
          price_at_time,
          products ( 
            name,
            product_ingredients (
              ingredient_id,
              quantity_used
            )
          )
        )
      `)
      .order('created_at', { ascending: false });
      
    if (preorderData) setPreorders(preorderData);

    // Fetch ingredients for stock checking
    const { data: ingData } = await supabase.from('ingredients').select('*');
    if (ingData) setIngredients(ingData);

    setLoading(false);
  };

  const updateStatus = async (id, newStatus) => {
    if (!window.confirm(`ต้องการเปลี่ยนสถานะเป็น "${newStatus}" ใช่หรือไม่?`)) return;

    try {
      const { error } = await supabase
        .from('preorders')
        .update({ status: newStatus })
        .eq('id', id);
        
      if (error) throw error;
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const completeOrder = async (order) => {
    if (!window.confirm('ยืนยันลูกค้ามารับของแล้วใช่หรือไม่?\nระบบจะทำการตัดสต๊อกวัตถุดิบ และบันทึกเป็นรายรับอัตโนมัติ')) return;

    // 1. Verify Stock
    let stockErrors = [];
    const ingredientUsage = {};
    
    order.preorder_items.forEach(item => {
      item.products.product_ingredients.forEach(pi => {
        const totalUsedInRecipeUnit = pi.quantity_used * item.quantity;
        const ing = ingredients.find(i => i.id === pi.ingredient_id);
        const factor = ing?.conversion_factor || 1;
        const totalUsedInStorageUnit = totalUsedInRecipeUnit / factor;
        
        ingredientUsage[pi.ingredient_id] = (ingredientUsage[pi.ingredient_id] || 0) + totalUsedInStorageUnit;
      });
    });

    for (const [ingId, used] of Object.entries(ingredientUsage)) {
      const ing = ingredients.find(i => i.id === ingId);
      if (ing && ing.stock_quantity < used) {
        stockErrors.push(`วัตถุดิบ ${ing.name} ไม่พอ (ต้องการตัดสต๊อก: ${Number(used).toFixed(2)}, มี: ${ing.stock_quantity})`);
      }
    }

    if (stockErrors.length > 0) {
      alert("ไม่สามารถปิดออร์เดอร์ได้ สต๊อกวัตถุดิบไม่เพียงพอ:\n- " + stockErrors.join("\n- "));
      return;
    }

    try {
      // 2. Create Sale Record
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert([{ total_amount: order.total_amount }])
        .select()
        .single();
      
      if (saleError) throw saleError;
      
      // 3. Create Sale Items
      const saleItemsData = order.preorder_items.map(item => ({
        sale_id: saleData.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price_at_time: item.price_at_time
      }));
      await supabase.from('sale_items').insert(saleItemsData);

      // 4. Update Ingredients Stock
      for (const [ingId, used] of Object.entries(ingredientUsage)) {
        const ing = ingredients.find(i => i.id === ingId);
        await supabase
          .from('ingredients')
          .update({ stock_quantity: ing.stock_quantity - used })
          .eq('id', ingId);
      }

      // 5. Record Transaction
      await supabase.from('transactions').insert([{
        type: 'income',
        amount: order.total_amount,
        description: `พรีออร์เดอร์สำเร็จ (คุณ ${order.customer_name})`,
        reference_id: saleData.id
      }]);

      // 6. Update Preorder Status
      await supabase
        .from('preorders')
        .update({ status: 'completed' })
        .eq('id', order.id);

      alert('ปิดออร์เดอร์สำเร็จ! บันทึกยอดขายและตัดสต๊อกแล้ว');
      fetchData();
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  const deleteOrder = async (id) => {
    if (!window.confirm('คุณต้องการลบออร์เดอร์นี้ออกจากระบบอย่างถาวรใช่หรือไม่?')) return;

    try {
      const { error } = await supabase
        .from('preorders')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      fetchData();
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการลบ: ' + err.message);
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'pending': return <span style={{ padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-full)', backgroundColor: '#fef3c7', color: '#b45309', fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Clock size={14}/> รอดำเนินการ</span>;
      case 'accepted': return <span style={{ padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--primary-light)', color: 'var(--primary-dark)', fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle size={14}/> รับออร์เดอร์แล้ว</span>;
      case 'completed': return <span style={{ padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-full)', backgroundColor: '#dcfce7', color: '#166534', fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><PackageCheck size={14}/> เสร็จสิ้น</span>;
      case 'cancelled': return <span style={{ padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-full)', backgroundColor: '#fee2e2', color: '#b91c1c', fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><XCircle size={14}/> ยกเลิก</span>;
      default: return null;
    }
  };

  return (
    <div>
      <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>จัดการพรีออร์เดอร์ (Pre-orders)</h3>

      {loading ? (
        <p className="text-center text-muted">กำลังโหลด...</p>
      ) : preorders.length === 0 ? (
        <div className="card text-center text-muted">
          ยังไม่มีรายการพรีออร์เดอร์
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {preorders.map(order => (
            <div key={order.id} className="card" style={{ padding: '1.5rem' }}>
              <div 
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
              >
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.25rem' }}>คุณ {order.customer_name}</div>
                  <div className="text-muted" style={{ fontSize: '0.9rem' }}>
                    เบอร์โทร: {order.customer_phone} &bull; วันรับ: {new Date(order.pickup_date).toLocaleString('th-TH')}
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--primary-dark)', fontSize: '1.2rem' }}>฿{order.total_amount.toFixed(2)}</div>
                    <div>{getStatusBadge(order.status)}</div>
                  </div>
                  {expandedId === order.id ? <ChevronUp className="text-muted" /> : <ChevronDown className="text-muted" />}
                </div>
              </div>

              {expandedId === order.id && (
                <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                  <h4 style={{ fontSize: '1rem', marginBottom: '1rem' }}>รายการที่สั่ง:</h4>
                  <ul style={{ listStyle: 'none', padding: 0, marginBottom: '1.5rem' }}>
                    {order.preorder_items.map((item, idx) => (
                      <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px dashed var(--border)' }}>
                        <span>{item.products?.name} x <strong style={{ color: 'var(--primary-dark)' }}>{item.quantity}</strong></span>
                        <span>฿{(item.price_at_time * item.quantity).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>

                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {order.status === 'pending' && (
                      <>
                        <button className="btn btn-primary" onClick={() => updateStatus(order.id, 'accepted')}>รับออร์เดอร์</button>
                        <button className="btn btn-outline" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => updateStatus(order.id, 'cancelled')}>ยกเลิกออร์เดอร์</button>
                      </>
                    )}
                    {order.status === 'accepted' && (
                      <button className="btn" style={{ backgroundColor: 'var(--success)', color: 'white' }} onClick={() => completeOrder(order)}>
                        ลูกค้ามารับของแล้ว (ตัดสต๊อกและรับเงิน)
                      </button>
                    )}
                    
                    {/* Delete Button */}
                    <button 
                      className="btn btn-outline" 
                      style={{ borderColor: 'transparent', color: 'var(--text-muted)', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.25rem' }} 
                      onClick={() => deleteOrder(order.id)}
                    >
                      <Trash2 size={16} /> ลบออร์เดอร์นี้
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
