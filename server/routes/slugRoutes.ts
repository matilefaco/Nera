import express from "express";
import { getDb } from "../firebaseAdmin.js";
import { logger } from "../utils/logger.js";

const isProduction = process.env.NODE_ENV === "production";

const router = express.Router();

    /**
 * GET /api/slug/check?slug={slug}&uid={uid}
 * Logic: Checks if a slug is available. Available if not exists OR if owned by uid.
 */
router.get("/check", async (req, res) => {
  try {
    const query = (req.query || {}) as any;
    const { slug, uid, city } = query;

    // Fallback parsing from URLSearchParams if params are missing in req.query
    const requestUrl = new URL(req.originalUrl || req.url, "https://usenera.com");
    const slugParam = typeof slug === "string" ? slug : requestUrl.searchParams.get("slug");
    const uidParam = typeof uid === "string" ? uid : requestUrl.searchParams.get("uid");
    const cityParam = typeof city === "string" ? city : requestUrl.searchParams.get("city");

    if (!slugParam || typeof slugParam !== "string") {
      return res.status(400).json({ error: "Parâmetro 'slug' é obrigatório." });
    }

    const cleanSlug = slugParam.toLowerCase().trim();
    const currentUid = typeof uidParam === "string" ? uidParam : null;
    const cityStr = typeof cityParam === "string" ? cityParam.toLowerCase().trim().replace(/[^a-z0-9]/g, '-') : '';

    // 1. Validation
    const slugRegex = /^[a-z0-9-]+$/;
    if (cleanSlug.length < 3 || cleanSlug.length > 50) {
      return res.status(400).json({ 
        available: false, 
        error: "O link deve ter entre 3 e 50 caracteres." 
      });
    }
    if (!slugRegex.test(cleanSlug)) {
      return res.status(400).json({ 
        available: false, 
        error: "O link deve conter apenas letras minúsculas, números e hífens." 
      });
    }

    // 2. Check existence in Firestore
    const db = getDb();
    console.log("[SLUG CHECK DEBUG] Step 1: db instance", !!db);
    
    if (!db) {
      console.error("[SLUG CHECK ERROR] Firestore db is NOT initialized.");
      return res.status(500).json({ 
        error: "Serviço de banco de dados não disponível.",
        ...(isProduction ? {} : { debug: "db_not_initialized" })
      });
    }

    try {
      console.log("[SLUG CHECK DEBUG] Step 2: Accessing collection 'slugs' for doc:", cleanSlug);
      const slugDoc = await db.collection("slugs").doc(cleanSlug).get();
      console.log("[SLUG CHECK DEBUG] Step 3: Query completed. Exists:", slugDoc.exists);

      if (slugDoc.exists) {
        const ownerId = slugDoc.data()?.uid;
        console.log("[SLUG CHECK DEBUG] Step 4a: Slug exists. Owner:", ownerId);
        
        // If the owner is the one asking, it's available
        if (currentUid && ownerId === currentUid) {
          return res.json({ 
            available: true,
            message: "Este já é o seu link!" 
          });
        }

        // Return suggestions
        const suggestions = [
          `${cleanSlug}-2`
        ];

        if (cityStr) {
          suggestions.push(`${cleanSlug}-${cityStr}`);
        } else {
          suggestions.push(`${cleanSlug}-pro`);
        }

        return res.json({ 
          available: false, 
          suggestions,
          message: "Este link já está em uso."
        });
      }

      console.log("[SLUG CHECK DEBUG] Step 4b: Slug available.");
      return res.json({ 
        available: true,
        message: "Link disponível!" 
      });
    } catch (innerErr: any) {
      logger.error("SERVER", "Slug check failed inside db operations", { error: innerErr.message, requestId: (req as any).requestId });
      return res.status(500).json({
        error: "Erro ao acessar o banco de dados.",
        ...(isProduction ? {} : { debug: innerErr.message || "fire_error", stack: innerErr.stack })
      });
    }

  } catch (err: any) {
    logger.error("SERVER", "Slug check outer error", { error: err.message, requestId: (req as any).requestId });
    return res.status(500).json({ 
      error: "Erro ao verificar disponibilidade do link.",
      ...(isProduction ? {} : { debug: err?.message || String(err), code: err?.code || null })
    });
  }
});

export default router;
