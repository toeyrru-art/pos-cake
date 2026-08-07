import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { ShoppingCart, Plus, Minus, Trash2, History, X, Edit } from 'lucide-react';

export default function POS() {
  const [products, setProducts] = useState([]);
  const [productPromotions, setProductPromotions] = useState([]);
  const [cart, setCart] = useState([]); // [{ product, quantity, flavor }]
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedFlavors, setSelectedFlavors] = useState({});

  // History state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [salesHistory, setSalesHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyDate, setHistoryDate] = useState(() => {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    return new Date(Date.now() - tzoffset).toISOString().split('T')[0];
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (isHistoryOpen) {
      fetchHistory();
    }
  }, [isHistoryOpen, historyDate]);

  const fetchData = async () => {
    setLoading(true);
    const [prodRes, promoRes] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('product_promotions').select('*').eq('is_active', true)
    ]);
    
    if (prodRes.data) setProducts(prodRes.data);
    if (promoRes.data) setProductPromotions(promoRes.data);
    setLoading(false);
  };

  const addToCart = (product) => {
    const flavorList = product.flavors ? product.flavors.split(',').map(f => f.trim()).filter(Boolean) : [];
    const flavor = flavorList.length > 0 ? (selectedFlavors[product.id] || flavorList[0]) : null;

    const existing = cart.find(item => item.product.id === product.id && item.flavor === flavor);
    if (existing) {
      setCart(cart.map(item => 
        (item.product.id === product.id && item.flavor === flavor)
          ? { ...item, quantity: item.quantity + 1 } 
          : item
      ));
    } else {
      setCart([...cart, { product, quantity: 1, flavor }]);
    }
  };

  const updateQuantity = (productId, flavor, delta) => {
    setCart(cart.map(item => {
      if (item.product.id === productId && item.flavor === flavor) {
        const newQ = item.quantity + delta;
        return newQ > 0 ? { ...item, quantity: newQ } : item;
      }
      return item;
    }));
  };

  const removeFromCart = (productId, flavor) => {
    setCart(cart.filter(item => !(item.product.id === productId && item.flavor === flavor)));
  };

  const getFlavorPriceAddOn = (flavor) => {
    if (!flavor) return 0;
    const match = flavor.match(/\(\s*\+\s*(\d+)\s*\)/);
    return match ? parseInt(match[1], 10) : 0;
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const [year, month, day] = historyDate.split('-').map(Number);
      
      // Thailand is UTC+7, so we offset by -7 hours to get the UTC time
      const startOfDay = new Date(Date.UTC(year, month - 1, day, -7, 0, 0, 0)).toISOString();
      const endOfDay = new Date(Date.UTC(year, month - 1, day, 23 - 7, 59, 59, 999)).toISOString();

      const { data: salesData, error } = await supabase
        .from('sales')
        .select(`
          id, total_amount, created_at,
          sale_items (
            id, product_id, quantity, price_at_time, notes,
            product:products (*)
          )
        `)
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .order('created_at', { ascending: false });
      
      if (salesData) setSalesHistory(salesData);
    } catch (e) {
      console.log('Error fetching history:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const cancelSale = async (saleId) => {
    if (!confirm('คุณต้องการยกเลิกบิลนี้ใช่หรือไม่?\n\nข้อมูลบิลและรายรับจะถูกลบทิ้ง')) return;
    try {
      await supabase.from('sale_items').delete().eq('sale_id', saleId);
      await supabase.from('transactions').delete().eq('reference_id', saleId);
      await supabase.from('sales').delete().eq('id', saleId);
      alert('ยกเลิกบิลเรียบร้อยแล้ว');
      fetchHistory();
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการยกเลิกบิล: ' + err.message);
    }
  };

  const editSale = async (sale) => {
    if (!confirm('การแก้ไขบิล จะเป็นการดึงของกลับมาในตะกร้า และ "ยกเลิกบิลเก่าทิ้ง" เพื่อให้คิดเงินใหม่\n\nคุณต้องการดำเนินการต่อหรือไม่?')) return;
    
    const newCart = sale.sale_items.map(item => ({
      product: item.product,
      quantity: item.quantity,
      flavor: item.notes ? item.notes.replace('หน้า/รส: ', '') : null
    }));
    
    setCart(newCart);
    
    try {
      await supabase.from('sale_items').delete().eq('sale_id', sale.id);
      await supabase.from('transactions').delete().eq('reference_id', sale.id);
      await supabase.from('sales').delete().eq('id', sale.id);
      
      setIsHistoryOpen(false);
      alert('ดึงรายการมาไว้ในตะกร้าเรียบร้อยแล้ว กรุณาแก้ไขและกดยืนยันการขายใหม่อีกครั้ง');
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการแก้ไขบิล: ' + err.message);
    }
  };

  const calculateTotal = () => {
    let rawTotal = cart.reduce((sum, item) => {
      const addOn = getFlavorPriceAddOn(item.flavor);
      return sum + ((item.product.selling_price + addOn) * item.quantity);
    }, 0);

    let totalPromoDiscount = 0;
    
    // Calculate discounts based on active product_promotions
    productPromotions.forEach(promo => {
      // Find matching items in cart (if product_id is null, it applies to all items)
      const matchingItems = cart.filter(item => !promo.product_id || item.product.id === promo.product_id);
      
      const totalQuantity = matchingItems.reduce((sum, item) => sum + item.quantity, 0);
      
      if (totalQuantity >= promo.condition_quantity) {
        const timesApplied = Math.floor(totalQuantity / promo.condition_quantity);
        totalPromoDiscount += timesApplied * promo.discount_amount;
      }
    });

    const finalTotal = Math.max(0, rawTotal - totalPromoDiscount);
    
    return { rawTotal, discount: totalPromoDiscount, finalTotal };
  };

  const processSale = async () => {
    if (cart.length === 0) return;

    setProcessing(true);
    try {
      const { finalTotal: totalAmount } = calculateTotal();

      // 1. Create Sale Record
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert([{ total_amount: totalAmount }])
        .select()
        .single();
      
      if (saleError) throw saleError;
      const saleId = saleData.id;

      // 2. Create Sale Items
      const saleItemsData = cart.map(item => {
        const addOn = getFlavorPriceAddOn(item.flavor);
        return {
          sale_id: saleId,
          product_id: item.product.id,
          quantity: item.quantity,
          price_at_time: item.product.selling_price + addOn,
          notes: item.flavor ? `หน้า/รส: ${item.flavor}` : null
        };
      });
      await supabase.from('sale_items').insert(saleItemsData);

      // 3. Record Transaction (Income)
      await supabase.from('transactions').insert([{
        type: 'income',
        amount: totalAmount,
        description: `ขายสินค้าหน้าร้าน (Sale #${saleId.split('-')[0]})`,
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
    <>
      {/* Sales History Modal */}
      {isHistoryOpen && createPortal(
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px', width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <History size={20} /> ประวัติการขายหน้าร้าน
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <input 
                  type="date" 
                  value={historyDate}
                  onChange={(e) => setHistoryDate(e.target.value)}
                  style={{
                    padding: '0.4rem',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    fontFamily: 'inherit'
                  }}
                />
                <button className="modal-close" onClick={() => setIsHistoryOpen(false)} style={{ position: 'static' }}><X size={20} /></button>
              </div>
            </div>
            
            <div style={{ padding: '1rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {loadingHistory ? (
                <p className="text-center text-muted">กำลังโหลด...</p>
              ) : salesHistory.length === 0 ? (
                <p className="text-center text-muted">ไม่พบประวัติการขายในวันที่เลือก</p>
              ) : (
                salesHistory.map(sale => {
                  const saleTime = new Date(sale.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
                  return (
                    <div key={sale.id} style={{ backgroundColor: 'var(--primary-light)', padding: '1rem', borderRadius: '8px', border: '1px dashed var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                        <div style={{ fontWeight: 'bold', color: 'var(--primary-dark)' }}>บิลเวลา: {saleTime}</div>
                        <div style={{ fontWeight: 'bold' }}>ยอดรวม: ฿{sale.total_amount.toFixed(2)}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
                        {sale.sale_items.map(item => (
                          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                            <div>
                              - {item.product?.name || 'สินค้าที่ถูกลบ'} {item.notes && <span className="text-muted">({item.notes})</span>}
                            </div>
                            <div>x {item.quantity}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                        <button className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={() => editSale(sale)}>
                          <Edit size={14} style={{ display: 'inline', marginRight: '4px' }} /> แก้ไขรายการ
                        </button>
                        <button className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => cancelSale(sale.id)}>
                          <Trash2 size={14} style={{ display: 'inline', marginRight: '4px' }} /> ยกเลิกบิล
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {/* Product Selection */}
      <div style={{ flex: '1 1 60%', minWidth: '320px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>รายการสินค้า</h3>
          <button className="btn btn-outline" style={{ padding: '0.4rem 0.8rem' }} onClick={() => setIsHistoryOpen(true)}>
            <History size={16} style={{ display: 'inline', marginRight: '4px' }} /> ประวัติการขาย
          </button>
        </div>
        
        {loading ? (
          <p className="text-center text-muted">กำลังโหลด...</p>
        ) : products.length === 0 ? (
          <div className="card text-center text-muted">ยังไม่มีรายการสินค้า</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
            {products.map(p => {
              const flavorList = p.flavors ? p.flavors.split(',').map(f => f.trim()).filter(Boolean) : [];
              const currentFlavor = selectedFlavors[p.id] || (flavorList[0] || '');

              return (
                <div 
                  key={p.id} 
                  className="card" 
                  style={{ 
                    display: 'flex',
                    flexDirection: 'column',
                    justify: 'space-between',
                    height: '100%'
                  }}
                >
                  {p.image_url ? (
                    <img 
                      src={p.image_url} 
                      alt={p.name} 
                      style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px', marginBottom: '0.75rem' }} 
                    />
                  ) : (
                    <div style={{ width: '100%', height: '120px', borderRadius: '8px', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-dark)', fontSize: '2rem', marginBottom: '0.75rem' }}>
                      🍰
                    </div>
                  )}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.25rem' }}>{p.name}</div>
                    <div style={{ color: 'var(--primary-dark)', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                      ฿{(p.selling_price + getFlavorPriceAddOn(currentFlavor)).toFixed(2)}
                    </div>

                    {/* Flavor Selection Pills */}
                    {flavorList.length > 0 && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                          {flavorList.map((f, idx) => {
                            const isSelected = currentFlavor === f;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setSelectedFlavors(prev => ({ ...prev, [p.id]: f }));
                                }}
                                style={{
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '12px',
                                  border: isSelected ? '1px solid var(--primary-dark)' : '1px solid var(--border)',
                                  backgroundColor: isSelected ? 'var(--primary-dark)' : 'white',
                                  color: isSelected ? 'white' : 'var(--text-main)',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                  flex: '1 1 auto',
                                  textAlign: 'center'
                                }}
                              >
                                {f}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <button 
                    className="btn btn-outline" 
                    style={{ width: '100%', padding: '0.4rem', marginTop: 'auto' }}
                    onClick={() => addToCart(p)}
                  >
                    <Plus size={14} style={{ display: 'inline', marginRight: '4px' }} /> ใส่ตะกร้า
                  </button>
                </div>
              );
            })}
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
                {cart.map(item => {
                  const addOn = getFlavorPriceAddOn(item.flavor);
                  const itemPrice = item.product.selling_price + addOn;
                  return (
                    <div key={`${item.product.id}-${item.flavor}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--primary-light)', padding: '0.75rem', borderRadius: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500 }}>
                          {item.product.name}
                          {item.flavor && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>({item.flavor})</span>}
                        </div>
                        <div className="text-muted" style={{ fontSize: '0.85rem' }}>฿{itemPrice.toFixed(2)}</div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button className="btn btn-outline" style={{ padding: '0.2rem', borderRadius: '4px', background: 'white' }} onClick={(e) => { e.stopPropagation(); updateQuantity(item.product.id, item.flavor, -1); }}>
                          <Minus size={14} />
                        </button>
                        <span style={{ fontWeight: 'bold', minWidth: '20px', textAlign: 'center' }}>{item.quantity}</span>
                        <button className="btn btn-outline" style={{ padding: '0.2rem', borderRadius: '4px', background: 'white' }} onClick={(e) => { e.stopPropagation(); updateQuantity(item.product.id, item.flavor, 1); }}>
                          <Plus size={14} />
                        </button>
                        <button className="btn btn-outline" style={{ padding: '0.2rem', borderRadius: '4px', color: 'var(--danger)', borderColor: 'transparent' }} onClick={(e) => { e.stopPropagation(); removeFromCart(item.product.id, item.flavor); }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
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
    </>
  );
}
