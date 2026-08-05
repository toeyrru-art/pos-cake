import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ShoppingCart, Plus, Minus, Trash2 } from 'lucide-react';

export default function POS() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]); // [{ product, quantity }]
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: prodData } = await supabase
      .from('products')
      .select('*')
      .order('name');
    if (prodData) setProducts(prodData);
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

    setProcessing(true);
    try {
      const totalAmount = calculateTotal();

      // 1. Create Sale Record
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert([{ total_amount: totalAmount }])
        .select()
        .single();
      
      if (saleError) throw saleError;
      const saleId = saleData.id;

      // 2. Create Sale Items
      const saleItemsData = cart.map(item => ({
        sale_id: saleId,
        product_id: item.product.id,
        quantity: item.quantity,
        price_at_time: item.product.selling_price
      }));
      await supabase.from('sale_items').insert(saleItemsData);

      // 3. Record Transaction (Income)
      await supabase.from('transactions').insert([{
        type: 'income',
        amount: totalAmount,
        description: `ขายสินค้า (Sale #${saleId.split('-')[0]})`,
        reference_id: saleId
      }]);

      alert('ทำรายการขายสำเร็จ!');
      setCart([]);
      fetchData();

    } catch (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {/* Product Selection */}
      <div style={{ flex: '1 1 60%', minWidth: '320px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>รายการสินค้า</h3>
        
        {loading ? (
          <p className="text-center text-muted">กำลังโหลด...</p>
        ) : products.length === 0 ? (
          <div className="card text-center text-muted">ยังไม่มีรายการสินค้า</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
            {products.map(product => (
              <div 
                key={product.id} 
                className="card" 
                style={{ 
                  cursor: 'pointer',
                  transition: 'transform 0.1s, box-shadow 0.1s',
                  display: 'flex',
                  flexDirection: 'column',
                  justify: 'space-between',
                  height: '100%'
                }}
                onClick={() => addToCart(product)}
              >
                {product.image_url ? (
                  <img 
                    src={product.image_url} 
                    alt={product.name} 
                    style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px', marginBottom: '0.75rem' }} 
                  />
                ) : (
                  <div style={{ width: '100%', height: '120px', borderRadius: '8px', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-dark)', fontSize: '2rem', marginBottom: '0.75rem' }}>
                    🍰
                  </div>
                )}
                <div>
                  <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.25rem' }}>{product.name}</div>
                  <div style={{ color: 'var(--primary-dark)', fontWeight: 'bold' }}>฿{product.selling_price.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cart Section */}
      <div style={{ flex: '1 1 35%', minWidth: '300px' }}>
        <div className="card" style={{ position: 'sticky', top: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
            <ShoppingCart size={20} color="var(--primary-dark)" />
            <h4 style={{ margin: 0, fontWeight: 'bold' }}>ตะกร้าสินค้า</h4>
          </div>

          {cart.length === 0 ? (
            <p className="text-center text-muted" style={{ padding: '2rem 0' }}>ยังไม่มีสินค้าในตะกร้า</p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem', maxHeight: '350px', overflowY: 'auto' }}>
                {cart.map(item => (
                  <div key={item.product.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--primary-light)', padding: '0.75rem', borderRadius: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>{item.product.name}</div>
                      <div className="text-muted" style={{ fontSize: '0.85rem' }}>฿{item.product.selling_price.toFixed(2)}</div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button className="btn btn-outline" style={{ padding: '0.2rem', borderRadius: '4px', background: 'white' }} onClick={(e) => { e.stopPropagation(); updateQuantity(item.product.id, -1); }}>
                        <Minus size={14} />
                      </button>
                      <span style={{ fontWeight: 'bold', minWidth: '20px', textAlign: 'center' }}>{item.quantity}</span>
                      <button className="btn btn-outline" style={{ padding: '0.2rem', borderRadius: '4px', background: 'white' }} onClick={(e) => { e.stopPropagation(); updateQuantity(item.product.id, 1); }}>
                        <Plus size={14} />
                      </button>
                      <button className="btn btn-outline" style={{ padding: '0.2rem', borderRadius: '4px', color: 'var(--danger)', borderColor: 'transparent' }} onClick={(e) => { e.stopPropagation(); removeFromCart(item.product.id); }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '2px dashed var(--border)', paddingTop: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 'bold' }}>
                  <span>ราคารวมทั้งสิ้น</span>
                  <span style={{ color: 'var(--primary-dark)' }}>฿{calculateTotal().toFixed(2)}</span>
                </div>
              </div>

              <button 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '0.875rem', fontSize: '1.1rem' }}
                onClick={processSale}
                disabled={processing}
              >
                {processing ? 'กำลังทำรายการ...' : 'ชำระเงิน / ยืนยันการขาย'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
