process.env.NODE_ENV = "production";

import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

const NVIDIA_API_KEY = defineSecret("NVIDIA_API_KEY");

/**
 * Universal backend entry point for Firebase Functions v2 / Cloud Run.
 */
let cachedApp: any = null;

async function createExpressApp() {
  if (!cachedApp) {
    try {
      const module = await import("./server.cjs");
      // CJS/ESM Interop: try direct named export, then default.named, then default (if it were the function itself)
      const createServerApp = module.createServerApp || (module.default && module.default.createServerApp) || module.default;

      if (typeof createServerApp !== "function") {
        console.error("[CRITICAL ERROR] createServerApp is not a function", { 
          moduleKeys: Object.keys(module),
          hasDefault: !!module.default,
          defaultKeys: module.default ? Object.keys(module.default) : []
        });
        throw new Error("Invalid server bundle: createServerApp is not a function in ./server.cjs");
      }

      cachedApp = await createServerApp();
    } catch (err: any) {
      console.error("[BOOT ERROR] Failed to load or initialize server app", {
        message: err.message,
        stack: err.stack
      });
      throw err;
    }
  }
  return cachedApp;
}

/**
 * Primary API Handler.
 * Firebase Functions v2 and Cloud Run (via Functions Framework) handle the HTTP port binding.
 */
export const api = onRequest(
  {
    region: "us-east1",
    memory: "512MiB",
    timeoutSeconds: 60,
    minInstances: 0,
    cors: false,
    secrets: [
      NVIDIA_API_KEY,
      "RESEND_API_KEY",
      "EMAIL_FROM",
      "EMAIL_REPLY_TO",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "STRIPE_PRICE_ESSENCIAL",
      "STRIPE_PRICE_PRO",
      "STRIPE_PORTAL_CONFIGURATION_ID"
    ],
  },
  async (req: any, res: any) => {
    const isProdEnv = process.env.GCLOUD_PROJECT && process.env.FUNCTIONS_EMULATOR !== "true";
    const isHostProd = req.hostname && req.hostname.includes("usenera.com");

    if (isProdEnv || isHostProd) {
      const blockedDebugTerms = [
        "test-email",
        "test-whatsapp",
        "test-ai-service-description",
        "fix-duplicate-slots",
        "run-confirmation-email"
      ];
      const rawUrl = String(req.url || req.originalUrl || "");
      const isBlockedDebugRoute = blockedDebugTerms.some((term) => rawUrl.includes(term));
      
      if (isBlockedDebugRoute) {
        return res.status(404).send("Not Found");
      }
    }

    try {
      const app = await createExpressApp();
      return app(req, res);
    } catch (err: any) {
      console.error("[CRITICAL STARTUP ERROR]", {
        message: err.message,
        stack: err.stack,
        code: err.code
      });
      res.status(500).send(`Internal Server Error during initialization: ${err.message}`);
    }
  }
);

// NO app.listen() or server.listen() here.
// Process startup is instantaneous (< 100ms) because heavy logic is inside createExpressApp().
