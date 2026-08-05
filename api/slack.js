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
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Slack Notify Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
