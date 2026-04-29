import { onRequest } from "firebase-functions/v2/https";

/**
 * Universal backend entry point.
 * Optimized for < 1s startup by using lazy initialization.
 */
let cachedApp: any = null;

async function getApp() {
  if (!cachedApp) {
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
  try {
    const app = await getApp();
    return app(req, res);
  } catch (err: any) {
    console.error("[FUNCTION ERROR]", err);
    res.status(500).send("Internal Server Error during initialization");
  }
});

// 2. Standalone listener for Cloud Run
const isStandalone = process.env.RUN_STANDALONE === 'true' || 
  (import.meta.url.startsWith('file:') && process.argv[1]?.includes('api_entry'));

if (isStandalone) {
  const PORT = Number(process.env.PORT) || 8080;
  console.log(`[BOOT] Standalone mode. Starting listener on port ${PORT}...`);
  
  getApp().then(app => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[SERVER] Ready at http://0.0.0.0:${PORT}`);
    });
  }).catch(err => {
    console.error("CRITICAL BOOT ERROR:", err);
    process.exit(1);
  });
}
