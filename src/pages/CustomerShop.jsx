import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { ShoppingBag, Plus, Minus, Trash2, Calendar, Phone, User, Cake, UploadCloud, CreditCard, Award, Gift, Check, Ticket, X } from 'lucide-react';

export default function CustomerShop() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [slipFile, setSlipFile] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('transfer');
  const [isStoreOpen, setIsStoreOpen] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [productPromotions, setProductPromotions] = useState([]);

  // Selected flavor state per product: { [productId]: flavorString }
  const [selectedFlavors, setSelectedFlavors] = useState({});

  // Member & Rewards state
  const [rewardsList, setRewardsList] = useState([]);
  const [memberInfo, setMemberInfo] = useState(null);
  const [selectedReward, setSelectedReward] = useState(null);
  const [bahtPerPoint, setBahtPerPoint] = useState(50);

  // Promo Code state
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [availablePromos, setAvailablePromos] = useState([]);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [showPromoInput, setShowPromoInput] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    pickupDate: ''
  });

  const [pickupDateMode, setPickupDateMode] = useState('customer');
  const [fixedPickupDate, setFixedPickupDate] = useState('');

  useEffect(() => {
    fetchStoreStatus();
    fetchData();
    fetchRewardsAndSettings();

    // Subscribe to store_settings changes real-time
    const channel = supabase
      .channel('store_settings_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'store_settings' },
        (payload) => {
          if (payload.new) {
            if (payload.new.key === 'is_store_open') setIsStoreOpen(payload.new.value === 'true');
            if (payload.new.key === 'pickup_date_mode') setPickupDateMode(payload.new.value);
            if (payload.new.key === 'fixed_pickup_date') setFixedPickupDate(payload.new.value);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchRewardsAndSettings = async () => {
    try {
      const { data: settingData } = await supabase
        .from('store_settings')
        .select('value')
        .eq('key', 'baht_per_point')
        .maybeSingle();

      if (settingData && settingData.value) {
        setBahtPerPoint(Number(settingData.value) || 50);
      }

      const { data: rewData } = await supabase
        .from('rewards')
        .select('*')
        .eq('is_active', true)
        .order('points_required', { ascending: true });

      if (rewData) setRewardsList(rewData);

      // Fetch active promo codes
      const { data: promoData } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (promoData) setAvailablePromos(promoData);
    } catch (e) {
      console.log('Error fetching rewards/settings/promos:', e);
    }
  };

  const fetchStoreStatus = async () => {
    const { data } = await supabase
      .from('store_settings')
      .select('*')
      .in('key', ['is_store_open', 'pickup_date_mode', 'fixed_pickup_date']);

    if (data) {
      data.forEach(setting => {
        if (setting.key === 'is_store_open') setIsStoreOpen(setting.value === 'true');
        if (setting.key === 'pickup_date_mode') setPickupDateMode(setting.value);
        if (setting.key === 'fixed_pickup_date') setFixedPickupDate(setting.value);
      });
    }
  };

  const fetchData = async () => {
    setLoading(true);

    const { data: settingsData } = await supabase
      .from('store_settings')
      .select('key, value')
      .in('key', ['pickup_date_mode', 'fixed_pickup_date']);

    let pMode = 'customer';
    let fDate = '';
    if (settingsData) {
      settingsData.forEach(setting => {
        if (setting.key === 'pickup_date_mode') pMode = setting.value;
        if (setting.key === 'fixed_pickup_date') fDate = setting.value;
      });
    }

    if (!fDate) {
      const tzoffset = (new Date()).getTimezoneOffset() * 60000;
      fDate = new Date(Date.now() - tzoffset).toISOString().split('T')[0];
    }

    let preorderQuery = supabase.from('preorder_items')
      .select('product_id, quantity, preorders!inner(status, pickup_date)')
      .in('preorders.status', ['pending', 'accepted', 'completed'])
      .gte('preorders.pickup_date', `${fDate}`)
      .lt('preorders.pickup_date', `${fDate}T23:59:59.999Z`);

    const saleQuery = supabase.from('sale_items')
      .select('product_id, quantity, created_at')
      .gte('created_at', `${fDate}T00:00:00`)
      .lt('created_at', `${fDate}T23:59:59.999Z`);

    const [prodRes, promoRes, preRes, saleRes] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('product_promotions').select('*').eq('is_active', true),
      preorderQuery,
      saleQuery
    ]);

    const activePreorders = preRes.data;
    const activeSales = saleRes.data;
    
    if (promoRes.data) {
      setProductPromotions(promoRes.data);
    }

    const reservedCounts = {};
    if (activePreorders) {
      activePreorders.forEach(item => {
        reservedCounts[item.product_id] = (reservedCounts[item.product_id] || 0) + item.quantity;
      });
    }
    if (activeSales) {
      activeSales.forEach(item => {
        reservedCounts[item.product_id] = (reservedCounts[item.product_id] || 0) + item.quantity;
      });
    }

    if (prodRes.data) {
      const productsWithLimits = prodRes.data.map(p => {
        if (p.preorder_limit === null || p.preorder_limit === undefined) {
          return { ...p, remaining: Infinity };
        }
        const reserved = reservedCounts[p.id] || 0;
        const remaining = Math.max(0, p.preorder_limit - reserved);
        return { ...p, remaining };
      });
      setProducts(productsWithLimits);
    }
    setLoading(false);
  };

  const checkMemberPhone = async (phoneStr) => {
    if (!phoneStr || phoneStr.trim().length < 9) {
      setMemberInfo(null);
      setSelectedReward(null);
      return;
    }
    try {
      const { data } = await supabase
        .from('members')
        .select('*')
        .eq('phone', phoneStr.trim())
        .maybeSingle();

      if (data) {
        setMemberInfo(data);
        if (data.name && !formData.name) {
          setFormData(prev => ({ ...prev, name: data.name }));
        }
      } else {
        setMemberInfo(null);
        setSelectedReward(null);
      }
    } catch (e) {
      console.log('Error checking member:', e);
    }
  };

  const addToCart = (product) => {
    const flavorList = product.flavors ? product.flavors.split(',').map(f => f.trim()).filter(Boolean) : [];
    const flavor = flavorList.length > 0 ? (selectedFlavors[product.id] || flavorList[0]) : null;

    const existing = cart.find(item => item.product.id === product.id && item.flavor === flavor);
    const currentQ = existing ? existing.quantity : 0;
    
    if (currentQ >= product.remaining) {
      alert(`ขออภัย สินค้านี้สั่งได้สูงสุด ${product.remaining} ชิ้นครับ`);
      return;
    }

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
        if (newQ > item.product.remaining) {
          alert(`ขออภัย สินค้านี้สั่งได้สูงสุด ${item.product.remaining} ชิ้นครับ`);
          return item;
        }
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

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => {
      const addOn = getFlavorPriceAddOn(item.flavor);
      return sum + ((item.product.selling_price + addOn) * item.quantity);
    }, 0);
  };

  const calculateRewardDiscount = () => {
    if (!selectedReward || !selectedReward.discount_amount) return 0;
    return Number(selectedReward.discount_amount) || 0;
  };

  const calculatePromoDiscount = () => {
    if (!appliedPromo) return 0;
    const subtotal = calculateSubtotal();
    if (appliedPromo.discount_type === 'percent') {
      return (subtotal * Number(appliedPromo.discount_value)) / 100;
    }
    return Number(appliedPromo.discount_value) || 0;
  };

  const calculateProductPromoDiscount = () => {
    let totalPromoDiscount = 0;
    productPromotions.forEach(promo => {
      const matchingItems = cart.filter(item => !promo.product_id || item.product.id === promo.product_id);
      const totalQuantity = matchingItems.reduce((sum, item) => sum + item.quantity, 0);
      if (totalQuantity >= promo.condition_quantity) {
        const timesApplied = Math.floor(totalQuantity / promo.condition_quantity);
        totalPromoDiscount += timesApplied * promo.discount_amount;
      }
    });
    return totalPromoDiscount;
  };

  const calculateDiscount = () => {
    return calculateRewardDiscount() + calculatePromoDiscount() + calculateProductPromoDiscount();
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const discount = calculateDiscount();
    return Math.max(0, subtotal - discount);
  };

  const applyPromoCode = async () => {
    if (!promoInput.trim()) return alert('กรุณากรอกโค้ดส่วนลด');
    const inputCode = promoInput.trim().toUpperCase();

    try {
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', inputCode)
        .eq('is_active', true)
        .maybeSingle();

      if (error || !data) {
        return alert('ไม่พบโค้ดส่วนลดนี้ หรือโค้ดหมดอายุแล้ว');
      }

      const subtotal = calculateSubtotal();
      if (data.min_spend && subtotal < Number(data.min_spend)) {
        return alert(`โค้ดนี้ใช้ได้เมื่อซื้อขั้นต่ำ ฿${Number(data.min_spend).toFixed(2)} ขึ้นไปครับ`);
      }

      let discountAmt = 0;
      if (data.discount_type === 'percent') {
        discountAmt = (subtotal * Number(data.discount_value)) / 100;
      } else {
        discountAmt = Number(data.discount_value);
      }

      setAppliedPromo({
        ...data,
        calculatedDiscount: discountAmt
      });
      alert(`ใช้โค้ดส่วนลด ${data.code} สำเร็จ! (ลด ฿${discountAmt.toFixed(2)})`);
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการตรวจสอบโค้ด');
    }
  };

  const removePromoCode = () => {
    setAppliedPromo(null);
    setPromoInput('');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'phone') {
      checkMemberPhone(value);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSlipFile(e.target.files[0]);
    }
  };
  const sendSlackNotification = async (orderData, cartItems, slipUrl, appliedPromo, selectedReward) => {
    try {
      const { data: slackWebhookData } = await supabase
        .from('store_settings')
        .select('value')
        .eq('key', 'slack_webhook_url')
        .maybeSingle();

      const webhookUrl = slackWebhookData?.value;
      
      if (!webhookUrl) {
        console.log('No Slack Webhook URL found. Skipping notification.');
        return;
      }

      const itemsList = cartItems
        .map(i => {
          const flavorText = i.flavor ? ` (${i.flavor})` : '';
          const itemPrice = i.product.selling_price + getFlavorPriceAddOn(i.flavor);
          return `- ${i.product.name}${flavorText} x ${i.quantity} (฿${(itemPrice * i.quantity).toFixed(2)})`;
        })
        .join('\n');

      const pickupDateFormatted = new Date(orderData.pickup_date).toLocaleString('th-TH', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });

      const rewardNotice = selectedReward ? `\n🎁 แลกของรางวัล: ${selectedReward.title} (หัก ${selectedReward.points_required} แต้ม)` : '';
      const promoNotice = appliedPromo ? `\n🎟️ โค้ดส่วนลด: ${appliedPromo.code} (ลด ฿${calculatePromoDiscount().toFixed(2)})` : '';
      const prodPromoDiscount = calculateProductPromoDiscount();
      const productPromoNotice = prodPromoDiscount > 0 ? `\n🛍️ โปรโมชั่นสินค้า: (ลด ฿${prodPromoDiscount.toFixed(2)})` : '';

      const messageText = `\n🆕 ออร์เดอร์ใหม่จากหน้าเว็บ /shop\n\n` +
        `👤 คุณ: ${orderData.customer_name}\n` +
        `📞 เบอร์โทร: ${orderData.customer_phone}\n` +
        `📅 นัดรับวัน-เวลา: ${pickupDateFormatted}\n\n` +
        `🍰 รายการสินค้า:\n${itemsList}\n\n` +
        `💰 ยอดรวมทั้งสิ้น: ฿${Number(orderData.total_amount).toFixed(2)}${rewardNotice}${promoNotice}${productPromoNotice}\n` +
        `💳 ชำระโดย: ${orderData.payment_method === 'transfer' ? 'โอนเงิน' : 'ชำระวันรับของ'}\n` +
        (slipUrl ? `🧾 สลิปโอนเงิน: ${slipUrl}` : '');

      await fetch('/api/slack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          webhookUrl: webhookUrl
        })
      });
    } catch (err) {
      console.log('Slack Notification Error:', err);
    }
  };

  const submitOrder = async (e) => {
    e.preventDefault();
    if (cart.length === 0) return alert('กรุณาเลือกสินค้าอย่างน้อย 1 ชิ้น');
    
    const actualPickupDate = pickupDateMode === 'fixed' ? fixedPickupDate : formData.pickupDate;
    
    if (!formData.name || !actualPickupDate) {
      return alert('กรุณากรอกข้อมูลให้ครบถ้วน');
    }

    setSubmitting(true);
    try {
      let slipUrl = null;

      if (slipFile) {
        try {
          const fileExt = slipFile.name.split('.').pop() || 'png';
          const fileName = `slip_${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('cake-images')
            .upload(fileName, slipFile);
            
          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage
              .from('cake-images')
              .getPublicUrl(fileName);
              
            slipUrl = publicUrlData?.publicUrl || null;
          }
        } catch (slipErr) {
          console.log('Slip upload error ignored:', slipErr);
        }
      }

      let pickupDateTime;
      try {
        const dateStr = `${actualPickupDate}T12:00:00`;
        const parsedDate = new Date(dateStr);
        if (isNaN(parsedDate.getTime())) {
          pickupDateTime = new Date().toISOString();
        } else {
          pickupDateTime = parsedDate.toISOString();
        }
      } catch (err) {
        pickupDateTime = new Date().toISOString();
      }

      const finalTotalAmount = calculateTotal();
      const subtotalAmount = calculateSubtotal();

      // Process Membership Points & Rewards
      if (formData.phone) {
        const cleanPhone = formData.phone.trim();
        const earnedPoints = Math.floor(subtotalAmount / bahtPerPoint);

        try {
          let { data: memberRes } = await supabase
            .from('members')
            .select('*')
            .eq('phone', cleanPhone)
            .maybeSingle();

          let memberId = memberRes?.id;
          let currentPoints = memberRes?.points || 0;

          if (!memberRes) {
            const insertRes = await supabase
              .from('members')
              .insert([{ phone: cleanPhone, name: formData.name, points: earnedPoints }])
              .select()
              .single();
            
            if (insertRes.data) {
              memberId = insertRes.data.id;
              await supabase.from('point_logs').insert([{
                member_id: memberId,
                points: earnedPoints,
                type: 'earn',
                description: `ต้อนรับสมาชิกใหม่ + แต้มจากยอดซื้อ ฿${subtotalAmount.toFixed(2)}`
              }]);
            }
          } else {
            if (selectedReward && currentPoints >= selectedReward.points_required) {
              currentPoints -= selectedReward.points_required;
              await supabase.from('point_logs').insert([{
                member_id: memberId,
                points: -selectedReward.points_required,
                type: 'redeem',
                description: `แลกของรางวัล: ${selectedReward.title}`
              }]);
            }

            if (earnedPoints > 0) {
              currentPoints += earnedPoints;
              await supabase.from('point_logs').insert([{
                member_id: memberId,
                points: earnedPoints,
                type: 'earn',
                description: `สะสมแต้มจากพรีออร์เดอร์ ฿${subtotalAmount.toFixed(2)}`
              }]);
            }

            await supabase
              .from('members')
              .update({ points: currentPoints, name: formData.name || memberRes.name })
              .eq('id', memberId);
          }
        } catch (memErr) {
          console.log('Member points processing bypassed:', memErr);
        }
      }

      // Create Preorder
      const preorderPayload = {
        customer_name: formData.name,
        customer_phone: formData.phone,
        pickup_date: pickupDateTime,
        total_amount: finalTotalAmount,
        status: 'pending',
        slip_url: slipUrl,
        payment_method: paymentMethod
      };

      let res = await supabase
        .from('preorders')
        .insert([preorderPayload])
        .select()
        .single();

      if (res.error) {
        if (res.error.message.includes('slip_url')) delete preorderPayload.slip_url;
        if (res.error.message.includes('payment_method')) delete preorderPayload.payment_method;
        
        res = await supabase
          .from('preorders')
          .insert([preorderPayload])
          .select()
          .single();
      }

      const preorderData = res.data;
      if (res.error) throw res.error;

      // Create Preorder Items
      const itemsData = cart.map(item => {
        const addOn = getFlavorPriceAddOn(item.flavor);
        return {
          preorder_id: preorderData.id,
          product_id: item.product.id,
          quantity: item.quantity,
          price_at_time: item.product.selling_price + addOn,
          notes: item.flavor ? `หน้า/รส: ${item.flavor}` : null
        };
      });

      let itemsRes = await supabase.from('preorder_items').insert(itemsData);
      if (itemsRes.error && itemsRes.error.message.includes('notes')) {
        const cleanItemsData = itemsData.map(({ notes, ...rest }) => rest);
        const retryRes = await supabase.from('preorder_items').insert(cleanItemsData);
        if (retryRes.error) throw retryRes.error;
      } else if (itemsRes.error) {
        throw itemsRes.error;
      }

      await sendSlackNotification(
        {
          customer_name: formData.name,
          customer_phone: formData.phone,
          pickup_date: pickupDateTime,
          total_amount: finalTotalAmount,
          payment_method: paymentMethod
        },
        cart,
        slipUrl,
        appliedPromo,
        selectedReward
      );

      setOrderSuccess(true);
      setCart([]);
      setSlipFile(null);
      setSelectedReward(null);
      setAppliedPromo(null);
      setPromoInput('');
    } catch (error) {
      alert('เกิดข้อผิดพลาดในการสั่งซื้อ: ' + error.message);
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
          <p className="text-muted mb-4">ขอบคุณที่สั่งขนมเค้กกับเรา แต้มสะสมของท่านถูกบันทึกเข้าในระบบเรียบร้อยแล้ว และทางร้านจะเตรียมขนมเค้กไว้ให้ตามวันและเวลานัดรับครับ</p>
          <button className="btn btn-primary" onClick={() => { setOrderSuccess(false); setFormData({name:'', phone:'', pickupDate:''}); setSlipFile(null); }}>
            กลับไปหน้าแรก
          </button>
        </div>
      </div>
    );
  }

  const subtotal = calculateSubtotal();
  const rewardDiscount = calculateRewardDiscount();
  const promoDiscount = calculatePromoDiscount();
  const totalDiscount = calculateDiscount();
  const total = calculateTotal();
  const estimatedEarnedPoints = Math.floor(subtotal / bahtPerPoint);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Shop Header */}
      <header style={{ 
        background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', 
        padding: '2.5rem 1rem', 
        color: 'white',
        textAlign: 'center',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          overflow: 'hidden',
          border: '4px solid white',
          boxShadow: '0 6px 16px rgba(0,0,0,0.15)',
          marginBottom: '1rem',
          backgroundColor: 'white'
        }}>
          <img src="/logo.jpg" alt="บ้านทุ่ง เบเกอรี่ Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 'bold', marginBottom: '0.25rem', textShadow: '0 2px 4px rgba(0,0,0,0.15)' }}>บ้านทุ่ง เบเกอรี่</h1>
        <p style={{ opacity: 0.95, fontSize: '1rem', fontWeight: 500, letterSpacing: '0.05em' }}>BAKERY HOME MADE • สั่งขนมเค้กล่วงหน้า อร่อย สดใหม่ ทุกวัน</p>
      </header>

      {/* Available Promo Codes Modal for Customer */}
      {isPromoModalOpen && createPortal(
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h4 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Ticket size={20} color="var(--primary-dark)" /> โค้ดส่วนลดของทางร้าน
              </h4>
              <button type="button" className="modal-close" onClick={() => setIsPromoModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '0.25rem' }}>
              {availablePromos.length === 0 ? (
                <p className="text-center text-muted" style={{ padding: '1.5rem' }}>ขณะนี้ยังไม่มีโค้ดส่วนลดที่เปิดใช้งาน</p>
              ) : (
                availablePromos.map(promo => {
                  const subtotal = calculateSubtotal();
                  const isEligible = !promo.min_spend || subtotal >= Number(promo.min_spend);
                  return (
                    <div 
                      key={promo.id} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '0.85rem 1rem', 
                        backgroundColor: 'var(--primary-light)', 
                        borderRadius: '12px',
                        border: '1.5px dashed var(--primary-dark)'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--primary-dark)', letterSpacing: '0.05em' }}>
                          {promo.code}
                        </div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                          {promo.discount_type === 'percent' ? `ส่วนลด ${promo.discount_value}%` : `ส่วนลด ฿${Number(promo.discount_value).toFixed(2)}`}
                        </div>
                        {Number(promo.min_spend) > 0 && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                            ขั้นต่ำ ฿{Number(promo.min_spend).toFixed(2)}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: '0.35rem 0.85rem', fontSize: '0.85rem' }}
                        onClick={() => {
                          if (!isEligible) {
                            alert(`โค้ดนี้ใช้ได้เมื่อซื้อขั้นต่ำ ฿${Number(promo.min_spend).toFixed(2)} ขึ้นไปครับ`);
                            return;
                          }
                          setPromoInput(promo.code);
                          let discountAmt = 0;
                          if (promo.discount_type === 'percent') {
                            discountAmt = (subtotal * Number(promo.discount_value)) / 100;
                          } else {
                            discountAmt = Number(promo.discount_value);
                          }
                          setAppliedPromo({ ...promo, calculatedDiscount: discountAmt });
                          setIsPromoModalOpen(false);
                        }}
                      >
                        ใช้โค้ดนี้
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Image Modal */}
      {selectedImage && createPortal(
        <div className="modal-overlay" style={{ zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSelectedImage(null)}>
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <button 
              type="button" 
              onClick={() => setSelectedImage(null)}
              style={{
                position: 'absolute',
                top: '-15px',
                right: '-15px',
                background: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                cursor: 'pointer',
                color: 'var(--primary-dark)',
                zIndex: 10
              }}
            >
              <X size={20} />
            </button>
            <img 
              src={selectedImage} 
              alt="Enlarged product" 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '90vh', 
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
              }} 
            />
          </div>
        </div>,
        document.body
      )}

      {/* Shop Content */}
      <main className="shop-layout" style={{ flex: 1, padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%', display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        
        {!isStoreOpen ? (
          <div style={{ width: '100%', textAlign: 'center', padding: '4rem 1rem' }}>
            <div style={{ width: '80px', height: '80px', margin: '0 auto 1.5rem', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Cake size={40} />
            </div>
            <h2 style={{ fontSize: '2rem', color: 'var(--primary-dark)', marginBottom: '1rem' }}>ขณะนี้ร้านปิดรับออร์เดอร์ชั่วคราว</h2>
            <p className="text-muted" style={{ fontSize: '1.1rem' }}>ต้องขออภัยในความไม่สะดวก ทางร้านจะกลับมาเปิดรับออร์เดอร์อีกครั้งในเร็วๆ นี้ครับ</p>
          </div>
        ) : (
          <>
            {/* Product List */}
            <div style={{ flex: '1 1 60%' }}>
              <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary-dark)' }}>เมนูขนมเค้กของเรา</h2>
          
          {loading ? (
            <p className="text-center text-muted">กำลังโหลดเมนู...</p>
          ) : products.filter(p => p.is_active !== false && p.remaining > 0).length === 0 ? (
            <p className="text-center text-muted">ขออภัย สินค้าถูกจองเต็มหรือปิดรับออร์เดอร์ทั้งหมดในขณะนี้</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.5rem' }}>
              {products.filter(p => p.is_active !== false && p.remaining > 0).map(p => {
                const flavorList = p.flavors ? p.flavors.split(',').map(f => f.trim()).filter(Boolean) : [];
                const currentFlavor = selectedFlavors[p.id] || (flavorList[0] || '');

                return (
                  <div key={p.id} className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                    {p.image_url ? (
                      <div 
                        style={{ width: '100%', height: '160px', marginBottom: '1rem', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer' }}
                        onClick={() => setSelectedImage(p.image_url)}
                      >
                        <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.2s' }} onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'} onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'} />
                      </div>
                    ) : (
                      <div style={{ width: '100%', height: '160px', marginBottom: '1rem', borderRadius: '8px', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-dark)' }}>
                        <span style={{ fontSize: '3rem' }}>🍰</span>
                      </div>
                    )}
                    <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    
                    {p.is_active === false ? (
                      <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--danger)', fontWeight: 'bold' }}>
                        ปิดรับพรีออร์เดอร์
                      </div>
                    ) : p.remaining !== Infinity && (
                      <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem', color: p.remaining > 0 ? 'var(--text-muted)' : 'var(--danger)', fontWeight: p.remaining <= 0 ? 'bold' : 'normal' }}>
                        {p.remaining > 0 ? `เหลืออีก ${p.remaining} ชิ้น` : 'สินค้าหมดโควต้า'}
                      </div>
                    )}

                    <div style={{ color: 'var(--primary-dark)', fontWeight: 'bold', fontSize: '1.25rem', marginBottom: '0.75rem' }}>
                      ฿{(p.selling_price + getFlavorPriceAddOn(currentFlavor)).toFixed(2)}
                    </div>

                    {/* Flavor Selection Pills */}
                    {flavorList.length > 0 && (
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
                          เลือกรสชาติ / หน้าเค้ก:
                        </label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
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
                                  padding: '0.35rem 0.75rem',
                                  borderRadius: '20px',
                                  border: isSelected ? '2px solid var(--primary-dark)' : '1px solid var(--border)',
                                  backgroundColor: isSelected ? 'var(--primary-dark)' : 'white',
                                  color: isSelected ? 'white' : 'var(--text-main)',
                                  fontSize: '0.85rem',
                                  fontWeight: isSelected ? 600 : 400,
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  boxShadow: isSelected ? '0 2px 6px rgba(111, 78, 55, 0.2)' : 'none'
                                }}
                              >
                                {isSelected ? `✓ ${f}` : f}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {(() => {
                      const isDisabled = p.is_active === false || p.remaining <= 0;
                      const buttonText = p.is_active === false ? 'ปิดรับพรีออร์เดอร์' : (p.remaining <= 0 ? 'Sold Out' : 'ใส่ตะกร้า');
                      return (
                        <button 
                          className="btn btn-outline" 
                          style={{ 
                            marginTop: 'auto', 
                            width: '100%',
                            opacity: isDisabled ? 0.5 : 1,
                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                            color: isDisabled ? 'var(--danger)' : undefined,
                            borderColor: isDisabled ? 'var(--danger)' : undefined
                          }}
                          onClick={() => !isDisabled && addToCart(p)}
                          disabled={isDisabled}
                        >
                          {!isDisabled && <Plus size={16} />} {buttonText}
                        </button>
                      );
                    })()}
                  </div>
                );
              })}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem', paddingRight: '0.5rem' }}>
                  {cart.map((item, index) => {
                    const unitPrice = item.product.selling_price + getFlavorPriceAddOn(item.flavor);
                    const itemTotal = unitPrice * item.quantity;
                    
                    return (
                      <div key={`${item.product.id}-${item.flavor || ''}-${index}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderBottom: '1px dashed var(--border)', padding: '0.75rem 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, paddingRight: '0.5rem' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-dark)', lineHeight: '1.2' }}>{item.product.name}</div>
                            {item.flavor && (
                              <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '0.2rem', fontWeight: 500 }}>
                                หน้า/รส: {item.flavor}
                              </div>
                            )}
                          </div>
                          <div style={{ fontWeight: 'bold', color: 'var(--primary-dark)', fontSize: '0.95rem' }}>
                            ฿{itemTotal.toFixed(2)}
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                            @ ฿{unitPrice.toFixed(2)}
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', background: '#f8f9fa', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <button 
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', color: 'var(--text-dark)', cursor: 'pointer' }} 
                              onClick={() => updateQuantity(item.product.id, item.flavor, -1)}
                            >
                              <Minus size={14} />
                            </button>
                            <span style={{ width: '28px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}>
                              {item.quantity}
                            </span>
                            <button 
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', color: 'var(--text-dark)', cursor: 'pointer' }} 
                              onClick={() => updateQuantity(item.product.id, item.flavor, 1)}
                            >
                              <Plus size={14} />
                            </button>
                            <div style={{ width: '1px', height: '16px', background: 'var(--border)', margin: '0 0.2rem' }}></div>
                            <button 
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', border: 'none', background: 'rgba(255, 71, 87, 0.1)', color: 'var(--danger)', cursor: 'pointer' }} 
                              onClick={() => removeFromCart(item.product.id, item.flavor)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Promo Code Input */}
                {!showPromoInput && !appliedPromo ? (
                  <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'center' }}>
                    <button 
                      type="button" 
                      onClick={() => setShowPromoInput(true)}
                      style={{ 
                        background: 'var(--primary-light)', 
                        border: '1px dashed var(--primary)', 
                        color: 'var(--primary-dark)', 
                        padding: '0.6rem 1rem', 
                        borderRadius: '8px', 
                        fontSize: '0.9rem', 
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        width: '100%',
                        justifyContent: 'center'
                      }}
                    >
                      <Ticket size={16} /> ใช้ส่วนลด
                    </button>
                  </div>
                ) : (
                  <div style={{ marginBottom: '1.25rem', backgroundColor: 'var(--primary-light)', padding: '0.75rem', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', gap: '0.25rem', margin: 0 }}>
                        <Ticket size={16} /> โค้ดส่วนลด (ถ้ามี)
                      </label>

                      {availablePromos.length > 0 && (
                        <button 
                          type="button"
                          onClick={() => setIsPromoModalOpen(true)}
                          style={{ background: 'none', border: 'none', color: 'var(--primary-dark)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                        >
                          🔍 ดูโค้ดทั้งหมด ({availablePromos.length})
                        </button>
                      )}
                    </div>

                    {appliedPromo ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ecfdf5', border: '1px solid #10b981', padding: '0.4rem 0.75rem', borderRadius: '8px', color: '#047857', fontWeight: 600, fontSize: '0.85rem' }}>
                        <span>✓ ใช้โค้ด {appliedPromo.code} (-฿{promoDiscount.toFixed(2)})</span>
                        <button type="button" onClick={() => { removePromoCode(); setShowPromoInput(false); }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>ยกเลิก</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input 
                          type="text" 
                          value={promoInput} 
                          onChange={(e) => setPromoInput(e.target.value.toUpperCase())} 
                          placeholder="เช่น BAKERY10" 
                          className="form-control" 
                          style={{ textTransform: 'uppercase', fontSize: '0.85rem', fontWeight: 600, backgroundColor: 'white' }}
                        />
                        <button type="button" onClick={applyPromoCode} className="btn btn-primary" style={{ padding: '0.35rem 0.85rem', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                          ใช้โค้ด
                        </button>
                        <button type="button" onClick={() => setShowPromoInput(false)} className="btn btn-outline" style={{ padding: '0.35rem', borderColor: 'transparent', color: 'var(--text-muted)' }}>
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.5rem', paddingTop: '1rem', borderTop: '2px dashed var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: 'var(--text-muted)' }}>
                    <span>ราคาสินค้ารวม</span>
                    <span>฿{subtotal.toFixed(2)}</span>
                  </div>
                  {rewardDiscount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: 'var(--danger)', fontWeight: 600 }}>
                      <span>ส่วนลดจากของรางวัล</span>
                      <span>- ฿{rewardDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {calculateProductPromoDiscount() > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: 'var(--danger)', fontWeight: 600 }}>
                      <span>โปรโมชั่นสินค้า</span>
                      <span>- ฿{calculateProductPromoDiscount().toFixed(2)}</span>
                    </div>
                  )}
                  {promoDiscount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: 'var(--danger)', fontWeight: 600 }}>
                      <span>ส่วนลดจากโค้ด ({appliedPromo.code})</span>
                      <span>- ฿{promoDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 'bold', marginTop: '0.25rem' }}>
                    <span>ยอดรวมสุทธิ</span>
                    <span style={{ color: 'var(--primary-dark)' }}>฿{total.toFixed(2)}</span>
                  </div>

                  {subtotal > 0 && (subtotal % bahtPerPoint) > 0 && (
                    <div style={{
                      marginTop: '0.75rem',
                      padding: '0.75rem 1rem',
                      backgroundColor: 'rgba(245, 158, 11, 0.12)',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      borderRadius: '12px',
                      color: '#b45309',
                      fontSize: '0.88rem',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      boxShadow: 'var(--shadow-sm)'
                    }}>
                      <span style={{ fontSize: '1.25rem' }}>💡</span>
                      <div>
                        ซื้อขนมเพิ่มอีกเพียง <strong style={{ color: '#d97706', fontSize: '0.95rem' }}>฿{(bahtPerPoint - (subtotal % bahtPerPoint)).toFixed(2)}</strong> จะได้รับแต้มสะสมเพิ่มทันทีอีก <strong style={{ color: 'var(--primary-dark)' }}>+1 แต้ม 🪙</strong> (รวมเป็น {estimatedEarnedPoints + 1} แต้ม)
                      </div>
                    </div>
                  )}

                  {formData.phone && (
                    <div style={{ marginTop: '0.5rem', backgroundColor: 'var(--primary-light)', padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--primary-dark)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Award size={16} /> คุณจะได้แต้มสะสมเพิ่ม <strong>+{estimatedEarnedPoints} แต้ม</strong> จากออร์เดอร์นี้
                    </div>
                  )}
                </div>

                {/* Checkout Form */}
                <form onSubmit={submitOrder} style={{ backgroundColor: 'var(--primary-light)', padding: '1.5rem', borderRadius: 'var(--radius-md)' }}>
                  <h4 style={{ marginBottom: '1rem', fontSize: '1rem' }}>ข้อมูลสำหรับการรับสินค้า</h4>
                  
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Phone size={14}/> เบอร์โทรศัพท์ (สำหรับสะสมแต้ม)</label>
                    <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="form-control" placeholder="08X-XXX-XXXX" />
                  </div>

                  {/* Member Points & Rewards Section */}
                  {formData.phone && (
                    <div style={{ marginBottom: '1rem', backgroundColor: 'white', padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: memberInfo ? '0.5rem' : 0 }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Award size={16} /> ข้อมูลสมาชิก
                        </span>
                        {memberInfo ? (
                          <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--primary-dark)', backgroundColor: 'var(--primary-light)', padding: '0.2rem 0.6rem', borderRadius: '12px' }}>
                            🪙 สะสมแล้ว {memberInfo.points || 0} แต้ม
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--success)' }}>
                            ✨ สมาชิกใหม่ (รับแต้มอัตโนมัติ)
                          </span>
                        )}
                      </div>

                      {/* Rewards Selector */}
                      {rewardsList.length > 0 && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
                            🎁 เลือกใช้แต้มแลกของรางวัล/ส่วนลด:
                          </label>
                          <select
                            value={selectedReward ? selectedReward.id : ''}
                            onChange={(e) => {
                              const selected = rewardsList.find(r => r.id === e.target.value);
                              if (selected) {
                                const currentPts = memberInfo?.points || 0;
                                if (currentPts < selected.points_required) {
                                  alert(`ขออภัย แต้มของคุณไม่พอ (ต้องใช้ ${selected.points_required} แต้ม แต่คุณมี ${currentPts} แต้ม)`);
                                  return;
                                }
                              }
                              setSelectedReward(selected || null);
                            }}
                            className="form-control"
                            style={{ fontSize: '0.85rem', padding: '0.4rem' }}
                          >
                            <option value="">-- ไม่ใช้แต้มแลกส่วนลด --</option>
                            {rewardsList.map(r => {
                              const canRedeem = (memberInfo?.points || 0) >= r.points_required;
                              return (
                                <option key={r.id} value={r.id} disabled={!canRedeem}>
                                  {r.title} (ใช้ {r.points_required} แต้ม) {!canRedeem ? '[แต้มไม่พอ]' : ''}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><User size={14}/> ชื่อผู้สั่ง</label>
                    <input type="text" name="name" required value={formData.name} onChange={handleInputChange} className="form-control" placeholder="ชื่อ-นามสกุล" />
                  </div>

                  {pickupDateMode === 'fixed' ? (
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', marginBottom: '1rem' }}>
                      <div className="form-group" style={{ flex: 1, backgroundColor: 'var(--primary-light)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', margin: 0, color: 'var(--primary-dark)' }}><Calendar size={14}/> รอบส่งเค้ก</label>
                        <div style={{ fontWeight: 'bold', fontSize: '1rem', marginTop: '0.25rem' }}>
                          {fixedPickupDate ? new Date(fixedPickupDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : 'ไม่ได้กำหนดวัน'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', marginBottom: '1rem' }}>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Calendar size={14}/> วันที่รับเค้ก</label>
                        <input type="date" name="pickupDate" required value={formData.pickupDate} onChange={handleInputChange} className="form-control" />
                      </div>
                    </div>
                  )}

                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <CreditCard size={14}/> รูปแบบการชำระเงิน
                    </label>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input 
                          type="radio" 
                          name="paymentMethod" 
                          value="transfer" 
                          checked={paymentMethod === 'transfer'} 
                          onChange={(e) => setPaymentMethod(e.target.value)} 
                        />
                        โอนเงินตอนนี้
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input 
                          type="radio" 
                          name="paymentMethod" 
                          value="pay_later" 
                          checked={paymentMethod === 'pay_later'} 
                          onChange={(e) => setPaymentMethod(e.target.value)} 
                        />
                        ชำระเงินตอนรับของ (Pay Later)
                      </label>
                    </div>
                  </div>

                  {paymentMethod === 'transfer' && (
                    <div style={{ 
                      marginTop: '1.5rem', 
                      marginBottom: '1.5rem',
                      padding: '1rem', 
                      backgroundColor: 'white', 
                      borderRadius: '16px',
                      textAlign: 'center',
                      border: '2px solid var(--primary-light)',
                      boxShadow: 'var(--shadow-sm)'
                    }}>
                      <div style={{ borderRadius: '12px', overflow: 'hidden', marginBottom: '0.75rem' }}>
                        <img 
                          src="/payment-qr.png" 
                          alt="ช่องทางการโอนเงิน" 
                          style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '12px' }}
                        />
                      </div>
                      <div style={{ fontWeight: 'bold', fontSize: '1.25rem', color: 'var(--primary-dark)', padding: '0.5rem 0' }}>
                        ยอดโอนทั้งสิ้น: ฿{total.toFixed(2)}
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'transfer' && (
                    <div className="form-group" style={{ marginTop: '1rem' }}>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <UploadCloud size={14}/> แนบสลิปโอนเงิน (ถ้ามี)
                      </label>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleFileChange} 
                        className="form-control"
                        style={{ padding: '0.4rem', backgroundColor: 'white' }}
                      />
                      {slipFile && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--success)', marginTop: '0.25rem', fontWeight: 500 }}>
                          ✓ เลือกไฟล์: {slipFile.name}
                        </div>
                      )}
                    </div>
                  )}

                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ width: '100%', marginTop: '1.5rem', padding: '0.85rem' }}
                    disabled={submitting}
                  >
                    {submitting ? 'กำลังส่งข้อมูล...' : (paymentMethod === 'transfer' ? 'ยืนยันการสั่งซื้อและโอนเงิน' : 'ยืนยันการสั่งซื้อ (ชำระวันรับของ)')}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
        </>
        )}
      </main>
    </div>
  );
}
