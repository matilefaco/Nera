import { createServerApp } from "./server.js";

const PORT = Number(process.env.PORT) || 3000;

createServerApp().then(app => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Standalone server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error("CRITICAL SERVER STARTUP ERROR:", err);
  process.exit(1);
});
