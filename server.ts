import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import { initFirebase } from "./server/firebaseAdmin.ts";
import { setupBackgroundTriggers } from "./server/background.ts";

// Routes
import bookingRoutes from "./server/routes/bookingRoutes.ts";
import notificationRoutes from "./server/routes/notificationRoutes.ts";
import profileRoutes from "./server/routes/profileRoutes.ts";
import planRoutes from "./server/routes/planRoutes.ts";
import analyticsRoutes from "./server/routes/analyticsRoutes.ts";
import calendarRoutes from "./server/routes/calendarRoutes.ts";
import slugRoutes from "./server/routes/slugRoutes.ts";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());

  // Skip express.json for Stripe Webhook to preserve raw body
  app.use((req, res, next) => {
    if (req.originalUrl === "/api/plans/webhook") {
      next();
    } else {
      express.json()(req, res, next);
    }
  });

  // Initialize Firebase and Background Triggers
  await initFirebase();
  setupBackgroundTriggers();

  // API Routes registration
  app.use("/api", bookingRoutes);
  app.use("/api", notificationRoutes);
  app.use("/api/profile", profileRoutes);
  app.use("/api/plans", planRoutes);
  app.use("/api", analyticsRoutes);
  app.use("/api/calendar", calendarRoutes);
  app.use("/api/slug", slugRoutes);

  // Global Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development or Static server for production
  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    const vite = await createServer({
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
