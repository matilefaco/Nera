import { onRequest } from "firebase-functions/v2/https";

let cachedApp: any = null;

async function createExpressApp() {
  if (!cachedApp) {
    const { createServerApp } = await import("../server.js");
    cachedApp = await createServerApp();
  }
  return cachedApp;
}

export const api = onRequest({
  region: "us-east1",
  memory: "512MiB",
  timeoutSeconds: 60,
  minInstances: 0,
  cors: true,
}, async (req, res) => {
  try {
    const app = await createExpressApp();
    console.log("[API_ENTRY] method:", req.method, "url:", req.url, "bodyExists:", !!(req as any).body);
    (req as any).body = (req as any).body || {};
    return app(req, res);
  } catch (err) {
    console.error("[CRITICAL STARTUP ERROR]", err);
    res.status(500).json({ error: "Internal Server Error during initialization" });
  }
});
