import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  User, 
  Phone, 
  Cake, 
  CheckCircle, 
  PackageCheck, 
  XCircle, 
  Filter, 
  Sparkles,
  ListOrdered,
  Printer,
  Wallet,
  Coins,
  Banknote
} from 'lucide-react';

export default function BakingCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const [preorders, setPreorders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'accepted', 'completed'

  useEffect(() => {
    fetchData();

    // Realtime subscription for preorders
    const channel = supabase
      .channel('baking_calendar_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'preorders' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('preorders')
      .select(`
        *,
        preorder_items (
          id,
          product_id,
          quantity,
          price_at_time,
          notes,
          is_received,
          products ( name )
        )
      `)
      .order('pickup_date', { ascending: true });

    if (error) {
      console.error('Error fetching calendar preorders:', error);
    } else {
      setPreorders(data || []);
    }
    setLoading(false);
  };

  const handleUpdateStatus = async (preorderId, newStatus) => {
    try {
      const { error } = await supabase
        .from('preorders')
        .update({ status: newStatus })
        .eq('id', preorderId);

      if (error) throw error;
      fetchData();
    } catch (err) {
      alert('ไม่สามารถอัปเดตสถานะได้: ' + err.message);
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
          ยอดรวม: ฿${Number(order.total_amount || 0).toFixed(2)}
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


  // Helper for Calendar Days calculation
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun, 1 = Mon...
  const totalDays = lastDayOfMonth.getDate();

  const prevMonthDays = [];
  if (startDayOfWeek > 0) {
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      prevMonthDays.push(prevMonthLastDay - i);
    }
  }

  const daysInMonth = Array.from({ length: totalDays }, (_, i) => i + 1);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setSelectedDateStr(`${yyyy}-${mm}-${dd}`);
  };

  // Format YYYY-MM-DD helper
  const formatDateString = (y, m, d) => {
    const mm = String(m + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  };

  const getLocalDateKey = (rawDate) => {
    if (!rawDate) return null;
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) {
      return String(rawDate).substring(0, 10);
    }
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Group preorders by pickup_date
  const preordersByDate = {};
  preorders.forEach(po => {
    if (statusFilter !== 'all' && po.status !== statusFilter) return;
    const dateKey = getLocalDateKey(po.pickup_date || po.created_at);
    if (!dateKey) return;

    if (!preordersByDate[dateKey]) {
      preordersByDate[dateKey] = {
        totalOrders: 0,
        totalItems: 0,
        pendingCount: 0,
        acceptedCount: 0,
        preparedCount: 0,
        completedCount: 0,
        totalRevenue: 0,
        payLaterRevenue: 0,
        paidRevenue: 0,
        orders: []
      };
    }

    const amount = Number(po.total_amount || 0);

    preordersByDate[dateKey].totalOrders += 1;
    preordersByDate[dateKey].orders.push(po);

    if (po.status !== 'cancelled') {
      preordersByDate[dateKey].totalRevenue += amount;
      if (po.payment_method === 'pay_later') {
        preordersByDate[dateKey].payLaterRevenue += amount;
      } else {
        preordersByDate[dateKey].paidRevenue += amount;
      }
    }

    if (po.status === 'pending') preordersByDate[dateKey].pendingCount += 1;
    if (po.status === 'accepted') preordersByDate[dateKey].acceptedCount += 1;
    if (po.status === 'prepared') preordersByDate[dateKey].preparedCount += 1;
    if (po.status === 'completed') preordersByDate[dateKey].completedCount += 1;

    let itemCount = 0;
    if (po.preorder_items) {
      po.preorder_items.forEach(item => {
        itemCount += Number(item.quantity || 0);
      });
    }
    preordersByDate[dateKey].totalItems += itemCount;
  });

  // Calculate total monthly expected revenue for visible month
  const totalMonthlyRevenue = Object.entries(preordersByDate).reduce((sum, [dKey, dData]) => {
    const [y, m] = dKey.split('-').map(Number);
    if (y === year && (m - 1) === month) {
      return sum + (dData.totalRevenue || 0);
    }
    return sum;
  }, 0);

  // Selected date preorders & aggregated baking summary
  const selectedDateOrders = preordersByDate[selectedDateStr]?.orders || [];

  // Aggregate baking count by (product_name + flavor)
  const bakingSummaryMap = {};
  selectedDateOrders.forEach(order => {
    if (order.status === 'cancelled') return; // Skip cancelled orders
    if (order.preorder_items) {
      order.preorder_items.forEach(item => {
        const prodName = item.products?.name || 'เค้ก';
        let flavorText = '';
        if (item.notes) {
          const match = item.notes.match(/(?:หน้า\/รส:\s*)(.*)/);
          if (match) flavorText = match[1];
          else flavorText = item.notes;
        }

        const key = flavorText ? `${prodName} (${flavorText})` : prodName;
        bakingSummaryMap[key] = (bakingSummaryMap[key] || 0) + Number(item.quantity || 0);
      });
    }
  });

  const monthNamesThai = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  const thaiFormattedSelectedDate = () => {
    if (!selectedDateStr) return '';
    const [y, m, d] = selectedDateStr.split('-').map(Number);
    return `${d} ${monthNamesThai[m - 1]} ${y + 543}`;
  };

  return (
    <div style={{ paddingBottom: '3rem' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <CalendarIcon size={28} color="var(--primary)" />
            ปฏิทินวางแผนทำเค้ก & สรุปออร์เดอร์
          </h1>
          <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            วางแผนการอบเค้กและตรวจสอบกำหนดนัดรับของลูกค้าล่วงหน้า
          </p>
        </div>

        {/* Filter & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', padding: '0.4rem 0.75rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
            <Filter size={16} color="var(--primary)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>กรองสถานะ:</span>
            <select 
              value={statusFilter} 
              onChange={e => setStatusFilter(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.85rem', fontWeight: '600', color: 'var(--primary-dark)', cursor: 'pointer' }}
            >
              <option value="all">ทั้งหมด</option>
              <option value="pending">รอการยืนยัน (Pending)</option>
              <option value="accepted">รับออร์เดอร์แล้ว (Accepted)</option>
              <option value="prepared">จัดขนมแล้ว (Prepared)</option>
              <option value="completed">เสร็จสิ้น/รับแล้ว (Completed)</option>
            </select>
          </div>

          <button 
            className="btn btn-outline" 
            onClick={goToToday}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderRadius: '10px' }}
          >
            <Sparkles size={16} color="var(--primary)" />
            วันนี้
          </button>
        </div>
      </div>

      {/* Main Layout Grid (Calendar + Daily Summary Side Panel) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* LEFT / TOP: Calendar Component */}
        <div className="card calendar-card-mobile" style={{ padding: '1.5rem', borderRadius: '16px', background: 'white', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
          {/* Calendar Month Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary-dark)' }}>
              {monthNamesThai[month]} {year + 543}
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                onClick={prevMonth} 
                className="btn btn-outline"
                style={{ padding: '0.4rem 0.6rem', borderRadius: '8px' }}
              >
                <ChevronLeft size={18} />
              </button>
              <button 
                onClick={nextMonth} 
                className="btn btn-outline"
                style={{ padding: '0.4rem 0.6rem', borderRadius: '8px' }}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* Weekday Headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem', textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            <div style={{ color: '#ff4757' }}>อา.</div>
            <div>จ.</div>
            <div>อ.</div>
            <div>พ.</div>
            <div>พฤ.</div>
            <div>ศ.</div>
            <div style={{ color: 'var(--primary)' }}>ส.</div>
          </div>

          {/* Calendar Grid Cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.35rem' }}>
            {/* Previous Month Padding Days */}
            {prevMonthDays.map((d, i) => (
              <div 
                key={`prev-${i}`} 
                className="calendar-day-cell"
                style={{ 
                  minHeight: '75px', 
                  padding: '0.35rem', 
                  borderRadius: '10px', 
                  background: '#f8f9fa', 
                  opacity: 0.3,
                  pointerEvents: 'none'
                }}
              >
                <span style={{ fontSize: '0.8rem' }}>{d}</span>
              </div>
            ))}

            {/* Current Month Days */}
            {daysInMonth.map(d => {
              const dateStr = formatDateString(year, month, d);
              const dayData = preordersByDate[dateStr];
              const isSelected = dateStr === selectedDateStr;
              
              const todayStr = formatDateString(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
              const isToday = dateStr === todayStr;

              return (
                <div
                  key={d}
                  className="calendar-day-cell"
                  onClick={() => setSelectedDateStr(dateStr)}
                  style={{
                    minHeight: '75px',
                    padding: '0.35rem',
                    borderRadius: '12px',
                    border: isSelected 
                      ? '2px solid var(--primary)' 
                      : (isToday ? '2px dashed var(--primary-light)' : '1px solid var(--border)'),
                    background: isSelected 
                      ? 'rgba(255, 143, 163, 0.08)' 
                      : (dayData ? '#ffffff' : '#fafafa'),
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: isSelected ? '0 4px 12px rgba(255, 143, 163, 0.25)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="calendar-day-number" style={{ 
                      fontSize: '0.85rem', 
                      fontWeight: isSelected || isToday ? 'bold' : '500',
                      color: isToday ? 'var(--primary-dark)' : 'inherit',
                      background: isToday ? 'var(--primary-light)' : 'transparent',
                      padding: '1px 6px',
                      borderRadius: '8px'
                    }}>
                      {d}
                    </span>
                    {dayData && (
                      <span className="calendar-qty-badge">
                        {dayData.totalItems} ชิ้น
                      </span>
                    )}
                  </div>

                  {/* Badges for Preorders */}
                  {dayData ? (
                    <div className="calendar-cell-indicators">
                      {dayData.totalRevenue > 0 && (
                        <div className="calendar-badge" style={{ background: '#fff3e0', color: '#b45309', fontWeight: 'bold' }}>
                          <span>💰 ฿{dayData.totalRevenue >= 1000 ? `${(dayData.totalRevenue / 1000).toFixed(1)}k` : dayData.totalRevenue.toFixed(0)}</span>
                        </div>
                      )}
                      {dayData.pendingCount > 0 && (
                        <div className="calendar-badge" style={{ background: '#ffeaa7', color: '#d63031' }}>
                          <span>⏳ รอรับ: {dayData.pendingCount}</span>
                        </div>
                      )}
                      {dayData.acceptedCount > 0 && (
                        <div className="calendar-badge" style={{ background: '#74b9ff', color: '#0984e3' }}>
                          <span>👩‍🍳 ทำ: {dayData.acceptedCount}</span>
                        </div>
                      )}
                      {dayData.preparedCount > 0 && (
                        <div className="calendar-badge" style={{ background: '#e9d5ff', color: '#7e22ce' }}>
                          <span>🎁 จัดแล้ว: {dayData.preparedCount}</span>
                        </div>
                      )}
                      {dayData.completedCount > 0 && (
                        <div className="calendar-badge" style={{ background: '#55efc4', color: '#00b894' }}>
                          <span>✅ รับ: {dayData.completedCount}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.7rem', color: '#ccc', textAlign: 'center', marginTop: '0.5rem' }}>-</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT / BOTTOM: Daily Baking Summary & Orders Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* CARD 0: Money Summary for Selected Date */}
          <div className="card" style={{ padding: '1.25rem', borderRadius: '16px', background: 'linear-gradient(135deg, #fff7ed 0%, #fff3e0 100%)', border: '1px solid rgba(245, 158, 11, 0.4)', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', borderBottom: '1px dashed rgba(245, 158, 11, 0.4)', paddingBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Wallet size={22} color="#d97706" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#b45309', fontWeight: 'bold' }}>
                  สรุปเงินที่จะได้รับ ({thaiFormattedSelectedDate()})
                </h3>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#b45309', background: 'rgba(245, 158, 11, 0.2)', padding: '2px 8px', borderRadius: '10px' }}>
                เดือนนี้รวม ฿{totalMonthlyRevenue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
              {/* Total Expected Revenue */}
              <div style={{ background: 'white', padding: '0.75rem 0.85rem', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.3)', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>💰 ยอดรวมที่จะได้รับ</div>
                <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#b45309', marginTop: '0.2rem' }}>
                  ฿{(preordersByDate[selectedDateStr]?.totalRevenue || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </div>
              </div>

              {/* To Collect on Pickup (Pay Later) */}
              <div style={{ background: 'white', padding: '0.75rem 0.85rem', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.3)', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 500 }}>💵 รอเก็บเงินสดตอนรับของ</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#dc2626', marginTop: '0.2rem' }}>
                  ฿{(preordersByDate[selectedDateStr]?.payLaterRevenue || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </div>
              </div>

              {/* Already Paid / Transferred */}
              <div style={{ background: 'white', padding: '0.75rem 0.85rem', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.3)', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 500 }}>💳 โอน/ชำระเงินแล้ว</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#059669', marginTop: '0.2rem' }}>
                  ฿{(preordersByDate[selectedDateStr]?.paidRevenue || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>
          
          {/* CARD 1: Daily Baking Summary (สรุปยอดอบเค้กประจำวัน) */}
          <div className="card" style={{ padding: '1.25rem', borderRadius: '16px', background: 'linear-gradient(135deg, #ffffff 0%, #fff8f9 100%)', border: '1px solid rgba(255, 143, 163, 0.3)', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px dashed var(--border)', paddingBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Cake size={22} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--primary-dark)', fontWeight: 'bold' }}>
                  ยอดอบเค้ก ({thaiFormattedSelectedDate()})
                </h3>
              </div>
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'white', background: 'var(--primary)', padding: '2px 10px', borderRadius: '12px' }}>
                รวม {Object.values(bakingSummaryMap).reduce((a, b) => Number(a) + Number(b), 0)} ชิ้น
              </span>
            </div>

            {Object.keys(bakingSummaryMap).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                🎂 ไม่มีรายการเค้กที่ต้องอบในวันนี้
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.65rem' }}>
                {Object.entries(bakingSummaryMap).map(([cakeName, qty], index) => (
                  <div key={index} style={{ background: 'white', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-dark)', flex: 1, paddingRight: '0.5rem' }}>
                      {cakeName}
                    </span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--primary-dark)', background: 'var(--primary-light)', padding: '2px 8px', borderRadius: '8px' }}>
                      x{qty}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CARD 2: Individual Customer Pickup Orders */}
          <div className="card" style={{ padding: '1.25rem', borderRadius: '16px', background: 'white', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ListOrdered size={20} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--primary-dark)', fontWeight: 'bold' }}>
                  ลูกค้ารับออร์เดอร์วันนี้ ({selectedDateOrders.length} รายการ)
                </h3>
              </div>
            </div>

            {selectedDateOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                📦 ไม่มีออร์เดอร์ลูกค้านัดรับในวันนี้
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '500px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                {selectedDateOrders.map(po => {
                  const getStatusBadge = (status) => {
                    switch (status) {
                      case 'pending':
                        return <span style={{ background: '#ffeaa7', color: '#d63031', fontSize: '0.75rem', fontWeight: 'bold', padding: '3px 8px', borderRadius: '12px' }}>⏳ รอการยืนยัน</span>;
                      case 'accepted':
                        return <span style={{ background: '#74b9ff', color: '#0984e3', fontSize: '0.75rem', fontWeight: 'bold', padding: '3px 8px', borderRadius: '12px' }}>👩‍🍳 รับออร์เดอร์แล้ว</span>;
                      case 'prepared':
                        return <span style={{ background: '#e9d5ff', color: '#7e22ce', fontSize: '0.75rem', fontWeight: 'bold', padding: '3px 8px', borderRadius: '12px' }}>🎁 จัดขนมแล้ว</span>;
                      case 'completed':
                        return <span style={{ background: '#55efc4', color: '#00b894', fontSize: '0.75rem', fontWeight: 'bold', padding: '3px 8px', borderRadius: '12px' }}>✅ เสร็จสิ้น/รับแล้ว</span>;
                      case 'cancelled':
                        return <span style={{ background: '#dfe6e9', color: '#636e72', fontSize: '0.75rem', fontWeight: 'bold', padding: '3px 8px', borderRadius: '12px' }}>❌ ยกเลิกแล้ว</span>;
                      default:
                        return null;
                    }
                  };

                  return (
                    <div 
                      key={po.id} 
                      style={{ 
                        border: '1px solid var(--border)', 
                        borderRadius: '12px', 
                        padding: '0.85rem',
                        background: po.status === 'cancelled' ? '#f8f9fa' : 'white',
                        opacity: po.status === 'cancelled' ? 0.6 : 1
                      }}
                    >
                      {/* Customer Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <User size={16} />
                            {po.customer_name || 'คุณลูกค้า'}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                            {po.customer_phone && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                <Phone size={13} /> {po.customer_phone}
                              </span>
                            )}
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: 'var(--primary-dark)', fontWeight: 'bold' }}>
                              <Clock size={13} /> {po.pickup_time || (po.pickup_date ? new Date(po.pickup_date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : 'ไม่ระบุเวลา')} น.
                            </span>
                          </div>
                        </div>

                        <div>{getStatusBadge(po.status)}</div>
                      </div>

                      {/* Items Ordered List */}
                      <div style={{ background: '#fcfcfc', borderRadius: '8px', padding: '0.5rem 0.75rem', margin: '0.5rem 0', border: '1px solid #f0f0f0' }}>
                        {po.preorder_items && po.preorder_items.map((item, idx) => (
                          <div key={idx} style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            fontSize: '0.85rem', 
                            padding: '2px 0',
                            textDecoration: item.is_received ? 'line-through' : 'none',
                            color: item.is_received ? '#aaa' : 'inherit'
                          }}>
                            <span>
                              🔹 {item.products?.name || 'เค้ก'} 
                              {item.notes && <span style={{ color: item.is_received ? '#aaa' : 'var(--primary)', fontWeight: 500 }}> ({item.notes})</span>}
                            </span>
                            <span style={{ fontWeight: 'bold' }}>x{item.quantity}</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'right', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--primary-dark)', marginTop: '0.35rem', borderTop: '1px dashed #eee', paddingTop: '0.35rem' }}>
                          <div>
                            {po.payment_method === 'pay_later' ? (
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#dc2626', backgroundColor: '#fee2e2', padding: '2px 8px', borderRadius: '8px' }}>
                                💵 รอเก็บเงินตอนรับของ
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#059669', backgroundColor: '#d1fae5', padding: '2px 8px', borderRadius: '8px' }}>
                                💳 ชำระ/โอนเรียบร้อย
                              </span>
                            )}
                          </div>
                          <div>ยอดรวม: ฿{Number(po.total_amount || 0).toFixed(2)}</div>
                        </div>
                      </div>

                      {/* Action buttons to update status */}
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                        <button 
                          onClick={() => printOrder(po)}
                          className="btn btn-outline"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', color: '#636e72', borderColor: '#dfe6e9', borderRadius: '6px' }}
                        >
                          <Printer size={13} /> พิมพ์สติกเกอร์
                        </button>
                        {po.status === 'pending' && (
                          <button 
                            onClick={() => handleUpdateStatus(po.id, 'accepted')}
                            className="btn btn-outline"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', color: '#0984e3', borderColor: '#74b9ff', borderRadius: '6px' }}
                          >
                            <CheckCircle size={13} /> รับออร์เดอร์
                          </button>
                        )}
                        {(po.status === 'accepted' || po.status === 'pending') && (
                          <button 
                            onClick={() => handleUpdateStatus(po.id, 'prepared')}
                            className="btn btn-outline"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', color: '#7e22ce', borderColor: '#c084fc', borderRadius: '6px' }}
                          >
                            <Cake size={13} /> จัดขนมแล้ว
                          </button>
                        )}
                        {po.status !== 'completed' && po.status !== 'cancelled' && (
                          <button 
                            onClick={() => handleUpdateStatus(po.id, 'completed')}
                            className="btn btn-outline"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', color: '#00b894', borderColor: '#55efc4', borderRadius: '6px' }}
                          >
                            <PackageCheck size={13} /> ขนมพร้อม/รับแล้ว
                          </button>
                        )}
                        {po.status !== 'cancelled' && (
                          <button 
                            onClick={() => handleUpdateStatus(po.id, 'cancelled')}
                            className="btn btn-outline"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', color: '#d63031', borderColor: '#ff7675', borderRadius: '6px' }}
                          >
                            <XCircle size={13} /> ยกเลิก
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
