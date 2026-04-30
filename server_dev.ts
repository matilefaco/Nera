import { createServerApp } from "./server.js";

async function startDevServer() {
  console.log("[DevServer] Starting...");
  try {
    const app = await createServerApp();
    const port = 3000;
    app.listen(port, "0.0.0.0", () => {
      console.log(`[DevServer] Express app listening on http://0.0.0.0:${port}`);
    });
  } catch (error) {
    console.error("[DevServer] Critical error starting Express:", error);
    process.exit(1);
  }
}

startDevServer();
