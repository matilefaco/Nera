import express from 'express';
import request from 'supertest';
import { api } from './dist-server/server/api_entry.js';

const app = express();
app.use((req, res, next) => {
  api(req, res);
});

request(app)
  .get('/api/health')
  .set('Host', 'usenera.com')
  .expect(200)
  .end(function(err, res) {
    if (err) throw err;
    console.log('Health Check OK:', res.text);
    process.exit(0);
  });
