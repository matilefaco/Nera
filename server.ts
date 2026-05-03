import express from "express";
import path from "path";
import fs from "fs";
import cors from "cors";

const PUBLIC_SITE_URL = "https://usenera.com";
const DEFAULT_OG_TITLE = "Nera | Vitrine & Agendamento Premium";
const DEFAULT_OG_DESCRIPTION = "Agende online com praticidade e elegância.";
const DEFAULT_OG_IMAGE = `${PUBLIC_SITE_URL}/og-default.png`;

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}

function toAbsoluteHttpsUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return DEFAULT_OG_IMAGE;

  const raw = value.trim();
  if (raw.startsWith("https://")) return raw;
  if (raw.startsWith("http://")) return raw.replace(/^http:\/\//, "https://");
  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("/")) return `${PUBLIC_SITE_URL}${raw}`;

  return DEFAULT_OG_IMAGE;
}

function buildProfileMeta(slug: string, profile?: any) {
  const canonicalUrl = `${PUBLIC_SITE_URL}/p/${encodeURIComponent(slug)}`;
  const professionalName = firstText(profile?.name, profile?.displayName);

  const title = firstText(
    profile?.ogTitle,
    profile?.shareTitle,
    professionalName ? `${professionalName} | Agendamento Premium` : "",
    DEFAULT_OG_TITLE
  );

  const description = firstText(
    profile?.ogDescription,
    profile?.shareDescription,
    profile?.shortDescription,
    profile?.headline,
    profile?.bio,
    DEFAULT_OG_DESCRIPTION
  ).slice(0, 180);

  const image = toAbsoluteHttpsUrl(
    firstText(profile?.ogImageUrl, profile?.shareImageUrl, profile?.photoUrl, profile?.avatarUrl, profile?.avatar)
  );

  return { canonicalUrl, title, description, image };
}

async function findProfileForSlug(db: any, slug: string) {
  const byUserSlug = await db.collection("users").where("slug", "==", slug).limit(1).get();
  if (!byUserSlug.empty) return byUserSlug.docs[0].data();

  const slugDoc = await db.collection("slugs").doc(slug).get();
  if (!slugDoc.exists) return null;

  const slugData = slugDoc.data() || {};
  const uid = firstText(slugData.uid, slugData.userId, slugData.professionalId, slugData.ownerId);
  if (!uid) return null;

  const userDoc = await db.collection("users").doc(uid).get();
  return userDoc.exists ? userDoc.data() : null;
}

function injectProfileMeta(html: string, meta: ReturnType<typeof buildProfileMeta>) {
  const metaTags = `
    <title>${escapeHtml(meta.title)}</title>
    <meta name="description" content="${escapeHtml(meta.description)}" />
    <link rel="canonical" href="${escapeHtml(meta.canonicalUrl)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Nera" />
    <meta property="og:title" content="${escapeHtml(meta.title)}" />
    <meta property="og:description" content="${escapeHtml(meta.description)}" />
    <meta property="og:image" content="${escapeHtml(meta.image)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(meta.image)}" />
    <meta property="og:url" content="${escapeHtml(meta.canonicalUrl)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(meta.title)}" />
    <meta name="twitter:description" content="${escapeHtml(meta.description)}" />
    <meta name="twitter:image" content="${escapeHtml(meta.image)}" />
  `;

  let nextHtml = html
    .replace(/<title>.*?<\/title>/is, "")
    .replace(/<meta\s+name=["']description["'][^>]*>/gi, "")
    .replace(/<link\s+rel=["']canonical["'][^>]*>/gi, "")
    .replace(/<meta\s+(?:property|name)=["'](?:og:[^"']+|twitter:[^"']+)["'][^>]*>/gi, "");

  return nextHtml.includes("</head>")
    ? nextHtml.replace("</head>", `${metaTags}\n</head>`)
    : `${metaTags}\n${nextHtml}`;
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
  app.get("/p/:slug", async (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.setHeader("Firebase-Hosting-Cache-Control", "no-store");
    res.setHeader("Accept-Ranges", "none");

    const { slug } = req.params;
    const indexPath = process.env.NODE_ENV === "production" 
      ? path.join(process.cwd(), "dist", "index.html")
      : path.join(process.cwd(), "index.html");

    if (!fs.existsSync(indexPath)) {
      return res.status(500).send("Profile page template unavailable");
    }

    let profile: any = null;
    try {
      const db = firebaseAdmin.getDb();
      if (db) profile = await findProfileForSlug(db, slug);
    } catch (err) {
      console.warn("[OG PROFILE] Firestore lookup failed; serving fallback OG", { slug, error: err instanceof Error ? err.message : String(err) });
    }

    const meta = buildProfileMeta(slug, profile);
    const html = injectProfileMeta(fs.readFileSync(indexPath, "utf-8"), meta);

    console.log("[OG PROFILE]", slug, {
      title: meta.title,
      description: meta.description,
      image: meta.image,
      url: meta.canonicalUrl,
      hasProfile: Boolean(profile),
    });

    res.status(200);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(html);
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
