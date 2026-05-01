import express from 'express';
import cors from 'cors';
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

  return app;
}

// Development local runner
if (process.env.NODE_ENV !== 'production' && import.meta.url === `file://${process.argv[1]}`) {
  const port = 3000;
  createServerApp().then(app => {
    app.listen(port, () => {
      console.log(`[LOCAL DEV] Server listening on port ${port}`);
    });
  });
}

export default createServerApp;
