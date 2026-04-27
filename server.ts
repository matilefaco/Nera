import express from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import dotenv from "dotenv";
import { initFirebase, db } from "./server/firebaseAdmin";
import { setupBackgroundTriggers } from "./server/background";

// Routes
import bookingRoutes from "./server/routes/bookingRoutes";
import notificationRoutes from "./server/routes/notificationRoutes";
import profileRoutes from "./server/routes/profileRoutes";
import planRoutes from "./server/routes/planRoutes";
import analyticsRoutes from "./server/routes/analyticsRoutes";
import calendarRoutes from "./server/routes/calendarRoutes";
import slugRoutes from "./server/routes/slugRoutes";

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

  // SSR for Professional Profiles (SEO/Social Previews)
  app.get("/debug-og/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const snapshot = await db.collection("users").where("slug", "==", slug).limit(1).get();

      const prof = snapshot.empty ? null : snapshot.docs[0].data();
      const imageUrl = prof?.avatar || "https://usenera.com/og-default.png";
      const profileUrl = `https://usenera.com/p/${slug}`;
      const title = prof ? `${prof.name} | ${prof.specialty || "Profissional Nera"}` : "User Not Found";
      
      const debugInfo = {
        slug,
        found: !!prof,
        imageUrl,
        profileUrl,
        title,
        env: {
          NODE_ENV: process.env.NODE_ENV,
          K_SERVICE: process.env.K_SERVICE,
          K_REVISION: process.env.K_REVISION,
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
          <p>Title: ${title}</p>
          <p>URL: ${profileUrl}</p>
          <img src="${imageUrl}" style="max-width: 400px; border: 1px solid #333;" />
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

      // In production, we always serve the tags to ensure preview worked.
      if (!isCrawler && process.env.NODE_ENV !== "production") {
        return next();
      }

      const { slug } = req.params;
      const snapshot = await db.collection("users").where("slug", "==", slug).limit(1).get();

      if (snapshot.empty) {
        console.log("SSR PROFILE: User not found in Firestore", slug);
        return next();
      }

      const prof = snapshot.docs[0].data();
      
      const escapeHtml = (unsafe: string) => {
        return (unsafe || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      };

      const safeName = escapeHtml(prof.name || "Profissional");
      const safeSpecialty = escapeHtml(prof.specialty || "Profissional Nera");
      const title = `${safeName} | ${safeSpecialty}`;
      const description = escapeHtml(prof.bio?.slice(0, 160) || `Agende um horário com ${prof.name} pelo Nera.`);
      
      const imageUrl = prof.avatar || "https://usenera.com/og-default.png";
      const profileUrl = `https://usenera.com/p/${prof.slug}`;

      // In production, read from dist/index.html. In dev, from the root index.html.
      const indexPath = process.env.NODE_ENV === "production" 
        ? path.join(process.cwd(), "dist", "index.html")
        : path.join(process.cwd(), "index.html");

      console.log("SSR PROFILE: Attempting to read index.html", { indexPath, exists: fs.existsSync(indexPath) });

      if (!fs.existsSync(indexPath)) {
        console.error("SSR PROFILE: index.html not found at", indexPath);
        return next();
      }

      let html = fs.readFileSync(indexPath, "utf-8");

      const metaTags = `
  <!-- SSR META TAGS START -->
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:secure_url" content="${imageUrl}" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${profileUrl}" />
  <meta property="og:type" content="profile" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="${imageUrl}" />
  <!-- SSR META TAGS END -->`;

      // Inject before </head> to ensure it's within the head section
      if (html.includes("</head>")) {
        html = html.replace("</head>", `${metaTags}\n</head>`);
      } else {
        console.warn("SSR PROFILE: </head> tag not found, appending to beginning");
        html = metaTags + html;
      }

      console.log("SSR PROFILE SUCCESS", {
        slug,
        env: process.env.NODE_ENV,
        hasOgImage: html.includes("og:image"),
        title,
        indexPath
      });

      res.setHeader("Content-Type", "text/html");
      return res.send(html);
    } catch (err) {
      console.error("[SSR ERROR]", err);
      return next();
    }
  });

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
