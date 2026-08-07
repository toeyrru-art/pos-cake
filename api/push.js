import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let title = req.body.title || 'ออร์เดอร์ใหม่!';
    let message = req.body.message || '';

    // If it's a Supabase Webhook payload, format the message automatically
    if (req.body.type === 'INSERT' && req.body.table === 'preorders' && req.body.record) {
      const record = req.body.record;
      message = `มีออร์เดอร์ใหม่จากคุณ ${record.customer_name || 'ลูกค้า'} เข้ามาในระบบครับ! (วันรับ: ${record.pickup_date || 'ไม่ได้ระบุ'})`;
    }

    if (!message) {
      return res.status(400).json({ error: 'Missing message' });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: settings } = await supabase.from('store_settings').select('*').in('key', ['vapid_public_key', 'vapid_private_key', 'push_subscriptions']);
    
    if (!settings) {
      return res.status(500).json({ error: 'Settings not found' });
    }

    let publicKey = '';
    let privateKey = '';
    let subscriptions = [];

    settings.forEach(s => {
      if (s.key === 'vapid_public_key') publicKey = s.value;
      if (s.key === 'vapid_private_key') privateKey = s.value;
      if (s.key === 'push_subscriptions') {
        try {
          subscriptions = JSON.parse(s.value || '[]');
        } catch(e) {
          subscriptions = [];
        }
      }
    });

    if (!publicKey || !privateKey) {
      return res.status(500).json({ error: 'VAPID keys not configured' });
    }

    if (subscriptions.length === 0) {
      return res.status(200).json({ success: true, message: 'No subscriptions' });
    }

    webpush.setVapidDetails(
      'mailto:admin@poscake.com',
      publicKey,
      privateKey
    );

    const payload = JSON.stringify({
      title: title || 'POS Cake Notification',
      body: message,
      icon: '/icon.png'
    });

    const sendPromises = subscriptions.map(sub => 
      webpush.sendNotification(sub, payload).catch(err => {
        console.error('Push error for sub:', err);
        // Could remove invalid subs here if status is 410 (Gone)
      })
    );

    await Promise.all(sendPromises);

    return res.status(200).json({ success: true, count: subscriptions.length });
  } catch (error) {
    console.error('Push Notify Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
