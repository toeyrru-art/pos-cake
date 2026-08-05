import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Ticket, Send, Plus, Trash2, Edit2, Save, X, CheckCircle2, AlertCircle, Sparkles, Megaphone, MessageSquare, Bot, Sparkle } from 'lucide-react';
import { createPortal } from 'react-dom';

export default function Promotions() {
  const [promoCodes, setPromoCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state for Promo Code
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    discount_type: 'fixed',
    discount_value: '',
    min_spend: '0',
    is_active: true
  });

  // Removed FB states

  useEffect(() => {
    fetchPromoCodes();
  }, []);

  const fetchPromoCodes = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('promo_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) setPromoCodes(data);
    } catch (e) {
      console.log('Error fetching promo codes:', e);
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

  const savePromoCode = async (e) => {
    e.preventDefault();
    if (!formData.code || !formData.discount_value) {
      return alert('กรุณากรอกโค้ดส่วนลดและมูลค่าส่วนลด');
    }

    const payload = {
      code: formData.code.trim().toUpperCase(),
      discount_type: formData.discount_type,
      discount_value: parseFloat(formData.discount_value),
      min_spend: parseFloat(formData.min_spend) || 0,
      is_active: formData.is_active
    };

    try {
      if (editingId) {
        const { error } = await supabase.from('promo_codes').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('promo_codes').insert([payload]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      resetForm();
      fetchPromoCodes();
      alert('บันทึกโค้ดส่วนลดสำเร็จ!');
    } catch (err) {
      if (err.message.includes('promo_codes') || err.message.includes('schema cache') || err.message.includes('row-level security') || err.code === '42501') {
        alert('กรุณารัน SQL ใน Supabase เพื่อสร้างตาราง promo_codes ก่อนนะครับ:\n\nCREATE TABLE IF NOT EXISTS promo_codes (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  code text UNIQUE NOT NULL,\n  discount_type text DEFAULT \'fixed\',\n  discount_value numeric NOT NULL,\n  min_spend numeric DEFAULT 0,\n  is_active boolean DEFAULT true,\n  created_at timestamp with time zone DEFAULT timezone(\'utc\'::text, now())\n);\n\nALTER TABLE promo_codes DISABLE ROW LEVEL SECURITY;');
      } else {
        alert('เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
      }
    }
  };

  const editPromoCode = (item) => {
    setEditingId(item.id);
    setFormData({
      code: item.code,
      discount_type: item.discount_type || 'fixed',
      discount_value: item.discount_value,
      min_spend: item.min_spend || '0',
      is_active: item.is_active !== false
    });
    setIsModalOpen(true);
  };

  const deletePromoCode = async (id) => {
    if (window.confirm('ต้องการลบโค้ดส่วนลดนี้ใช่หรือไม่?')) {
      try {
        const { error } = await supabase.from('promo_codes').delete().eq('id', id);
        if (error) throw error;
        fetchPromoCodes();
      } catch (err) {
        alert('เกิดข้อผิดพลาดในการลบ: ' + err.message);
      }
    }
  };

  const toggleCodeActive = async (id, currentStatus) => {
    const nextStatus = !currentStatus;
    try {
      const { error } = await supabase.from('promo_codes').update({ is_active: nextStatus }).eq('id', id);
      if (error) throw error;
      setPromoCodes(prev => prev.map(p => p.id === id ? { ...p, is_active: nextStatus } : p));
    } catch (e) {
      alert('เกิดข้อผิดพลาด: ' + e.message);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({ code: '', discount_type: 'fixed', discount_value: '', min_spend: '0', is_active: true });
  };

  // Removed FB functions

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Ticket color="var(--primary)" size={24} /> โค้ดส่วนลด & บรอดแคสต์แจ้งเตือน
        </h3>

      </div>

      {/* Promo Codes Management Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h4 style={{ margin: 0, fontWeight: 'bold', fontSize: '1.1rem' }}>รายการโค้ดส่วนลดทั้งหมด ({promoCodes.length} โค้ด)</h4>
          <button className="btn btn-primary" onClick={() => { resetForm(); setIsModalOpen(true); }} style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}>
            <Plus size={16} /> เพิ่มโค้ดส่วนลด
          </button>
        </div>

        {loading ? (
          <p className="text-center text-muted">กำลังโหลดรายการโค้ด...</p>
        ) : promoCodes.length === 0 ? (
          <p className="text-center text-muted" style={{ padding: '2rem' }}>ยังไม่มีโค้ดส่วนลด กดปุ่มเพิ่มด้านบนเพื่อสร้างโค้ดแรกได้เลย</p>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>รหัสโค้ด (Code)</th>
                  <th>ส่วนลด</th>
                  <th>ยอดซื้อขั้นต่ำ</th>
                  <th>สถานะโค้ด</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {promoCodes.map((item) => {
                  const isActive = item.is_active !== false;
                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 'bold', fontSize: '1.05rem', color: 'var(--primary-dark)' }}>
                        <span style={{ backgroundColor: 'var(--primary-light)', padding: '0.3rem 0.75rem', borderRadius: '8px', border: '1px dashed var(--primary-dark)' }}>
                          {item.code}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {item.discount_type === 'percent' ? (
                          <span style={{ color: '#d97706' }}>ลด {item.discount_value}%</span>
                        ) : (
                          <span style={{ color: 'var(--primary-dark)' }}>ลด ฿{Number(item.discount_value).toFixed(2)}</span>
                        )}
                      </td>
                      <td>
                        {Number(item.min_spend) > 0 ? (
                          <span>ขั้นต่ำ ฿{Number(item.min_spend).toFixed(2)}</span>
                        ) : (
                          <span className="text-muted">ไม่มีขั้นต่ำ</span>
                        )}
                      </td>
                      <td>
                        <button
                          onClick={() => toggleCodeActive(item.id, item.is_active)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '20px',
                            border: 'none',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            backgroundColor: isActive ? 'rgba(52, 211, 153, 0.15)' : 'rgba(251, 113, 133, 0.15)',
                            color: isActive ? '#059669' : '#e11d48',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {isActive ? <><CheckCircle2 size={16} /> ใช้งานได้</> : <><X size={16} /> ปิดใช้งาน</>}
                        </button>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button className="btn btn-outline" onClick={() => editPromoCode(item)} style={{ padding: '0.25rem 0.5rem' }}>
                            <Edit2 size={14} />
                          </button>
                          <button className="btn btn-outline" onClick={() => deletePromoCode(item.id)} style={{ padding: '0.25rem 0.5rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}>
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

      {/* Promo Code Form Modal */}
      {isModalOpen && createPortal(
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h4 className="modal-title">
                {editingId ? <Edit2 size={20} /> : <Plus size={20} />}
                {editingId ? 'แก้ไขโค้ดส่วนลด' : 'สร้างโค้ดส่วนลดใหม่'}
              </h4>
              <button type="button" className="modal-close" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={savePromoCode}>
              <div className="flex flex-col gap-3 mb-4">
                <div className="form-group">
                  <label className="form-label">รหัสโค้ดส่วนลด (เช่น BAKERY10)</label>
                  <input 
                    type="text" 
                    name="code" 
                    value={formData.code} 
                    onChange={handleInputChange} 
                    className="form-control premium-input" 
                    placeholder="เช่น WELCOME20" 
                    required 
                    style={{ textTransform: 'uppercase', fontWeight: 'bold' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">ประเภทส่วนลด</label>
                  <select 
                    name="discount_type" 
                    value={formData.discount_type} 
                    onChange={handleInputChange} 
                    className="form-control premium-input"
                  >
                    <option value="fixed">ลดเป็นบาท (เช่น ลด 20 บาท)</option>
                    <option value="percent">ลดเป็นเปอร์เซ็นต์ (เช่น ลด 10%)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">มูลค่าส่วนลด ({formData.discount_type === 'percent' ? '%' : 'บาท'})</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    name="discount_value" 
                    value={formData.discount_value} 
                    onChange={handleInputChange} 
                    className="form-control premium-input" 
                    placeholder={formData.discount_type === 'percent' ? 'เช่น 10 (หมายถึง 10%)' : 'เช่น 20 (หมายถึง 20 บาท)'} 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">ยอดซื้อขั้นต่ำ (บาท)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    name="min_spend" 
                    value={formData.min_spend} 
                    onChange={handleInputChange} 
                    className="form-control premium-input" 
                    placeholder="0 = ไม่กำหนดขั้นต่ำ" 
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontWeight: 500 }}>
                    <input 
                      type="checkbox" 
                      name="is_active" 
                      checked={formData.is_active} 
                      onChange={handleInputChange} 
                      style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                    />
                    เปิดใช้งานโค้ดส่วนลดนี้ทันที
                  </label>
                </div>
              </div>

              <div className="flex gap-2 justify-end mt-4">
                <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>ยกเลิก</button>
                <button type="submit" className="btn btn-primary">
                  {editingId ? <><Save size={16}/> บันทึกการแก้ไข</> : <><Plus size={16}/> ยืนยันสร้างโค้ด</>}
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
