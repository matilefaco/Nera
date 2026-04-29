import { onRequest } from "firebase-functions/v2/https";

/**
 * Universal backend entry point.
 * This acts as both a Firebase Function and a standalone express server for Cloud Run.
 */
let cachedApp: any = null;

async function getApp() {
  if (!cachedApp) {
    console.log("[BOOT] Initializing server app (lazy)...");
    const { createServerApp } = await import("../server.js");
    cachedApp = await createServerApp();
  }
  return cachedApp;
}

// 1. Export for Firebase Functions
export const api = onRequest({
  region: "us-east1",
  memory: "512MiB",
  timeoutSeconds: 60,
  minInstances: 0,
}, async (req: any, res: any) => {
  const app = await getApp();
  return app(req, res);
});

// 2. Standalone listener for Cloud Run
const isMainModule = import.meta.url.startsWith('file:') && 
  (process.argv[1] && (process.argv[1].endsWith('api_entry.js') || process.argv[1].endsWith('api_entry.ts')));

if (isMainModule || process.env.RUN_STANDALONE === 'true') {
  const PORT = Number(process.env.PORT) || 8080;
  console.log(`[BOOT] Environment: PORT=${process.env.PORT}, NODE_ENV=${process.env.NODE_ENV}`);
  console.log(`[BOOT] Standalone mode detected. Starting listener on port ${PORT}...`);
  
  getApp().then(app => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[SERVER] Listening at http://0.0.0.0:${PORT}`);
      console.log(`[SERVER] Ready for traffic. Base path: /`);
    });
  }).catch(err => {
    console.error("CRITICAL BOOT ERROR:", err);
    process.exit(1);
  });
}
