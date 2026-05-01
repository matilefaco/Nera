import { onRequest } from "firebase-functions/v2/https";

let cachedApp: any = null;

async function createExpressApp() {
  if (!cachedApp) {
    const { createServerApp } = await import("../server.js");
    cachedApp = await createServerApp();
  }
  return cachedApp;
}

function getRequestPath(req: any): string {
  return String(req.originalUrl || req.url || "");
}

export const api = onRequest({
  region: "us-east1",
  memory: "512MiB",
  timeoutSeconds: 60,
  minInstances: 0,
  cors: true,
}, async (req, res) => {
  try {
    const requestPath = getRequestPath(req);
    console.log("[API_ENTRY_DIRECT] method:", req.method, "url:", requestPath, "bodyExists:", !!(req as any).body);

    // Hard diagnostic route at the Firebase Function entrypoint.
    // If this still returns HTML, production is not running this exported function.
    if (req.method === "GET" && requestPath.includes("/api/debug/version")) {
      res.set("Cache-Control", "no-store");
      return res.status(200).json({
        version: "booking-debug-v2-entrypoint",
        time: new Date().toISOString(),
        url: requestPath
      });
    }

    // Hard validation for the empty-body booking smoke test, before Express can touch streams.
    if (req.method === "POST" && requestPath.includes("/api/public/create-booking")) {
      const body = (req as any).body || {};
      const hasRequiredPayload = Boolean(
        body.professionalId &&
        body.serviceId &&
        body.date &&
        body.time &&
        body.clientName &&
        body.clientPhone
      );

      if (!hasRequiredPayload) {
        res.set("Cache-Control", "no-store");
        return res.status(400).json({ error: "Dados de agendamento incompletos" });
      }
    }

    const app = await createExpressApp();
    (req as any).body = (req as any).body || {};
    return app(req, res);
  } catch (err: any) {
    console.error("[CRITICAL STARTUP ERROR]", err);
    res.status(500).json({
      error: "Internal Server Error during initialization",
      message: err?.message || String(err)
    });
  }
});
