import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react';

export default function Inventory() {
  const [ingredients, setIngredients] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    cost_per_unit: '',
    stock_quantity: '',
    unit_id: '',
    recipe_unit_id: '',
    conversion_factor: 1,
    min_stock_level: 5
  });
  
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch units
    const { data: unitsData, error: unitsError } = await supabase
      .from('units')
      .select('*')
      .order('name');
    
    if (!unitsError && unitsData) {
      setUnits(unitsData);
      if (unitsData.length > 0 && !formData.unit_id) {
        setFormData(prev => ({ 
          ...prev, 
          unit_id: unitsData[0].id,
          recipe_unit_id: unitsData[0].id
        }));
      }
    }

    // Fetch ingredients with unit details
    const { data: ingData, error: ingError } = await supabase
      .from('ingredients')
      .select(`
        *,
        units!ingredients_unit_id_fkey ( name )
      `)
      .order('created_at', { ascending: false });

    if (!ingError && ingData) {
      setIngredients(ingData);
    }
    
    setLoading(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const saveIngredient = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.cost_per_unit || !formData.stock_quantity || !formData.unit_id) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    const payload = {
      name: formData.name,
      cost_per_unit: parseFloat(formData.cost_per_unit),
      stock_quantity: parseFloat(formData.stock_quantity),
      unit_id: formData.unit_id,
      recipe_unit_id: formData.recipe_unit_id || formData.unit_id,
      conversion_factor: parseFloat(formData.conversion_factor) || 1,
      min_stock_level: parseFloat(formData.min_stock_level) || 0
    };

    if (editingId) {
      const { error } = await supabase
        .from('ingredients')
        .update(payload)
        .eq('id', editingId);
      
      if (error) alert(error.message);
      else {
        setEditingId(null);
        resetForm();
        fetchData();
        setIsModalOpen(false);
      }
    } else {
      const { error } = await supabase
        .from('ingredients')
        .insert([payload]);
      
      if (error) alert(error.message);
      else {
        resetForm();
        fetchData();
        setIsModalOpen(false);
      }
    }
  };

  const editIngredient = (item) => {
    setEditingId(item.id);
    setFormData({
      name: item.name,
      cost_per_unit: item.cost_per_unit,
      stock_quantity: item.stock_quantity,
      unit_id: item.unit_id,
      recipe_unit_id: item.recipe_unit_id || item.unit_id,
      conversion_factor: item.conversion_factor || 1,
      min_stock_level: item.min_stock_level ?? 5
    });
    setIsModalOpen(true);
  };

  const deleteIngredient = async (id) => {
    if (window.confirm('ต้องการลบวัตถุดิบนี้ใช่หรือไม่?')) {
      const { error } = await supabase.from('ingredients').delete().eq('id', id);
      if (error) alert(error.message);
      else fetchData();
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      cost_per_unit: '',
      stock_quantity: '',
      unit_id: units.length > 0 ? units[0].id : '',
      recipe_unit_id: units.length > 0 ? units[0].id : '',
      conversion_factor: 1,
      min_stock_level: 5
    });
    setEditingId(null);
  };

  const addUnit = async (e) => {
    e.preventDefault();
    if (!newUnitName) return;

    const { error } = await supabase
      .from('units')
      .insert([{ name: newUnitName }]);
    
    if (error) {
      if (error.code === '23505') {
        alert('ชื่อหน่วยวัดนี้มีอยู่ในระบบแล้วครับ');
      } else {
        alert(error.message);
      }
    } else {
      setNewUnitName('');
      setShowUnitForm(false);
      fetchData();
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>จัดการสต๊อกวัตถุดิบ</h3>
        <div className="flex gap-2">
          <button className="btn btn-outline" onClick={() => setShowUnitForm(!showUnitForm)}>
            <Plus size={16} /> จัดการหน่วยวัด
          </button>
          <button className="btn btn-primary" onClick={() => { resetForm(); setIsModalOpen(true); }}>
            <Plus size={16} /> เพิ่มวัตถุดิบ
          </button>
        </div>
      </div>

      {showUnitForm && (
        <div className="card mb-4" style={{ backgroundColor: 'var(--bg-sidebar)' }}>
          <form onSubmit={addUnit} className="flex gap-2 items-center">
            <div className="flex-1">
              <input
                type="text"
                placeholder="ชื่อหน่วยวัดใหม่ (เช่น ลัง, แพ็ค)"
                className="form-control"
                value={newUnitName}
                onChange={(e) => setNewUnitName(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary">เพิ่มหน่วยวัด</button>
            <button type="button" className="btn btn-outline" onClick={() => setShowUnitForm(false)}>ปิด</button>
          </form>
        </div>
      )}

      {isModalOpen && createPortal(
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">
                {editingId ? <Edit2 size={24} /> : <Plus size={24} />}
                {editingId ? 'แก้ไขวัตถุดิบ' : 'เพิ่มวัตถุดิบ'}
              </h4>
              <button type="button" className="modal-close" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={saveIngredient}>
              <div className="flex flex-wrap gap-4 mb-4">
                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label className="form-label">ชื่อวัตถุดิบ</label>
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="form-control premium-input" placeholder="เช่น แป้งเค้ก" />
                </div>
                
                <div className="form-group" style={{ flex: '1 1 200px' }}>
                  <label className="form-label">หน่วยเก็บสต๊อก</label>
                  <select name="unit_id" value={formData.unit_id} onChange={handleInputChange} className="form-control premium-input">
                    {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>

                <div className="form-group" style={{ flex: '1 1 200px' }}>
                  <label className="form-label">ราคาต่อหน่วยเก็บ (บาท)</label>
                  <input type="number" step="0.01" name="cost_per_unit" value={formData.cost_per_unit} onChange={handleInputChange} className="form-control premium-input" placeholder="0.00" />
                </div>

                <div className="form-group" style={{ flex: '1 1 200px' }}>
                  <label className="form-label">จำนวนสต๊อกที่มี</label>
                  <input type="number" step="0.01" name="stock_quantity" value={formData.stock_quantity} onChange={handleInputChange} className="form-control premium-input" placeholder="0.00" />
                </div>

                <div className="form-group" style={{ flex: '1 1 200px' }}>
                  <label className="form-label" style={{ color: 'var(--danger)' }}>เตือนเมื่อต่ำกว่า</label>
                  <input type="number" step="0.01" name="min_stock_level" value={formData.min_stock_level} onChange={handleInputChange} className="form-control premium-input" placeholder="เช่น 5" style={{ borderColor: 'rgba(251, 113, 133, 0.4)' }} />
                </div>
              </div>

              <div className="recipe-section mt-6">
                <h5 style={{ fontSize: '1.1rem', color: 'var(--primary-dark)', marginBottom: '1rem' }}>ตั้งค่าการใช้ในสูตรอาหาร</h5>
                <div className="flex flex-wrap gap-4">
                  <div className="form-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
                    <label className="form-label">หน่วยที่ใช้ในสูตร (ย่อย)</label>
                    <select name="recipe_unit_id" value={formData.recipe_unit_id} onChange={handleInputChange} className="form-control premium-input">
                      {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>

                  <div className="form-group" style={{ flex: '2 1 300px', marginBottom: 0 }}>
                    <label className="form-label">อัตราส่วน (1 หน่วยเก็บ = ? หน่วยสูตร)</label>
                    <input type="number" step="0.01" name="conversion_factor" value={formData.conversion_factor} onChange={handleInputChange} className="form-control premium-input" placeholder="เช่น 1000" />
                  </div>
                </div>
                <p className="text-muted mt-2 mb-0" style={{ fontSize: '0.85rem' }}>
                  * เช่น ซื้อแป้งมาเป็น "ถุง" แต่ในสูตรใช้เป็น "กรัม" (1 ถุง = 1000 กรัม) ให้ใส่อัตราส่วน = 1000
                </p>
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)} style={{ padding: '0.75rem 2rem' }}>ยกเลิก</button>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 2.5rem' }}>
                  {editingId ? <><Save size={18}/> บันทึกการแก้ไข</> : <><Plus size={18}/> ยืนยันเพิ่มวัตถุดิบ</>}
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
                  <th>ชื่อวัตถุดิบ</th>
                  <th>ยอดคงเหลือ (สต๊อก)</th>
                  <th>หน่วยย่อย (ในสูตร)</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {ingredients.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center text-muted">ยังไม่มีข้อมูลวัตถุดิบ</td>
                  </tr>
                ) : (
                  ingredients.map((item) => {
                    const storageUnit = item.units?.name || '';
                    const recipeUnit = units.find(u => u.id === item.recipe_unit_id)?.name || storageUnit;
                    const factor = item.conversion_factor || 1;
                    const costPerRecipeUnit = item.cost_per_unit / factor;
                    const isLowStock = item.stock_quantity <= (item.min_stock_level || 0);
                    
                    return (
                      <tr key={item.id} style={{ backgroundColor: isLowStock ? 'rgba(251, 113, 133, 0.05)' : 'transparent' }}>
                        <td style={{ fontWeight: 500 }}>
                          {item.name}
                          {isLowStock && (
                            <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', backgroundColor: 'var(--danger)', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>ใกล้หมด</span>
                          )}
                        </td>
                        <td>
                          <div style={{ color: isLowStock ? 'var(--danger)' : 'inherit', fontWeight: isLowStock ? 'bold' : 'normal' }}>
                            {item.stock_quantity} {storageUnit}
                          </div>
                          <div className="text-muted" style={{ fontSize: '0.8rem' }}>฿{item.cost_per_unit.toFixed(2)} / {storageUnit}</div>
                        </td>
                        <td>
                          <div>1 {storageUnit} = {factor} {recipeUnit}</div>
                          <div style={{ color: 'var(--primary-dark)', fontSize: '0.8rem' }}>฿{costPerRecipeUnit.toFixed(4)} / {recipeUnit}</div>
                        </td>
                        <td>
                        <div className="flex gap-2">
                          <button className="btn btn-outline" onClick={() => editIngredient(item)} style={{ padding: '0.25rem 0.5rem' }}>
                            <Edit2 size={14} />
                          </button>
                          <button className="btn btn-outline" onClick={() => deleteIngredient(item.id)} style={{ padding: '0.25rem 0.5rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
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
