import express from "express";
import { db } from "../firebaseAdmin";
import admin from "firebase-admin";

const router = express.Router();

/**
 * POST /api/profile/save
 * Transactional save that claims a slug and updates the user profile.
 */
router.post("/save", async (req, res) => {
  const { uid, profileData, services } = req.body;
  const slug = profileData?.slug?.toLowerCase()?.trim();

  if (!uid || !slug) {
    return res.status(400).json({ error: "UID e Slug são obrigatórios." });
  }

  try {
    console.log("[PROFILE SAVE] Starting transaction for UID:", uid, "Slug:", slug);
    const result = await db.runTransaction(async (transaction) => {
      const slugRef = db.collection("slugs").doc(slug);
      const userRef = db.collection("users").doc(uid);

      console.log("[PROFILE SAVE TX] Fetching slug and user documents...");
      const slugDoc = await transaction.get(slugRef);
      const userSnap = await transaction.get(userRef);

      // 1. If slug exists, check if it belongs to THIS user
      if (slugDoc.exists) {
        const ownerId = slugDoc.data()?.uid;
        if (ownerId !== uid) {
          console.warn("[PROFILE SAVE TX] Slug collision:", slug, "belongs to", ownerId);
          throw new Error("Este link já está sendo usado por outra profissional.");
        }
      }

      // 2. If user already had a different slug, release old one
      const userData = userSnap.exists ? userSnap.data() : null;
      const currentSlug = userData?.slug;
      if (currentSlug && currentSlug !== slug) {
        console.log("[PROFILE SAVE TX] Releasing old slug:", currentSlug);
        const oldSlugRef = db.collection("slugs").doc(currentSlug);
        transaction.delete(oldSlugRef);
      }

      // 3. Claim the slug
      console.log("[PROFILE SAVE TX] Claiming slug:", slug);
      transaction.set(slugRef, { 
        uid, 
        claimedAt: admin.firestore.FieldValue.serverTimestamp() 
      });

      // 4. Update the profile
      console.log("[PROFILE SAVE TX] Updating user info for:", uid);
      const finalProfileData = {
        ...profileData,
        slug,
        updatedAt: new Date().toISOString()
      };
      transaction.set(userRef, finalProfileData, { merge: true });

      // 5. Handle Services if provided
      if (Array.isArray(services) && services.length > 0) {
        console.log("[PROFILE SAVE TX] Adding", services.length, "services");
        for (const service of services) {
          const serviceRef = db.collection("services").doc();
          transaction.set(serviceRef, {
            ...service,
            professionalId: uid,
            createdAt: new Date().toISOString(),
            active: true
          });
        }
      }

      console.log("[PROFILE SAVE TX] Transaction logic completed successfully");
      return { success: true, slug };
    });

    console.log("[PROFILE SAVE] Transaction committed successfully for UID:", uid);
    res.json(result);
  } catch (err: any) {
    console.error("[PROFILE SAVE ERROR]", err.message);
    const status = err.message.includes("já está sendo usado") ? 409 : 500;
    res.status(status).json({ error: err.message });
  }
});

// --- NEW: ROBUST RESERVATION LOOKUP API ---
router.get("/reservation/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    if (!slug) return res.status(400).json({ error: "Missing slug" });

    const slugStr = slug.toLowerCase();
    let appointmentData: any = null;
    let appointmentId: string | null = null;

    // Strategy 1: Check reservation_links (Fastest/New)
    const linkDoc = await db.collection('reservation_links').doc(slugStr).get();
    if (linkDoc.exists) {
      appointmentId = linkDoc.data()?.appointmentId;
      if (appointmentId) {
        const apptDoc = await db.collection('appointments').doc(appointmentId).get();
        if (apptDoc.exists) {
          appointmentData = apptDoc.data();
        }
      }
    }

    // Strategy 2: Fallback query search
    if (!appointmentData) {
      const strategies = ['manageSlug', 'token', 'publicToken', 'manageToken'];
      for (const field of strategies) {
        const q = await db.collection('appointments').where(field, '==', slugStr).limit(1).get();
        if (!q.empty) {
          appointmentId = q.docs[0].id;
          appointmentData = q.docs[0].data();
          break;
        }
      }
    }

    // Strategy 3: Reservation Code (Uppercase)
    if (!appointmentData) {
      const q = await db.collection('appointments').where('reservationCode', '==', slug.toUpperCase()).limit(1).get();
      if (!q.empty) {
        appointmentId = q.docs[0].id;
        appointmentData = q.docs[0].data();
      }
    }

    // Strategy 4: Doc ID
    if (!appointmentData && slug.length >= 20) {
      const q = await db.collection('appointments').doc(slug).get();
      if (q.exists) {
        appointmentId = q.id;
        appointmentData = q.data();
      }
    }

    if (!appointmentData) {
      return res.status(404).json({ found: false, error: "Reservation not found" });
    }

    // Get professional data for context
    const proDoc = await db.collection('users').doc(appointmentData.professionalId).get();
    const proData = proDoc.exists ? proDoc.data() : null;

    // Return sanitized data for client
    res.json({
      found: true,
      appointment: {
        id: appointmentId,
        ...appointmentData,
        professional: proData ? {
          name: proData.name,
          slug: proData.slug,
          whatsapp: proData.whatsapp
        } : null
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- NEW: DIAGNOSTIC ENDPOINT FOR RESERVATION ---
router.get("/debug-reservation", async (req, res) => {
  try {
    const { slug } = req.query;
    if (!slug) return res.status(400).json({ error: "Missing slug or token" });

    const slugStr = slug as string;
    const results: any = { 
      slugReceived: slugStr,
      foundLinkDoc: false,
      appointmentFound: false,
      searchTime: new Date().toISOString()
    };

    const linkDoc = await db.collection('reservation_links').doc(slugStr.toLowerCase()).get();
    if (linkDoc.exists) {
      results.foundLinkDoc = true;
      results.linkDocData = linkDoc.data();
      const apptDoc = await db.collection('appointments').doc(results.linkDocData.appointmentId).get();
      if (apptDoc.exists) {
        results.appointmentFound = true;
        results.appointmentId = apptDoc.id;
        results.appointmentData = apptDoc.data();
      }
    }

    if (!results.appointmentFound) {
      // Broad search
      const q = await db.collection('appointments').where('manageSlug', '==', slugStr.toLowerCase()).limit(1).get();
      if (!q.empty) {
        results.appointmentFound = true;
        results.appointmentId = q.docs[0].id;
        results.appointmentData = q.docs[0].data();
        results.note = "Found via backup query (manageSlug)";
      }
    }

    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
