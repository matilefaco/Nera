import { onRequest } from "firebase-functions/v2/https";
import { createServerApp } from "../server.js";

/**
 * Universal backend entry point for Firebase Functions (2nd Gen).
 * This acts as the Cloud Run service in the Firebase project.
 * 
 * We use a lazy initialization pattern within the handler to ensure the 'api' 
 * export is immediately visible to the Firebase Functions scanner, avoiding 
 * issues with top-level await during function discovery.
 */
let cachedApp: any = null;

export const api = onRequest({
  memory: "512MiB",
  timeoutSeconds: 60,
  minInstances: 0,
}, async (req: any, res: any) => {
  if (!cachedApp) {
    console.log("[FUNCTIONS] Initializing server app (lazy)...");
    cachedApp = await createServerApp();
  }
  return cachedApp(req, res);
});
