import 'dotenv/config';

async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/env', {
      method: 'GET',
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', text);
  } catch (e: any) {
    console.error('Fetch error:', e.message);
  }
}

test();
