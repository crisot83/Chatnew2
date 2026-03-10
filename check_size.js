import https from 'https';

const url = 'https://docs.google.com/spreadsheets/d/1-3u_uuEcPW98KvqKQ_ivdW0qG9FA3YMoF-Cl2zfuZI0/gviz/tq?tqx=out:csv&sheet=analisisseccionRamon';

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Size in bytes:', data.length);
    console.log('First 500 chars:', data.substring(0, 500));
  });
}).on('error', (err) => {
  console.error('Error:', err.message);
});
