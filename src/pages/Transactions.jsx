import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { TrendingUp, TrendingDown, DollarSign, Plus, Camera, Loader2, X, UploadCloud, Clipboard } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const fileInputRef = useRef(null);
  
  // Scan Modal state
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanImageFile, setScanImageFile] = useState(null);
  const [scanImagePreview, setScanImagePreview] = useState(null);

  // Filter state
  const [filterDate, setFilterDate] = useState('');
  
  // Summary state
  const [summary, setSummary] = useState({ income: 0, expense: 0, net: 0 });

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    type: 'expense',
    amount: '',
    description: ''
  });
  const [editingId, setEditingId] = useState(null);

  const handleFileChange = (file) => {
    if (!file) return;
    setScanImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setScanImagePreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        handleFileChange(file);
        break;
      }
    }
  };

  useEffect(() => {
    if (showScanModal) {
      window.addEventListener('paste', handlePaste);
    } else {
      window.removeEventListener('paste', handlePaste);
      setScanImageFile(null);
      setScanImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
    return () => window.removeEventListener('paste', handlePaste);
  }, [showScanModal]);

  const processScanImage = async () => {
    if (!scanImageFile) return;

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      alert('ไม่พบ VITE_GEMINI_API_KEY ในระบบ กรุณาเพิ่ม API Key เพื่อใช้งานฟีเจอร์นี้');
      return;
    }

    setScanning(true);
    try {
      const base64Data = scanImagePreview.split(',')[1];
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `
        ให้อ่านภาพสลิปโอนเงิน หรือใบเสร็จรับเงินนี้
        และดึงข้อมูลยอดเงินรวม (amount) กับรายละเอียดสินค้า/บริการ (description) สรุปเป็นภาษาไทยสั้นๆ
        ตัวอย่าง description เช่น "ซื้อวัตถุดิบ (แป้ง)", "ค่าไฟเดือนล่าสุด", "รับเงินโอนค่าเค้ก"
        ตอบกลับมาเป็นรูปแบบ JSON เท่านั้น ห้ามมีข้อความอื่นปน
        รูปแบบ:
        {"amount": 150.50, "description": "ซื้อ..."}
      `;

      const imageParts = [{ inlineData: { data: base64Data, mimeType: scanImageFile.type } }];
      const result = await model.generateContent([prompt, ...imageParts]);
      const response = await result.response;
      let text = response.text();
      
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(text);
      
      if (parsed.amount) {
        setFormData(prev => ({
          ...prev,
          amount: parsed.amount,
          description: parsed.description || prev.description
        }));
        setShowScanModal(false);
        setShowForm(true);
      } else {
        alert('AI ไม่สามารถอ่านข้อมูลยอดเงินจากภาพนี้ได้');
      }
    } catch (error) {
      console.error(error);
      if (error.message && error.message.includes('503')) {
        alert('ระบบ AI กำลังมีผู้ใช้งานจำนวนมาก กรุณาลองใหม่อีกครั้งในภายหลัง หรือกรอกข้อมูลด้วยตัวเองครับ');
      } else {
        alert('เกิดข้อผิดพลาดในการอ่านภาพ: ' + error.message);
      }
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterDate]);

  const fetchData = async () => {
    setLoading(true);
    
    let query = supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (filterDate) {
      const startOfDay = new Date(filterDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(filterDate);
      endOfDay.setHours(23, 59, 59, 999);

      query = query
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString());
    }

    const { data, error } = await query;

    if (data) {
      setTransactions(data);
      
      // Calculate summary
      let inc = 0, exp = 0;
      data.forEach(t => {
        if (t.type === 'income') inc += Number(t.amount);
        else exp += Number(t.amount);
      });
      setSummary({ income: inc, expense: exp, net: inc - exp });
    }
    
    setLoading(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const saveTransaction = async (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.description) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    const payload = {
      type: formData.type,
      amount: parseFloat(formData.amount),
      description: formData.description
    };

    if (editingId) {
      const { error } = await supabase.from('transactions').update(payload).eq('id', editingId);
      if (error) {
        alert(error.message);
      } else {
        resetForm();
        fetchData();
      }
    } else {
      const { error } = await supabase.from('transactions').insert([payload]);
      if (error) {
        alert(error.message);
      } else {
        resetForm();
        fetchData();
      }
    }
  };

  const resetForm = () => {
    setFormData({ type: 'expense', amount: '', description: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (t) => {
    setFormData({
      type: t.type,
      amount: t.amount,
      description: t.description
    });
    setEditingId(t.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('คุณต้องการลบรายการนี้ใช่หรือไม่?')) return;
    
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) {
      alert(error.message);
    } else {
      fetchData();
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4 gap-4 flex-wrap">
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>รายรับ-รายจ่าย</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef} 
            onChange={(e) => handleFileChange(e.target.files?.[0])} 
            style={{ display: 'none' }} 
          />
          <button 
            className="btn btn-outline" 
            onClick={() => setShowScanModal(true)}
            style={{ backgroundColor: 'var(--primary-light)', borderColor: 'var(--primary-light)' }}
          >
            <Camera size={16} /> สแกนใบเสร็จ
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            <Plus size={16} /> บันทึกรายการใหม่
          </button>
        </div>
      </div>

      {showScanModal && createPortal(
        <div className="modal-overlay" onClick={() => !scanning && setShowScanModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', textAlign: 'center' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Camera size={20} /> สแกนใบเสร็จ
              </h3>
              {!scanning && (
                <button onClick={() => setShowScanModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  <X size={24} />
                </button>
              )}
            </div>
            
            <div style={{ padding: '1rem 0' }}>
              {!scanImagePreview ? (
                <div 
                  style={{ 
                    border: '2px dashed var(--border)', 
                    borderRadius: '12px', 
                    padding: '3rem 2rem',
                    cursor: 'pointer',
                    backgroundColor: 'var(--bg-main)'
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud size={48} color="var(--primary-dark)" style={{ margin: '0 auto 1rem', opacity: 0.8 }} />
                  <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>คลิกเพื่ออัปโหลดรูปภาพ</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                    <Clipboard size={16} /> หรือสามารถกด Ctrl+V / Cmd+V เพื่อวางรูปได้เลย
                  </p>
                </div>
              ) : (
                <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
                  <img src={scanImagePreview} alt="Receipt Preview" style={{ maxHeight: '300px', maxWidth: '100%', borderRadius: '8px', objectFit: 'contain' }} />
                  {!scanning && (
                    <button 
                      onClick={() => { setScanImageFile(null); setScanImagePreview(null); }}
                      style={{ 
                        position: 'absolute', top: '-10px', right: '-10px', 
                        background: 'var(--danger)', color: 'white', 
                        border: 'none', borderRadius: '50%', 
                        width: '30px', height: '30px', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        cursor: 'pointer', boxShadow: 'var(--shadow-md)' 
                      }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button 
                className="btn btn-outline" 
                onClick={() => setShowScanModal(false)} 
                disabled={scanning}
              >
                ยกเลิก
              </button>
              <button 
                className="btn btn-primary" 
                onClick={processScanImage} 
                disabled={!scanImageFile || scanning}
                style={{ minWidth: '120px' }}
              >
                {scanning ? <><Loader2 className="animate-spin" size={16} style={{ display: 'inline', marginRight: '4px' }} /> กำลังสแกน...</> : 'ดึงข้อมูล'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--success)' }}>
          <div style={{ padding: '1rem', backgroundColor: 'rgba(134, 239, 172, 0.2)', borderRadius: '50%', color: 'var(--success)' }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: '0.875rem' }}>รายรับรวม</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>฿{summary.income.toFixed(2)}</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--danger)' }}>
          <div style={{ padding: '1rem', backgroundColor: 'rgba(252, 165, 165, 0.2)', borderRadius: '50%', color: 'var(--danger)' }}>
            <TrendingDown size={24} />
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: '0.875rem' }}>รายจ่ายรวม</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>฿{summary.expense.toFixed(2)}</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: `4px solid ${summary.net >= 0 ? 'var(--primary-dark)' : 'var(--text-muted)'}` }}>
          <div style={{ padding: '1rem', backgroundColor: 'var(--primary-light)', borderRadius: '50%', color: 'var(--primary-dark)' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: '0.875rem' }}>คงเหลือ (กำไร/ขาดทุน)</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: summary.net >= 0 ? 'var(--primary-dark)' : 'var(--text-muted)' }}>
              ฿{summary.net.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Add Transaction Form */}
      {showForm && (
        <div className="card mb-4" style={{ backgroundColor: 'var(--bg-sidebar)' }}>
          <h4 style={{ marginBottom: '1rem', fontWeight: 'bold' }}>
            {editingId ? 'แก้ไขรายการ' : 'บันทึกรายรับ/รายจ่าย'}
          </h4>
          <form onSubmit={saveTransaction} className="flex flex-wrap gap-4 items-end">
            <div className="form-group" style={{ flex: '1 1 150px', marginBottom: 0 }}>
              <label className="form-label">ประเภท</label>
              <select name="type" value={formData.type} onChange={handleInputChange} className="form-control">
                <option value="expense">รายจ่าย</option>
                <option value="income">รายรับ</option>
              </select>
            </div>
            
            <div className="form-group" style={{ flex: '2 1 200px', marginBottom: 0 }}>
              <label className="form-label">รายละเอียด</label>
              <input type="text" name="description" value={formData.description} onChange={handleInputChange} className="form-control" placeholder="เช่น ซื้อวัตถุดิบเข้าร้าน, จ่ายค่าไฟ" />
            </div>

            <div className="form-group" style={{ flex: '1 1 150px', marginBottom: 0 }}>
              <label className="form-label">จำนวนเงิน (บาท)</label>
              <input type="number" step="0.01" name="amount" value={formData.amount} onChange={handleInputChange} className="form-control" placeholder="0.00" />
            </div>

            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary">{editingId ? 'บันทึกการแก้ไข' : 'บันทึก'}</button>
              <button type="button" className="btn btn-outline" onClick={resetForm}>ยกเลิก</button>
            </div>
          </form>
        </div>
      )}

      {/* Transactions List */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h4 style={{ margin: 0, fontWeight: 'bold' }}>ประวัติรายการ</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>กรองตามวันที่:</label>
            <input 
              type="date" 
              className="form-control premium-input"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              style={{ width: 'auto', padding: '0.35rem 0.75rem' }}
            />
            {filterDate && (
              <button 
                className="btn btn-outline" 
                onClick={() => setFilterDate('')}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
              >
                ล้าง
              </button>
            )}
          </div>
        </div>
        {loading ? (
          <p className="text-center text-muted">กำลังโหลด...</p>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>วันที่/เวลา</th>
                  <th>รายละเอียด</th>
                  <th>ประเภท</th>
                  <th>จำนวนเงิน</th>
                  <th style={{ width: '120px' }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center text-muted">ยังไม่มีประวัติรายการ</td>
                  </tr>
                ) : (
                  transactions.map((t) => (
                    <tr key={t.id}>
                      <td className="text-muted" style={{ fontSize: '0.875rem' }}>
                        {new Date(t.created_at).toLocaleString('th-TH')}
                      </td>
                      <td>{t.description}</td>
                      <td>
                        {t.type === 'income' ? (
                          <span style={{ color: 'var(--success)', fontWeight: 500, padding: '0.2rem 0.5rem', backgroundColor: 'rgba(134,239,172,0.1)', borderRadius: 'var(--radius-sm)' }}>รายรับ</span>
                        ) : (
                          <span style={{ color: 'var(--danger)', fontWeight: 500, padding: '0.2rem 0.5rem', backgroundColor: 'rgba(252,165,165,0.1)', borderRadius: 'var(--radius-sm)' }}>รายจ่าย</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 'bold', color: t.type === 'income' ? 'var(--success)' : 'var(--danger)' }}>
                        {t.type === 'income' ? '+' : '-'}฿{Number(t.amount).toFixed(2)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }} onClick={() => handleEdit(t)}>
                            แก้ไข
                          </button>
                          <button className="btn btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleDelete(t.id)}>
                            ลบ
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
