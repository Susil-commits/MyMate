const http = require('http');

const check = (path) => {
  return new Promise((resolve) => {
    http.get(`http://localhost:5000${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ path, status: res.statusCode, data }));
    }).on('error', (err) => resolve({ path, error: err.message }));
  });
};

(async () => {
  const routes = [
    '/health',
    '/',
    '/api/drivers',
    '/api/bookings',
    '/api/reviews',
    '/api/auth/profile'
  ];
  
  for (const r of routes) {
    const res = await check(r);
    console.log(`[${res.status || 'ERROR'}] ${r}: ${res.data || res.error}`);
  }
})();
