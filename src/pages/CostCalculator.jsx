import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Calculator, 
  Percent, 
  DollarSign, 
  Plus, 
  Trash2, 
  Save, 
  RefreshCw, 
  Sparkles, 
  TrendingUp, 
  PieChart, 
  Info, 
  Layers, 
  ShoppingBag,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';

export default function CostCalculator() {
  const [activeTab, setActiveTab] = useState('quick'); // 'quick' | 'recipe'
  const [products, setProducts] = useState([]);
  const [dbIngredients, setDbIngredients] = useState([]);
  const [savingToProduct, setSavingToProduct] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');

  // Mode 1: Quick Calculator State
  const [ingredientCost, setIngredientCost] = useState(50);
  const [packagingCost, setPackagingCost] = useState(10);
  const [laborCost, setLaborCost] = useState(15);
  const [otherCost, setOtherCost] = useState(5);
  const [spoilagePercent, setSpoilagePercent] = useState(5); // 5% waste
  const [marginType, setMarginType] = useState('margin'); // 'margin' (% of sale) or 'markup' (% on cost)
  const [targetPercent, setTargetPercent] = useState(40); // 40% margin

  // Mode 2: Recipe Builder State
  const [recipeName, setRecipeName] = useState('เค้กส้มหน้านิ่ม (1 ปอนด์)');
  const [yieldQuantity, setYieldQuantity] = useState(4); // e.g. 4 ชิ้น หรือ 4 กล่อง
  const [yieldUnit, setYieldUnit] = useState('ชิ้น');
  const [recipeItems, setRecipeItems] = useState([
    { id: 1, name: 'แป้งเค้ก', quantity: 200, unit: 'กรัม', costPerUnit: 0.04 }, // 40 บาท/kg = 0.04/g
    { id: 2, name: 'ไข่ไก่ (เบอร์ 2)', quantity: 3, unit: 'ฟอง', costPerUnit: 4.5 },
    { id: 3, name: 'น้ำตาลทราย', quantity: 120, unit: 'กรัม', costPerUnit: 0.03 },
    { id: 4, name: 'เนยสดเค็ม', quantity: 100, unit: 'กรัม', costPerUnit: 0.25 },
    { id: 5, name: 'ซอสส้มสำเร็จรูป', quantity: 150, unit: 'กรัม', costPerUnit: 0.12 }
  ]);
  const [recipeLabor, setRecipeLabor] = useState(40);
  const [recipePackaging, setRecipePackaging] = useState(20);
  const [recipeOther, setRecipeOther] = useState(10);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // Fetch products to allow saving calculated price directly
    const { data: prodData } = await supabase
      .from('products')
      .select('id, name, selling_price')
      .order('name');
    if (prodData) setProducts(prodData);

    // Fetch ingredients for recipe lookup
    const { data: ingData } = await supabase
      .from('ingredients')
      .select('id, name, cost_per_unit, units(name)')
      .order('name');
    if (ingData) setDbIngredients(ingData);
  };

  // Quick Calculator Calculations
  const rawCost = Number(ingredientCost) || 0;
  const packCost = Number(packagingCost) || 0;
  const labCost = Number(laborCost) || 0;
  const othCost = Number(otherCost) || 0;
  const wasteAmt = rawCost * ((Number(spoilagePercent) || 0) / 100);

  const totalCostPerUnit = rawCost + packCost + labCost + othCost + wasteAmt;

  let calculatedSellingPrice = 0;
  const pct = Number(targetPercent) || 0;

  if (marginType === 'margin') {
    // Margin % = (Price - Cost) / Price => Price = Cost / (1 - Margin%)
    calculatedSellingPrice = pct < 100 ? totalCostPerUnit / (1 - pct / 100) : totalCostPerUnit * 2;
  } else {
    // Markup % = (Price - Cost) / Cost => Price = Cost * (1 + Markup%)
    calculatedSellingPrice = totalCostPerUnit * (1 + pct / 100);
  }

  const profitAmount = calculatedSellingPrice - totalCostPerUnit;
  const actualMarginPct = calculatedSellingPrice > 0 ? (profitAmount / calculatedSellingPrice) * 100 : 0;
  const actualMarkupPct = totalCostPerUnit > 0 ? (profitAmount / totalCostPerUnit) * 100 : 0;

  // Recipe Builder Calculations
  const totalRecipeIngredientsCost = recipeItems.reduce((sum, item) => {
    return sum + (Number(item.quantity) || 0) * (Number(item.costPerUnit) || 0);
  }, 0);

  const totalRecipeBatchCost = totalRecipeIngredientsCost + Number(recipeLabor) + Number(recipePackaging) + Number(recipeOther);
  const costPerYieldUnit = (Number(yieldQuantity) || 1) > 0 ? totalRecipeBatchCost / Number(yieldQuantity) : totalRecipeBatchCost;

  const addRecipeItem = () => {
    setRecipeItems(prev => [
      ...prev,
      { id: Date.now(), name: '', quantity: 100, unit: 'กรัม', costPerUnit: 0.1 }
    ]);
  };

  const removeRecipeItem = (id) => {
    setRecipeItems(prev => prev.filter(item => item.id !== id));
  };

  const updateRecipeItem = (id, field, value) => {
    setRecipeItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleSelectDbIngredient = (id, itemId) => {
    const found = dbIngredients.find(ing => ing.id === id || ing.id === Number(id));
    if (found) {
      updateRecipeItem(itemId, 'name', found.name);
      updateRecipeItem(itemId, 'costPerUnit', found.cost_per_unit || 0);
      if (found.units?.name) {
        updateRecipeItem(itemId, 'unit', found.units.name);
      }
    }
  };

  const applyRecipeToQuickCalc = () => {
    setIngredientCost(Math.round(totalRecipeIngredientsCost / (Number(yieldQuantity) || 1)));
    setLaborCost(Math.round(Number(recipeLabor) / (Number(yieldQuantity) || 1)));
    setPackagingCost(Math.round(Number(recipePackaging) / (Number(yieldQuantity) || 1)));
    setOtherCost(Math.round(Number(recipeOther) / (Number(yieldQuantity) || 1)));
    setActiveTab('quick');
  };

  const savePriceToSelectedProduct = async () => {
    if (!selectedProductId) {
      alert('กรุณาเลือกเมนูที่ต้องการอัปเดตราคาขาย');
      return;
    }

    const targetPrice = Math.ceil(calculatedSellingPrice);

    setSavingToProduct(true);
    const { error } = await supabase
      .from('products')
      .update({ selling_price: targetPrice })
      .eq('id', selectedProductId);

    setSavingToProduct(false);

    if (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    } else {
      alert(`อัปเดตราคาขายเป็น ฿${targetPrice} สำเร็จแล้ว!`);
      fetchData();
    }
  };

  // Suggested price tiers table for quick reference
  const suggestedTiers = [20, 30, 40, 50, 60, 70, 100].map(mPct => {
    const price = marginType === 'margin' 
      ? (mPct < 100 ? totalCostPerUnit / (1 - mPct / 100) : totalCostPerUnit * 2)
      : totalCostPerUnit * (1 + mPct / 100);
    const profit = price - totalCostPerUnit;
    return {
      percent: mPct,
      price: Math.ceil(price),
      exactPrice: price,
      profit: profit
    };
  });

  return (
    <div style={{ paddingBottom: '3rem' }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-dark)' }}>
            <Calculator size={28} /> คำนวณราคาขาย & ต้นทุนกำไร
          </h3>
          <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>
            เครื่องมือช่วยตั้งราคาขายเค้ก ขนม และเบเกอรี่ ให้ได้กำไรตามเป้าหมาย ไม่ขาดทุน
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', backgroundColor: 'var(--primary-light)', padding: '0.3rem', borderRadius: '12px', gap: '0.3rem' }}>
          <button
            onClick={() => setActiveTab('quick')}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '9px',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s ease',
              backgroundColor: activeTab === 'quick' ? 'white' : 'transparent',
              color: activeTab === 'quick' ? 'var(--primary-dark)' : 'var(--text-muted)',
              boxShadow: activeTab === 'quick' ? 'var(--shadow-sm)' : 'none'
            }}
          >
            <Sparkles size={16} /> คำนวณราคาขายแบบด่วน
          </button>
          <button
            onClick={() => setActiveTab('recipe')}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '9px',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s ease',
              backgroundColor: activeTab === 'recipe' ? 'white' : 'transparent',
              color: activeTab === 'recipe' ? 'var(--primary-dark)' : 'var(--text-muted)',
              boxShadow: activeTab === 'recipe' ? 'var(--shadow-sm)' : 'none'
            }}
          >
            <Layers size={16} /> คำนวณจากสูตรวัตถุดิบ (Recipe Costing)
          </button>
        </div>
      </div>

      {activeTab === 'quick' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {/* Inputs Section */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h4 style={{ margin: 0, fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
              <DollarSign size={20} color="var(--primary-dark)" /> 1. ใส่รายละเอียดต้นทุน (ต่อชิ้น/ปอนด์)
            </h4>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>ต้นทุนวัตถุดิบ (บาท)</label>
              <input 
                type="number" 
                min="0"
                step="1"
                className="form-control premium-input"
                value={ingredientCost} 
                onChange={(e) => setIngredientCost(e.target.value)}
                placeholder="เช่น 50"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">ค่าบรรจุภัณฑ์/กล่อง (บาท)</label>
                <input 
                  type="number" 
                  min="0"
                  step="1"
                  className="form-control"
                  value={packagingCost} 
                  onChange={(e) => setPackagingCost(e.target.value)}
                  placeholder="เช่น 10"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">ค่าแรงทำขนม (บาท)</label>
                <input 
                  type="number" 
                  min="0"
                  step="1"
                  className="form-control"
                  value={laborCost} 
                  onChange={(e) => setLaborCost(e.target.value)}
                  placeholder="เช่น 15"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">ค่าอื่นๆ (น้ำ/ไฟ/ก๊าซ)</label>
                <input 
                  type="number" 
                  min="0"
                  step="1"
                  className="form-control"
                  value={otherCost} 
                  onChange={(e) => setOtherCost(e.target.value)}
                  placeholder="เช่น 5"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">เผื่อสูญเสีย (%)</label>
                <input 
                  type="number" 
                  min="0"
                  max="50"
                  className="form-control"
                  value={spoilagePercent} 
                  onChange={(e) => setSpoilagePercent(e.target.value)}
                  placeholder="เช่น 5"
                />
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--primary-light)', padding: '1rem', borderRadius: '12px', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                <span>รวมต้นทุนวัตถุดิบ + เผื่อเสีย:</span>
                <span>฿{(rawCost + wasteAmt).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--primary-dark)' }}>
                <span>รวมต้นทุนสุทธิต่อชิ้น:</span>
                <span>฿{totalCostPerUnit.toFixed(2)}</span>
              </div>
            </div>

            <h4 style={{ margin: '0.5rem 0 0', fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
              <Percent size={20} color="var(--primary-dark)" /> 2. กำหนดกำไรที่ต้องการ
            </h4>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className={`btn ${marginType === 'margin' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setMarginType('margin')}
                style={{ flex: 1, padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
              >
                % กำไรจากยอดขาย (Margin)
              </button>
              <button
                type="button"
                className={`btn ${marginType === 'markup' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setMarginType('markup')}
                style={{ flex: 1, padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
              >
                % บวกเพิ่มจากทุน (Markup)
              </button>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <label className="form-label" style={{ margin: 0, fontWeight: 600 }}>
                  เป้าหมายกำไร: <span style={{ color: 'var(--primary-dark)', fontSize: '1.1rem', fontWeight: 'bold' }}>{targetPercent}%</span>
                </label>
              </div>
              <input 
                type="range" 
                min="5" 
                max="90" 
                step="5"
                value={targetPercent} 
                onChange={(e) => setTargetPercent(e.target.value)}
                style={{ width: '100%', accentColor: 'var(--primary-dark)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.25rem', marginTop: '0.5rem' }}>
                {[20, 30, 40, 50, 60, 70].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setTargetPercent(val)}
                    style={{
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.8rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      backgroundColor: Number(targetPercent) === val ? 'var(--primary-dark)' : 'white',
                      color: Number(targetPercent) === val ? 'white' : 'var(--text-main)',
                      cursor: 'pointer'
                    }}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results & Tiers Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Big Recommended Price Card */}
            <div className="card" style={{ 
              background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', 
              border: '2px solid rgba(249, 115, 22, 0.3)',
              borderRadius: '16px',
              padding: '1.5rem',
              textAlign: 'center',
              boxShadow: 'var(--shadow-md)'
            }}>
              <div style={{ fontSize: '0.9rem', color: '#c2410c', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                ราคาขายที่แนะนำ (ต่อชิ้น)
              </div>
              <div style={{ fontSize: '3rem', fontWeight: '900', color: '#9a3412', margin: '0.25rem 0' }}>
                ฿{Math.ceil(calculatedSellingPrice)}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#7c2d12', fontWeight: 500 }}>
                (คำนวณแบบทศนิยมแม่นยำ: ฿{calculatedSellingPrice.toFixed(2)})
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px dashed rgba(249, 115, 22, 0.3)' }}>
                <div style={{ backgroundColor: 'white', padding: '0.75rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>กำไรสุทธิต่อชิ้น</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--success)' }}>
                    +฿{(Math.ceil(calculatedSellingPrice) - totalCostPerUnit).toFixed(2)}
                  </div>
                </div>

                <div style={{ backgroundColor: 'white', padding: '0.75rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>อัตรากำไร (Margin)</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary-dark)' }}>
                    {actualMarginPct.toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Save directly to Menu dropdown */}
              {products.length > 0 && (
                <div style={{ marginTop: '1.25rem', textAlign: 'left', backgroundColor: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '0.5rem' }}>
                    💡 บันทึกราคาขายนี้ไปยังเมนูในร้าน
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select
                      className="form-control"
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      style={{ fontSize: '0.85rem' }}
                    >
                      <option value="">-- เลือกเมนูที่ต้องการอัปเดต --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} (ปัจจุบัน ฿{p.selling_price || 0})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={savePriceToSelectedProduct}
                      disabled={savingToProduct || !selectedProductId}
                      style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}
                    >
                      {savingToProduct ? 'กำลังบันทึก...' : 'อัปเดตราคา'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Price Tiers Comparison Table */}
            <div className="card">
              <h4 style={{ margin: '0 0 1rem', fontWeight: 'bold', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp size={18} color="var(--primary-dark)" /> ตารางเปรียบเทียบราคาขายที่ % กำไรต่างกัน
              </h4>

              <div className="table-container">
                <table className="table" style={{ fontSize: '0.88rem' }}>
                  <thead>
                    <tr>
                      <th>% กำไร</th>
                      <th>ราคาขายตั้งต้น</th>
                      <th>ปัดเศษราคาขาย</th>
                      <th>กำไรที่ได้รับ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suggestedTiers.map(tier => {
                      const isCurrent = Number(targetPercent) === tier.percent;
                      return (
                        <tr 
                          key={tier.percent} 
                          style={{ 
                            backgroundColor: isCurrent ? 'var(--primary-light)' : 'transparent',
                            fontWeight: isCurrent ? 'bold' : 'normal'
                          }}
                        >
                          <td>
                            <span style={{ 
                              padding: '0.2rem 0.5rem', 
                              borderRadius: '6px', 
                              backgroundColor: isCurrent ? 'var(--primary-dark)' : 'rgba(0,0,0,0.05)',
                              color: isCurrent ? 'white' : 'var(--text-main)',
                              fontSize: '0.8rem'
                            }}>
                              {tier.percent}%
                            </span>
                          </td>
                          <td className="text-muted">฿{tier.exactPrice.toFixed(2)}</td>
                          <td style={{ color: 'var(--primary-dark)', fontWeight: 'bold' }}>฿{tier.price}</td>
                          <td style={{ color: 'var(--success)' }}>+฿{(tier.price - totalCostPerUnit).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Recipe Costing Builder Tab */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {/* Recipe Form */}
          <div className="card" style={{ gridColumn: 'span 2' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h4 style={{ margin: 0, fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PieChart size={20} color="var(--primary-dark)" /> คำนวณต้นทุนตามสูตรวัตถุดิบ (Recipe Builder)
              </h4>
              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={applyRecipeToQuickCalc}
                style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--primary-light)' }}
              >
                <ArrowRight size={16} /> ส่งยอดต้นทุนไปคำนวณราคาขาย
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>ชื่อสูตรขนม / เมนู</label>
                <input 
                  type="text" 
                  className="form-control"
                  value={recipeName} 
                  onChange={(e) => setRecipeName(e.target.value)}
                  placeholder="เช่น เค้กส้ม 1 ปอนด์"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>จำนวนผลผลิตที่ได้</label>
                <input 
                  type="number" 
                  min="1"
                  className="form-control"
                  value={yieldQuantity} 
                  onChange={(e) => setYieldQuantity(e.target.value)}
                  placeholder="เช่น 4"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>หน่วยเรียก</label>
                <input 
                  type="text" 
                  className="form-control"
                  value={yieldUnit} 
                  onChange={(e) => setYieldUnit(e.target.value)}
                  placeholder="เช่น ชิ้น / ปอนด์ / กล่อง"
                />
              </div>
            </div>

            <h5 style={{ fontWeight: 'bold', margin: '1rem 0 0.75rem', fontSize: '0.95rem' }}>รายการวัตถุดิบในสูตร:</h5>

            <div className="table-container" style={{ marginBottom: '1rem' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: '35%' }}>วัตถุดิบ (เลือกจากสต็อกหรือพิมพ์เอง)</th>
                    <th style={{ width: '20%' }}>ปริมาณที่ใช้</th>
                    <th style={{ width: '15%' }}>หน่วย</th>
                    <th style={{ width: '20%' }}>ราคาต่อหน่วย (บาท)</th>
                    <th style={{ width: '10%' }}>ราคารวม</th>
                    <th style={{ width: '50px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {recipeItems.map((item) => {
                    const itemTotalCost = (Number(item.quantity) || 0) * (Number(item.costPerUnit) || 0);
                    return (
                      <tr key={item.id}>
                        <td>
                          {dbIngredients.length > 0 && (
                            <select
                              className="form-control"
                              onChange={(e) => handleSelectDbIngredient(e.target.value, item.id)}
                              style={{ fontSize: '0.8rem', padding: '0.2rem 0.4rem', marginBottom: '0.3rem' }}
                            >
                              <option value="">-- เลือกวัตถุดิบจากระบบคลัง --</option>
                              {dbIngredients.map(ing => (
                                <option key={ing.id} value={ing.id}>
                                  {ing.name} (฿{ing.cost_per_unit}/{ing.units?.name || 'หน่วย'})
                                </option>
                              ))}
                            </select>
                          )}
                          <input 
                            type="text" 
                            className="form-control"
                            value={item.name}
                            onChange={(e) => updateRecipeItem(item.id, 'name', e.target.value)}
                            placeholder="ชื่อวัตถุดิบ"
                          />
                        </td>
                        <td>
                          <input 
                            type="number" 
                            step="any"
                            className="form-control"
                            value={item.quantity}
                            onChange={(e) => updateRecipeItem(item.id, 'quantity', e.target.value)}
                            placeholder="ปริมาณ"
                          />
                        </td>
                        <td>
                          <input 
                            type="text" 
                            className="form-control"
                            value={item.unit}
                            onChange={(e) => updateRecipeItem(item.id, 'unit', e.target.value)}
                            placeholder="กรัม/ฟอง"
                          />
                        </td>
                        <td>
                          <input 
                            type="number" 
                            step="any"
                            className="form-control"
                            value={item.costPerUnit}
                            onChange={(e) => updateRecipeItem(item.id, 'costPerUnit', e.target.value)}
                            placeholder="บาท/หน่วย"
                          />
                        </td>
                        <td style={{ fontWeight: 'bold', color: 'var(--primary-dark)' }}>
                          ฿{itemTotalCost.toFixed(2)}
                        </td>
                        <td>
                          <button 
                            type="button" 
                            onClick={() => removeRecipeItem(item.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.2rem' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <button 
              type="button" 
              className="btn btn-outline" 
              onClick={addRecipeItem}
              style={{ fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginBottom: '1.5rem' }}
            >
              <Plus size={16} /> เพิ่มวัตถุดิบอีก 1 รายการ
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">ค่าแรงรวมทั้งสูตร (บาท)</label>
                <input 
                  type="number" 
                  className="form-control"
                  value={recipeLabor}
                  onChange={(e) => setRecipeLabor(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">ค่าบรรจุภัณฑ์รวม (บาท)</label>
                <input 
                  type="number" 
                  className="form-control"
                  value={recipePackaging}
                  onChange={(e) => setRecipePackaging(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">ค่าก๊าซ/ไฟ/อื่นๆ รวม (บาท)</label>
                <input 
                  type="number" 
                  className="form-control"
                  value={recipeOther}
                  onChange={(e) => setRecipeOther(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Summary Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card" style={{ backgroundColor: 'var(--primary-light)', border: '1px solid var(--primary-dark)' }}>
              <h4 style={{ margin: '0 0 1rem', fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--primary-dark)' }}>
                📊 สรุปต้นทุนสูตร "{recipeName || 'ขนม'}"
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>ต้นทุนวัตถุดิบรวม:</span>
                  <span style={{ fontWeight: 600 }}>฿{totalRecipeIngredientsCost.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>ค่าแรง + ค่าบรรจุภัณฑ์ + ค่าอื่นๆ:</span>
                  <span style={{ fontWeight: 600 }}>฿{(Number(recipeLabor) + Number(recipePackaging) + Number(recipeOther)).toFixed(2)}</span>
                </div>
                <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 'bold' }}>
                  <span>รวมต้นทุนทั้งสูตร ({yieldQuantity} {yieldUnit}):</span>
                  <span style={{ color: 'var(--primary-dark)' }}>฿{totalRecipeBatchCost.toFixed(2)}</span>
                </div>
              </div>

              <div style={{ 
                marginTop: '1.25rem', 
                padding: '1rem', 
                backgroundColor: 'white', 
                borderRadius: '12px', 
                textAlign: 'center',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  ต้นทุนสุทธิต่อ 1 {yieldUnit}
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary-dark)', margin: '0.25rem 0' }}>
                  ฿{costPerYieldUnit.toFixed(2)}
                </div>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={applyRecipeToQuickCalc}
                  style={{ marginTop: '0.75rem', width: '100%', fontSize: '0.85rem' }}
                >
                  <ArrowRight size={16} /> นำต้นทุนนี้ไปคำนวณราคาขาย
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
