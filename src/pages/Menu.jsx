import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Edit2, Save, X, Calculator, UploadCloud, Loader2 } from 'lucide-react';
import imageCompression from 'browser-image-compression';

export default function Menu() {
  const [products, setProducts] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [allUnits, setAllUnits] = useState([]);
  const [loading, setLoading] = useState(true);

  // Recipe builder states
  const [formData, setFormData] = useState({
    name: '',
    selling_price: '',
    image_url: '',
    preorder_limit: ''
  });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  
  const [recipeItems, setRecipeItems] = useState([]); // [{ ingredient_id, quantity_used, cost }]
  const [suggestedPrice, setSuggestedPrice] = useState(0);
  
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch all units
    const { data: unitsData } = await supabase.from('units').select('*');
    if (unitsData) setAllUnits(unitsData);

    // Fetch ingredients for recipe builder
    const { data: ingData } = await supabase
      .from('ingredients')
      .select('*')
      .order('name');
    
    if (ingData) setIngredients(ingData);

    // Fetch products with their recipe
    const { data: prodData } = await supabase
      .from('products')
      .select(`
        *,
        product_ingredients (
          ingredient_id,
          quantity_used,
          ingredients ( name, cost_per_unit, conversion_factor, recipe_unit_id, unit_id )
        )
      `)
      .order('created_at', { ascending: false });

    if (prodData) setProducts(prodData);
    
    setLoading(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const addRecipeItem = () => {
    if (ingredients.length > 0) {
      setRecipeItems([...recipeItems, { ingredient_id: ingredients[0].id, quantity_used: 1 }]);
    }
  };

  const updateRecipeItem = (index, field, value) => {
    const newItems = [...recipeItems];
    newItems[index][field] = value;
    setRecipeItems(newItems);
    calculateSuggestedPrice(newItems);
  };

  const removeRecipeItem = (index) => {
    const newItems = recipeItems.filter((_, i) => i !== index);
    setRecipeItems(newItems);
    calculateSuggestedPrice(newItems);
  };

  const calculateSuggestedPrice = (items) => {
    let cost = 0;
    items.forEach(item => {
      const ing = ingredients.find(i => i.id === item.ingredient_id);
      if (ing) {
        const factor = ing.conversion_factor || 1;
        const costPerRecipeUnit = ing.cost_per_unit / factor;
        cost += (costPerRecipeUnit * parseFloat(item.quantity_used || 0));
      }
    });
    // Suggest 50% margin
    const suggested = cost * 1.5;
    setSuggestedPrice(suggested);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploading(true);

      // 1. Compress Image
      const options = {
        maxSizeMB: 0.2, // Max 200KB
        maxWidthOrHeight: 800, // Max 800px width/height
        useWebWorker: true,
        fileType: 'image/webp' // Convert to WEBP for better compression
      };
      
      const compressedFile = await imageCompression(file, options);
      const fileExt = 'webp';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${fileName}`;

      // 2. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('cake-images')
        .upload(filePath, compressedFile);

      if (uploadError) throw uploadError;

      // 3. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('cake-images')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, image_url: publicUrl }));
      alert('อัปโหลดรูปภาพสำเร็จ!');
    } catch (error) {
      alert('เกิดข้อผิดพลาดในการอัปโหลด: ' + error.message);
    } finally {
      setUploading(false);
      // Reset input
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
      suggested_price: suggestedPrice,
      image_url: formData.image_url,
      preorder_limit: formData.preorder_limit ? parseInt(formData.preorder_limit, 10) : null
    };

    try {
      let productId = editingId;

      if (editingId) {
        // Update product
        await supabase.from('products').update(payload).eq('id', editingId);
        // Delete old recipe
        await supabase.from('product_ingredients').delete().eq('product_id', editingId);
      } else {
        // Insert product
        const { data, error } = await supabase.from('products').insert([payload]).select().single();
        if (error) throw error;
        productId = data.id;
      }

      // Insert new recipe
      if (recipeItems.length > 0) {
        const recipePayload = recipeItems.map(item => ({
          product_id: productId,
          ingredient_id: item.ingredient_id,
          quantity_used: parseFloat(item.quantity_used)
        }));
        await supabase.from('product_ingredients').insert(recipePayload);
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
      preorder_limit: product.preorder_limit || ''
    });
    
    const items = (product.product_ingredients || []).map(pi => ({
      ingredient_id: pi.ingredient_id,
      quantity_used: pi.quantity_used
    }));
    
    setRecipeItems(items);
    calculateSuggestedPrice(items);
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
    setFormData({ name: '', selling_price: '', image_url: '', preorder_limit: '' });
    setRecipeItems([]);
    setSuggestedPrice(0);
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
          <div className="modal-content">
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
              <div className="flex flex-wrap gap-4 mb-4">
                <div className="form-group" style={{ flex: '2 1 300px' }}>
                  <label className="form-label">ชื่อเมนูเค้ก</label>
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="form-control premium-input" placeholder="เช่น เค้กช็อกโกแลตหน้านิ่ม" />
                </div>
                <div className="form-group" style={{ flex: '1 1 150px' }}>
                  <label className="form-label">ราคาขาย (บาท)</label>
                  <input type="number" step="0.01" name="selling_price" value={formData.selling_price} onChange={handleInputChange} className="form-control premium-input" placeholder="0.00" />
                </div>
                <div className="form-group" style={{ flex: '1 1 150px' }}>
                  <label className="form-label">จำกัดพรีออร์เดอร์ (ชิ้น)</label>
                  <input type="number" min="1" step="1" name="preorder_limit" value={formData.preorder_limit || ''} onChange={handleInputChange} className="form-control premium-input" placeholder="เว้นว่าง = ไม่อั้น" />
                </div>
                <div className="form-group" style={{ flex: '2 1 300px' }}>
                  <label className="form-label">รูปภาพเค้ก (อัปโหลดจากเครื่อง)</label>
                  
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
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
                      {uploading && <p className="text-muted mt-2" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Loader2 size={14} className="animate-spin" /> กำลังอัปโหลด...</p>}
                    </div>
                    
                    {formData.image_url && (
                      <div style={{ position: 'relative' }}>
                        <img src={formData.image_url} alt="Preview" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '12px', border: '2px solid var(--primary-light)' }} />
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

              <div className="recipe-section">
                <div className="flex justify-between items-center mb-4 pb-2" style={{ borderBottom: '2px dashed rgba(255, 143, 179, 0.3)' }}>
                  <label className="form-label mb-0" style={{ fontSize: '1.1rem', color: 'var(--primary-dark)' }}>สูตรวัตถุดิบที่ใช้ (Recipe)</label>
                  <button type="button" className="btn btn-outline" onClick={addRecipeItem} style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', borderRadius: 'var(--radius-md)' }}>
                    <Plus size={14} /> เพิ่มวัตถุดิบ
                  </button>
                </div>
                
                {recipeItems.length === 0 ? (
                  <div className="text-center p-4" style={{ background: 'rgba(255,255,255,0.8)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)' }}>
                    <p className="text-muted m-0">ยังไม่ได้เพิ่มวัตถุดิบในสูตร</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {recipeItems.map((item, index) => (
                      <div key={index} className="flex gap-2 items-center p-2" style={{ background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                        <select 
                          className="form-control premium-input" 
                          value={item.ingredient_id} 
                          onChange={(e) => updateRecipeItem(index, 'ingredient_id', e.target.value)}
                          style={{ flex: 2, border: 'none', boxShadow: 'none' }}
                        >
                          {ingredients.map(ing => {
                            const factor = ing.conversion_factor || 1;
                            const costPerRecipeUnit = ing.cost_per_unit / factor;
                            const recipeUnitId = ing.recipe_unit_id || ing.unit_id;
                            const recipeUnitName = allUnits.find(u => u.id === recipeUnitId)?.name || '';
                            return (
                              <option key={ing.id} value={ing.id}>
                                {ing.name} (ต้นทุน: ฿{costPerRecipeUnit.toFixed(4)}/{recipeUnitName})
                              </option>
                            );
                          })}
                        </select>
                        
                        <div style={{ width: '1px', height: '30px', background: 'var(--border)' }}></div>

                        <input 
                          type="number" 
                          step="0.01" 
                          className="form-control premium-input" 
                          placeholder="จำนวนที่ใช้" 
                          value={item.quantity_used}
                          onChange={(e) => updateRecipeItem(index, 'quantity_used', e.target.value)}
                          style={{ flex: 1, border: 'none', boxShadow: 'none', textAlign: 'center' }}
                        />
                        
                        <span style={{ minWidth: '50px', fontSize: '0.875rem', fontWeight: '500' }} className="text-muted">
                          {(() => {
                            const ing = ingredients.find(i => i.id === item.ingredient_id);
                            if (!ing) return '';
                            const recipeUnitId = ing.recipe_unit_id || ing.unit_id;
                            return allUnits.find(u => u.id === recipeUnitId)?.name || '';
                          })()}
                        </span>

                        <button type="button" onClick={() => removeRecipeItem(index)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '0.5rem', display: 'flex', alignItems: 'center' }}>
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="mt-4 pt-3 text-right">
                  <p style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', fontWeight: 'bold', fontSize: '1.1rem', background: 'var(--primary-light)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)' }}>
                    <Calculator size={18} color="var(--primary-dark)"/> 
                    ต้นทุนรวม: <span style={{ color: 'var(--primary-dark)' }}>฿{(suggestedPrice / 1.5).toFixed(2)}</span>
                  </p>
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
                  <th>ราคาขาย</th>
                  <th>ต้นทุน/ราคาแนะนำ</th>
                  <th>จำกัดรับออร์เดอร์</th>
                  <th>สูตรวัตถุดิบ</th>
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
                    const suggestedPrice = item.suggested_price || 0;
                    const sellingPrice = item.selling_price || 0;
                    const cost = suggestedPrice / 1.5;
                    const productIngredients = item.product_ingredients || [];
                    
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
                        <td style={{ color: 'var(--primary-dark)', fontWeight: 'bold' }}>฿{sellingPrice.toFixed(2)}</td>
                        <td>
                          ฿{cost.toFixed(2)} <br/>
                          <span className="text-muted" style={{ fontSize: '0.75rem' }}>(แนะนำ ฿{suggestedPrice.toFixed(2)})</span>
                        </td>
                        <td>
                          {item.preorder_limit ? (
                            <span style={{ fontWeight: 'bold', color: 'var(--primary-dark)' }}>{item.preorder_limit} ชิ้น</span>
                          ) : (
                            <span className="text-muted">ไม่อั้น</span>
                          )}
                        </td>
                        <td>
                          {productIngredients.length > 0 ? (
                            <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.875rem' }} className="text-muted">
                              {productIngredients.map((pi, idx) => {
                                const ing = pi.ingredients;
                                const recipeUnitId = ing?.recipe_unit_id || ing?.unit_id;
                                const unitName = allUnits.find(u => u.id === recipeUnitId)?.name || '';
                                return (
                                  <li key={idx}>{ing?.name}: {pi.quantity_used} {unitName}</li>
                                );
                              })}
                            </ul>
                          ) : (
                            <span className="text-muted">- ไม่มีสูตร -</span>
                          )}
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
