import 'dotenv/config';

async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/chat/analisis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '¿Cuáles son las 5 subsecciones con mayor margen y cifra de venta?' })
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', text);
  } catch (e: any) {
    console.error('Fetch error:', e.message);
  }
}

test();
