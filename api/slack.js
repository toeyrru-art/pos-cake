export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { message, webhookUrl } = req.body;

    if (!message || !webhookUrl) {
      return res.status(400).json({ error: 'Missing message or webhookUrl' });
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: message })
    });

    if (!response.ok) {
        throw new Error('Slack API returned status ' + response.status);
    }
    
    // Also trigger Push Notification
    try {
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const host = req.headers.host;
      if (host) {
        await fetch(`${protocol}://${host}/api/push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'POS Cake Shop', message })
        });
      }
    } catch(e) {
      console.error('Failed to trigger push from slack.js', e);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Slack Notify Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
