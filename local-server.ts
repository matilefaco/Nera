import { createServerApp } from "./server.ts";

export { createServerApp };

async function start() {
  // Guard: Do not bind to port if running in Firebase/Functions environment
  if (process.env.FUNCTIONS_TARGET || process.env.K_SERVICE || process.env.FIREBASE_CONFIG) {
    console.log("[SERVER] Skipping local listen (Running in cloud environment)");
    return;
  }

  console.log("[DEV SERVER] Initializing Express + Vite...");
  const app = await createServerApp();
  const port = 3000;
  
  app.listen(port, "0.0.0.0", () => {
    console.log(`[DEV SERVER] Running at http://localhost:${port}`);
    console.log(`[DEV SERVER] Health check: http://localhost:${port}/api/health`);
  });
}

start().catch(err => {
  console.error("[DEV SERVER] Critical startup error:", err);
  process.exit(1);
});
