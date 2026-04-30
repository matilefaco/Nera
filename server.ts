import express from "express";
import path from "path";
import fs from "fs";
import cors from "cors";

export async function createServerApp() {
  // 1. Initial configuration (Move heavy logic here)
  const { config } = await import("dotenv");
  config();

  const firebaseAdmin = await import("./server/firebaseAdmin.js");
  
  const app = express();

  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 200
  }));

  // 2. Immediate Diagnostic Endpoints
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  app.get("/api/public/booking-health", (req, res) => {
    res.json({ 
      ok: true, 
      route: "booking-global", 
      time: new Date().toISOString(),
      env: process.env.NODE_ENV,
      url: req.url
    });
  });

  // 3. Skip express.json for Stripe Webhook
  app.use((req, res, next) => {
    if (req.originalUrl === "/api/plans/webhook") {
      next();
    } else {
      express.json()(req, res, next);
    }
  });

  // 4. Initialize Firebase Admin (Awaited to ensure DB is ready for route handlers)
  try {
    await firebaseAdmin.initFirebase();
    console.log("[SERVER] Firebase Admin initialized.");
  } catch (err) {
    console.error("[SERVER] Failed to initialize Firebase:", err);
  }

  // 5. Registration of API Routes (Consolidated for consistent path resolution in production)
  const apiRouter = express.Router();

  // Specific routers
  apiRouter.use("/slug", (await import("./server/routes/slugRoutes.js")).default);
  apiRouter.use("/profile", (await import("./server/routes/profileRoutes.js")).default);
  apiRouter.use("/plans", (await import("./server/routes/planRoutes.js")).default);
  apiRouter.use("/calendar", (await import("./server/routes/calendarRoutes.js")).default);

  // Generic catch-all routers for remaining endpoints (mounting directly at root of apiRouter)
  apiRouter.use((await import("./server/routes/bookingRoutes.js")).default);
  apiRouter.use((await import("./server/routes/notificationRoutes.js")).default);
  apiRouter.use((await import("./server/routes/analyticsRoutes.js")).default);

  app.use("/api", apiRouter);

  // 6. SSR for Professional Profiles
  app.get("/p/:slug", async (req, res, next) => {
    try {
      const { slug } = req.params;
      const snapshot = await firebaseAdmin.db.collection("users").where("slug", "==", slug).limit(1).get();
      
      if (snapshot.empty) return next();
      
      const prof = snapshot.docs[0].data() as any;
      const indexPath = process.env.NODE_ENV === "production" 
        ? path.join(process.cwd(), "dist", "index.html")
        : path.join(process.cwd(), "index.html");

      if (!fs.existsSync(indexPath)) return next();
      let html = fs.readFileSync(indexPath, "utf-8");

      const title = prof.name || "Profissional Nera";
      const description = prof.bio?.slice(0, 160) || "Agende online";
      const imageUrl = prof.photoUrl || prof.avatar || "https://usenera.com/og-default.png";

      const metaTags = `
        <title>${title}</title>
        <meta name="description" content="${description}" />
        <meta property="og:title" content="${title}" />
        <meta property="og:description" content="${description}" />
        <meta property="og:image" content="${imageUrl}" />
        <meta name="twitter:card" content="summary_large_image" />
      `;

      if (html.includes("</head>")) {
        html = html.replace("</head>", `${metaTags}\n</head>`);
      }
      
      res.setHeader("Content-Type", "text/html");
      return res.send(html);
    } catch (err) {
      console.error("[SSR ERROR]", err);
      return next();
    }
  });

  // 7. Vite/Static serving
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

  // 8. Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(`[CRITICAL ERROR]`, err);
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  });

  return app;
}

// No standalone listen here - moved to local-server.ts
