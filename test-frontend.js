import http from 'http';

const req = http.request({
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/ai/service-description',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer FAKE_TOKEN'
  }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('BODY:', data);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(JSON.stringify({
  serviceName: "Volume natural",
  currentDescription: "Alongamento de cílios com efeito natural.",
  professionalSpecialty: "Alongamento de cílios"
}));
req.end();
