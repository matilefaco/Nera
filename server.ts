import express from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import { logger } from "./server/utils/logger.js";
import { isNonPublicProfile } from "./server/utils/qualityFilter.js";
import { formatSpecialtyLabel, getServiceLocationCopy } from "./src/lib/copy.js";

declare module "express-serve-static-core" {
  interface Request {
    requestId?: string;
  }
}

const allowedOrigins = [
  "https://usenera.com",
  "https://www.usenera.com",
  "https://ai-studio-applet-webapp-bb725.web.app",
  "https://ai-studio-applet-webapp-bb725.firebaseapp.com"
];

function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true; // server-to-server, Stripe, curl, bots, SSR

  const envOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(o => o.trim())
    .filter(Boolean);

  if (process.env.APP_URL) envOrigins.push(process.env.APP_URL);
  if (process.env.VITE_APP_URL) envOrigins.push(process.env.VITE_APP_URL);

  if (allowedOrigins.includes(origin) || envOrigins.includes(origin)) return true;

  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  
  if (process.env.CLOUD_RUN_PUBLIC_URL && origin === process.env.CLOUD_RUN_PUBLIC_URL) return true;
  
  const isAiStudioPreviewOrigin = /^https:\/\/ais-(dev|pre)-[a-z0-9-]+\.run\.app$/.test(origin);
  if (isAiStudioPreviewOrigin) return true;

  return false;
}

export async function createServerApp() {
  // slug check deploy sync - forced redeploy
  // 1. Initial configuration (Move heavy logic here)
  const { config } = await import("dotenv");
  config();

  const firebaseAdmin = await import("./server/firebaseAdmin.js");
  const { requestIdMiddleware } = await import("./server/middleware/requestId.js");
  const { 
    publicLookupLimiter, 
    bookingLimiter, 
    analyticsLimiter 
  } = await import("./server/middleware/rateLimiter.js");
  
  const app = express();

  // Trust proxy for rate limiting
  app.set("trust proxy", 1);
  
  app.use(requestIdMiddleware);

  app.use(cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      logger.warn("CORS", "Blocked origin via CORS", { meta: { origin } });
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 200
  }));

  // Global protection for diagnostic routes
  app.use((req, res, next) => {
    const isProdEnv = process.env.GCLOUD_PROJECT && process.env.FUNCTIONS_EMULATOR !== "true";
    const isHostProd = req.hostname && req.hostname.includes("usenera.com");
    
    if (isProdEnv || isHostProd) {
      const blockedTerms = [
        "test-email",
        "test-whatsapp",
        "fix-duplicate-slots",
        "run-confirmation-email",
        "test-ai-service-description"
      ];
      if (blockedTerms.some(term => req.path.includes(term))) {
        return res.status(404).send("Not Found");
      }
    }
    next();
  });

  // 3. Body Parsing Middleware
  // Firebase Functions v2 automatically parses the body into req.body and req.rawBody.
  // To prevent 'stream is not readable' errors, we mock '_body = true' so express.json skips reading the stream.
  app.use((req, res, next) => {
    const isFirebaseParser = (req as any).rawBody !== undefined;
    
    if (isFirebaseParser) {
      (req as any)._body = true;
    }

    if (req.originalUrl.includes("/api/plans/webhook") || req.path.includes("/api/plans/webhook")) {
      express.raw({ type: "application/json" })(req, res, next);
    } else {
      express.json({ limit: '10mb' })(req, res, next);
    }
  });

  // 4. Initialize Firebase Admin (Awaited to ensure DB is ready for route handlers)
  try {
    await firebaseAdmin.initFirebase();
    logger.info("SERVER", "Firebase Admin initialized");
  } catch (err) {
    logger.error("SERVER", "Failed to initialize Firebase", { error: err });
  }

  // 5. Registration of API Routes (Consolidated for consistent path resolution in production)
  const apiRouter = express.Router();

  // Specific routers
  let routes: any[] = [];
  try {
    routes = await Promise.all([
      import("./server/routes/authRoutes.js"),
      import("./server/routes/aiRoutes.js"),
      import("./server/routes/slugRoutes.js"),
      import("./server/routes/healthRoutes.js"),
      import("./server/routes/profileRoutes.js"),
      import("./server/routes/planRoutes.js"),
      import("./server/routes/calendarRoutes.js"),
      import("./server/routes/bookingRoutes.js"),
      import("./server/routes/notificationRoutes.js"),
      import("./server/routes/analyticsRoutes.js")
    ]);
  } catch (routeErr: any) {
    logger.error("SERVER", "Failed to import one or more routes", { error: routeErr.message, stack: routeErr.stack });
    throw routeErr;
  }

  const [
    authRoutes,
    aiRoutes,
    slugRoutes,
    healthRoutes,
    profileRoutes,
    planRoutes,
    calendarRoutes,
    bookingRoutes,
    notificationRoutes,
    analyticsRoutes
  ] = routes;

  apiRouter.use("/auth", authRoutes.default);
  apiRouter.use("/ai", aiRoutes.default);
  apiRouter.use("/slug", publicLookupLimiter, slugRoutes.default);
  apiRouter.use("/health", healthRoutes.default);
  apiRouter.use("/profile/reservation", publicLookupLimiter);
  apiRouter.use("/profile", profileRoutes.default);
  apiRouter.use("/plans", planRoutes.default);
  apiRouter.use("/calendar", calendarRoutes.default);

  // Generic catch-all routers for remaining endpoints (mounting directly at root of apiRouter)
  apiRouter.use(bookingLimiter, bookingRoutes.default);
  apiRouter.use(notificationRoutes.default);
  apiRouter.use(analyticsLimiter, analyticsRoutes.default);

  app.use("/api", apiRouter);

  // 6. Robots.txt and Sitemap.xml (Prioritized)
  app.get("/robots.txt", (req, res) => {
    const robots = [
      "User-agent: *",
      "Allow: /",
      "Allow: /profissionais",
      "Allow: /p/",
      "Disallow: /dashboard",
      "Disallow: /onboarding",
      "Disallow: /settings",
      "Disallow: /configuracoes",
      "Disallow: /profile",
      "Disallow: /agenda",
      "Disallow: /pedidos",
      "Disallow: /financeiro",
      "Disallow: /services",
      "Disallow: /cupons",
      "Disallow: /avaliacoes",
      "Disallow: /indicacoes",
      "Disallow: /whatsapp-history",
      "Disallow: /checkout",
      "Disallow: /login",
      "Disallow: /register",
      "Disallow: /verificar-email",
      "",
      "Sitemap: https://usenera.com/sitemap.xml"
    ].join("\n");
    
    res.setHeader("Content-Type", "text/plain");
    res.send(robots);
  });

  app.get("/sitemap.xml", async (req, res) => {
    try {
      const db = firebaseAdmin.getDb();
      if (!db) return res.status(503).send("Database warming up. Please retry in a moment.");

      const baseUrl = "https://usenera.com";
      const staticPages = [
        "",
        "/profissionais",
        "/termos",
        "/privacidade"
      ];

      // Fetch indexable professionals - enforce quality filters at query level if possible
      const snapshot = await db.collection("users")
        .where("onboardingCompleted", "==", true)
        .where("indexable", "==", true)
        .where("role", "==", "professional")
        .limit(1000)
        .get();

      const professionalSlugs = snapshot.docs
        .map(doc => doc.data())
        .filter(data => {
          // Exclude any fake, test, QA, example or non-public profile using our centralized helper
          return !isNonPublicProfile(data);
        })
        .map(data => `/p/${data.slug}`);

      const allPages = [...staticPages, ...professionalSlugs];

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
      
      allPages.forEach(page => {
        xml += `  <url>\n`;
        xml += `    <loc>${baseUrl}${page}</loc>\n`;
        xml += `    <changefreq>${page === "" ? "daily" : "weekly"}</changefreq>\n`;
        xml += `    <priority>${page === "" ? "1.0" : page.startsWith("/p/") ? "0.8" : "0.6"}</priority>\n`;
        xml += `  </url>\n`;
      });

      xml += `</urlset>`;

      res.setHeader("Content-Type", "application/xml");
      res.status(200).send(xml);
    } catch (err) {
      logger.error("SEO", "Sitemap generation error", { error: err });
      res.status(500).send("Error generating sitemap");
    }
  });

  // 7. Root-level OG Proxy
  app.get("/og/p/:slugWithExt", async (req, res) => {
    try {
      const slug = req.params.slugWithExt.replace(/\.(jpg|jpeg|png)$/i, "");
      const db = firebaseAdmin.getDb();
      if (!db) return res.status(500).send("Database not initialized");

      const snapshot = await db.collection("users").where("slug", "==", slug).limit(1).get();
      const fallback = "https://usenera.com/og-default.jpg";

      if (snapshot.empty) {
        return res.redirect(fallback);
      }

      const prof = snapshot.docs[0].data() as any;
      const imageUrl = prof.shareImage || prof.photoUrl || prof.avatar;

      if (!imageUrl || typeof imageUrl !== "string" || !imageUrl.startsWith("http")) {
        return res.redirect(fallback);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const imageResponse = await fetch(imageUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!imageResponse.ok) {
          return res.redirect(fallback);
        }

        const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
        const buffer = Buffer.from(await imageResponse.arrayBuffer());

        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400"); // 7 days cache
        return res.send(buffer);
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        if (fetchErr.name === 'AbortError') {
          logger.warn("SSR", "OG Proxy timeout", { meta: { imageUrl, slug } });
        } else {
          logger.error("SSR", "OG Proxy fetch error", { error: fetchErr, meta: { imageUrl, slug } });
        }
        return res.redirect(fallback);
      }
    } catch (err) {
      logger.error("SSR", "OG Proxy error", { error: err, meta: { slugWithExt: req.params.slugWithExt } });
      return res.redirect("https://usenera.com/og-default.jpg");
    }
  });

  // 7. SSR for Professional Profiles
  const escapeHtml = (unsafe: string) => {
    return (unsafe || '').toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  let cachedIndexHtml: string | null = null;
  let viteServer: any = null;

  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    viteServer = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
  }

  function getCachedIndexHtml(indexPath: string): string {
    if (process.env.NODE_ENV !== "production") {
      return fs.readFileSync(indexPath, "utf-8");
    }
    if (cachedIndexHtml) return cachedIndexHtml;
    const html = fs.readFileSync(indexPath, "utf-8");
    cachedIndexHtml = html;
    return html;
  }

  app.get("/p/:slug", publicLookupLimiter, async (req, res, next) => {
    try {
      const { slug } = req.params;
      const db = firebaseAdmin.getDb();
      if (!db) return next();
      
      const indexPath = process.env.NODE_ENV === "production" 
        ? path.join(process.cwd(), "dist", "index.html")
        : path.join(process.cwd(), "index.html");

      if (!fs.existsSync(indexPath)) return next();
      
      let baseHtml: string;
      try {
        baseHtml = getCachedIndexHtml(indexPath);
      } catch (err) {
        logger.error("SSR", "Failed to read index.html", { error: err });
        return next();
      }
      
      let html = baseHtml; // Create a local copy for this request

      let title = "nera — agenda e presença para profissionais de beleza";
      let description = "Agendamentos, vitrine profissional e presença digital para profissionais de beleza que levam o próprio trabalho a sério.";
      let ogImage = "https://usenera.com/og-default.png";
      let pageUrl = `https://usenera.com/p/${escapeHtml(encodeURIComponent(slug))}`;

      const snapshot = await db.collection("users").where("slug", "==", slug).limit(1).get();
      
      if (slug === 'helena-prado') {
        title = "Helena Prado | Sobrancelhas e Harmonização do Olhar | Nera";
        description = "Especialista em design de sobrancelhas naturais. Com foco em harmonização facial, meu trabalho é realçar sua beleza autêntica.";
        ogImage = "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=400&auto=format&fit=crop";
      } else if (!snapshot.empty) {
        const prof = snapshot.docs[0].data() as any;
        
        const namePart = prof.name || "Profissional";
        const specialtyLabel = formatSpecialtyLabel(prof.specialty);
        if (prof.name && prof.specialty) {
          title = escapeHtml(`${prof.name} | ${specialtyLabel} | Nera`);
        } else if (prof.name) {
          title = escapeHtml(`${prof.name} | Nera`);
        }
        
        const locationCopy = getServiceLocationCopy(prof);
        let rawBio = prof.bio || prof.aboutBio || prof.heroBio || "";
        let cleanedBio = rawBio.toString().replace(/\n+/g, " ").trim();
        
        if (cleanedBio) {
          description = escapeHtml(cleanedBio.slice(0, 160));
        } else {
          const specialty = formatSpecialtyLabel(prof.specialty);
          const locationPart = locationCopy ? `${locationCopy}. ` : (prof.city ? `em ${prof.city}. ` : "");
          description = escapeHtml(`${specialty} ${locationPart}Agende seu horário com praticidade na Nera.`);
        }
        
        let imageUrl = prof.photoUrl || prof.avatar || prof.shareImage;
        if (imageUrl && typeof imageUrl === "string" && imageUrl.startsWith("http")) {
           ogImage = escapeHtml(imageUrl);
        }
      }

      // Automatically determine indexability (P1 Test profiles check)
      let isIndexable = true;
      if (slug === 'helena-prado') {
        isIndexable = false;
      } else if (snapshot.empty) {
        isIndexable = false;
      } else {
        const prof = snapshot.docs[0].data() as any;
        if (isNonPublicProfile(prof)) {
          isIndexable = false;
        }
      }

      const metaTags = `
        ${!isIndexable ? '<meta name="robots" content="noindex, nofollow" />' : ''}
        <title>${title}</title>
        <meta name="description" content="${description}" />
        <link rel="canonical" href="${pageUrl}" />
        <meta property="og:title" content="${title}" />
        <meta property="og:description" content="${description}" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="${pageUrl}" />
        <meta property="og:site_name" content="Nera" />
        <meta property="og:locale" content="pt_BR" />
        <meta property="og:image" content="${ogImage}" />
        <meta property="og:image:alt" content="Perfil na Nera" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${title}" />
        <meta name="twitter:description" content="${description}" />
        <meta name="twitter:image" content="${ogImage}" />
      `;

      if (html.includes("</head>")) {
        html = html.replace(/<title>.*?<\/title>/i, "");
        html = html.replace("</head>", `${metaTags}\n</head>`);
      }
      
      if (viteServer) {
        html = await viteServer.transformIndexHtml(req.originalUrl, html);
      }

      if (!isIndexable) {
        res.setHeader("X-Robots-Tag", "noindex, nofollow");
      }
      res.setHeader("Content-Type", "text/html");
      return res.send(html);
    } catch (err) {
      logger.error("SSR", "SSR logic error", { error: err, meta: { path: req.path } });
      // Fallback
      return next();
    }
  });

  app.get("/review/:token", publicLookupLimiter, async (req, res, next) => {
    try {
      const { token } = req.params;
      const db = firebaseAdmin.getDb();
      if (!db) return next();
      
      const indexPath = process.env.NODE_ENV === "production" 
        ? path.join(process.cwd(), "dist", "index.html")
        : path.join(process.cwd(), "index.html");

      if (!fs.existsSync(indexPath)) return next();
      
      let baseHtml: string;
      try {
        baseHtml = getCachedIndexHtml(indexPath);
      } catch (err) {
        logger.error("SSR", "Failed to read index.html in review", { error: err });
        return next();
      }
      
      let html = baseHtml; 

      let title = "Nera | Avalie sua experiência";
      let description = "Sua avaliação ajuda a profissional a crescer com confiança.";
      let ogImage = "https://usenera.com/og-default.png";
      let pageUrl = `https://usenera.com/review/${escapeHtml(encodeURIComponent(token))}`;

      const snapshot = await db.collection("review_requests").where("token", "==", token).limit(1).get();
      
      if (!snapshot.empty) {
        const reqData = snapshot.docs[0].data() as any;
        if (reqData.professionalId) {
          const profSnap = await db.collection("users").doc(reqData.professionalId).get();
          if (profSnap.exists) {
            const prof = profSnap.data() as any;
            if (prof.name) {
               title = escapeHtml(`Avalie sua experiência com ${prof.name} | Nera`);
               description = escapeHtml(`Sua avaliação ajuda ${prof.name} a continuar oferecendo o melhor serviço.`);
            }
          }
        }
      }

      const metaTags = `
        <title>${title}</title>
        <meta name="description" content="${description}" />
        <link rel="canonical" href="${pageUrl}" />
        <meta property="og:title" content="${title}" />
        <meta property="og:description" content="${description}" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="${pageUrl}" />
        <meta property="og:site_name" content="Nera" />
        <meta property="og:locale" content="pt_BR" />
        <meta property="og:image" content="${ogImage}" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${title}" />
        <meta name="twitter:description" content="${description}" />
        <meta name="twitter:image" content="${ogImage}" />
      `;

      if (html.includes("</head>")) {
        html = html.replace(/<title>.*?<\/title>/i, "");
        html = html.replace("</head>", `${metaTags}\n</head>`);
      }

      if (viteServer) {
        html = await viteServer.transformIndexHtml(req.originalUrl, html);
      }

      res.setHeader("Content-Type", "text/html");
      return res.send(html);
    } catch (err) {
      logger.error("SSR", "SSR logic error in review", { error: err, meta: { path: req.path } });
      return next();
    }
  });

  // 8. Public Directory SSR
  app.get("/profissionais", publicLookupLimiter, async (req, res, next) => {
    try {
      const indexPath = process.env.NODE_ENV === "production" 
        ? path.join(process.cwd(), "dist", "index.html")
        : path.join(process.cwd(), "index.html");

      if (!fs.existsSync(indexPath)) return next();
      
      let html = getCachedIndexHtml(indexPath);
      const title = "Diretório de Profissionais | Nera";
      const description = "Encontre as melhores profissionais de beleza: especialistas em cílios, sobrancelhas, unhas e muito mais no diretório oficial da Nera.";
      const pageUrl = "https://usenera.com/profissionais";
      const ogImage = "https://usenera.com/og-default.png";

      const metaTags = `
        <title>${title}</title>
        <meta name="description" content="${description}" />
        <link rel="canonical" href="${pageUrl}" />
        <meta property="og:title" content="${title}" />
        <meta property="og:description" content="${description}" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="${pageUrl}" />
        <meta property="og:image" content="${ogImage}" />
        <meta name="twitter:card" content="summary_large_image" />
      `;

      if (html.includes("</head>")) {
        html = html.replace(/<title>.*?<\/title>/i, "");
        html = html.replace("</head>", `${metaTags}\n</head>`);
      }
      if (viteServer) html = await viteServer.transformIndexHtml(req.originalUrl, html);
      res.setHeader("Content-Type", "text/html");
      return res.send(html);
    } catch (err) {
      next();
    }
  });

  // 9. Private Routes Protection (Noindex)
  app.get([
    "/dashboard*", 
    "/onboarding*", 
    "/settings*", 
    "/configuracoes*",
    "/profile*", 
    "/checkout*", 
    "/success*", 
    "/cancel*", 
    "/referrals*", 
    "/indicacoes*",
    "/login*", 
    "/register*",
    "/agenda*",
    "/pedidos*",
    "/clients*",
    "/clientes*",
    "/financeiro*",
    "/billing*",
    "/services*",
    "/cupons*",
    "/avaliacoes*",
    "/whatsapp-history*",
    "/verificar-email*",
    "/trocar-senha*",
    "/planos*",
    "/plans*"
  ], async (req, res, next) => {
    try {
      const indexPath = process.env.NODE_ENV === "production" 
        ? path.join(process.cwd(), "dist", "index.html")
        : path.join(process.cwd(), "index.html");

      if (!fs.existsSync(indexPath)) return next();
      
      let html = getCachedIndexHtml(indexPath);
      const metaTags = `<meta name="robots" content="noindex, nofollow" />`;

      if (html.includes("</head>")) {
        html = html.replace("</head>", `${metaTags}\n</head>`);
      }
      if (viteServer) html = await viteServer.transformIndexHtml(req.originalUrl, html);
      res.setHeader("Content-Type", "text/html");
      res.setHeader("X-Robots-Tag", "noindex, nofollow"); // Extra security
      return res.send(html);
    } catch (err) {
      next();
    }
  });

  // 10. Homepage SSR
  app.get("/", async (req, res, next) => {
    try {
      const indexPath = process.env.NODE_ENV === "production" 
        ? path.join(process.cwd(), "dist", "index.html")
        : path.join(process.cwd(), "index.html");

      if (!fs.existsSync(indexPath)) return next();
      
      let html = getCachedIndexHtml(indexPath);
      const title = "nera — agenda e presença para profissionais de beleza";
      const description = "Agendamentos, vitrine profissional e presença digital para profissionais de beleza que levam o próprio trabalho a sério.";
      const pageUrl = "https://usenera.com/";
      const ogImage = "https://usenera.com/og-default.png";

      const metaTags = `
        <title>${title}</title>
        <meta name="description" content="${description}" />
        <link rel="canonical" href="${pageUrl}" />
        <meta property="og:title" content="${title}" />
        <meta property="og:description" content="${description}" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="${pageUrl}" />
        <meta property="og:image" content="${ogImage}" />
        <meta name="twitter:card" content="summary_large_image" />
      `;

      if (html.includes("</head>")) {
        html = html.replace(/<title>.*?<\/title>/i, "");
        html = html.replace("</head>", `${metaTags}\n</head>`);
      }
      if (viteServer) html = await viteServer.transformIndexHtml(req.originalUrl, html);
      res.setHeader("Content-Type", "text/html");
      return res.send(html);
    } catch (err) {
      next();
    }
  });

  // 11. Vite/Static serving
  if (viteServer) {
    app.use(viteServer.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
        maxAge: '1y',
        immutable: true,
        setHeaders: (res, path) => {
          if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'public, no-cache');
          }
        }
    }));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'), {
         headers: {
           'Cache-Control': 'public, no-cache'
         }
      });
    });
  }

  // 8. Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error("SERVER", "Critical Unhandled Error", { requestId: req.requestId, error: err });
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  });

  return app;
}

// No standalone listen here - moved to local-server.ts
