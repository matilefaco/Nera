import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { bookingRouter } from './server/routes/bookingRoutes.js';
import { planRouter } from './server/routes/planRoutes.js';
import { slugRouter } from './server/routes/slugRoutes.js';
import { analyticsRouter } from './server/routes/analyticsRoutes.js';
import { profileRouter } from './server/routes/profileRoutes.js';
import { calendarRouter } from './server/routes/calendarRoutes.js';
import { notificationRouter } from './server/routes/notificationRoutes.js';
import * as firebaseAdmin from './server/firebaseAdmin.js';

export async function createServerApp() {
  const app = express();

  // 1. Surgical Fix for "stream is not readable"
  // As requested: Middleware that doesn't read the stream, since body might be pre-parsed
  app.use((req: any, res, next) => {
    if (req.body === undefined || req.body === null) {
      req.body = {};
    }
    return next();
  });

  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 200
  }));

  // 2. Immediate Diagnostic Endpoints
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  app.get("/api/diagnostic/firebase", async (req, res) => {
    try {
      const db = firebaseAdmin.getDb();
      const test = await db.collection("system").doc("health").get();
      res.json({ status: "firebase_ok", exists: test.exists });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Initialize Firebase Admin
  try {
    await firebaseAdmin.initFirebase();
  } catch (err) {
    console.error("[CRITICAL] Firebase Admin Init Failed:", err);
  }

  // 4. Routes
  app.use('/api', bookingRouter);
  app.use('/api/plans', planRouter);
  app.use('/api/slug', slugRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/calendar', calendarRouter);
  app.use('/api/notifications', notificationRouter);

  // 5. Serve Static Files (Frontend)
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  // In Cloud Run, dist is usually at the root, same as dist-server's parent
  const distPath = path.resolve(__dirname, '../dist');
  
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    // SPA fallback
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

// Start server if run directly
const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('server.js');

if (isMain) {
  const port = process.env.PORT || 3000;
  createServerApp().then(app => {
    app.listen(port, () => {
      console.log(`[SERVER] Listening on port ${port}`);
    });
  });
}

export default createServerApp;
