import express, { Request, Response } from "express";
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
    const response = {
      status: "ok",
      uptime: getSafeUptime(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV === "production" ? "production" : "dev"
    };
    
    logger.info("HEALTH", "Backend health check requested", { requestId: req.requestId });
    res.set("Cache-Control", "public, max-age=10").json(response);
  } catch (error) {
    logger.error("HEALTH", "Health check failed", { error, requestId: req.requestId });
    res.status(500).json({ status: "error" });
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

router.get("/integrations", (req: Request, res: Response) => {
  try {
    const hasStripe = Boolean(process.env.STRIPE_SECRET_KEY);
    const hasResend = Boolean(process.env.RESEND_API_KEY);
    const hasWhatsapp = Boolean(process.env.Z_API_INSTANCE_ID || process.env.META_ACCESS_TOKEN);
    const hasCalendar = Boolean(process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_SECRET);

    logger.info("HEALTH", "Integrations health check requested", { requestId: req.requestId });
    
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

router.post("/log", express.json(), (req: express.Request, res: express.Response) => {
  logger.error("CRITICAL FRONTEND LOG", req.body);
  res.status(200).json({ ok: true });
});

export default router;