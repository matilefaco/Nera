import { createServerApp } from "./server.js";

console.log("Starting server...");

const start = async () => {
  try {
    const PORT = process.env.PORT || 8080;
    const app = await createServerApp();
    
    app.listen(PORT, () => {
      console.log("Server running on port", PORT);
    });
  } catch (err) {
    console.error("CRITICAL SERVER STARTUP ERROR:", err);
    process.exit(1);
  }
};

start();
