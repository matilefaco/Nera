import express from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import { logger } from "./server/utils/logger.js";
const allowedOrigins = [
    "https://usenera.com",
    "https://www.usenera.com",
    "https://ai-studio-applet-webapp-bb725.web.app",
    "https://ai-studio-applet-webapp-bb725.firebaseapp.com"
];
function isAllowedOrigin(origin) {
    if (!origin)
        return true; // server-to-server, Stripe, curl, bots, SSR
    const envOrigins = (process.env.ALLOWED_ORIGINS || "")
        .split(",")
        .map(o => o.trim())
        .filter(Boolean);
    if (process.env.APP_URL)
        envOrigins.push(process.env.APP_URL);
    if (process.env.VITE_APP_URL)
        envOrigins.push(process.env.VITE_APP_URL);
    if (allowedOrigins.includes(origin) || envOrigins.includes(origin))
        return true;
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
        return true;
    if (process.env.CLOUD_RUN_PUBLIC_URL && origin === process.env.CLOUD_RUN_PUBLIC_URL)
        return true;
    return false;
}
export async function createServerApp() {
    // 1. Initial configuration (Move heavy logic here)
    const { config } = await import("dotenv");
    config();
    const firebaseAdmin = await import("./server/firebaseAdmin.js");
    const { requestIdMiddleware } = await import("./server/middleware/requestId.js");
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
                "debug",
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
    // 3. Skip express.json for Stripe Webhook
    app.use((req, res, next) => {
        if (req.originalUrl === "/api/plans/webhook") {
            next();
        }
        else {
            express.json()(req, res, next);
        }
    });
    // 4. Initialize Firebase Admin (Awaited to ensure DB is ready for route handlers)
    try {
        await firebaseAdmin.initFirebase();
        logger.info("SERVER", "Firebase Admin initialized");
    }
    catch (err) {
        logger.error("SERVER", "Failed to initialize Firebase", { error: err });
    }
    // 5. Registration of API Routes (Consolidated for consistent path resolution in production)
    const apiRouter = express.Router();
    // Specific routers
    apiRouter.use("/slug", (await import("./server/routes/slugRoutes.js")).default);
    apiRouter.use("/health", (await import("./server/routes/healthRoutes.js")).default);
    apiRouter.use("/profile", (await import("./server/routes/profileRoutes.js")).default);
    apiRouter.use("/plans", (await import("./server/routes/planRoutes.js")).default);
    apiRouter.use("/calendar", (await import("./server/routes/calendarRoutes.js")).default);
    // Generic catch-all routers for remaining endpoints (mounting directly at root of apiRouter)
    apiRouter.use((await import("./server/routes/bookingRoutes.js")).default);
    apiRouter.use((await import("./server/routes/notificationRoutes.js")).default);
    apiRouter.use((await import("./server/routes/analyticsRoutes.js")).default);
    app.use("/api", apiRouter);
    // 6. Root-level OG Proxy
    app.get("/og/p/:slugWithExt", async (req, res) => {
        try {
            const slug = req.params.slugWithExt.replace(/\.(jpg|jpeg|png)$/i, "");
            const db = firebaseAdmin.getDb();
            if (!db)
                return res.status(500).send("Database not initialized");
            const snapshot = await db.collection("users").where("slug", "==", slug).limit(1).get();
            const fallback = "https://usenera.com/og-default.jpg";
            if (snapshot.empty) {
                return res.redirect(fallback);
            }
            const prof = snapshot.docs[0].data();
            const imageUrl = prof.shareImage || prof.photoUrl || prof.avatar;
            if (!imageUrl || typeof imageUrl !== "string" || !imageUrl.startsWith("http")) {
                return res.redirect(fallback);
            }
            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) {
                return res.redirect(fallback);
            }
            const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
            const buffer = Buffer.from(await imageResponse.arrayBuffer());
            res.setHeader("Content-Type", contentType);
            res.setHeader("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400"); // 7 days cache
            return res.send(buffer);
        }
        catch (err) {
            logger.error("SSR", "OG Proxy error", { error: err, meta: { slugWithExt: req.params.slugWithExt } });
            return res.redirect("https://usenera.com/og-default.jpg");
        }
    });
    // 7. SSR for Professional Profiles
    const escapeHtml = (unsafe) => {
        return (unsafe || '').toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };
    let cachedIndexHtml = null;
    function getCachedIndexHtml(indexPath) {
        if (process.env.NODE_ENV !== "production") {
            return fs.readFileSync(indexPath, "utf-8");
        }
        if (cachedIndexHtml)
            return cachedIndexHtml;
        const html = fs.readFileSync(indexPath, "utf-8");
        cachedIndexHtml = html;
        return html;
    }
    app.get("/p/:slug", async (req, res, next) => {
        try {
            const { slug } = req.params;
            const db = firebaseAdmin.getDb();
            if (!db)
                return next();
            const indexPath = process.env.NODE_ENV === "production"
                ? path.join(process.cwd(), "dist", "index.html")
                : path.join(process.cwd(), "index.html");
            if (!fs.existsSync(indexPath))
                return next();
            let baseHtml;
            try {
                baseHtml = getCachedIndexHtml(indexPath);
            }
            catch (err) {
                logger.error("SSR", "Failed to read index.html", { error: err });
                return next();
            }
            let html = baseHtml; // Create a local copy for this request
            let title = "Nera | Agendamento online";
            let cleanName = "Profissional";
            let description = "Agende serviços de beleza com praticidade pela Nera.";
            let ogImage = "https://usenera.com/og-default.png";
            let pageUrl = `https://usenera.com/p/${escapeHtml(encodeURIComponent(slug))}`;
            const snapshot = await db.collection("users").where("slug", "==", slug).limit(1).get();
            if (!snapshot.empty) {
                const prof = snapshot.docs[0].data();
                title = escapeHtml(prof.name ? `${prof.name} | Nera` : "Nera | Agendamento online");
                cleanName = escapeHtml(prof.name || "Profissional");
                let rawBio = prof.bio || prof.aboutBio || prof.heroBio || "";
                let cleanedBio = rawBio.toString().replace(/\n+/g, ' ').trim().slice(0, 160);
                description = escapeHtml(cleanedBio || "Agende seus serviços de beleza online com praticidade pela Nera.");
                let imageUrl = prof.photoUrl || prof.avatar || prof.shareImage;
                if (imageUrl && typeof imageUrl === "string" && imageUrl.startsWith("http")) {
                    ogImage = escapeHtml(imageUrl);
                }
            }
            const metaTags = `
        <title>${title}</title>
        <meta name="description" content="${description}" />
        <link rel="canonical" href="${pageUrl}" />
        <meta property="og:title" content="${cleanName} | Agende online" />
        <meta property="og:description" content="${description}" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="${pageUrl}" />
        <meta property="og:site_name" content="Nera" />
        <meta property="og:locale" content="pt_BR" />
        <meta property="og:image" content="${ogImage}" />
        <meta property="og:image:alt" content="Perfil de ${cleanName} na Nera" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${cleanName} | Agende online" />
        <meta name="twitter:description" content="${description}" />
        <meta name="twitter:image" content="${ogImage}" />
      `;
            if (html.includes("</head>")) {
                html = html.replace(/<title>.*?<\/title>/i, "");
                html = html.replace("</head>", `${metaTags}\n</head>`);
            }
            res.setHeader("Content-Type", "text/html");
            return res.send(html);
        }
        catch (err) {
            logger.error("SSR", "SSR logic error", { error: err, meta: { path: req.path } });
            // Fallback
            return next();
        }
    });
    app.get("/review/:token", async (req, res, next) => {
        try {
            const { token } = req.params;
            const db = firebaseAdmin.getDb();
            if (!db)
                return next();
            const indexPath = process.env.NODE_ENV === "production"
                ? path.join(process.cwd(), "dist", "index.html")
                : path.join(process.cwd(), "index.html");
            if (!fs.existsSync(indexPath))
                return next();
            let baseHtml;
            try {
                baseHtml = getCachedIndexHtml(indexPath);
            }
            catch (err) {
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
                const reqData = snapshot.docs[0].data();
                if (reqData.professionalId) {
                    const profSnap = await db.collection("users").doc(reqData.professionalId).get();
                    if (profSnap.exists) {
                        const prof = profSnap.data();
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
            res.setHeader("Content-Type", "text/html");
            return res.send(html);
        }
        catch (err) {
            logger.error("SSR", "SSR logic error in review", { error: err, meta: { path: req.path } });
            return next();
        }
    });
    // 8. Vite/Static serving
    if (process.env.NODE_ENV !== "production") {
        const { createServer } = await import("vite");
        const vite = await createServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    }
    else {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }
    // 8. Error Handler
    app.use((err, req, res, next) => {
        logger.error("SERVER", "Critical Unhandled Error", { requestId: req.requestId, error: err });
        res.status(500).json({ error: "Internal Server Error", message: err.message });
    });
    return app;
}
// No standalone listen here - moved to local-server.ts
