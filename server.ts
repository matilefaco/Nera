import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  /**
   * Notification Endpoint
   * Handles sending emails and (placeholder) WhatsApp messages.
   * In a real production app, this would use Resend/SendGrid and Twilio/Meta API.
   */
  app.post("/api/notify", async (req, res) => {
    const { type, payload } = req.body;
    
    console.log(`[Notification Service] Processing ${type}...`);
    console.log(`[Notification Service] Payload:`, JSON.stringify(payload, null, 2));

    // MOCK IMPLEMENTATION
    // In a real scenario, you would use:
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({ ... });
    
    // For now, we simulate the delay and log the "sent" message
    await new Promise(resolve => setTimeout(resolve, 500));

    res.json({ 
      success: true, 
      message: `Notification of type ${type} processed successfully.`,
      channel: "Email & WhatsApp (Simulated)"
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
