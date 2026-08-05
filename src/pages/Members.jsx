import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Award, Plus, Trash2, Edit2, Save, X, Search, Settings, Gift, User, History, CheckCircle2 } from 'lucide-react';
import { createPortal } from 'react-dom';

export default function Members() {
  const [members, setMembers] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [bahtPerPoint, setBahtPerPoint] = useState(50); // Default 50 THB = 1 Point

  // Modal states
  const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
  const [editingRewardId, setEditingRewardId] = useState(null);
  const [rewardForm, setRewardForm] = useState({
    title: '',
    points_required: '',
    discount_amount: '0',
    is_active: true
  });

  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [adjustPoints, setAdjustPoints] = useState('');
  const [adjustType, setAdjustType] = useState('add'); // 'add' or 'subtract'
  const [adjustReason, setAdjustReason] = useState('');

  useEffect(() => {
    fetchSettings();
    fetchRewards();
    fetchMembers();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase
        .from('store_settings')
        .select('value')
        .eq('key', 'baht_per_point')
        .maybeSingle();

      if (data && data.value) {
        setBahtPerPoint(Number(data.value) || 50);
      }
    } catch (e) {
      console.log('Error fetching settings:', e);
    }
  };

  const saveBahtPerPointSetting = async (val) => {
    const num = Number(val) || 50;
    setBahtPerPoint(num);
    try {
      await supabase
        .from('store_settings')
        .upsert({ key: 'baht_per_point', value: num.toString() }, { onConflict: 'key' });
      alert('บันทึกเรตสะสมแต้มเรียบร้อยแล้ว!');
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการบันทึกเรตแต้ม');
    }
  };

  const fetchRewards = async () => {
    try {
      const { data } = await supabase
        .from('rewards')
        .select('*')
        .order('points_required', { ascending: true });

      if (data) setRewards(data);
    } catch (e) {
      console.log('Error fetching rewards:', e);
    }
  };

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('members')
        .select('*')
        .order('points', { ascending: false });

      if (data) setMembers(data);
    } catch (e) {
      console.log('Error fetching members:', e);
    } finally {
      setLoading(false);
    }
  };

  const saveReward = async (e) => {
    e.preventDefault();
    if (!rewardForm.title || !rewardForm.points_required) {
      return alert('กรุณากรอกชื่อของรางวัลและแต้มที่ต้องใช้');
    }

    const payload = {
      title: rewardForm.title,
      points_required: parseInt(rewardForm.points_required, 10),
      discount_amount: parseFloat(rewardForm.discount_amount) || 0,
      is_active: rewardForm.is_active
    };

    try {
      if (editingRewardId) {
        const { error } = await supabase.from('rewards').update(payload).eq('id', editingRewardId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('rewards').insert([payload]);
        if (error) throw error;
      }

      setIsRewardModalOpen(false);
      resetRewardForm();
      fetchRewards();
    } catch (err) {
      if (err.message.includes('row-level security') || err.message.includes('violates row-level security policy') || err.code === '42501') {
        alert('กรุณารัน SQL ใน Supabase เพื่อสร้างและเปิดสิทธิ์ตารางก่อนนะครับ:\n\nALTER TABLE rewards DISABLE ROW LEVEL SECURITY;\nALTER TABLE members DISABLE ROW LEVEL SECURITY;\nALTER TABLE point_logs DISABLE ROW LEVEL SECURITY;');
      } else {
        alert('เกิดข้อผิดพลาดในการบันทึกของรางวัล: ' + err.message);
      }
    }
  };

  const editReward = (reward) => {
    setEditingRewardId(reward.id);
    setRewardForm({
      title: reward.title,
      points_required: reward.points_required,
      discount_amount: reward.discount_amount || '0',
      is_active: reward.is_active !== false
    });
    setIsRewardModalOpen(true);
  };

  const deleteReward = async (id) => {
    if (window.confirm('ต้องการลบของรางวัลนี้ใช่หรือไม่?')) {
      try {
        const { error } = await supabase.from('rewards').delete().eq('id', id);
        if (error) throw error;
        fetchRewards();
      } catch (err) {
        alert('เกิดข้อผิดพลาดในการลบ: ' + err.message);
      }
    }
  };

  const resetRewardForm = () => {
    setEditingRewardId(null);
    setRewardForm({ title: '', points_required: '', discount_amount: '0', is_active: true });
  };

  const openAdjustModal = (member) => {
    setSelectedMember(member);
    setAdjustPoints('');
    setAdjustType('add');
    setAdjustReason('');
    setIsAdjustModalOpen(true);
  };

  const handleAdjustPoints = async (e) => {
    e.preventDefault();
    if (!adjustPoints || isNaN(adjustPoints)) return alert('กรุณากรอกจำนวนแต้ม');

    const amount = parseInt(adjustPoints, 10);
    const finalChange = adjustType === 'add' ? amount : -amount;
    const newTotalPoints = Math.max(0, (selectedMember.points || 0) + finalChange);

    try {
      const { error } = await supabase
        .from('members')
        .update({ points: newTotalPoints })
        .eq('id', selectedMember.id);

      if (error) throw error;

      // Log point change
      await supabase.from('point_logs').insert([{
        member_id: selectedMember.id,
        points: finalChange,
        type: adjustType === 'add' ? 'admin_add' : 'admin_subtract',
        description: adjustReason || 'ปรับเปลี่ยนโดยแอดมิน'
      }]);

      setIsAdjustModalOpen(false);
      fetchMembers();
      alert('ปรับแต้มสะสมสำเร็จ!');
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการปรับแต้ม: ' + err.message);
    }
  };

  const filteredMembers = members.filter(m => 
    (m.name && m.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (m.phone && m.phone.includes(searchTerm))
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Award color="var(--primary)" size={24} /> ระบบสมาชิก & สะสมแต้ม
        </h3>
      </div>

      {/* Settings & Rewards Management Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        
        {/* Points Rate Setting Card */}
        <div className="card">
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-dark)', marginBottom: '1rem', fontSize: '1.1rem' }}>
            <Settings size={20} /> ตั้งค่าเรตสะสมแต้ม
          </h4>
          <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
            กำหนดว่ายอดซื้อกี่บาท จึงจะได้รับแต้มสะสม 1 แต้ม
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: 500 }}>ยอดซื้อทุกๆ</span>
            <input 
              type="number" 
              min="1" 
              value={bahtPerPoint} 
              onChange={(e) => setBahtPerPoint(e.target.value)} 
              className="form-control premium-input" 
              style={{ width: '100px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem' }} 
            />
            <span style={{ fontWeight: 500 }}>บาท = <strong>1 แต้ม 🪙</strong></span>
          </div>
          <button 
            className="btn btn-primary" 
            style={{ marginTop: '1.25rem', width: '100%' }}
            onClick={() => saveBahtPerPointSetting(bahtPerPoint)}
          >
            บันทึกการตั้งค่าเรตแต้ม
          </button>
        </div>

        {/* Rewards List Header Card */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-dark)', margin: 0, fontSize: '1.1rem' }}>
              <Gift size={20} /> รายการของรางวัลแลกแต้ม
            </h4>
            <button className="btn btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }} onClick={() => { resetRewardForm(); setIsRewardModalOpen(true); }}>
              <Plus size={16} /> เพิ่มของรางวัล
            </button>
          </div>
          
          <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {rewards.length === 0 ? (
              <p className="text-muted text-center style={{ padding: '1rem' }}">ยังไม่มีของรางวัล กดปุ่มเพิ่มด้านบนได้เลย</p>
            ) : (
              rewards.map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', backgroundColor: 'var(--primary-light)', borderRadius: '8px' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{r.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--primary-dark)' }}>
                      ใช้ <strong>{r.points_required} แต้ม</strong> {Number(r.discount_amount) > 0 ? `(ส่วนลด ฿${Number(r.discount_amount).toFixed(2)})` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button className="btn btn-outline" style={{ padding: '0.2rem 0.4rem' }} onClick={() => editReward(r)}>
                      <Edit2 size={12} />
                    </button>
                    <button className="btn btn-outline" style={{ padding: '0.2rem 0.4rem', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => deleteReward(r.id)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Reward Form Modal */}
      {isRewardModalOpen && createPortal(
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h4 className="modal-title">
                {editingRewardId ? <Edit2 size={20} /> : <Plus size={20} />}
                {editingRewardId ? 'แก้ไขของรางวัล' : 'เพิ่มของรางวัลใหม่'}
              </h4>
              <button type="button" className="modal-close" onClick={() => setIsRewardModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={saveReward}>
              <div className="flex flex-col gap-3 mb-4">
                <div className="form-group">
                  <label className="form-label">ชื่อของรางวัล / ส่วนลด</label>
                  <input 
                    type="text" 
                    value={rewardForm.title} 
                    onChange={(e) => setRewardForm({ ...rewardForm, title: e.target.value })} 
                    className="form-control premium-input" 
                    placeholder="เช่น ส่วนลดเงินสด 20 บาท หรือ ฟรี! บราวนี่ 1 ชิ้น" 
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">จำนวนแต้มที่ต้องใช้แลก (แต้ม)</label>
                  <input 
                    type="number" 
                    min="1" 
                    value={rewardForm.points_required} 
                    onChange={(e) => setRewardForm({ ...rewardForm, points_required: e.target.value })} 
                    className="form-control premium-input" 
                    placeholder="เช่น 10" 
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">จำนวนเงินส่วนลดที่จะหักออก (บาท)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    value={rewardForm.discount_amount} 
                    onChange={(e) => setRewardForm({ ...rewardForm, discount_amount: e.target.value })} 
                    className="form-control premium-input" 
                    placeholder="0.00 (ใส่ 0 หากเป็นของแถมฟรี)" 
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    หากเป็นส่วนลดเงินสด ระบบจะหักยอดเงินให้อัตโนมัติเมื่อลูกค้าแลกแต้ม
                  </small>
                </div>
              </div>

              <div className="flex gap-2 justify-end mt-4">
                <button type="button" className="btn btn-outline" onClick={() => setIsRewardModalOpen(false)}>ยกเลิก</button>
                <button type="submit" className="btn btn-primary">
                  {editingRewardId ? <><Save size={16}/> บันทึกการแก้ไข</> : <><Plus size={16}/> ยืนยันเพิ่มของรางวัล</>}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Adjust Points Modal */}
      {isAdjustModalOpen && selectedMember && createPortal(
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h4 className="modal-title"><Award size={20} /> ปรับแต้มสมาชิก</h4>
              <button type="button" className="modal-close" onClick={() => setIsAdjustModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAdjustPoints}>
              <div style={{ marginBottom: '1rem', backgroundColor: 'var(--primary-light)', padding: '0.75rem', borderRadius: '8px' }}>
                <div style={{ fontWeight: 600 }}>{selectedMember.name || 'ไม่ระบุชื่อ'} ({selectedMember.phone})</div>
                <div style={{ color: 'var(--primary-dark)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                  แต้มปัจจุบัน: <strong>{selectedMember.points} แต้ม 🪙</strong>
                </div>
              </div>

              <div className="form-group mb-3">
                <label className="form-label">ประเภทการปรับ</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <input type="radio" name="adjType" value="add" checked={adjustType === 'add'} onChange={() => setAdjustType('add')} />
                    ➕ เพิ่มแต้ม
                  </label>
                  <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <input type="radio" name="adjType" value="subtract" checked={adjustType === 'subtract'} onChange={() => setAdjustType('subtract')} />
                    ➖ หักแต้ม
                  </label>
                </div>
              </div>

              <div className="form-group mb-3">
                <label className="form-label">จำนวนแต้ม</label>
                <input 
                  type="number" 
                  min="1" 
                  value={adjustPoints} 
                  onChange={(e) => setAdjustPoints(e.target.value)} 
                  className="form-control premium-input" 
                  placeholder="เช่น 5" 
                  required 
                />
              </div>

              <div className="form-group mb-4">
                <label className="form-label">เหตุผล / หมายเหตุ (ระบุหรือไม่ก็ได้)</label>
                <input 
                  type="text" 
                  value={adjustReason} 
                  onChange={(e) => setAdjustReason(e.target.value)} 
                  className="form-control premium-input" 
                  placeholder="เช่น สมนาคุณพิเศษลูกค้าประจำ" 
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button type="button" className="btn btn-outline" onClick={() => setIsAdjustModalOpen(false)}>ยกเลิก</button>
                <button type="submit" className="btn btn-primary">ยืนยันปรับแต้ม</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Members List Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h4 style={{ margin: 0, fontWeight: 'bold', fontSize: '1.1rem' }}>รายชื่อสมาชิกทั้งหมด ({members.length} คน)</h4>
          
          <div style={{ position: 'relative', minWidth: '240px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="form-control" 
              placeholder="ค้นหาชื่อ หรือเบอร์โทร..." 
              style={{ paddingLeft: '2.2rem', fontSize: '0.9rem' }} 
            />
          </div>
        </div>

        {loading ? (
          <p className="text-center text-muted">กำลังโหลดข้อมูลสมาชิก...</p>
        ) : filteredMembers.length === 0 ? (
          <p className="text-center text-muted" style={{ padding: '2rem' }}>ยังไม่มีข้อมูลสมาชิกในระบบ</p>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>เบอร์โทรศัพท์</th>
                  <th>ชื่อสมาชิก</th>
                  <th>แต้มสะสมคงเหลือ</th>
                  <th>วันที่สมัคร</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((m) => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 600 }}>{m.phone}</td>
                    <td>{m.name || '-'}</td>
                    <td>
                      <span style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary-dark)', padding: '0.3rem 0.75rem', borderRadius: '16px', fontWeight: 'bold', fontSize: '0.95rem' }}>
                        🪙 {m.points} แต้ม
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem' }} className="text-muted">
                      {new Date(m.created_at).toLocaleDateString('th-TH')}
                    </td>
                    <td>
                      <button className="btn btn-outline" style={{ padding: '0.3rem 0.65rem', fontSize: '0.85rem' }} onClick={() => openAdjustModal(m)}>
                        <Edit2 size={14} /> ปรับแต้ม
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
