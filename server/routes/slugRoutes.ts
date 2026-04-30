import express from "express";
import { getDb } from "../firebaseAdmin.js";

const router = express.Router();

    /**
 * GET /api/slug/check?slug={slug}&uid={uid}
 * Logic: Checks if a slug is available. Available if not exists OR if owned by uid.
 */
router.get("/check", async (req, res) => {
  try {
    const { slug, uid, city } = req.query;
    if (!slug || typeof slug !== "string") {
      return res.status(400).json({ error: "Parâmetro 'slug' é obrigatório." });
    }

    const cleanSlug = slug.toLowerCase().trim();
    const currentUid = typeof uid === "string" ? uid : null;
    const cityStr = typeof city === "string" ? city.toLowerCase().trim().replace(/[^a-z0-9]/g, '-') : '';

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
    console.log("[SLUG CHECK] checking slug:", cleanSlug, "for uid:", currentUid);
    const db = getDb();
    
    if (!db) {
      console.error("[SLUG CHECK ERROR] Firestore db is NOT initialized.");
      return res.status(500).json({ error: "Serviço de banco de dados não disponível." });
    }

    const slugDoc = await db.collection("slugs").doc(cleanSlug).get();
    console.log("[SLUG CHECK] query completed. Exists:", slugDoc.exists);

    if (slugDoc.exists) {
      const ownerId = slugDoc.data()?.uid;
      
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

    return res.json({ 
      available: true,
      message: "Link disponível!" 
    });

  } catch (err: any) {
    console.error("[SLUG CHECK ERROR FULL]", err);
    res.status(500).json({ error: "Erro ao verificar disponibilidade do link." });
  }
});

export default router;
