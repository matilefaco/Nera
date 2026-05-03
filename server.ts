import express from "express";
import path from "path";
import fs from "fs";
import cors from "cors";

const PUBLIC_SITE_URL = "https://usenera.com";
const DEFAULT_OG_IMAGE = `${PUBLIC_SITE_URL}/og-default.png`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toAbsoluteHttpsUrl(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  try {
    const parsed = new URL(trimmed, PUBLIC_SITE_URL);
    if (parsed.protocol === "http:") parsed.protocol = "https:";
    return parsed.toString();
  } catch {
    return null;
  }
}

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
      const db = firebaseAdmin.getDb();
      if (!db) return next();
      
      const snapshot = await db.collection("users").where("slug", "==", slug).limit(1).get();
      
      if (snapshot.empty) return next();
      
      const prof = snapshot.docs[0].data() as any;
      const indexPath = process.env.NODE_ENV === "production" 
        ? path.join(process.cwd(), "dist", "index.html")
        : path.join(process.cwd(), "index.html");

      if (!fs.existsSync(indexPath)) return next();
      let html = fs.readFileSync(indexPath, "utf-8");

      const canonicalUrl = `${PUBLIC_SITE_URL}/p/${encodeURIComponent(slug)}`;
      const rawTitle = (prof.ogTitle || prof.shareTitle || (prof.name ? `${prof.name} | Agendamento Premium` : "") || "Nera | Vitrine & Agendamento Premium").toString().trim();
      const rawDescription = (prof.ogDescription || prof.shortDescription || prof.headline || prof.bio || "Agende online com praticidade e elegância.").toString().trim();
      const rawImage = prof.ogImageUrl || prof.shareImageUrl || prof.photoUrl || prof.avatar;

      const title = escapeHtml(rawTitle.slice(0, 120) || "Nera | Vitrine & Agendamento Premium");
      const description = escapeHtml(rawDescription.slice(0, 160) || "Agende online com praticidade e elegância.");
      const imageUrl = escapeHtml(toAbsoluteHttpsUrl(rawImage) || DEFAULT_OG_IMAGE);

      const metaTags = `
        <title>${title}</title>
        <meta name="description" content="${description}" />
        <link rel="canonical" href="${canonicalUrl}" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="${title}" />
        <meta property="og:description" content="${description}" />
        <meta property="og:image" content="${imageUrl}" />
        <meta property="og:url" content="${canonicalUrl}" />
        <meta property="og:site_name" content="Nera" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${title}" />
        <meta name="twitter:description" content="${description}" />
        <meta name="twitter:image" content="${imageUrl}" />
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
