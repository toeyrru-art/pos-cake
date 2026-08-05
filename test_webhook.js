const { default: fetch } = require('node-fetch');
async function test() {
  const payload = {
    "object": "page",
    "entry": [{
      "id": "12345",
      "time": 123456789,
      "messaging": [{
        "sender": { "id": "123" },
        "recipient": { "id": "456" },
        "message": { "text": "สั่งเค้ก" }
      }]
    }]
  };
  const res = await fetch('http://localhost:3000/api/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  console.log(res.status, await res.text());
}
test();
