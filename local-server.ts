import { createServerApp } from "./server.ts";

async function start() {
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
