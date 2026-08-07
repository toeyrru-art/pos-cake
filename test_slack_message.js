const webhookUrl = 'https://hooks.slack.com/services/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';
fetch(webhookUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: 'ทดสอบแจ้งเตือนจากระบบ POS เค้ก' })
}).then(res => console.log('Status:', res.status)).catch(err => console.error(err));
