import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ShoppingCart, Plus, Minus, Trash2 } from 'lucide-react';

export default function POS() {
  const [products, setProducts] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [cart, setCart] = useState([]); // [{ product, quantity }]
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch products with recipes
    const { data: prodData } = await supabase
      .from('products')
      .select(`
        *,
        product_ingredients (
          ingredient_id,
          quantity_used
        )
      `)
      .order('name');
    if (prodData) setProducts(prodData);

    // Fetch ingredients to check stock
    const { data: ingData } = await supabase
      .from('ingredients')
      .select('*');
    if (ingData) setIngredients(ingData);

    setLoading(false);
  };

  const addToCart = (product) => {
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      setCart(cart.map(item => 
        item.product.id === product.id 
          ? { ...item, quantity: item.quantity + 1 } 
          : item
      ));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId, delta) => {
    setCart(cart.map(item => {
      if (item.product.id === productId) {
        const newQ = item.quantity + delta;
        return newQ > 0 ? { ...item, quantity: newQ } : item;
      }
      return item;
    }));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + (item.product.selling_price * item.quantity), 0);
  };

  const processSale = async () => {
    if (cart.length === 0) return;
    
    // 1. Verify Stock
    let stockErrors = [];
    const ingredientUsage = {};
    
    cart.forEach(cartItem => {
      cartItem.product.product_ingredients.forEach(pi => {
        const totalUsedInRecipeUnit = pi.quantity_used * cartItem.quantity;
        const ing = ingredients.find(i => i.id === pi.ingredient_id);
        const factor = ing?.conversion_factor || 1;
        const totalUsedInStorageUnit = totalUsedInRecipeUnit / factor;
        
        ingredientUsage[pi.ingredient_id] = (ingredientUsage[pi.ingredient_id] || 0) + totalUsedInStorageUnit;
      });
    });

    for (const [ingId, used] of Object.entries(ingredientUsage)) {
      const ing = ingredients.find(i => i.id === ingId);
      if (ing && ing.stock_quantity < used) {
        stockErrors.push(`วัตถุดิบ ${ing.name} ไม่พอ (ต้องการตัดสต๊อก: ${used.toFixed(2)}, มี: ${ing.stock_quantity})`);
      }
    }

    if (stockErrors.length > 0) {
      alert("ไม่สามารถขายได้ สต๊อกวัตถุดิบไม่เพียงพอ:\n- " + stockErrors.join("\n- "));
      return;
    }

    setProcessing(true);
    try {
      const totalAmount = calculateTotal();

      // 2. Create Sale Record
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert([{ total_amount: totalAmount }])
        .select()
        .single();
      
      if (saleError) throw saleError;
      const saleId = saleData.id;

      // 3. Create Sale Items
      const saleItemsData = cart.map(item => ({
        sale_id: saleId,
        product_id: item.product.id,
        quantity: item.quantity,
        price_at_time: item.product.selling_price
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

      // 5. Record Transaction (Income)
      await supabase.from('transactions').insert([{
        type: 'income',
        amount: totalAmount,
        description: `ขายสินค้า (Sale #${saleId.split('-')[0]})`,
        reference_id: saleId
      }]);

      alert('ทำรายการขายสำเร็จ!');
      setCart([]);
      fetchData(); // refresh stock

    } catch (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>ขายสินค้า (POS)</h3>

      <div className="flex gap-4 pos-layout" style={{ alignItems: 'flex-start' }}>
        
        {/* Product Grid */}
        <div style={{ flex: '2' }}>
          <div className="card">
            <h4 style={{ marginBottom: '1rem', fontWeight: 'bold' }}>เมนูเค้ก</h4>
            {loading ? (
              <p className="text-center text-muted">กำลังโหลด...</p>
            ) : products.length === 0 ? (
              <p className="text-center text-muted">ไม่มีเมนูเค้ก กรุณาไปเพิ่มที่จัดการเมนู</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                {products.map(p => (
                  <div 
                    key={p.id} 
                    style={{ 
                      border: '1px solid var(--border)', 
                      borderRadius: 'var(--radius-md)', 
                      padding: '1rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textAlign: 'center',
                      backgroundColor: 'var(--primary-light)'
                    }}
                    onClick={() => addToCart(p)}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary-dark)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    {p.image_url ? (
                      <div style={{ width: '100%', height: '120px', marginBottom: '0.75rem', borderRadius: '8px', overflow: 'hidden' }}>
                        <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ) : (
                      <div style={{ width: '100%', height: '120px', marginBottom: '0.75rem', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-dark)' }}>
                        <span style={{ fontSize: '2rem' }}>🍰</span>
                      </div>
                    )}
                    <div style={{ fontWeight: 500, marginBottom: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    <div style={{ color: 'var(--primary-dark)', fontWeight: 'bold', fontSize: '1.125rem' }}>
                      ฿{p.selling_price.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cart */}
        <div style={{ flex: '1', minWidth: '300px' }}>
          <div className="card" style={{ position: 'sticky', top: '100px' }}>
            <h4 style={{ marginBottom: '1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShoppingCart size={20} /> รายการสั่งซื้อ
            </h4>
            
            {cart.length === 0 ? (
              <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                ยังไม่ได้เลือกสินค้า
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                {cart.map(item => (
                  <div key={item.product.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>{item.product.name}</div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        ฿{item.product.selling_price.toFixed(2)} / ชิ้น
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button className="btn btn-outline" style={{ padding: '0.2rem' }} onClick={() => updateQuantity(item.product.id, -1)}>
                        <Minus size={14} />
                      </button>
                      <span style={{ width: '20px', textAlign: 'center' }}>{item.quantity}</span>
                      <button className="btn btn-outline" style={{ padding: '0.2rem' }} onClick={() => updateQuantity(item.product.id, 1)}>
                        <Plus size={14} />
                      </button>
                      <button className="btn btn-outline" style={{ padding: '0.2rem', color: 'var(--danger)', borderColor: 'transparent', marginLeft: '0.5rem' }} onClick={() => removeFromCart(item.product.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                
                <div style={{ borderTop: '2px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.25rem' }}>
                  <span>ยอดรวม</span>
                  <span style={{ color: 'var(--primary-dark)' }}>฿{calculateTotal().toFixed(2)}</span>
                </div>
                
                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', marginTop: '1rem' }}
                  onClick={processSale}
                  disabled={processing}
                >
                  {processing ? 'กำลังประมวลผล...' : 'ชำระเงิน (ตัดสต๊อกอัตโนมัติ)'}
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
