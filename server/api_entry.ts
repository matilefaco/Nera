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

function isPlainObject(value: any) {
  return value && typeof value === "object" && !Buffer.isBuffer(value) && !Array.isArray(value);
}

function parseFirebaseBody(req: any) {
  if (isPlainObject(req.body) && Object.keys(req.body).length > 0) {
    return req.body;
  }

  const rawBody = req.rawBody;
  if (!rawBody) {
    return isPlainObject(req.body) ? req.body : {};
  }

  try {
    const rawText = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody);
    if (!rawText.trim()) return {};
    return JSON.parse(rawText);
  } catch (err: any) {
    console.error("[API_ENTRY_BODY_PARSE_ERROR]", err?.message || err);
    return isPlainObject(req.body) ? req.body : {};
  }
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
    (req as any).body = parseFirebaseBody(req as any);

    console.log("[API_ENTRY_DIRECT] method:", req.method, "url:", requestPath, "bodyKeys:", Object.keys((req as any).body || {}));

    if (req.method === "GET" && requestPath.includes("/api/debug/version")) {
      res.set("Cache-Control", "no-store");
      return res.status(200).json({
        version: "booking-debug-v3-rawbody",
        time: new Date().toISOString(),
        url: requestPath
      });
    }

    const app = await createExpressApp();
    return app(req, res);
  } catch (err: any) {
    console.error("[CRITICAL STARTUP ERROR]", err);
    res.status(500).json({
      error: "Internal Server Error during initialization",
      message: err?.message || String(err)
    });
  }
});
