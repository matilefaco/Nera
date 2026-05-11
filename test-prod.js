import { api } from './dist-server/server/api_entry.js';

const req = {
  url: '/api/health',
  hostname: 'usenera.com',
  headers: { host: 'usenera.com' },
  method: 'GET'
};
const res = {
  status: (code) => { console.log('STATUS:', code); return res; },
  send: (msg) => { console.log('SEND:', msg); return res; },
  json: (msg) => { console.log('JSON:', msg); return res; },
  setHeader: () => {},
  end: () => console.log('END'),
  on: () => {} // Mock for res.on
};

console.log('Invoking api...');
api(req, res).then(() => console.log('API call finished')).catch(e => console.error('API call failed', e));
