import express from "express";
import { db, getDb } from "../firebaseAdmin.js";
import admin from "firebase-admin";
import { isValidWhatsapp } from "../utils.js";
import { requireFirebaseAuth, AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { logger, maskUid } from "../utils/logger.js";
import { publicReadLimiter, authMutationLimiter } from "../middleware/rateLimiter.js";

// Duplicated from src/constants/plans.ts to avoid src/ dependency on server
const PLAN_CONFIGS: any = {
  free: {
    themes: ['terracotta'],
    features: {
      unlimitedBookings: false,
      whatsappNotifications: false,
      advancedDashboard: false,
      waitlist: false,
      antiNoShow: false,
      coupons: false,
      analytics: false,
      reports: false,
      referrals: false,
    }
  },
  essencial: {
    themes: ['terracotta', 'rose', 'sage'],
    features: {
      unlimitedBookings: true,
      whatsappNotifications: false,
      advancedDashboard: false,
      waitlist: false,
      antiNoShow: true,
      coupons: false,
      analytics: false,
      reports: false,
      referrals: false,
    }
  },
  pro: {
    themes: ['terracotta', 'rose', 'sage', 'navy', 'plum'],
    features: {
      unlimitedBookings: true,
      whatsappNotifications: true,
      advancedDashboard: true,
      waitlist: true,
      antiNoShow: true,
      coupons: true,
      analytics: true,
      reports: true,
      referrals: true,
    }
  }
};

const router = express.Router();

const debugOnly = (req: any, res: any, next: any) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).send("Not Found");
  }
  return next();
};

/**
 * Recursively removes undefined fields from an object or array.
 */
const removeUndefinedDeep = (value: any): any => {
  if (Array.isArray(value)) {
    return value.map(removeUndefinedDeep).filter((v) => v !== undefined);
  }
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, removeUndefinedDeep(v)])
    );
  }
  return value;
};

/**
 * POST /api/profile/save
 * Transactional save that claims a slug and updates the user profile.
 */
router.post("/save", requireFirebaseAuth, authMutationLimiter, async (req: AuthenticatedRequest, res: express.Response) => {
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
    if (!db) throw new Error("Database not connected");

    const result = await db.runTransaction(async (transaction) => {
      const slugRef = db.collection("slugs").doc(slug);
      const userRef = db.collection("users").doc(uid);
      const conflictingUserQuery = db.collection("users").where("slug", "==", slug).limit(1);
      const servicesQuery = db.collection("services").where("professionalId", "==", uid).where("active", "==", true);

      const [slugDoc, userSnap, conflictingUserSnap, existingServicesSnap] = await Promise.all([
        transaction.get(slugRef),
        transaction.get(userRef),
        transaction.get(conflictingUserQuery),
        transaction.get(servicesQuery)
      ]);

      // 1. If slug exists in dedicated collection, verify ownership
      if (slugDoc.exists) {
        const ownerId = slugDoc.data()?.uid;
        if (ownerId && ownerId !== uid) {
          logger.warn("PROFILE", "Slug conflict detected (slugs col)", { professionalId: maskUid(uid), meta: { slug, ownerId: maskUid(ownerId) } });
          throw new Error("Este link já está sendo usado por outra profissional.");
        }
      }

      // 2. Safety Net: Check if another user has this slug in their doc but NOT in slugs col
      if (!conflictingUserSnap.empty) {
        const conflictingUid = conflictingUserSnap.docs[0].id;
        if (conflictingUid !== uid) {
          logger.warn("PROFILE", "Slug conflict detected (users col fallback)", { professionalId: maskUid(uid), meta: { slug, conflictingUid: maskUid(conflictingUid) } });
          throw new Error("Este link já está sendo usado por outra profissional.");
        }
      }

      const userData = userSnap.exists ? userSnap.data() : null;
      const currentSlug = userData?.slug;
      
      // 3. Handle old slug release if changed
      if (currentSlug && currentSlug.toLowerCase() !== slug) {
        logger.info("PROFILE", "Releasing old slug", { professionalId: maskUid(uid), meta: { currentSlug } });
        const oldSlugRef = db.collection("slugs").doc(currentSlug.toLowerCase());
        transaction.delete(oldSlugRef);
      }

      // 4. Securely Lock/Claim the new slug
      transaction.set(slugRef, { 
        uid, 
        slug,
        createdAt: slugDoc.exists ? (slugDoc.data()?.createdAt || admin.firestore.FieldValue.serverTimestamp()) : admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        source: "profile_save"
      }, { merge: true });

      // 5. Build final profile data with strict ALLOWLIST
      const userPlan = (userData?.plan || 'free').toLowerCase() as keyof typeof PLAN_CONFIGS;
      const themeVariant = sanitizedProfile?.profileTheme?.variant;
      
      const config = PLAN_CONFIGS[userPlan] || PLAN_CONFIGS.free;
      const allowedThemes = config.themes || ['terracotta'];

      let validatedTheme = sanitizedProfile?.profileTheme;
      if (themeVariant && !allowedThemes.includes(themeVariant)) {
        logger.warn("PROFILE", "User tried to use an unauthorized theme variant. Resetting.", { professionalId: maskUid(uid), meta: { userPlan, requestedTheme: themeVariant } });
        validatedTheme = { variant: 'terracotta' };
      }

      // PICKS only allowed fields from incoming data to prevent security exploits
      const ALLOWED_FIELDS = [
        'name', 'displayName', 'bio', 'specialty', 'city', 'neighborhood', 'headline',
        'instagram', 'whatsapp', 'slug', 'avatar', 'photoURL', 'coverImage',
        'portfolio', 'profileTheme', 'serviceMode', 'studioAddress', 
        'serviceAreaType', 'serviceAreas', 'pricingStrategy', 'workingHours', 
        'paymentMethods', 'antiNoShowEnabled', 'advancePaymentRequired', 
        'delayTolerance', 'professionalIdentity', 'onboardingCompleted'
      ];

      const filteredProfile: any = {};
      ALLOWED_FIELDS.forEach(field => {
        if (sanitizedProfile[field] !== undefined) {
          filteredProfile[field] = sanitizedProfile[field];
        }
      });

      // Override with validated/internal values
      filteredProfile.profileTheme = validatedTheme;
      filteredProfile.slug = slug;
      filteredProfile.updatedAt = admin.firestore.FieldValue.serverTimestamp();

      // Ensure UID is correct
      filteredProfile.uid = uid;

      // WhatsApp validation on backend
      const whatsapp = filteredProfile.whatsapp;
      if (whatsapp && !isValidWhatsapp(whatsapp)) {
        logger.warn("PROFILE", "User tried to save invalid WhatsApp", { professionalId: maskUid(uid) });
        throw new Error("O número de WhatsApp informado é inválido. Use um formato brasileiro (DDD + número).");
      }

      // Set publication flags
      const isFinishingOnboarding = filteredProfile.onboardingCompleted === true && !userData?.onboardingCompleted;
      
      const missingDefaults: any = {};
      if (userData?.planRank === undefined) missingDefaults.planRank = 0;
      if (userData?.averageRating === undefined) missingDefaults.averageRating = 0;
      if (userData?.totalReviews === undefined) missingDefaults.totalReviews = 0;

      const finalProfileData = {
        ...filteredProfile,
        ...missingDefaults,
        // Add publication timestamp if completing onboarding
        ...(isFinishingOnboarding ? { profilePublishedAt: admin.firestore.FieldValue.serverTimestamp() } : {})
      };

      transaction.set(userRef, finalProfileData, { merge: true });

      // 6. Handle Services if provided with Idempotency (Upsert by name) within the same transaction
      if (Array.isArray(services) && services.length > 0) {
        const existingServicesMap = new Map();
        existingServicesSnap.docs.forEach(doc => {
          const data = doc.data();
          const key = (data.name || "").toLowerCase().trim();
          if (key && !existingServicesMap.has(key)) {
            existingServicesMap.set(key, { id: doc.id, ...data });
          }
        });

        for (const service of services) {
          const sanitizedService = removeUndefinedDeep(service);
          const serviceName = (sanitizedService.name || "").toLowerCase().trim();
          
          if (!serviceName) continue;

          const existingService = existingServicesMap.get(serviceName);

          if (existingService) {
            // UPDATING existing service
            const serviceRef = db.collection("services").doc(existingService.id);
            transaction.update(serviceRef, {
              ...sanitizedService,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              source: "publish",
              active: true
            });
          } else {
            // CREATING new service
            const serviceRef = db.collection("services").doc();
            transaction.set(serviceRef, {
              ...sanitizedService,
              professionalId: uid,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              source: "publish",
              active: true
            });
          }
        }
      }

      return { success: true, slug, published: isFinishingOnboarding };
    });

    logger.info("PROFILE", "Transaction committed successfully", { professionalId: maskUid(uid) });
    res.json(result);
  } catch (err: any) {
    logger.error("PROFILE", "Profile publish error", { requestId: req.requestId, professionalId: maskUid(uid), error: err });
    const status = err.message.includes("já está sendo usado") ? 409 : 500;
    res.status(status).json({ error: err.message });
  }
});

// --- NEW: ROBUST RESERVATION LOOKUP API ---
router.get("/reservation/:slug", publicReadLimiter, async (req, res) => {
  try {
    const { slug } = req.params;
    if (!slug) return res.status(400).json({ error: "Missing slug" });

    const db = getDb();
    if (!db) throw new Error("Database not connected");

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
    const safeAppointmentData = {
      id: appointmentId,
      manageSlug: appointmentData.manageSlug,
      token: appointmentData.token,
      date: appointmentData.date,
      time: appointmentData.time,
      duration: appointmentData.duration,
      status: appointmentData.status,
      professionalId: appointmentData.professionalId,
      serviceName: appointmentData.serviceName,
      reservationCode: appointmentData.reservationCode,
      totalPrice: appointmentData.totalPrice,
      price: appointmentData.price,
      locationType: appointmentData.locationType,
      address: appointmentData.address,
      clientConfirmed24h: appointmentData.clientConfirmed24h,
      clientConfirmedAt: appointmentData.clientConfirmedAt,
      rescheduledAt: appointmentData.rescheduledAt,
      previousDate: appointmentData.previousDate,
      previousTime: appointmentData.previousTime,
      professional: proData ? {
        name: proData.name,
        slug: proData.slug,
        whatsapp: proData.whatsapp
      } : null
    };

    res.json({
      found: true,
      appointment: safeAppointmentData
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- NEW: DIAGNOSTIC ENDPOINT FOR RESERVATION ---
router.get("/debug-reservation", debugOnly, async (req, res) => {
  try {
    const { slug } = req.query;
    if (!slug) return res.status(400).json({ error: "Missing slug or token" });

    const db = getDb();
    if (!db) throw new Error("Database not connected");

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

/**
 * GET /api/public-profile/:slug
 * Resolves a public profile by slug and returns sanitized data.
 */
router.get("/public-profile/:slug", publicReadLimiter, async (req, res) => {
  const { slug } = req.params;
  const cleanSlug = slug?.toLowerCase()?.trim();

  if (!cleanSlug) {
    return res.status(400).json({ error: "Slug é obrigatório." });
  }

  try {
    const db = getDb();
    if (!db) throw new Error("Database not connected");

    logger.info("PUBLIC_PROFILE", "Fetching public profile", { slug: cleanSlug });

    let uid: string | null = null;

    // 1. Resolve UID via slugs collection (Source of Truth)
    const slugRef = db.collection("slugs").doc(cleanSlug);
    const slugDoc = await slugRef.get();

    if (slugDoc.exists) {
      uid = slugDoc.data()?.uid;
    }

    // 2. Fallback to users collection (for legacy or edge cases)
    if (!uid) {
      const usersQuery = db.collection("users")
        .where("slug", "==", cleanSlug)
        .limit(2);
      
      const usersSnapshot = await usersQuery.get();
      
      if (usersSnapshot.empty) {
        return res.status(404).json({ error: "Perfil não encontrado." });
      }

      if (usersSnapshot.docs.length > 1) {
        logger.warn("PUBLIC_PROFILE", "Conflict: Multiple users for same slug", { slug: cleanSlug });
        return res.status(409).json({ error: "Conflito de link. Entre em contato com o suporte." });
      }

      uid = usersSnapshot.docs[0].id;
    }

    if (!uid) {
      return res.status(404).json({ error: "Perfil não encontrado." });
    }

    // 3. Fetch user data
    const userDoc = await db.collection("users").doc(uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: "Perfil não encontrado." });
    }

    const userData = userDoc.data() || {};

    // 4. Sanitize data - Return ONLY what's needed for the public profile
    const sanitizedData = {
      uid: uid,
      name: userData.name,
      displayName: userData.displayName || userData.businessName || userData.name,
      slug: userData.slug,
      avatar: userData.avatar || userData.photoUrl,
      photoUrl: userData.photoUrl || userData.avatar,
      bio: userData.bio,
      headline: userData.headline,
      specialty: userData.specialty,
      city: userData.city,
      neighborhood: userData.neighborhood,
      address: userData.address || userData.publicAddress,
      serviceMode: userData.serviceMode,
      workingHours: userData.workingHours,
      professionalIdentity: userData.professionalIdentity,
      portfolio: userData.portfolio || [],
      profileTheme: userData.profileTheme,
      paymentMethods: userData.paymentMethods || [],
      instagram: userData.instagram,
      whatsapp: userData.whatsapp,
      plan: userData.plan || 'free',
      onboardingCompleted: userData.onboardingCompleted
    };

    return res.json(sanitizedData);
  } catch (err: any) {
    logger.error("PUBLIC_PROFILE", "Error fetching profile", { slug: cleanSlug, error: err.message });
    return res.status(500).json({ error: "Erro ao carregar perfil." });
  }
});

/**
 * GET /api/profile/public-directory
 * Returns a list of professionals for the directory page, sanitized.
 */
router.get("/public-directory", publicReadLimiter, async (req, res) => {
  try {
    const db = getDb();
    if (!db) throw new Error("Database not connected");

    // Basic query for directory
    // We remove orderBy from firestore to avoid missing documents that lack planRank or averageRating.
    // Memory sort is fine since we apply a limit.
    let q: admin.firestore.Query = db.collection("users")
      .where("onboardingCompleted", "==", true)
      .limit(100); 

    const snapshot = await q.get();
    let professionals = snapshot.docs.map(doc => {
      const data = doc.data();
      // Sanitize: Return only what's needed for the directory card
      return {
        uid: doc.id,
        name: data.name,
        slug: data.slug,
        avatar: data.avatar || data.photoUrl,
        specialty: data.specialty,
        city: data.city,
        neighborhood: data.neighborhood,
        averageRating: data.averageRating || 0,
        totalReviews: data.totalReviews || 0,
        planRank: data.planRank || 0,
        serviceMode: data.serviceMode,
        professionalIdentity: {
          mainSpecialty: data.professionalIdentity?.mainSpecialty,
          differentials: data.professionalIdentity?.differentials
        }
      };
    });

    // Memory sort: planRank desc, then averageRating desc
    professionals.sort((a, b) => {
      if (b.planRank !== a.planRank) {
        return b.planRank - a.planRank;
      }
      return b.averageRating - a.averageRating;
    });

    // Limit to 40 after sorting
    professionals = professionals.slice(0, 40);

    res.json(professionals);
  } catch (err: any) {
    logger.error("PUBLIC_DIRECTORY", "Error fetching directory", { error: err.message });
    res.status(500).json({ error: "Erro ao carregar diretório." });
  }
});

/**
 * GET /api/profile/referrals
 * Returns list of professionals referred by the current user.
 */
router.get("/referrals", requireFirebaseAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDb();
    const uid = req.uid;
    
    // Get current user's referral code
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) return res.status(404).json({ error: "Usuário não encontrado." });
    
    const referralCode = userDoc.data()?.referralCode;
    if (!referralCode) return res.json([]);

    const snapshot = await db.collection("users")
      .where("referredBy", "==", referralCode)
      .limit(100)
      .get();
      
    const referrals = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || 'Nova Profissional',
        email: data.email || '',
        createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt) : new Date().toISOString(),
        plan: data.plan || 'free'
      };
    });

    res.json(referrals);
  } catch (err: any) {
    logger.error("REFERRALS", "Error fetching referrals", { error: err.message });
    res.status(500).json({ error: "Erro ao carregar indicações." });
  }
});

export default router;
