import express from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import dotenv from "dotenv";
import { initFirebase, db } from "./server/firebaseAdmin.js";
import { setupBackgroundTriggers } from "./server/background.js";

// Routes
import bookingRoutes from "./server/routes/bookingRoutes.js";
import notificationRoutes from "./server/routes/notificationRoutes.js";
import profileRoutes from "./server/routes/profileRoutes.js";
import planRoutes from "./server/routes/planRoutes.js";
import analyticsRoutes from "./server/routes/analyticsRoutes.js";
import calendarRoutes from "./server/routes/calendarRoutes.js";
import slugRoutes from "./server/routes/slugRoutes.js";

dotenv.config();

export async function createServerApp() {
  const app = express();
  const PORT = 3000;

  app.use(cors());

  // Global Health Check (Early to pass Cloud Run health probes)
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Skip express.json for Stripe Webhook to preserve raw body
  app.use((req, res, next) => {
    if (req.originalUrl === "/api/plans/webhook") {
      next();
    } else {
      express.json()(req, res, next);
    }
  });

  // Initialize Firebase and Background Triggers (Asyncly to not block startup)
  initFirebase().then(() => {
    setupBackgroundTriggers();
  }).catch(err => {
    console.error("[SERVER] Failed to initialize Firebase/Background:", err);
  });

  // API Routes registration
  app.use("/api", bookingRoutes);
  app.use("/api", notificationRoutes);
  app.use("/api/profile", profileRoutes);
  app.use("/api/plans", planRoutes);
  app.use("/api", analyticsRoutes);
  app.use("/api/calendar", calendarRoutes);
  app.use("/api/slug", slugRoutes);

  // Pre-load the index.html template for SSR performance
  // In production, read from dist/index.html. In dev, from the root index.html.
  const indexPath = process.env.NODE_ENV === "production" 
    ? path.join(process.cwd(), "dist", "index.html")
    : path.join(process.cwd(), "index.html");

  let cachedIndexHtml = "";
  try {
    if (fs.existsSync(indexPath)) {
      cachedIndexHtml = fs.readFileSync(indexPath, "utf-8");
      console.log(`[SSR] index.html template loaded in memory from ${indexPath}`);
    } else {
      console.warn(`[SSR] index.html not found at ${indexPath} during startup. Will retry on first request.`);
    }
  } catch (err) {
    console.error(`[SSR] Failed to read index.html during startup:`, err);
  }

  // Helper to fetch profile and prepare OG data
  async function getProfileOgData(slug: string) {
    const snapshot = await db.collection("users").where("slug", "==", slug).limit(1).get();
    if (snapshot.empty) return null;
    
    const prof = snapshot.docs[0].data() as any;
    
    const escapeHtml = (unsafe: string) => {
      return (unsafe || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    const safeName = escapeHtml(prof.name || "Profissional");
    const safeCategory = escapeHtml(prof.category || prof.specialty || "Profissional Nera");
    
    const title = prof.ogTitle ? escapeHtml(prof.ogTitle) : `${safeName} | ${safeCategory}`;
    const description = prof.ogDescription 
      ? escapeHtml(prof.ogDescription) 
      : escapeHtml(prof.bio?.slice(0, 160) || `Agende um horário com ${prof.name} pelo Nera.`);
    
    const imageUrl = prof.ogImageUrl || prof.photoUrl || prof.avatar || "https://usenera.com/og-default.png";
    const profileUrl = `https://usenera.com/p/${prof.slug}`;

    return { 
      prof, 
      title, 
      description, 
      imageUrl, 
      profileUrl,
      safeName,
      safeCategory
    };
  }

  // SSR for Professional Profiles (SEO/Social Previews)
  app.get("/debug-og/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const data = await getProfileOgData(slug);
      
      // Sanitize profile for debugging (remove PII)
      const sanitizedProf = data ? {
        name: data.prof.name,
        slug: data.prof.slug,
        category: data.prof.category,
        specialty: data.prof.specialty,
        bio: data.prof.bio,
        headline: data.prof.headline,
        avatar: data.prof.avatar,
        photoUrl: data.prof.photoUrl,
        ogTitle: data.prof.ogTitle,
        ogDescription: data.prof.ogDescription,
        ogImageUrl: data.prof.ogImageUrl,
        ogCtaText: data.prof.ogCtaText,
        ogUpdatedAt: data.prof.ogUpdatedAt,
        instagram: data.prof.instagram,
        city: data.prof.city,
        neighborhood: data.prof.neighborhood
      } : null;

      const debugInfo = {
        slug,
        found: !!data,
        rawUser: sanitizedProf,
        finalTags: data ? {
          title: data.title,
          imageUrl: data.imageUrl,
          description: data.description,
          profileUrl: data.profileUrl,
          ctaText: data.prof?.ogCtaText
        } : null,
        env: {
          NODE_ENV: process.env.NODE_ENV,
          PROJECT_ID: process.env.GOOGLE_CLOUD_PROJECT
        },
        userAgent: req.headers["user-agent"],
        serverTime: new Date().toISOString()
      };

      res.setHeader("Content-Type", "text/html");
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Nera Debug OG - ${slug}</title>
          <style>body { font-family: monospace; background: #1a1a1a; color: #00ff00; padding: 20px; }</style>
        </head>
        <body>
          <h1>Nera Debug OG</h1>
          <pre>${JSON.stringify(debugInfo, null, 2)}</pre>
          <hr />
          <h3>Social Tags</h3>
          <p>Title: ${data?.title}</p>
          <p>URL: ${data?.profileUrl}</p>
          <img src="${data?.imageUrl}" style="max-width: 400px; border: 1px solid #333;" />
        </body>
        </html>
      `);
    } catch (err: any) {
      res.status(500).send(`<h1>Server Error</h1><pre>${err.message}\n${err.stack}</pre>`);
    }
  });

  app.get("/p/:slug", async (req, res, next) => {
    try {
      const ua = req.headers["user-agent"] || "";
      const isCrawler = /facebookexternalhit|Twitterbot|WhatsApp|TelegramBot|LinkedInBot|Slackbot|pinterest|Googlebot/i.test(ua);

      console.log("SSR PROFILE ROUTE HIT", {
        slug: req.params.slug,
        isCrawler,
        userAgent: ua,
        env: process.env.NODE_ENV,
        url: req.url
      });

      const { slug } = req.params;
      const data = await getProfileOgData(slug);

      if (!data) {
        console.log("SSR PROFILE: User not found in Firestore", slug);
        return next();
      }

      let html = cachedIndexHtml;

      // Lazy load if cache is empty (e.g. build finished after server started)
      if (!html) {
        if (fs.existsSync(indexPath)) {
          html = fs.readFileSync(indexPath, "utf-8");
          cachedIndexHtml = html; // Cache it for subsequent requests
        }
      }

      if (!html) {
        console.error("SSR PROFILE: index.html template still not available");
        return next();
      }

      const metaTags = `
  <!-- SSR META TAGS START -->
  <title>${data.title}</title>
  <meta name="description" content="${data.description}" />
  <meta property="og:title" content="${data.title}" />
  <meta property="og:description" content="${data.description}" />
  <meta property="og:image" content="${data.imageUrl}" />
  <meta property="og:image:secure_url" content="${data.imageUrl}" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${data.profileUrl}" />
  <meta property="og:type" content="profile" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="${data.imageUrl}" />
  <!-- SSR META TAGS END -->`;

      // Inject before </head> to ensure it's within the head section
      if (html.includes("</head>")) {
        html = html.replace("</head>", `${metaTags}\n</head>`);
      } else {
        html = metaTags + html;
      }

      console.log("SSR PROFILE SUCCESS", {
        slug,
        env: process.env.NODE_ENV,
        title: data.title
      });

      res.setHeader("Content-Type", "text/html");
      return res.send(html);
    } catch (err) {
      console.error("[SSR ERROR]", err);
      return next();
    }
  });

  // Global Health Check
  // Already registered above

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

  return app;
}

// No standalone listen here - moved to local-server.ts
