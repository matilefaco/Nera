import { initFirebase } from './server/firebaseAdmin.js';
import express from 'express';
import notificationRoutes from './server/routes/notificationRoutes.js';

async function run() {
  await initFirebase();
  const app = express();
  app.use(express.json());
  
  // Bypass auth middleware
  app.use((req, res, next) => {
    req.headers.authorization = 'Bearer test';
    next();
  });
  
  // Mock requireFirebaseAuth
  jest.mock('./server/middleware/authMiddleware.js', () => ({
    requireFirebaseAuth: (req, res, next) => next()
  }));

  // Not easy, let's just make a POST request with the actual router mounted
}
