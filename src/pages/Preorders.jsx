import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { Clock, CheckCircle, PackageCheck, XCircle, ChevronDown, ChevronUp, Trash2, Image as ImageIcon, CreditCard, Plus, User, Phone, Calendar, X, UploadCloud, MessageSquare, Sparkles, Printer, Cake } from 'lucide-react';
import imageCompression from 'browser-image-compression';

export default function Preorders() {
  const [preorders, setPreorders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [viewingSlipUrl, setViewingSlipUrl] = useState(null);
  const [promotions, setPromotions] = useState([]);

  // Manual Preorder Entry Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('active'); // 'active', 'history'
  const [orderSource, setOrderSource] = useState('Facebook'); // 'Facebook', 'LINE', 'โทรสั่ง', 'หน้าร้าน'
  
  const [rawChatText, setRawChatText] = useState('');
  const [parseSuccessMsg, setParseSuccessMsg] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('12:00');
  const [paymentMethod, setPaymentMethod] = useState('transfer');
  const [slipUrl, setSlipUrl] = useState('');
  const [uploadingSlip, setUploadingSlip] = useState(false);

  // Selected items in modal: [{ product, flavor, quantity }]
  const [orderItems, setOrderItems] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedFlavor, setSelectedFlavor] = useState('');
  const [quantity, setQuantity] = useState(1);

  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchData();
    fetchProducts();
    fetchPromotions();

    // Subscribe to preorders real-time changes
    const channel = supabase
      .channel('preorders_realtime_list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'preorders' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('name');
    if (data) setProducts(data);
  };

  const fetchPromotions = async () => {
    const { data } = await supabase.from('product_promotions').select('*').eq('is_active', true);
    if (data) setPromotions(data);
  };

  const fetchData = async () => {
    setLoading(true);
    
    // Try nested query first
    let { data: preorderData, error } = await supabase
      .from('preorders')
      .select(`
        *,
        preorder_items (
          id,
          product_id,
          quantity,
          price_at_time,
          notes,
          products ( name )
        )
      `)
      .order('created_at', { ascending: false });
      
    // Fallback if nested query failed (e.g. FK relation missing or notes column error)
    if (error || !preorderData) {
      console.log('Nested preorder fetch error, using fallback:', error);
      const { data: simpleOrders } = await supabase
        .from('preorders')
        .select('*')
        .order('created_at', { ascending: false });

      if (simpleOrders) {
        const { data: allItems } = await supabase
          .from('preorder_items')
          .select('*, products(name)');

        const itemsMap = {};
        (allItems || []).forEach(item => {
          if (!itemsMap[item.preorder_id]) itemsMap[item.preorder_id] = [];
          itemsMap[item.preorder_id].push(item);
        });

        preorderData = simpleOrders.map(ord => ({
          ...ord,
          preorder_items: itemsMap[ord.id] || []
        }));
      }
    }

    if (preorderData) {
      const statusPriority = {
        pending: 1,
        accepted: 2,
        prepared: 3,
        completed: 4,
        cancelled: 5
      };

      preorderData.sort((a, b) => {
        const pA = statusPriority[a.status] || 99;
        const pB = statusPriority[b.status] || 99;
        if (pA !== pB) {
          return pA - pB;
        }
        return new Date(b.created_at) - new Date(a.created_at);
      });

      setPreorders(preorderData);
    }
    setLoading(false);
  };

  const sanitizeCustomerName = (nameStr) => {
    if (!nameStr) return '';
    let clean = nameStr.trim();
    clean = clean.replace(/^[\d\s\:\-\._]+/, '');
    clean = clean.replace(/^(?:ชื่อผู้รับ|ชื่อลูกค้า|ชื่อ|คุณ)\s*[\:\-\._]?\s*/gi, '');
    clean = clean.replace(/^(?:ชื่อผู้รับ|ชื่อลูกค้า|ชื่อ|คุณ)\s*[\:\-\._]?\s*/gi, '');
    return clean.trim();
  };

  const formatDisplayName = (nameStr) => {
    if (!nameStr) return 'คุณลูกค้า';
    let clean = sanitizeCustomerName(nameStr);
    if (!clean) clean = nameStr.replace(/\(FB\)|\(LINE\)|\(โทรสั่ง\)|\(หน้าร้าน\)/gi, '').trim();
    return clean ? (clean.startsWith('คุณ') ? clean : `คุณ ${clean}`) : 'คุณลูกค้า';
  };

  const sendSlackCancelNotification = async (order) => {
    try {
      const { data: slackTokenData } = await supabase
        .from('store_settings')
        .select('value')
        .eq('key', 'slack_webhook_url')
        .maybeSingle();

      const webhookUrl = slackTokenData?.value;
      
      if (!webhookUrl) return;

      const itemsList = (order.preorder_items || [])
        .map(i => {
          const notesText = i.notes ? ` (${i.notes})` : '';
          return `- ${i.products?.name || 'สินค้า'}${notesText} x ${i.quantity}`;
        })
        .join('\n');

      const messageText = `\n❌ [แจ้งเตือนลบ/ยกเลิกออร์เดอร์]\n\n` +
        `👤 คุณ: ${order.customer_name}\n` +
        `📞 เบอร์โทร: ${order.customer_phone}\n` +
        `🍰 รายการสินค้า:\n${itemsList}\n` +
        `💰 ยอดรวม: ฿${Number(order.total_amount).toFixed(2)}\n\n` +
        `🗑️ ออร์เดอร์นี้ถูกลบ/ยกเลิกออกจากระบบเรียบร้อยแล้วครับ`;

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

  const updateStatus = async (order, newStatus) => {
    if (newStatus === 'completed' && order.status !== 'completed') {
      try {
        const salePayload = {
          total_amount: order.total_amount
        };
        const { data: saleData, error: saleError } = await supabase.from('sales').insert([salePayload]).select().single();
        
        if (saleError) throw saleError;
        const saleId = saleData.id;

        if (order.preorder_items && order.preorder_items.length > 0) {
          const saleItemsData = order.preorder_items.map(item => ({
            sale_id: saleId,
            product_id: item.product_id,
            quantity: item.quantity,
            price_at_time: item.price_at_time
          }));
          await supabase.from('sale_items').insert(saleItemsData);
        }

        await supabase.from('transactions').insert([{
          type: 'income',
          amount: order.total_amount,
          description: `รับขนมเค้ก (พรีออร์เดอร์ #${saleId.split('-')[0]})`,
          reference_id: saleId
        }]);
      } catch (err) {
        console.error('Failed to log sale for preorder', err);
        alert('เกิดข้อผิดพลาดในการบันทึกยอดขาย: ' + err.message);
        return;
      }
    }

    const { error } = await supabase
      .from('preorders')
      .update({ status: newStatus })
      .eq('id', order.id);

    if (error) {
      if (error.message && error.message.includes('preorders_status_check')) {
        alert('กรุณารันคำสั่ง SQL ใน Supabase SQL Editor เพื่ออนุญาตสถานะ "จัดขนมแล้ว" ครับ:\n\nALTER TABLE preorders DROP CONSTRAINT IF EXISTS preorders_status_check;');
      } else {
        alert(error.message);
      }
    } else {
      // Send Slack notification for status change
      try {
        const { data: slackTokenData } = await supabase
          .from('store_settings')
          .select('value')
          .eq('key', 'slack_webhook_url')
          .maybeSingle();
        
        const webhookUrl = slackTokenData?.value;
        if (webhookUrl) {
          let statusText = newStatus;
          if (newStatus === 'accepted') statusText = 'รับออร์เดอร์แล้ว';
          if (newStatus === 'prepared') statusText = 'จัดขนมแล้ว (พร้อมส่ง/พร้อมรับ)';
          if (newStatus === 'completed') statusText = 'ลูกค้ารับขนมแล้ว (เสร็จสิ้น)';
          if (newStatus === 'pending') statusText = 'รอยืนยัน';

          const message = `อัปเดตสถานะออร์เดอร์: คุณ ${order.customer_name}\nสถานะใหม่: ${statusText}`;
          await fetch('/api/slack', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, webhookUrl })
          });
        }
      } catch (err) {
        console.log('Slack Notification Error:', err);
      }
      
      fetchData();
    }
  };

  const printOrder = (order) => {
    let iframe = document.getElementById('print-iframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }

    const itemsHtml = (order.preorder_items || []).map(item => `
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 20px; border-bottom: 1px dashed #ccc; padding-bottom: 8px;">
        <span style="flex: 1; padding-right: 8px; line-height: 1.3;">
          ${item.products?.name || 'เค้ก'}
          ${item.notes ? `<br><small style="color: #333; font-size: 18px;">(${item.notes})</small>` : ''}
        </span>
        <span style="font-weight: bold; font-size: 22px;">x${item.quantity}</span>
      </div>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>พิมพ์ออร์เดอร์</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;600&display=swap');
          @page {
            margin: 0;
          }
          body {
            font-family: 'Kanit', sans-serif;
            margin: 0;
            padding: 8px;
            color: #000;
            background: #fff;
            width: 240px; /* Reduced width to force browser to scale up everything */
            box-sizing: border-box;
          }
          .text-center { text-align: center; }
          .header { font-size: 26px; font-weight: bold; margin-bottom: 8px; border-bottom: 2px solid #000; padding-bottom: 6px; }
          .customer { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
          .info { font-size: 20px; margin-bottom: 10px; line-height: 1.4; }
          .footer { margin-top: 10px; border-top: 2px solid #000; padding-top: 8px; font-weight: bold; font-size: 24px; text-align: right; }
          
          @media print {
            html, body { 
              width: 240px !important; 
              margin: 0 !important; 
              padding: 0 4px !important; 
            }
          }
        </style>
      </head>
      <body>
        <div class="text-center header">
          ใบออร์เดอร์เค้ก
        </div>
        <div class="customer">
          คุณ: ${order.customer_name || 'ลูกค้า'}
        </div>
        <div class="info">
          เบอร์: ${order.customer_phone || '-'}<br>
          รับ: ${order.pickup_date ? new Date(order.pickup_date).toLocaleDateString('th-TH') : '-'} 
          เวลา: ${order.pickup_time || (order.pickup_date ? new Date(order.pickup_date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-')} น.<br>
          ชำระเงิน: ${order.payment_method === 'transfer' ? 'โอนเงิน' : 'เงินสด'}
        </div>
        <div>
          ${itemsHtml}
        </div>
        <div class="footer">
          ยอดรวม: ฿${(order.total_amount || 0).toFixed(2)}
        </div>
      </body>
      </html>
    `;

    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(html);
    iframe.contentWindow.document.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }, 500);
  };

  const toggleItemReceived = async (orderId, itemId, currentStatus) => {
    // Optimistic UI update
    setPreorders(prev => prev.map(order => {
      if (order.id === orderId) {
        return {
          ...order,
          preorder_items: order.preorder_items.map(i => i.id === itemId ? { ...i, is_received: !currentStatus } : i)
        };
      }
      return order;
    }));

    const { error } = await supabase
      .from('preorder_items')
      .update({ is_received: !currentStatus })
      .eq('id', itemId);

    if (error) {
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + error.message);
      fetchData(); // revert
    } else {
      // Check if all items are now received
      const order = preorders.find(o => o.id === orderId);
      if (order && order.status !== 'completed') {
        const updatedItems = order.preorder_items.map(i => i.id === itemId ? { ...i, is_received: !currentStatus } : i);
        const allReceived = updatedItems.length > 0 && updatedItems.every(i => i.is_received);
        if (allReceived) {
          if (window.confirm('ลูกค้ารับขนมครบทุกรายการแล้ว ต้องการเปลี่ยนสถานะออร์เดอร์เป็น "รับขนมแล้ว" หรือไม่?')) {
            updateStatus(order, 'completed');
          }
        }
      }
    }
  };

  const deletePreorder = async (order) => {
    if (window.confirm(`ต้องการลบออร์เดอร์ของ คุณ${order.customer_name} ใช่หรือไม่?`)) {
      sendSlackCancelNotification(order);

      const { error } = await supabase
        .from('preorders')
        .delete()
        .eq('id', order.id);

      if (error) alert(error.message);
      else fetchData();
    }
  };

  // Fast AI Chat Converter
  const parseRawChatText = () => {
    if (!rawChatText.trim()) return alert('กรุณาแปะข้อความแชทในช่องด้านบนก่อนกดแปลงครับ');

    const text = rawChatText.trim();
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    // 1. Extract Phone Number
    const phoneMatch = text.match(/0[689]\d{8}|0\d{9}/);
    if (phoneMatch) setCustomerPhone(phoneMatch[0]);

    // 2. Extract Customer Name
    let foundName = null;
    if (lines.length > 0 && !lines[0].match(/0\d{8,9}/) && !lines[0].match(/สั่ง|เค้ก|บราวนี่|ส\.ค\.|ก\.ย\.|รับ/)) {
      foundName = sanitizeCustomerName(lines[0]);
    }
    if (!foundName) {
      const nameMatch = text.match(/(?:ชื่อ|คุณ)\s*([^\s,0-9]+)/i);
      if (nameMatch) foundName = sanitizeCustomerName(nameMatch[1]);
    }
    if (foundName) setCustomerName(foundName);

    // 3. Extract Date & Time
    const dateMatch = text.match(/(\d{1,2})\s*(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)/);
    if (dateMatch) {
      const day = parseInt(dateMatch[1], 10);
      const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
      const monthIdx = months.indexOf(dateMatch[2]);
      if (monthIdx !== -1) {
        const d = new Date(new Date().getFullYear(), monthIdx, day);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        setPickupDate(`${yyyy}-${mm}-${dd}`);
      }
    }

    const timeMatch = text.match(/(\d{1,2})[\.\:](?:(\d{2}))?\s*น/);
    if (timeMatch && timeMatch[1]) {
      const hour = String(parseInt(timeMatch[1], 10)).padStart(2, '0');
      const min = timeMatch[2] ? String(parseInt(timeMatch[2], 10)).padStart(2, '0') : '00';
      setPickupTime(`${hour}:${min}`);
    }

    // 4. Extract Products & Flavors
    const newItems = [];
    lines.forEach(lineText => {
      for (const prod of products) {
        if (lineText.includes(prod.name)) {
          let qty = 1;
          const qtyMatch = lineText.match(/(\d+)\s*(ชิ้น|ก้อน|ปอนด์)?/);
          if (qtyMatch && qtyMatch[1]) {
            qty = parseInt(qtyMatch[1], 10);
          }

          let flavor = null;
          if (prod.flavors) {
            const flavorList = prod.flavors.split(',').map(f => f.trim()).filter(Boolean);
            for (const f of flavorList) {
              if (lineText.includes(f)) {
                flavor = f;
                break;
              }
            }
          }

          newItems.push({
            product: prod,
            flavor,
            quantity: qty
          });
          break;
        }
      }
    });

    if (newItems.length > 0) {
      setOrderItems(prev => [...prev, ...newItems]);
    }

    setParseSuccessMsg(`✨ แปลงข้อมูลสำเร็จ! ดึงเบอร์ ${phoneMatch ? phoneMatch[0] : 'ไม่ได้'}, รายการเค้ก ${newItems.length} รายการเรียบร้อยแล้ว`);
  };

  // Add Item to Manual Order List
  const addOrderItem = () => {
    if (!selectedProductId) return alert('กรุณาเลือกรายการขนมเค้ก');
    const prod = products.find(p => p.id === selectedProductId);
    if (!prod) return;

    setOrderItems([...orderItems, {
      product: prod,
      flavor: selectedFlavor || null,
      quantity: parseInt(quantity, 10) || 1
    }]);

    setSelectedProductId('');
    setSelectedFlavor('');
    setQuantity(1);
  };

  const removeOrderItem = (index) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const handleSlipUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingSlip(true);
    try {
      const options = { maxSizeMB: 0.2, maxWidthOrHeight: 800, useWebWorker: true, fileType: 'image/webp' };
      const compressedFile = await imageCompression(file, options);
      const fileName = `slip_${Date.now()}-${Math.random().toString(36).substring(7)}.webp`;

      const { error: uploadError } = await supabase.storage
        .from('cake-images')
        .upload(fileName, compressedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('cake-images')
        .getPublicUrl(fileName);

      setSlipUrl(publicUrl);
    } catch (err) {
      alert('อัปโหลดสลิปไม่สำเร็จ: ' + err.message);
    } finally {
      setUploadingSlip(false);
    }
  };

  const getFlavorPriceAddOn = (flavor) => {
    if (!flavor) return 0;
    const match = flavor.match(/\(\s*\+\s*(\d+)\s*\)/);
    return match ? parseInt(match[1], 10) : 0;
  };

  const calculateSubtotal = () => {
    return orderItems.reduce((sum, item) => {
      const addOn = getFlavorPriceAddOn(item.flavor);
      return sum + ((item.product.selling_price + addOn) * item.quantity);
    }, 0);
  };

  const calculateProductPromoDiscount = () => {
    let totalDiscount = 0;
    const qtyByProduct = {};
    let totalAllItemsQty = 0;

    orderItems.forEach(item => {
      const pId = item.product.id;
      qtyByProduct[pId] = (qtyByProduct[pId] || 0) + item.quantity;
      totalAllItemsQty += item.quantity;
    });

    promotions.forEach(promo => {
      if (promo.product_id) {
        const qty = qtyByProduct[promo.product_id] || 0;
        if (qty >= promo.condition_quantity) {
          const times = Math.floor(qty / promo.condition_quantity);
          totalDiscount += times * promo.discount_amount;
        }
      } else {
        if (totalAllItemsQty >= promo.condition_quantity) {
          const times = Math.floor(totalAllItemsQty / promo.condition_quantity);
          totalDiscount += times * promo.discount_amount;
        }
      }
    });
    return totalDiscount;
  };

  const calculateManualTotal = () => {
    return Math.max(0, calculateSubtotal() - calculateProductPromoDiscount());
  };

  const openEditModal = (order) => {
    setEditingOrderId(order.id);
    
    let name = order.customer_name || '';
    let source = 'Facebook';
    const sourceMatch = name.match(/\((Facebook|LINE|โทรสั่ง|หน้าร้าน)\)$/);
    if (sourceMatch) {
      source = sourceMatch[1];
      name = name.replace(/\s*\((Facebook|LINE|โทรสั่ง|หน้าร้าน)\)$/, '');
    }
    setCustomerName(name);
    setOrderSource(source);
    
    setCustomerPhone(order.customer_phone === '-' ? '' : order.customer_phone);
    
    if (order.pickup_date) {
      const d = new Date(order.pickup_date);
      const tzOffset = d.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString();
      setPickupDate(localISOTime.split('T')[0]);
      setPickupTime(localISOTime.split('T')[1].substring(0, 5));
    } else {
      setPickupDate('');
      setPickupTime('12:00');
    }
    
    setPaymentMethod(order.payment_method || 'transfer');
    setSlipUrl(order.slip_url || '');
    
    const mappedItems = (order.preorder_items || []).map(item => {
      let flavorStr = '';
      if (item.notes && item.notes.startsWith('หน้า/รส: ')) {
        flavorStr = item.notes.replace('หน้า/รส: ', '');
      }
      return {
        product: { id: item.product_id, name: item.products?.name, selling_price: item.price_at_time - getFlavorPriceAddOn(flavorStr) },
        flavor: flavorStr,
        quantity: item.quantity
      };
    });
    setOrderItems(mappedItems);
    
    setIsCreateModalOpen(true);
  };

  const saveManualPreorder = async (e) => {
    e.preventDefault();
    if (orderItems.length === 0) return alert('กรุณาเพิ่มรายการขนมเค้กอย่างน้อย 1 รายการ');

    setSubmitting(true);
    try {
      const cleanName = sanitizeCustomerName(customerName) || 'คุณลูกค้า';
      const finalPhone = customerPhone.trim() || '-';
      
      let finalDate = pickupDate;
      if (!finalDate) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        finalDate = `${yyyy}-${mm}-${dd}`;
      }

      const finalTime = pickupTime || '12:00';
      const timePart = finalTime.length === 5 ? `${finalTime}:00` : finalTime;
      const pickupDateTime = new Date(`${finalDate}T${timePart}`).toISOString();

      const totalAmount = calculateManualTotal();

      // 1. Insert Preorder
      const preorderPayload = {
        customer_name: `${cleanName} (${orderSource})`,
        customer_phone: finalPhone,
        pickup_date: pickupDateTime,
        total_amount: totalAmount,
        status: 'accepted',
        slip_url: slipUrl || null,
        payment_method: paymentMethod
      };

      let res;
      if (editingOrderId) {
        res = await supabase.from('preorders').update(preorderPayload).eq('id', editingOrderId).select().single();
        if (res.error) {
          if (res.error.message.includes('slip_url')) delete preorderPayload.slip_url;
          if (res.error.message.includes('payment_method')) delete preorderPayload.payment_method;
          res = await supabase.from('preorders').update(preorderPayload).eq('id', editingOrderId).select().single();
        }
      } else {
        res = await supabase.from('preorders').insert([preorderPayload]).select().single();
        if (res.error) {
          if (res.error.message.includes('slip_url')) delete preorderPayload.slip_url;
          if (res.error.message.includes('payment_method')) delete preorderPayload.payment_method;
          res = await supabase.from('preorders').insert([preorderPayload]).select().single();
        }
      }

      if (res.error) throw res.error;
      const createdPreorder = res.data;

      if (editingOrderId) {
        await supabase.from('preorder_items').delete().eq('preorder_id', editingOrderId);
      }

      // 2. Insert Items
      const itemsPayload = orderItems.map(i => {
        const addOn = getFlavorPriceAddOn(i.flavor);
        return {
          preorder_id: createdPreorder.id,
          product_id: i.product.id,
          quantity: i.quantity,
          price_at_time: i.product.selling_price + addOn,
          notes: i.flavor ? `หน้า/รส: ${i.flavor}` : null
        };
      });

      let itemRes = await supabase.from('preorder_items').insert(itemsPayload);
      if (itemRes.error && itemRes.error.message.includes('notes')) {
        const cleanPayload = itemsPayload.map(({ notes, ...rest }) => rest);
        itemRes = await supabase.from('preorder_items').insert(cleanPayload);
      }
      if (itemRes.error) throw itemRes.error;

      // 3. Credit Member Points automatically if phone provided
      if (finalPhone !== '-') {
        try {
          const { data: settingData } = await supabase.from('store_settings').select('value').eq('key', 'baht_per_point').maybeSingle();
          const bahtPerPoint = Number(settingData?.value) || 50;
          const earnedPoints = Math.floor(totalAmount / bahtPerPoint);

          const { data: existingMember } = await supabase.from('members').select('*').eq('phone', finalPhone).maybeSingle();

          if (!existingMember) {
            const insertMem = await supabase.from('members').insert([{ phone: finalPhone, name: cleanName, points: earnedPoints }]).select().single();
            if (insertMem.data && earnedPoints > 0) {
              await supabase.from('point_logs').insert([{ member_id: insertMem.data.id, points: earnedPoints, type: 'earn', description: `สะสมแต้มจากออร์เดอร์ ${orderSource}` }]);
            }
          } else if (earnedPoints > 0) {
            const newPts = (existingMember.points || 0) + earnedPoints;
            await supabase.from('members').update({ points: newPts }).eq('id', existingMember.id);
            await supabase.from('point_logs').insert([{ member_id: existingMember.id, points: earnedPoints, type: 'earn', description: `สะสมแต้มจากออร์เดอร์ ${orderSource}` }]);
          }
        } catch (memErr) {
          console.log('Auto points bypass:', memErr);
        }
      }

      setIsCreateModalOpen(false);
      resetManualForm();
      fetchData();
      alert(editingOrderId ? 'บันทึกการแก้ไขสำเร็จ!' : 'คีย์ออร์เดอร์สำเร็จ!');
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการคีย์ออร์เดอร์: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetManualForm = () => {
    setEditingOrderId(null);
    setCustomerName('');
    setCustomerPhone('');
    setPickupDate('');
    setPickupTime('12:00');
    setPaymentMethod('transfer');
    setSlipUrl('');
    setOrderItems([]);
    setSelectedProductId('');
    setSelectedFlavor('');
    setQuantity(1);
    setRawChatText('');
    setParseSuccessMsg('');
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#d97706', padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Clock size={14} /> รอยืนยัน</span>;
      case 'accepted':
        return <span style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#2563eb', padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle size={14} /> รับออร์เดอร์แล้ว</span>;
      case 'prepared':
        return <span style={{ backgroundColor: 'rgba(147, 51, 234, 0.15)', color: '#9333ea', padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Cake size={14} /> จัดขนมแล้ว</span>;
      case 'completed':
        return <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#059669', padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><PackageCheck size={14} /> รับขนมแล้ว</span>;
      case 'cancelled':
        return <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#dc2626', padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><XCircle size={14} /> ยกเลิกแล้ว</span>;
      default:
        return null;
    }
  };

  const displayPreorders = preorders.filter(order => {
    if (activeTab === 'active') return order.status === 'pending' || order.status === 'accepted' || order.status === 'prepared';
    return order.status === 'completed' || order.status === 'cancelled';
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>ออร์เดอร์ล่วงหน้า (Pre-orders)</h3>
        
        <button 
          className="btn btn-primary"
          onClick={() => { resetManualForm(); setIsCreateModalOpen(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Plus size={18} /> คีย์ออร์เดอร์จาก FB / โทรสั่ง
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
        <button 
          onClick={() => setActiveTab('active')}
          style={{ 
            background: 'none', 
            border: 'none', 
            borderBottom: activeTab === 'active' ? '2px solid var(--primary-dark)' : '2px solid transparent', 
            padding: '0.5rem 1rem', 
            fontSize: '1rem', 
            fontWeight: activeTab === 'active' ? 'bold' : 'normal',
            color: activeTab === 'active' ? 'var(--primary-dark)' : 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          ออร์เดอร์ปัจจุบัน
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          style={{ 
            background: 'none', 
            border: 'none', 
            borderBottom: activeTab === 'history' ? '2px solid var(--primary-dark)' : '2px solid transparent', 
            padding: '0.5rem 1rem', 
            fontSize: '1rem', 
            fontWeight: activeTab === 'history' ? 'bold' : 'normal',
            color: activeTab === 'history' ? 'var(--primary-dark)' : 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          ประวัติ (รับแล้ว/ยกเลิก)
        </button>
      </div>

      {/* Manual Preorder Entry Modal */}
      {isCreateModalOpen && createPortal(
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h4 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MessageSquare size={20} color="var(--primary-dark)" /> {editingOrderId ? 'แก้ไขออร์เดอร์' : 'คีย์ออร์เดอร์ใหม่ (FB / โทรสั่ง)'}
              </h4>
              <button type="button" className="modal-close" onClick={() => setIsCreateModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={saveManualPreorder}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '70vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
                
                {/* AI Chat Converter Text Box */}
                {!editingOrderId && (
                  <div style={{ backgroundColor: '#faf5ff', padding: '1rem', borderRadius: '12px', border: '1.5px dashed #c084fc' }}>
                    <label className="form-label" style={{ fontWeight: 'bold', color: '#6b21a8', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                      <Sparkles size={16} /> วางข้อความแชทเพื่อแปลงเป็นออร์เดอร์ทันที (AI Fast Fill)
                    </label>
                    <textarea 
                      rows="3"
                      value={rawChatText}
                      onChange={(e) => setRawChatText(e.target.value)}
                      placeholder="วางข้อความแชทจาก FB/LINE ที่นี่ เช่น:&#10;บราวนี่เค้ก โอริโอ้ 2&#10;บราวนี่เค้ก เมล็ดฟักทอง 2&#10;แตง 0614097892&#10;5 ส.ค. 13.00น."
                      className="form-control"
                      style={{ fontSize: '0.85rem', backgroundColor: 'white', marginBottom: '0.5rem' }}
                    />
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button 
                        type="button" 
                        onClick={parseRawChatText} 
                        className="btn btn-primary"
                        style={{ backgroundColor: '#9333ea', color: 'white', border: 'none', fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                      >
                        ⚡ ประมวลผลข้อความ
                      </button>
                      {parseSuccessMsg && <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>{parseSuccessMsg}</span>}
                    </div>
                  </div>
                )}

                {/* Source Selection */}
                <div className="form-group">
                  <label className="form-label">ช่องทางการสั่งซื้อ</label>
                  <select value={orderSource} onChange={(e) => setOrderSource(e.target.value)} className="form-control premium-input">
                    <option value="Facebook">Facebook Messenger</option>
                    <option value="LINE">LINE</option>
                    <option value="โทรสั่ง">โทรศัพท์สั่ง</option>
                    <option value="หน้าร้าน">สั่งหน้าร้าน</option>
                  </select>
                </div>

                {/* Customer Details */}
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flex: '1 1 200px' }}>
                    <label className="form-label">ชื่อลูกค้า <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>(ไม่จำเป็นต้องกรอก)</span></label>
                    <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="form-control premium-input" placeholder="เช่น คุณสมศรี (ไม่ระบุใส่ 'คุณลูกค้า')" />
                  </div>
                  <div className="form-group" style={{ flex: '1 1 200px' }}>
                    <label className="form-label">เบอร์โทรศัพท์ <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>(ไม่จำเป็นต้องกรอก)</span></label>
                    <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="form-control premium-input" placeholder="08X-XXX-XXXX (ไม่ระบุใส่ '-')" />
                  </div>
                </div>

                {/* Date & Time */}
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">วันที่นัดรับ <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>(ไม่ระบุ = วันนี้)</span></label>
                    <input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className="form-control premium-input" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">เวลานัดรับ <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>(ไม่ระบุ = 12:00)</span></label>
                    <input type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} className="form-control premium-input" />
                  </div>
                </div>

                {/* Items Selector */}
                <div style={{ backgroundColor: 'var(--primary-light)', padding: '1rem', borderRadius: '12px' }}>
                  <label className="form-label" style={{ fontWeight: 'bold', color: 'var(--primary-dark)', marginBottom: '0.75rem' }}>
                    🍰 เพิ่มรายการขนมเค้ก
                  </label>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                    <select 
                      value={selectedProductId} 
                      onChange={(e) => {
                        setSelectedProductId(e.target.value);
                        setSelectedFlavor('');
                      }} 
                      className="form-control"
                      style={{ backgroundColor: 'white' }}
                    >
                      <option value="">-- เลือกเมนูเค้ก --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (฿{p.selling_price.toFixed(2)})</option>
                      ))}
                    </select>

                    {/* Flavors pills if selected product has flavors */}
                    {(() => {
                      const prod = products.find(p => p.id === selectedProductId);
                      if (!prod || !prod.flavors) return null;
                      const flavorList = prod.flavors.split(',').map(f => f.trim()).filter(Boolean);
                      if (flavorList.length === 0) return null;

                      return (
                        <div>
                          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                            เลือกรสชาติ / หน้าเค้ก:
                          </label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            {flavorList.map((f, idx) => {
                              const isSel = (selectedFlavor || flavorList[0]) === f;
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setSelectedFlavor(f)}
                                  style={{
                                    padding: '0.25rem 0.6rem',
                                    borderRadius: '16px',
                                    border: isSel ? '2px solid var(--primary-dark)' : '1px solid var(--border)',
                                    backgroundColor: isSel ? 'var(--primary-dark)' : 'white',
                                    color: isSel ? 'white' : 'var(--text-main)',
                                    fontSize: '0.8rem',
                                    fontWeight: isSel ? 600 : 400,
                                    cursor: 'pointer'
                                  }}
                                >
                                  {isSel ? `✓ ${f}` : f}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>จำนวน:</label>
                      <input 
                        type="number" 
                        min="1" 
                        value={quantity} 
                        onChange={(e) => setQuantity(e.target.value)} 
                        className="form-control" 
                        style={{ width: '80px', backgroundColor: 'white', textAlign: 'center' }} 
                      />
                      <button type="button" className="btn btn-primary" onClick={addOrderItem} style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
                        + เพิ่มเข้าออร์เดอร์
                      </button>
                    </div>
                  </div>

                  {/* Added Items List */}
                  {orderItems.length > 0 && (
                    <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '0.75rem', border: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>รายการที่เลือกแล้ว ({orderItems.length} รายการ):</div>
                      {orderItems.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px dashed var(--border)' }}>
                          <div style={{ flex: 1, paddingRight: '1rem' }}>
                            {item.product.name} {item.flavor && `(${item.flavor})`} x <strong>{item.quantity}</strong>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                              ฿{((item.product.selling_price + getFlavorPriceAddOn(item.flavor)) * item.quantity).toFixed(2)}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 'bold', color: 'var(--primary-dark)', fontSize: '0.9rem' }}>
                              ฿{((item.product.selling_price + getFlavorPriceAddOn(item.flavor)) * item.quantity).toFixed(2)}
                            </span>
                            <button type="button" onClick={() => removeOrderItem(idx)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0 }}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                      <div style={{ textAlign: 'right', marginTop: '1rem' }}>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                          ยอดรวมสินค้า: ฿{calculateSubtotal().toFixed(2)}
                        </div>
                        {calculateProductPromoDiscount() > 0 && (
                          <div style={{ fontSize: '0.9rem', color: 'var(--success)', fontWeight: 600, marginBottom: '0.25rem' }}>
                            ส่วนลดโปรโมชั่น: -฿{calculateProductPromoDiscount().toFixed(2)}
                          </div>
                        )}
                        <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--primary-dark)' }}>
                          ยอดสุทธิ: ฿{calculateManualTotal().toFixed(2)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Payment Method & Slip Upload */}
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">การชำระเงิน</label>
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="form-control premium-input">
                      <option value="transfer">โอนเงินแล้ว</option>
                      <option value="pay_later">ชำระเงินตอนรับของ (Pay Later)</option>
                    </select>
                  </div>
                  
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">อัปโหลดสลิป (ถ้ามี)</label>
                    <input type="file" accept="image/*" onChange={handleSlipUpload} ref={fileInputRef} className="form-control premium-input" disabled={uploadingSlip} />
                    {uploadingSlip && <small className="text-muted">กำลังอัปโหลดสลิป...</small>}
                    {slipUrl && <small style={{ color: 'var(--success)', display: 'block', fontWeight: 600 }}>✓ อัปโหลดสลิปสำเร็จ</small>}
                  </div>
                </div>

              </div>

              <div className="flex gap-2 justify-end mt-4">
                <button type="button" className="btn btn-outline" onClick={() => setIsCreateModalOpen(false)}>ยกเลิก</button>
                  <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: '100%', fontSize: '1.1rem', padding: '0.75rem' }}>
                    {submitting ? 'กำลังบันทึก...' : editingOrderId ? 'บันทึกการแก้ไข' : 'บันทึกออร์เดอร์'}
                  </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {loading ? (
        <div className="card text-center text-muted">กำลังโหลดข้อมูล...</div>
      ) : displayPreorders.length === 0 ? (
        <div className="card text-center text-muted">
          ยังไม่มีรายการพรีออร์เดอร์ในหมวดหมู่นี้
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {displayPreorders.map((order, index) => {
            const prevOrder = index > 0 ? displayPreorders[index - 1] : null;
            const showDivider = !prevOrder || prevOrder.status !== order.status;
            
            const statusTitle = {
              'pending': '⏳ รอยืนยัน (รอกดรับออร์เดอร์)',
              'accepted': '👩‍🍳 รับออร์เดอร์แล้ว (รอทำ/กำลังเตรียม)',
              'prepared': '🎁 จัดขนมแล้ว (พร้อมส่ง/รอรับ)',
              'completed': '✅ รับขนมแล้ว (เสร็จสิ้น)',
              'cancelled': '❌ ยกเลิกแล้ว'
            };

            return (
              <React.Fragment key={order.id}>
                {showDivider && (
                  <div style={{
                    marginTop: index > 0 ? '1.5rem' : '0.5rem',
                    marginBottom: '0.5rem',
                    padding: '0.5rem 1rem',
                    backgroundColor: '#f8f9fa',
                    borderLeft: '4px solid var(--primary-dark)',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                    fontSize: '1.1rem',
                    color: 'var(--primary-dark)'
                  }}>
                    {statusTitle[order.status] || order.status}
                  </div>
                )}
                <div className="card" style={{ padding: '1.5rem' }}>
              <div 
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
              >
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.25rem' }}>{formatDisplayName(order.customer_name)}</div>
                  <div className="text-muted" style={{ fontSize: '0.9rem' }}>
                    เบอร์โทร: {order.customer_phone} &bull; วันรับ: {new Date(order.pickup_date).toLocaleString('th-TH')}
                  </div>
                  <div style={{ marginTop: '0.25rem', fontSize: '0.85rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.25rem', color: order.payment_method === 'pay_later' ? '#d97706' : 'var(--primary-dark)' }}>
                    <CreditCard size={14} /> 
                    {order.payment_method === 'pay_later' ? 'วิธีชำระ: จ่ายเงินตอนรับของ (Pay Later)' : 'วิธีชำระ: โอนเงิน'}
                    
                    {order.payment_method !== 'pay_later' && order.slip_url && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingSlipUrl(order.slip_url);
                        }}
                        style={{ marginLeft: '0.5rem', background: 'var(--primary-light)', border: 'none', borderRadius: '4px', padding: '0.15rem 0.5rem', fontSize: '0.75rem', color: 'var(--primary-dark)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                      >
                        <ImageIcon size={12} /> ดูสลิป
                      </button>
                    )}
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--primary-dark)', fontSize: '1.2rem' }}>฿{order.total_amount.toFixed(2)}</div>
                    <div>{getStatusBadge(order.status)}</div>
                  </div>
                  {expandedId === order.id ? <ChevronUp className="text-muted" /> : <ChevronDown className="text-muted" />}
                </div>
              </div>

              {expandedId === order.id && (
                <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '280px' }}>
                      <h4 style={{ fontSize: '1rem', marginBottom: '1rem' }}>รายการที่สั่ง:</h4>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {order.preorder_items.map((item, idx) => (
                          <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px dashed var(--border)', alignItems: 'center' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', margin: 0, flex: 1 }}>
                              <input 
                                type="checkbox" 
                                checked={item.is_received || false}
                                onChange={() => toggleItemReceived(order.id, item.id, item.is_received)}
                                style={{ width: '1.2rem', height: '1.2rem', accentColor: 'var(--success)' }}
                              />
                              <span style={{ textDecoration: item.is_received ? 'line-through' : 'none', color: item.is_received ? 'var(--text-muted)' : 'inherit' }}>
                                {item.products?.name} 
                                {item.notes && <span style={{ color: 'var(--primary-dark)', fontWeight: 600, marginLeft: '0.35rem' }}>({item.notes})</span>}
                                {' '}x <strong style={{ color: item.is_received ? 'var(--text-muted)' : 'var(--primary-dark)' }}>{item.quantity}</strong>
                              </span>
                            </label>
                            <span style={{ textDecoration: item.is_received ? 'line-through' : 'none', color: item.is_received ? 'var(--text-muted)' : 'inherit' }}>
                              ฿{(item.price_at_time * item.quantity).toFixed(2)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {order.slip_url && (
                      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center' }}>
                        <a 
                          href={order.slip_url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="btn btn-outline"
                          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
                        >
                          <ImageIcon size={16} /> ดูสลิปโอนเงิน
                        </a>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button 
                        className="btn btn-outline" 
                        style={{ 
                          fontSize: '0.85rem',
                          backgroundColor: order.status === 'pending' ? 'var(--primary-light)' : 'transparent',
                          borderColor: order.status === 'pending' ? 'var(--primary-dark)' : 'var(--border)'
                        }}
                        onClick={() => updateStatus(order, 'pending')}
                        disabled={order.status === 'pending'}
                      >
                        รอยืนยัน
                      </button>
                      <button 
                        className="btn btn-outline" 
                        style={{ 
                          fontSize: '0.85rem',
                          backgroundColor: order.status === 'accepted' ? '#eff6ff' : 'transparent',
                          borderColor: order.status === 'accepted' ? '#2563eb' : 'var(--border)',
                          color: order.status === 'accepted' ? '#2563eb' : 'inherit'
                        }}
                        onClick={() => updateStatus(order, 'accepted')}
                        disabled={order.status === 'accepted'}
                      >
                        รับออร์เดอร์แล้ว
                      </button>
                      <button 
                        className="btn btn-outline" 
                        style={{ 
                          fontSize: '0.85rem',
                          backgroundColor: order.status === 'prepared' ? '#f3e8ff' : 'transparent',
                          borderColor: order.status === 'prepared' ? '#9333ea' : 'var(--border)',
                          color: order.status === 'prepared' ? '#9333ea' : 'inherit'
                        }}
                        onClick={() => updateStatus(order, 'prepared')}
                        disabled={order.status === 'prepared'}
                      >
                        จัดขนมแล้ว
                      </button>
                      <button 
                        className="btn btn-success" 
                        style={{ fontSize: '0.85rem', backgroundColor: 'var(--success)', color: 'white', border: 'none' }}
                        onClick={async () => {
                          const hasItems = order.preorder_items && order.preorder_items.length > 0;
                          if (!hasItems) {
                            updateStatus(order, 'completed');
                            return;
                          }
                          
                          const allReceived = order.preorder_items.every(i => i.is_received);
                          const noneReceived = order.preorder_items.every(i => !i.is_received);
                          
                          if (noneReceived) {
                            // If none are ticked, auto-tick all and complete
                            if (window.confirm('คุณยังไม่ได้ติ๊กรับขนมเลย ต้องการรับขนมทั้งหมดและปิดออร์เดอร์ใช่หรือไม่?')) {
                              try {
                                const itemIds = order.preorder_items.map(i => i.id);
                                await supabase.from('preorder_items').update({ is_received: true }).in('id', itemIds);
                                updateStatus(order, 'completed');
                              } catch(e) {
                                alert('Error updating items: ' + e.message);
                              }
                            }
                            return;
                          }
                          
                          if (!allReceived) {
                            alert('กรุณาติ๊กรับขนมให้ครบทุกรายการก่อนกด "รับขนมแล้ว" เพื่อปิดออร์เดอร์เข้าประวัติครับ');
                            return;
                          }
                          
                          updateStatus(order, 'completed');
                        }}
                        disabled={order.status === 'completed'}
                      >
                        รับขนมแล้ว
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button 
                        onClick={() => printOrder(order)}
                        className="btn btn-outline"
                        style={{ fontSize: '0.85rem', color: '#636e72', borderColor: '#dfe6e9', padding: '0.5rem 1rem' }}
                      >
                        <Printer size={16} /> พิมพ์สติกเกอร์
                      </button>
                      <button 
                        className="btn btn-outline" 
                        style={{ color: 'var(--primary-dark)', borderColor: 'var(--primary-dark)', fontSize: '0.85rem' }}
                        onClick={() => openEditModal(order)}
                      >
                        แก้ไขออร์เดอร์
                      </button>
                      <button 
                        className="btn btn-outline" 
                        style={{ color: 'var(--danger)', borderColor: 'var(--danger)', fontSize: '0.85rem' }}
                        onClick={() => deletePreorder(order)}
                      >
                        <Trash2 size={16} /> ลบออร์เดอร์นี้
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Slip Image Modal */}
      {viewingSlipUrl && createPortal(
        <div className="modal-overlay" onClick={() => setViewingSlipUrl(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem', color: 'var(--text-dark)' }}>สลิปโอนเงิน</h2>
              <button className="btn btn-outline" style={{ border: 'none', padding: '0.25rem' }} onClick={() => setViewingSlipUrl(null)}>
                <X size={20} />
              </button>
            </div>
            <div style={{ marginTop: '1rem', padding: '0.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <img src={viewingSlipUrl} alt="Payment Slip" style={{ maxWidth: '100%', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
