import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://sxyiqsakqmxtjebwplff.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_6gkLIHtfTwl8j_CSgfq8Rg_0wD4AnAu';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // Ensure we are called correctly (Vercel Cron sends a GET)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Determine "Today" in Thai time (Asia/Bangkok)
    const now = new Date();
    const tzOffset = 7 * 60 * 60 * 1000;
    const thTime = new Date(now.getTime() + tzOffset);
    
    // YYYY-MM-DD in Thai time
    const yyyy = thTime.getUTCFullYear();
    const mm = String(thTime.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(thTime.getUTCDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;
    
    // Bounds for today
    const startOfDay = `${todayStr}T00:00:00+07:00`;
    const endOfDay = `${todayStr}T23:59:59+07:00`;

    // 2. Fetch today's preorders (not cancelled/deleted)
    const { data: orders, error: ordersError } = await supabase
      .from('preorders')
      .select('*, preorder_items(*, products(*))')
      .gte('pickup_date', startOfDay)
      .lte('pickup_date', endOfDay)
      .neq('status', 'cancelled');

    if (ordersError) throw ordersError;

    // 3. Format message
    let message = `🌅 *[สรุปออร์เดอร์ที่ต้องส่งวันนี้ - ${todayStr}]*\n`;
    message += `วันนี้มีคิวส่งทั้งหมด *${orders.length}* ออร์เดอร์ครับ!\n\n`;

    if (orders.length === 0) {
      message += `(ยังไม่มีคิวจัดส่งสำหรับวันนี้)`;
    } else {
      orders.forEach((order, index) => {
        message += `${index + 1}. คุณ ${order.customer_name} (${order.customer_phone})\n`;
        order.preorder_items?.forEach(item => {
          const notesText = item.notes ? ` (${item.notes})` : '';
          message += `   - ${item.products?.name || 'สินค้า'}${notesText} x ${item.quantity}\n`;
        });
        message += `\n`;
      });
    }

    // 4. Fetch Slack Webhook URL
    const { data: slackData } = await supabase
      .from('store_settings')
      .select('value')
      .eq('key', 'slack_webhook_url')
      .maybeSingle();

    const webhookUrl = slackData?.value;
    if (!webhookUrl) {
      return res.status(400).json({ error: 'No Slack Webhook URL configured' });
    }

    // 5. Send to Slack
    const slackRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message })
    });

    if (!slackRes.ok) {
      throw new Error(`Slack API error: ${slackRes.status}`);
    }

    return res.status(200).json({ success: true, count: orders.length });
  } catch (error) {
    console.error('Cron Morning Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
