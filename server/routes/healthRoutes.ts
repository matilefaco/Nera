import express, { Request, Response } from "express";
import admin from "firebase-admin";
import { logger } from "../utils/logger.js";
import { getDb } from "../firebaseAdmin.js";

const router = express.Router();

function getSafeUptime(): string {
  const uptimeSeconds = process.uptime();
  const days = Math.floor(uptimeSeconds / (3600 * 24));
  const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

router.get("/", (req: Request, res: Response) => {
  try {
    const memory = process.memoryUsage();
    const memoryUsage = {
      rss: `${Math.round(memory.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(memory.external / 1024 / 1024)} MB`,
    };

    let firestoreStatus = "degraded";
    if (getDb()) {
      firestoreStatus = "ok";
    }

    const response = {
      ok: true,
      timestamp: new Date().toISOString(),
      uptime: getSafeUptime(),
      environment: process.env.NODE_ENV === "production" ? "production" : "dev",
      version: process.env.npm_package_version || "unknown",
      firestore: firestoreStatus,
      memoryUsage
    };
    
    logger.info("HEALTH", "Backend health check requested", { requestId: req.requestId });
    res.set("Cache-Control", "public, max-age=10").json(response);
  } catch (error) {
    logger.error("HEALTH", "Health check failed", { error, requestId: req.requestId });
    res.status(500).json({ ok: false, error: "Health check failed" });
  }
});

router.get("/db", (req: Request, res: Response) => {
  try {
    const db = getDb();
    
    if (db) {
      logger.info("HEALTH", "Database health check requested", { requestId: req.requestId });
      res.set("Cache-Control", "public, max-age=10").json({ status: "ok" });
    } else {
      logger.warn("HEALTH", "Database health check degraded (not initialized)", { requestId: req.requestId });
      res.set("Cache-Control", "public, max-age=10").json({ status: "degraded" });
    }
  } catch (error) {
    logger.error("HEALTH", "Database health check failed", { error, requestId: req.requestId });
    res.status(500).json({ status: "error" });
  }
});

router.get("/integrations", async (req: Request, res: Response) => {
  try {
    // Check for admin status to decide whether to show details
    let isAdmin = false;
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        
        // Admin if has claim or role in Firestore
        if (decodedToken.admin === true) {
          isAdmin = true;
        } else {
          const db = getDb();
          const userDoc = await db.collection('users').doc(decodedToken.uid).get();
          if (userDoc.exists && userDoc.data()?.role === 'admin') {
            isAdmin = true;
          }
        }
      } catch (e) {
        // Auth failure - treat as public
      }
    }

    if (!isAdmin) {
      logger.info("HEALTH", "Integrations health check requested (Public)", { requestId: req.requestId });
      return res.json({ status: "ok" });
    }

    const hasStripe = Boolean(process.env.STRIPE_SECRET_KEY);
    const hasResend = Boolean(process.env.RESEND_API_KEY);
    const hasWhatsapp = Boolean(process.env.Z_API_INSTANCE_ID || process.env.META_ACCESS_TOKEN);
    const hasCalendar = Boolean(process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_SECRET);

    logger.info("HEALTH", "Integrations health check requested (Admin)", { requestId: req.requestId });
    
    res.json({
      stripe: hasStripe,
      resend: hasResend,
      whatsapp: hasWhatsapp,
      calendar: hasCalendar
    });
  } catch (error) {
    logger.error("HEALTH", "Integrations health check failed", { error, requestId: req.requestId });
    res.status(500).json({ status: "error" });
  }
});

router.get("/zapi-check", (req: Request, res: Response) => {
  res.json({
    hasInstanceId: !!process.env.ZAPI_INSTANCE_ID,
    hasInstanceToken: !!process.env.ZAPI_INSTANCE_TOKEN,
    hasZapiToken: !!process.env.ZAPI_TOKEN,
    env: process.env.NODE_ENV,
    isCloudRun: !!process.env.K_SERVICE,
    isFirebaseFunctions: !!process.env.FUNCTION_TARGET
  });
});

router.post("/log", express.json(), (req: express.Request, res: express.Response) => {
  logger.error("CRITICAL FRONTEND LOG", req.body);
  res.status(200).json({ ok: true });
});

export default router;