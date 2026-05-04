import { onRequest } from "firebase-functions/v2/https";
/**
 * Universal backend entry point for Firebase Functions v2 / Cloud Run.
 * Optimized for < 1s startup via lazy initialization.
 */
let cachedApp = null;
/**
 * Lazy initialization of the Express app.
 * This prevents heavy imports from blocking the overall process startup.
 */
async function createExpressApp() {
    if (!cachedApp) {
        // We import dynamically to keep the initial script evaluation instantaneous
        const { createServerApp } = await import("../server.js");
        cachedApp = await createServerApp();
    }
    return cachedApp;
}
/**
 * Primary API Handler.
 * Firebase Functions v2 and Cloud Run (via Functions Framework) handle the HTTP port binding.
 */
export const api = onRequest({
    region: "us-east1",
    memory: "512MiB",
    timeoutSeconds: 60,
    minInstances: 0,
    cors: true,
}, async (req, res) => {
    try {
        const app = await createExpressApp();
        return app(req, res);
    }
    catch (err) {
        console.error("[CRITICAL STARTUP ERROR]", err);
        res.status(500).send("Internal Server Error during initialization");
    }
});
// NO app.listen() or server.listen() here.
// Process startup is instantaneous (< 100ms) because heavy logic is inside createExpressApp().
