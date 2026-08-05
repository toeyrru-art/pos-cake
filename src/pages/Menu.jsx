import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Edit2, Save, X, Loader2, Cake, CheckCircle2, XCircle } from 'lucide-react';
import imageCompression from 'browser-image-compression';

export default function Menu() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    selling_price: '',
    image_url: '',
    preorder_limit: '',
    is_active: true,
    flavors: ''
  });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: prodData } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (prodData) setProducts(prodData);
    setLoading(false);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const toggleProductActive = async (id, currentStatus) => {
    const nextStatus = currentStatus === false ? true : false;
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: nextStatus })
        .eq('id', id);

      if (error) {
        if (error.message.includes('is_active')) {
          alert('กรุณารันคำสั่ง SQL ใน Supabase เพิ่มคอลัมน์ is_active ก่อนนะครับ:\n\nALTER TABLE products ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;');
          return;
        }
        throw error;
      }
      setProducts(prev => prev.map(p => p.id === id ? { ...p, is_active: nextStatus } : p));
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการเปลี่ยนสถานะ: ' + e.message);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploading(true);

      const options = {
        maxSizeMB: 0.2,
        maxWidthOrHeight: 800,
        useWebWorker: true,
        fileType: 'image/webp'
      };
      
      const compressedFile = await imageCompression(file, options);
      const fileExt = 'webp';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('cake-images')
        .upload(filePath, compressedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('cake-images')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, image_url: publicUrl }));
      alert('อัปโหลดรูปภาพสำเร็จ!');
    } catch (error) {
      alert('เกิดข้อผิดพลาดในการอัปโหลด: ' + error.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const saveProduct = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.selling_price) {
      alert('กรุณากรอกชื่อและราคาขาย');
      return;
    }

    const payload = {
      name: formData.name,
      selling_price: parseFloat(formData.selling_price),
      image_url: formData.image_url,
      preorder_limit: formData.preorder_limit ? parseInt(formData.preorder_limit, 10) : null,
      is_active: formData.is_active,
      flavors: formData.flavors
    };

    try {
      if (editingId) {
        let { error } = await supabase.from('products').update(payload).eq('id', editingId);
        if (error) {
          if (error.message.includes('flavors')) {
            alert('กรุณารันคำสั่ง SQL เพิ่มคอลัมน์ flavors ใน Supabase ก่อนนะครับ:\n\nALTER TABLE products ADD COLUMN IF NOT EXISTS flavors text;');
            delete payload.flavors;
          }
          if (error.message.includes('is_active')) {
            delete payload.is_active;
          }
          const retry = await supabase.from('products').update(payload).eq('id', editingId);
          if (retry.error) throw retry.error;
        }
      } else {
        let { error } = await supabase.from('products').insert([payload]);
        if (error) {
          if (error.message.includes('flavors')) {
            alert('กรุณารันคำสั่ง SQL เพิ่มคอลัมน์ flavors ใน Supabase ก่อนนะครับ:\n\nALTER TABLE products ADD COLUMN IF NOT EXISTS flavors text;');
            delete payload.flavors;
          }
          if (error.message.includes('is_active')) {
            delete payload.is_active;
          }
          const retry = await supabase.from('products').insert([payload]);
          if (retry.error) throw retry.error;
        }
      }

      resetForm();
      fetchData();
      setIsModalOpen(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const editProduct = (product) => {
    setEditingId(product.id);
    setFormData({
      name: product.name,
      selling_price: product.selling_price,
      image_url: product.image_url || '',
      preorder_limit: product.preorder_limit || '',
      is_active: product.is_active !== false,
      flavors: product.flavors || ''
    });
    setIsModalOpen(true);
  };

  const deleteProduct = async (id) => {
    if (window.confirm('ต้องการลบเมนูนี้ใช่หรือไม่?')) {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) alert(error.message);
      else fetchData();
    }
  };

  const resetForm = () => {
    setFormData({ name: '', selling_price: '', image_url: '', preorder_limit: '', is_active: true, flavors: '' });
    setEditingId(null);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>จัดการเมนูเค้ก</h3>
        <button className="btn btn-primary" onClick={() => { resetForm(); setIsModalOpen(true); }}>
          <Plus size={16} /> เพิ่มเมนูเค้ก
        </button>
      </div>

      {isModalOpen && createPortal(
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h4 className="modal-title">
                {editingId ? <Edit2 size={24} /> : <Plus size={24} />}
                {editingId ? 'แก้ไขเมนูเค้ก' : 'เพิ่มเมนูเค้ก'}
              </h4>
              <button type="button" className="modal-close" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={saveProduct}>
              <div className="flex flex-col gap-4 mb-4">
                <div className="form-group">
                  <label className="form-label">ชื่อเมนูเค้ก</label>
                  <input 
                    type="text" 
                    name="name" 
                    value={formData.name} 
                    onChange={handleInputChange} 
                    className="form-control premium-input" 
                    placeholder="เช่น เค้กหน้านิ่ม" 
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">รสชาติ / หน้าเค้ก (แยกด้วยจุลภาค ,)</label>
                  <input 
                    type="text" 
                    name="flavors" 
                    value={formData.flavors || ''} 
                    onChange={handleInputChange} 
                    className="form-control premium-input" 
                    placeholder="เช่น ช็อกโกแลต, สตรอว์เบอร์รี่, มะพร้าวอ่อน, ส้ม" 
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                    เว้นว่างไว้หากไม่มีตัวเลือก ให้ลูกค้าเลือกได้ในหน้าสั่งซื้อ
                  </small>
                </div>
                
                <div className="form-group">
                  <label className="form-label">ราคาขาย (บาท)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    name="selling_price" 
                    value={formData.selling_price} 
                    onChange={handleInputChange} 
                    className="form-control premium-input" 
                    placeholder="0.00" 
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">จำกัดพรีออร์เดอร์ (ชิ้น)</label>
                  <input 
                    type="number" 
                    min="1" 
                    step="1" 
                    name="preorder_limit" 
                    value={formData.preorder_limit || ''} 
                    onChange={handleInputChange} 
                    className="form-control premium-input" 
                    placeholder="เว้นว่าง = ไม่อั้น" 
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
                    เปิดรับพรีออร์เดอร์เมนูนี้ในหน้าร้าน
                  </label>
                </div>

                <div className="form-group">
                  <label className="form-label">รูปภาพเค้ก</label>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleImageUpload} 
                        className="form-control premium-input" 
                        ref={fileInputRef}
                        disabled={uploading}
                        style={{ padding: '0.5rem' }}
                      />
                      {uploading && (
                        <p className="text-muted mt-2" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Loader2 size={14} className="animate-spin" /> กำลังอัปโหลด...
                        </p>
                      )}
                    </div>
                    
                    {formData.image_url && (
                      <div style={{ position: 'relative' }}>
                        <img 
                          src={formData.image_url} 
                          alt="Preview" 
                          style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '12px', border: '2px solid var(--primary-light)' }} 
                        />
                        <button 
                          type="button" 
                          onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}
                          style={{ position: 'absolute', top: '-8px', right: '-8px', background: 'var(--danger)', color: 'white', border: '2px solid white', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)} style={{ padding: '0.75rem 2rem' }}>ยกเลิก</button>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 2.5rem' }}>
                  {editingId ? <><Save size={18}/> บันทึกการแก้ไข</> : <><Plus size={18}/> ยืนยันเพิ่มเมนู</>}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      <div className="card">
        {loading ? (
          <p className="text-center text-muted">กำลังโหลด...</p>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>รูปภาพ</th>
                  <th>ชื่อเมนู</th>
                  <th>รสชาติ/หน้าเค้ก</th>
                  <th>ราคาขาย</th>
                  <th>จำกัดพรีออร์เดอร์</th>
                  <th>สถานะพรีออร์เดอร์</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center text-muted">ยังไม่มีข้อมูลเมนูเค้ก</td>
                  </tr>
                ) : (
                  products.map((item) => {
                    const sellingPrice = Number(item.selling_price) || 0;
                    const isActive = item.is_active !== false;

                    return (
                      <tr key={item.id}>
                        <td>
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.name} style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '8px' }} />
                          ) : (
                            <div style={{ width: '48px', height: '48px', backgroundColor: 'var(--primary-light)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-dark)' }}>
                              <Cake size={24} />
                            </div>
                          )}
                        </td>
                        <td style={{ fontWeight: 500 }}>{item.name}</td>
                        <td>
                          {item.flavors ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                              {item.flavors.split(',').map((f, idx) => (
                                <span key={idx} style={{ fontSize: '0.75rem', backgroundColor: 'var(--primary-light)', color: 'var(--primary-dark)', padding: '0.2rem 0.5rem', borderRadius: '12px', fontWeight: 500 }}>
                                  {f.trim()}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted" style={{ fontSize: '0.85rem' }}>-</span>
                          )}
                        </td>
                        <td style={{ color: 'var(--primary-dark)', fontWeight: 'bold' }}>฿{sellingPrice.toFixed(2)}</td>
                        <td>
                          {item.preorder_limit ? (
                            <span style={{ fontWeight: 'bold', color: 'var(--primary-dark)' }}>{item.preorder_limit} ชิ้น</span>
                          ) : (
                            <span className="text-muted">ไม่อั้น</span>
                          )}
                        </td>
                        <td>
                          <button
                            onClick={() => toggleProductActive(item.id, item.is_active)}
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
                            {isActive ? (
                              <><CheckCircle2 size={16} /> เปิดรับพรี</>
                            ) : (
                              <><XCircle size={16} /> ปิดรับพรี</>
                            )}
                          </button>
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <button className="btn btn-outline" onClick={() => editProduct(item)} style={{ padding: '0.25rem 0.5rem' }}>
                              <Edit2 size={14} />
                            </button>
                            <button className="btn btn-outline" onClick={() => deleteProduct(item.id)} style={{ padding: '0.25rem 0.5rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
