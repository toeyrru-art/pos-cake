import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ShoppingBag, Plus, Minus, Trash2, Calendar, Phone, User, Cake } from 'lucide-react';

export default function CustomerShop() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    pickupDate: '',
    pickupTime: ''
  });

  useEffect(() => {
    document.title = "TT Bakery | Pre-order";
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    
    // Fetch products
    const { data: prodData } = await supabase
      .from('products')
      .select('*')
      .order('name');
      
    // Fetch active preorders to calculate reserved quantities
    const { data: activePreorders } = await supabase
      .from('preorder_items')
      .select(`
        product_id,
        quantity,
        preorders!inner(status)
      `)
      .in('preorders.status', ['pending', 'accepted']);

    // Calculate reserved quantities per product
    const reservedCounts = {};
    if (activePreorders) {
      activePreorders.forEach(item => {
        reservedCounts[item.product_id] = (reservedCounts[item.product_id] || 0) + item.quantity;
      });
    }

    if (prodData) {
      // Append remaining limit to product objects
      const productsWithLimits = prodData.map(p => {
        if (p.preorder_limit === null || p.preorder_limit === undefined) {
          return { ...p, remaining: Infinity }; // Unlimited
        }
        const reserved = reservedCounts[p.id] || 0;
        const remaining = Math.max(0, p.preorder_limit - reserved);
        return { ...p, remaining };
      });
      setProducts(productsWithLimits);
    }
    setLoading(false);
  };

  const addToCart = (product) => {
    const existing = cart.find(item => item.product.id === product.id);
    const currentQ = existing ? existing.quantity : 0;
    
    if (currentQ >= product.remaining) {
      alert(`ขออภัย สินค้านี้สั่งได้สูงสุด ${product.remaining} ชิ้นครับ`);
      return;
    }

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
        if (newQ > item.product.remaining) {
          alert(`ขออภัย สินค้านี้สั่งได้สูงสุด ${item.product.remaining} ชิ้นครับ`);
          return item;
        }
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const submitOrder = async (e) => {
    e.preventDefault();
    if (cart.length === 0) return alert('กรุณาเลือกสินค้าอย่างน้อย 1 ชิ้น');
    if (!formData.name || !formData.phone || !formData.pickupDate || !formData.pickupTime) {
      return alert('กรุณากรอกข้อมูลให้ครบถ้วน');
    }

    setSubmitting(true);
    try {
      const pickupDateTime = new Date(`${formData.pickupDate}T${formData.pickupTime}`).toISOString();
      const totalAmount = calculateTotal();

      // Create Preorder
      const { data: preorderData, error: preorderError } = await supabase
        .from('preorders')
        .insert([{
          customer_name: formData.name,
          customer_phone: formData.phone,
          pickup_date: pickupDateTime,
          total_amount: totalAmount,
          status: 'pending'
        }])
        .select()
        .single();

      if (preorderError) throw preorderError;

      // Create Preorder Items
      const itemsData = cart.map(item => ({
        preorder_id: preorderData.id,
        product_id: item.product.id,
        quantity: item.quantity,
        price_at_time: item.product.selling_price
      }));

      const { error: itemsError } = await supabase.from('preorder_items').insert(itemsData);
      if (itemsError) throw itemsError;

      setOrderSuccess(true);
      setCart([]);
    } catch (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (orderSuccess) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="card text-center" style={{ maxWidth: '500px', width: '100%' }}>
          <div style={{ width: '80px', height: '80px', backgroundColor: 'var(--success)', borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <Cake size={40} />
          </div>
          <h2 style={{ color: 'var(--primary-dark)', marginBottom: '1rem' }}>สั่งซื้อสำเร็จ!</h2>
          <p className="text-muted mb-4">ขอบคุณที่สั่งขนมเค้กกับเรา ทางร้านได้รับออร์เดอร์ของคุณเรียบร้อยแล้ว และจะเตรียมขนมเค้กไว้ให้ตามวันและเวลาที่คุณนัดรับครับ</p>
          <button className="btn btn-primary" onClick={() => { setOrderSuccess(false); setFormData({name:'', phone:'', pickupDate:'', pickupTime:''}); }}>
            กลับไปหน้าแรก
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Shop Header */}
      <header style={{ 
        background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', 
        padding: '2rem', 
        color: 'white',
        textAlign: 'center',
        boxShadow: 'var(--shadow-md)'
      }}>
        <h1 style={{ fontFamily: 'var(--font-en)', fontSize: '2.5rem', marginBottom: '0.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>TT Bakery</h1>
        <p style={{ opacity: 0.9 }}>สั่งขนมเค้กล่วงหน้า อร่อย สดใหม่ ทุกวัน</p>
      </header>

      {/* Shop Content */}
      <main className="shop-layout" style={{ flex: 1, padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%', display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        
        {/* Product List */}
        <div style={{ flex: '1 1 60%' }}>
          <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary-dark)' }}>เมนูขนมเค้กของเรา</h2>
          
          {loading ? (
            <p className="text-center text-muted">กำลังโหลดเมนู...</p>
          ) : products.length === 0 ? (
            <p className="text-center text-muted">ขออภัย ยังไม่มีเมนูเปิดรับพรีออร์เดอร์ในขณะนี้</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.5rem' }}>
              {products.map(p => (
                <div key={p.id} className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                  {p.image_url ? (
                    <div style={{ width: '100%', height: '160px', marginBottom: '1rem', borderRadius: '8px', overflow: 'hidden' }}>
                      <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <div style={{ width: '100%', height: '160px', marginBottom: '1rem', borderRadius: '8px', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-dark)' }}>
                      <span style={{ fontSize: '3rem' }}>🍰</span>
                    </div>
                  )}
                  <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  
                  {p.remaining !== Infinity && (
                    <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem', color: p.remaining > 0 ? 'var(--text-muted)' : 'var(--danger)', fontWeight: p.remaining <= 0 ? 'bold' : 'normal' }}>
                      {p.remaining > 0 ? `เหลืออีก ${p.remaining} ชิ้น` : 'สินค้าหมดโควต้า'}
                    </div>
                  )}

                  <div style={{ color: 'var(--primary-dark)', fontWeight: 'bold', fontSize: '1.25rem', marginBottom: '1rem' }}>
                    ฿{p.selling_price.toFixed(2)}
                  </div>
                  <button 
                    className="btn btn-outline" 
                    style={{ 
                      marginTop: 'auto', 
                      width: '100%',
                      opacity: p.remaining <= 0 ? 0.5 : 1,
                      cursor: p.remaining <= 0 ? 'not-allowed' : 'pointer',
                      color: p.remaining <= 0 ? 'var(--danger)' : undefined,
                      borderColor: p.remaining <= 0 ? 'var(--danger)' : undefined
                    }}
                    onClick={() => p.remaining > 0 && addToCart(p)}
                    disabled={p.remaining <= 0}
                  >
                    <Plus size={16} /> {p.remaining <= 0 ? 'Sold Out' : 'ใส่ตะกร้า'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart & Checkout Form */}
        <div style={{ flex: '1 1 35%', minWidth: '320px' }}>
          <div className="card" style={{ position: 'sticky', top: '2rem' }}>
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShoppingBag size={24} color="var(--primary-dark)" /> ตะกร้าสินค้า
            </h3>

            {cart.length === 0 ? (
              <div className="text-center text-muted" style={{ padding: '2rem 0' }}>
                ยังไม่มีสินค้าในตะกร้า
              </div>
            ) : (
              <>
                {/* Cart Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                  {cart.map(item => (
                    <div key={item.product.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500 }}>{item.product.name}</div>
                        <div className="text-muted" style={{ fontSize: '0.85rem' }}>฿{item.product.selling_price.toFixed(2)}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button className="btn btn-outline" style={{ padding: '0.2rem', borderRadius: '4px' }} onClick={() => updateQuantity(item.product.id, -1)}>
                          <Minus size={14} />
                        </button>
                        <span style={{ width: '24px', textAlign: 'center', fontWeight: 'bold' }}>{item.quantity}</span>
                        <button className="btn btn-outline" style={{ padding: '0.2rem', borderRadius: '4px' }} onClick={() => updateQuantity(item.product.id, 1)}>
                          <Plus size={14} />
                        </button>
                        <button className="btn btn-outline" style={{ padding: '0.2rem', borderRadius: '4px', color: 'var(--danger)', borderColor: 'transparent' }} onClick={() => removeFromCart(item.product.id)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '2rem', paddingTop: '1rem', borderTop: '2px dashed var(--border)' }}>
                  <span>ยอดรวมทั้งสิ้น</span>
                  <span style={{ color: 'var(--primary-dark)' }}>฿{calculateTotal().toFixed(2)}</span>
                </div>

                {/* Checkout Form */}
                <form onSubmit={submitOrder} style={{ backgroundColor: 'var(--primary-light)', padding: '1.5rem', borderRadius: 'var(--radius-md)' }}>
                  <h4 style={{ marginBottom: '1rem', fontSize: '1rem' }}>ข้อมูลสำหรับการรับสินค้า</h4>
                  
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><User size={14}/> ชื่อผู้สั่ง</label>
                    <input type="text" name="name" required value={formData.name} onChange={handleInputChange} className="form-control" placeholder="ชื่อ-นามสกุล" />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Phone size={14}/> เบอร์โทรศัพท์</label>
                    <input type="tel" name="phone" required value={formData.phone} onChange={handleInputChange} className="form-control" placeholder="08X-XXX-XXXX" />
                  </div>

                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Calendar size={14}/> วันที่รับเค้ก</label>
                      <input type="date" name="pickupDate" required value={formData.pickupDate} onChange={handleInputChange} className="form-control" />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">เวลาที่รับ</label>
                      <input type="time" name="pickupTime" required value={formData.pickupTime} onChange={handleInputChange} className="form-control" />
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', fontSize: '1.1rem', padding: '1rem' }} disabled={submitting}>
                    {submitting ? 'กำลังส่งข้อมูล...' : 'ยืนยันการสั่งพรีออร์เดอร์'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
