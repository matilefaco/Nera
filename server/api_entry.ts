import { onRequest } from "firebase-functions/v2/https";
import { createServerApp } from "../server.js";

/**
 * Universal backend entry point for Firebase Functions (2nd Gen).
 * This acts as the Cloud Run service in the Firebase project.
 */
export const api = onRequest({
  region: "us-east1",
  memory: "512MiB",
  timeoutSeconds: 60,
  minInstances: 0,
}, async (req, res) => {
  const app = await createServerApp();
  return app(req, res);
});
