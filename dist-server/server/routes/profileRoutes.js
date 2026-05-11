import express from "express";
import { getDb } from "../firebaseAdmin.js";
import admin from "firebase-admin";
import { isValidWhatsapp } from "../utils.js";
import { PLAN_CONFIGS } from "../../src/constants/plans.js";
import { requireFirebaseAuth } from "../middleware/authMiddleware.js";
import { logger, maskUid } from "../utils/logger.js";
import { publicReadLimiter, authMutationLimiter } from "../middleware/rateLimiter.js";
const router = express.Router();
const debugOnly = (req, res, next) => {
    if (process.env.NODE_ENV === "production") {
        return res.status(404).send("Not Found");
    }
    return next();
};
/**
 * Recursively removes undefined fields from an object or array.
 */
const removeUndefinedDeep = (value) => {
    if (Array.isArray(value)) {
        return value.map(removeUndefinedDeep).filter((v) => v !== undefined);
    }
    if (value && typeof value === "object" && !(value instanceof Date)) {
        return Object.fromEntries(Object.entries(value)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, removeUndefinedDeep(v)]));
    }
    return value;
};
/**
 * POST /api/profile/save
 * Transactional save that claims a slug and updates the user profile.
 */
router.post("/save", requireFirebaseAuth, authMutationLimiter, async (req, res) => {
    const { profileData, services } = req.body;
    const uid = req.uid;
    logger.info("PROFILE", "Profile save requested", {
        requestId: req.requestId,
        professionalId: maskUid(uid),
        meta: {
            hasName: Boolean(profileData?.name),
            hasWhatsapp: Boolean(profileData?.whatsapp),
            hasSlug: Boolean(profileData?.slug),
            servicesCount: services?.length || 0
        }
    });
    const sanitizedProfile = removeUndefinedDeep(profileData || {});
    const slug = sanitizedProfile?.slug?.toLowerCase()?.trim();
    if (!uid || !slug) {
        return res.status(400).json({ error: "UID e Slug são obrigatórios." });
    }
    try {
        logger.info("PROFILE", "Starting transaction", { professionalId: maskUid(uid), meta: { slug } });
        const db = getDb();
        if (!db)
            throw new Error("Database not connected");
        const result = await db.runTransaction(async (transaction) => {
            const slugRef = db.collection("slugs").doc(slug);
            const userRef = db.collection("users").doc(uid);
            const [slugDoc, userSnap] = await Promise.all([
                transaction.get(slugRef),
                transaction.get(userRef)
            ]);
            // 1. If slug exists, verify ownership
            if (slugDoc.exists) {
                const ownerId = slugDoc.data()?.uid;
                if (ownerId && ownerId !== uid) {
                    logger.warn("PROFILE", "Slug conflict detected", { professionalId: maskUid(uid), meta: { slug, ownerId: maskUid(ownerId) } });
                    throw new Error("Este link já está sendo usado por outra profissional.");
                }
            }
            // 2. Handle old slug release if changed
            const userData = userSnap.exists ? userSnap.data() : null;
            const currentSlug = userData?.slug;
            if (currentSlug && currentSlug.toLowerCase() !== slug) {
                logger.info("PROFILE", "Releasing old slug", { professionalId: maskUid(uid), meta: { currentSlug } });
                const oldSlugRef = db.collection("slugs").doc(currentSlug.toLowerCase());
                transaction.delete(oldSlugRef);
            }
            // 3. Securely Lock/Claim the new slug
            transaction.set(slugRef, {
                uid,
                slug,
                createdAt: slugDoc.exists ? (slugDoc.data()?.createdAt || admin.firestore.FieldValue.serverTimestamp()) : admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                source: "profile_save"
            }, { merge: true });
            // 4. Update the user profile
            // --- THEME VALIDATION (Security) ---
            const userPlan = (userData?.plan || 'free').toLowerCase();
            const themeVariant = sanitizedProfile?.profileTheme?.variant;
            // WhatsApp validation on backend
            const whatsapp = sanitizedProfile?.whatsapp;
            if (whatsapp && !isValidWhatsapp(whatsapp)) {
                logger.warn("PROFILE", "User tried to save invalid WhatsApp", { professionalId: maskUid(uid) });
                throw new Error("O número de WhatsApp informado é inválido. Use um formato brasileiro (DDD + número).");
            }
            const config = PLAN_CONFIGS[userPlan] || PLAN_CONFIGS.free;
            const allowed = config.themes;
            let validatedTheme = sanitizedProfile?.profileTheme;
            if (themeVariant && !allowed.includes(themeVariant)) {
                logger.warn("PROFILE", "User tried to use an unauthorized theme variant. Resetting.", { professionalId: maskUid(uid), meta: { userPlan, requestedTheme: themeVariant } });
                validatedTheme = { variant: 'terracotta' };
            }
            const finalProfileData = removeUndefinedDeep({
                ...sanitizedProfile,
                profileTheme: validatedTheme,
                slug,
                updatedAt: new Date().toISOString()
            });
            transaction.set(userRef, finalProfileData, { merge: true });
            // 5. Handle Services if provided
            if (Array.isArray(services) && services.length > 0) {
                for (const service of services) {
                    const sanitizedService = removeUndefinedDeep(service);
                    const serviceRef = db.collection("services").doc();
                    transaction.set(serviceRef, {
                        ...sanitizedService,
                        professionalId: uid,
                        createdAt: new Date().toISOString(),
                        active: true
                    });
                }
            }
            return { success: true, slug };
        });
        logger.info("PROFILE", "Transaction committed successfully", { professionalId: maskUid(uid) });
        res.json(result);
    }
    catch (err) {
        logger.error("PROFILE", "Profile publish error", { requestId: req.requestId, professionalId: maskUid(uid), error: err });
        const status = err.message.includes("já está sendo usado") ? 409 : 500;
        res.status(status).json({ error: err.message });
    }
});
// --- NEW: ROBUST RESERVATION LOOKUP API ---
router.get("/reservation/:slug", publicReadLimiter, async (req, res) => {
    try {
        const { slug } = req.params;
        if (!slug)
            return res.status(400).json({ error: "Missing slug" });
        const db = getDb();
        if (!db)
            throw new Error("Database not connected");
        const slugStr = slug.toLowerCase();
        let appointmentData = null;
        let appointmentId = null;
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// --- NEW: DIAGNOSTIC ENDPOINT FOR RESERVATION ---
router.get("/debug-reservation", debugOnly, async (req, res) => {
    try {
        const { slug } = req.query;
        if (!slug)
            return res.status(400).json({ error: "Missing slug or token" });
        const db = getDb();
        if (!db)
            throw new Error("Database not connected");
        const slugStr = slug;
        const results = {
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
export default router;
