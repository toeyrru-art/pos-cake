import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://sxyiqsakqmxtjebwplff.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_6gkLIHtfTwl8j_CSgfq8Rg_0wD4AnAu';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Determine "Today" and "Tomorrow" in Thai time
    const now = new Date();
    const tzOffset = 7 * 60 * 60 * 1000;
    const thTime = new Date(now.getTime() + tzOffset);
    
    // Today
    const t_yyyy = thTime.getUTCFullYear();
    const t_mm = String(thTime.getUTCMonth() + 1).padStart(2, '0');
    const t_dd = String(thTime.getUTCDate()).padStart(2, '0');
    const todayStr = `${t_yyyy}-${t_mm}-${t_dd}`;
    
    const startOfToday = `${todayStr}T00:00:00+07:00`;
    const endOfToday = `${todayStr}T23:59:59+07:00`;

    // Tomorrow
    const tomorrowTime = new Date(thTime.getTime() + 24 * 60 * 60 * 1000);
    const tm_yyyy = tomorrowTime.getUTCFullYear();
    const tm_mm = String(tomorrowTime.getUTCMonth() + 1).padStart(2, '0');
    const tm_dd = String(tomorrowTime.getUTCDate()).padStart(2, '0');
    const tomorrowStr = `${tm_yyyy}-${tm_mm}-${tm_dd}`;

    const startOfTomorrow = `${tomorrowStr}T00:00:00+07:00`;
    const endOfTomorrow = `${tomorrowStr}T23:59:59+07:00`;

    // 2. Fetch today's sales (orders created today)
    const { data: salesToday, error: salesError } = await supabase
      .from('preorders')
      .select('*')
      .gte('created_at', startOfToday)
      .lte('created_at', endOfToday)
      .neq('status', 'cancelled');

    if (salesError) throw salesError;

    // Calculate total sales
    const totalOrdersToday = salesToday.length;
    const totalRevenueToday = salesToday.reduce((sum, order) => sum + Number(order.total_amount), 0);

    // 3. Fetch tomorrow's tasks (orders pickup tomorrow)
    const { data: tasksTomorrow, error: tasksError } = await supabase
      .from('preorders')
      .select('*, preorder_items(*, products(*))')
      .gte('pickup_date', startOfTomorrow)
      .lte('pickup_date', endOfTomorrow)
      .neq('status', 'cancelled');

    if (tasksError) throw tasksError;

    // 4. Format message
    let message = `🌆 *[สรุปประจำวัน - ${todayStr}]*\n`;
    message += `💰 *ยอดขายที่เข้ามาวันนี้*\n`;
    message += `- ออร์เดอร์ใหม่: ${totalOrdersToday} ออร์เดอร์\n`;
    message += `- ยอดรวม: ฿${totalRevenueToday.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n\n`;

    message += `📋 *เตรียมงานสำหรับจัดส่งพรุ่งนี้ (${tomorrowStr})*\n`;
    message += `พรุ่งนี้มีคิวส่งทั้งหมด *${tasksTomorrow.length}* ออร์เดอร์ครับ\n\n`;

    if (tasksTomorrow.length === 0) {
      message += `(พรุ่งนี้ยังไม่มีคิวจัดส่ง สบายๆ ครับ! 😊)`;
    } else {
      tasksTomorrow.forEach((order, index) => {
        message += `${index + 1}. คุณ ${order.customer_name} (${order.customer_phone})\n`;
        order.preorder_items?.forEach(item => {
          const notesText = item.notes ? ` (${item.notes})` : '';
          message += `   - ${item.products?.name || 'สินค้า'}${notesText} x ${item.quantity}\n`;
        });
        message += `\n`;
      });
    }

    // 5. Fetch Slack Webhook URL
    const { data: slackData } = await supabase
      .from('store_settings')
      .select('value')
      .eq('key', 'slack_webhook_url')
      .maybeSingle();

    const webhookUrl = slackData?.value;
    if (!webhookUrl) {
      return res.status(400).json({ error: 'No Slack Webhook URL configured' });
    }

    // 6. Send to Slack
    const slackRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message })
    });

    if (!slackRes.ok) {
      throw new Error(`Slack API error: ${slackRes.status}`);
    }

    return res.status(200).json({ success: true, sales: totalOrdersToday, tasks: tasksTomorrow.length });
  } catch (error) {
    console.error('Cron Evening Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
