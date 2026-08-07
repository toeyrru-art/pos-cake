async function testPush() {
  try {
    const res = await fetch('https://taii-tang-bakery.vercel.app/api/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title: 'Test', message: 'ทดสอบระบบแจ้งเตือนจากระบบหลังบ้าน' })
    });
    const data = await res.json();
    console.log('Push response:', data);
  } catch (err) {
    console.error('Error:', err);
  }
}

testPush();
