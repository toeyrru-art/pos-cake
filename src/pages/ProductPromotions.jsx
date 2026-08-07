import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ShoppingBag, Plus, Trash2, Edit2, Save, X, CheckCircle2 } from 'lucide-react';
import { createPortal } from 'react-dom';

export default function ProductPromotions() {
  const [promotions, setPromotions] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    product_id: '',
    condition_quantity: '',
    discount_amount: '',
    is_active: true
  });

  useEffect(() => {
    fetchProducts();
    fetchPromotions();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('id, name');
    if (data) setProducts(data);
  };

  const fetchPromotions = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('product_promotions')
        .select('*, product:products(name)')
        .order('created_at', { ascending: false });

      if (data) setPromotions(data);
    } catch (e) {
      console.log('Error fetching product promotions:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const savePromotion = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.condition_quantity || !formData.discount_amount) {
      return alert('กรุณากรอกข้อมูลให้ครบถ้วน');
    }

    const payload = {
      name: formData.name.trim(),
      product_id: formData.product_id ? formData.product_id : null,
      condition_quantity: parseInt(formData.condition_quantity, 10),
      discount_amount: parseFloat(formData.discount_amount),
      is_active: formData.is_active
    };

    try {
      if (editingId) {
        const { error } = await supabase.from('product_promotions').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('product_promotions').insert([payload]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      resetForm();
      fetchPromotions();
      alert('บันทึกโปรโมชั่นสำเร็จ!');
    } catch (err) {
      if (err.code === '42P01' || err.message?.includes('relation "product_promotions" does not exist')) {
        alert('กรุณารัน SQL ใน Supabase เพื่อสร้างตารางก่อนนะครับ...');
      } else {
        alert('เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
      }
    }
  };

  const editPromotion = (item) => {
    setEditingId(item.id);
    setFormData({
      name: item.name,
      product_id: item.product_id || '',
      condition_quantity: item.condition_quantity,
      discount_amount: item.discount_amount,
      is_active: item.is_active !== false
    });
    setIsModalOpen(true);
  };

  const deletePromotion = async (id) => {
    if (window.confirm('ต้องการลบโปรโมชั่นนี้ใช่หรือไม่?')) {
      try {
        const { error } = await supabase.from('product_promotions').delete().eq('id', id);
        if (error) throw error;
        fetchPromotions();
      } catch (err) {
        alert('เกิดข้อผิดพลาดในการลบ: ' + err.message);
      }
    }
  };

  const toggleActive = async (id, currentStatus) => {
    const nextStatus = !currentStatus;
    try {
      const { error } = await supabase.from('product_promotions').update({ is_active: nextStatus }).eq('id', id);
      if (error) throw error;
      setPromotions(prev => prev.map(p => p.id === id ? { ...p, is_active: nextStatus } : p));
    } catch (e) {
      alert('เกิดข้อผิดพลาด: ' + e.message);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({ name: '', product_id: '', condition_quantity: '', discount_amount: '', is_active: true });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShoppingBag color="var(--primary)" size={24} /> จัดการโปรโมชั่นสินค้า (ซื้อ X ลด Y)
        </h3>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h4 style={{ margin: 0, fontWeight: 'bold', fontSize: '1.1rem' }}>รายการโปรโมชั่นทั้งหมด</h4>
          <button className="btn btn-primary" onClick={() => { resetForm(); setIsModalOpen(true); }} style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}>
            <Plus size={16} /> เพิ่มโปรโมชั่น
          </button>
        </div>

        {loading ? (
          <p className="text-center text-muted">กำลังโหลด...</p>
        ) : promotions.length === 0 ? (
          <p className="text-center text-muted" style={{ padding: '2rem' }}>ยังไม่มีโปรโมชั่น กดปุ่มเพิ่มด้านบนเพื่อสร้างโปรแรกได้เลย</p>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>ชื่อโปรโมชั่น</th>
                  <th>สินค้าที่ร่วมรายการ</th>
                  <th>เงื่อนไขการซื้อ</th>
                  <th>ส่วนลด</th>
                  <th>สถานะ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {promotions.map((item) => {
                  const isActive = item.is_active !== false;
                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 'bold' }}>{item.name}</td>
                      <td>{item.product ? item.product.name : 'ทุกสินค้า (คละได้)'}</td>
                      <td>ซื้อครบ {item.condition_quantity} ชิ้น</td>
                      <td style={{ color: 'var(--primary-dark)', fontWeight: 600 }}>ลด ฿{Number(item.discount_amount).toFixed(2)}</td>
                      <td>
                        <button
                          onClick={() => toggleActive(item.id, item.is_active)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.35rem 0.75rem', borderRadius: '20px', border: 'none',
                            fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                            backgroundColor: isActive ? 'rgba(52, 211, 153, 0.15)' : 'rgba(251, 113, 133, 0.15)',
                            color: isActive ? '#059669' : '#e11d48'
                          }}
                        >
                          {isActive ? <><CheckCircle2 size={16} /> ใช้งานได้</> : <><X size={16} /> ปิดใช้งาน</>}
                        </button>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button className="btn btn-outline" onClick={() => editPromotion(item)} style={{ padding: '0.25rem 0.5rem' }}>
                            <Edit2 size={14} />
                          </button>
                          <button className="btn btn-outline" onClick={() => deletePromotion(item.id)} style={{ padding: '0.25rem 0.5rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && createPortal(
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h4 className="modal-title">
                {editingId ? <Edit2 size={20} /> : <Plus size={20} />}
                {editingId ? 'แก้ไขโปรโมชั่น' : 'สร้างโปรโมชั่นใหม่'}
              </h4>
              <button type="button" className="modal-close" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={savePromotion}>
              <div className="flex flex-col gap-3 mb-4">
                <div className="form-group">
                  <label className="form-label">ชื่อโปรโมชั่น</label>
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="form-control premium-input" placeholder="เช่น บราวนี่ 3 ชิ้น 25 บาท" required />
                </div>

                <div className="form-group">
                  <label className="form-label">สินค้าที่ร่วมรายการ</label>
                  <select name="product_id" value={formData.product_id} onChange={handleInputChange} className="form-control premium-input">
                    <option value="">-- ใช้ได้กับทุกสินค้า (คละรวมกันได้) --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <small className="text-muted" style={{ display: 'block', marginTop: '4px' }}>หากระบุสินค้า โปรจะนับยอดซื้อเฉพาะสินค้านั้นๆ</small>
                </div>

                <div className="flex gap-3">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">จำนวนชิ้นที่ต้องซื้อ</label>
                    <input type="number" min="2" step="1" name="condition_quantity" value={formData.condition_quantity} onChange={handleInputChange} className="form-control premium-input" placeholder="เช่น 3" required />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">ส่วนลดที่ได้รับ (บาท)</label>
                    <input type="number" min="1" step="0.01" name="discount_amount" value={formData.discount_amount} onChange={handleInputChange} className="form-control premium-input" placeholder="เช่น 5" required />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontWeight: 500 }}>
                    <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleInputChange} style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }} />
                    เปิดใช้งานโปรโมชั่นนี้ทันที
                  </label>
                </div>
              </div>

              <div className="flex gap-2 justify-end mt-4">
                <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>ยกเลิก</button>
                <button type="submit" className="btn btn-primary">
                  {editingId ? <><Save size={16}/> บันทึก</> : <><Plus size={16}/> สร้างโปรโมชั่น</>}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
