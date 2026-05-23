import express from "express";
import { db, getDb } from "../firebaseAdmin.js";
import admin from "firebase-admin";
import { isValidWhatsapp, isDataUriImage } from "../utils.js";
import { isNonPublicProfile } from "../utils/qualityFilter.js";
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

  // P0: Reserve demo and system slugs
  const RESERVED_SLUGS = ['helena-prado', 'exemplo', 'admin', 'nera', 'suporte', 'ajuda', 'beta'];
  if (RESERVED_SLUGS.includes(slug)) {
    return res.status(400).json({ error: "Este endereço está reservado. Escolha outro link." });
  }

  try {
    logger.info("PROFILE", "Starting transaction", { professionalId: maskUid(uid), meta: { slug } });
    const db = getDb();
    if (!db) throw new Error("Database not connected");

    const result = await db.runTransaction(async (transaction) => {
      const slugRef = db.collection("slugs").doc(slug);
      const userRef = db.collection("users").doc(uid);
      const conflictingUserQuery = db.collection("users").where("slug", "==", slug).limit(2);
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
          throw new Error("Esse link já está sendo usado. Escolha outro endereço.");
        }
      }

      // 2. Safety Net: Check if another user has this slug in their doc but NOT in slugs col
      if (!conflictingUserSnap.empty) {
        const hasOtherUser = conflictingUserSnap.docs.some(doc => doc.id !== uid);
        if (hasOtherUser) {
          logger.warn("PROFILE", "Slug conflict detected (users col fallback)");
          throw new Error("Esse link já está sendo usado. Escolha outro endereço.");
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
        'serviceAreaType', 'serviceAreas', 'travelFeeMode', 'fixedTravelFee', 
        'pricingStrategy', 'workingHours', 'paymentMethods', 'acceptsInstallments',
        'antiNoShowEnabled', 'advancePaymentRequired', 'delayTolerance', 
        'professionalIdentity', 'onboardingCompleted', 'onboardingStep',
        'published', 'indexable', 'avatarSkipped'
      ];

      const filteredProfile: any = {};
      ALLOWED_FIELDS.forEach(field => {
        if (sanitizedProfile[field] !== undefined) {
          // BLOCK base64/data URI in profile fields
          const val = sanitizedProfile[field];
          if (['avatar', 'photoURL', 'coverImage'].includes(field) && isDataUriImage(val)) {
            logger.warn("PROFILE", `Blocked base64 image in field: ${field}`, { professionalId: maskUid(uid) });
            return; // Skip this field
          }
          
          if (field === 'portfolio' && Array.isArray(val)) {
            filteredProfile[field] = val.filter((item: any) => item && item.url && !isDataUriImage(item.url));
            if (filteredProfile[field].length !== val.length) {
               logger.warn("PROFILE", `Filtered out ${val.length - filteredProfile[field].length} base64 portfolio items`, { professionalId: maskUid(uid) });
            }
            return;
          }

          filteredProfile[field] = sanitizedProfile[field];
        }
      });

      // Override with validated/internal values
      if (validatedTheme !== undefined) {
        filteredProfile.profileTheme = validatedTheme;
      }
      filteredProfile.slug = slug;
      filteredProfile.updatedAt = admin.firestore.FieldValue.serverTimestamp();

      // Ensure UID is correct
      filteredProfile.uid = uid;

      // Plan check for premium features
      if (userPlan !== 'pro') {
        if (filteredProfile.acceptsInstallments) {
          logger.warn("PROFILE", "Blocked acceptsInstallments for non-pro user", { professionalId: maskUid(uid), plan: userPlan });
          filteredProfile.acceptsInstallments = false;
        }
      }

      // WhatsApp validation on backend
      const whatsapp = filteredProfile.whatsapp;
      if (whatsapp && !isValidWhatsapp(whatsapp)) {
        logger.warn("PROFILE", "User tried to save invalid WhatsApp", { professionalId: maskUid(uid) });
        throw new Error("WhatsApp inválido. Use formato brasileiro com DDD.");
      }

      // Set publication flags
      let isFinishingOnboarding = filteredProfile.onboardingCompleted === true && !userData?.onboardingCompleted;
      
      let draftMessage: string | null = null;
      let isPublished = filteredProfile.published !== false && (userData?.published !== false || isFinishingOnboarding);

      const combinedData = { ...userData, ...filteredProfile };
      const isTestProfileData = isNonPublicProfile(combinedData);

      // Only perform strict publication validation if the profile is attempting to be published/indexable,
      // or if it implicitly tries to publish during onboarding.
      if (
        filteredProfile.published === true || 
        filteredProfile.indexable === true || 
        isPublished ||
        combinedData.published === true ||
        combinedData.indexable === true ||
        filteredProfile.onboardingCompleted === true
      ) {
        
        const hasMinFields = combinedData.name && combinedData.name.trim().length >= 3 &&
                             combinedData.slug && combinedData.slug.trim().length >= 3 &&
                             combinedData.specialty &&
                             combinedData.city;

        let hasValidService = false;
        if (Array.isArray(services) && services.length > 0) {
           for (const svc of services) {
              const sName = svc?.name?.toLowerCase().trim();
              const isTestSvc = isNonPublicProfile({name: sName, slug: "valid", specialty: "valid", onboardingCompleted: true, indexable: true});
              if (sName && sName.length >= 3 && !isTestSvc) {
                  hasValidService = true;
                  break;
              }
           }
        } else if (!existingServicesSnap.empty) {
           hasValidService = true;
        }

        if (isTestProfileData || !hasMinFields || !hasValidService) {
           filteredProfile.published = false;
           filteredProfile.indexable = false;
           // We explicitly allow onboardingCompleted to remain true so the user is not trapped in an onboarding loop,
           // but we force the profile into DRAFT mode because it failed quality checks.
           isPublished = false;

           if (isTestProfileData) {
             draftMessage = "Esse perfil parece conter dados de teste (QA). Ele foi salvo como rascunho, mas não será publicado como vitrine real.";
             logger.warn("PROFILE", "Test/QA profile prevented from publishing", { professionalId: maskUid(uid), cause: 'isTestProfileData' });
           } else if (!hasMinFields) {
             draftMessage = "Revise algumas informações antes de publicar sua vitrine (nome, especialidade e cidade são obrigatórios).";
             logger.warn("PROFILE", "Incomplete profile prevented from publishing", { professionalId: maskUid(uid), cause: 'missingFields' });
           } else if (!hasValidService) {
             draftMessage = "Adicione pelo menos um serviço com nome válido, duração e preço para publicar a vitrine.";
             logger.warn("PROFILE", "No valid services prevented from publishing", { professionalId: maskUid(uid), cause: 'noValidService' });
           }
        } else if (combinedData.onboardingCompleted) {
           // Auto-recover published/indexable state if they fixed their profile and it now passes quality!
           if (filteredProfile.published !== false) {
             filteredProfile.published = true;
             filteredProfile.indexable = !isNonPublicProfile(combinedData); // Safety indexable check
             isPublished = true;
           }
        }
      }
      
      let isFirstPublish = isPublished && !userData?.profilePublishedAt && !userData?.published;

      const missingDefaults: any = {};
      if (userData?.planRank === undefined) missingDefaults.planRank = 0;
      if (userData?.averageRating === undefined) missingDefaults.averageRating = 0;
      if (userData?.totalReviews === undefined) missingDefaults.totalReviews = 0;

      const finalProfileData = {
        ...filteredProfile,
        ...missingDefaults,
        // Add publication timestamp if this is the first true publish
        ...(isFirstPublish ? { profilePublishedAt: admin.firestore.FieldValue.serverTimestamp() } : {})
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

      return { 
        success: true, 
        slug, 
        published: isFinishingOnboarding || isPublished,
        draftMessage,
        isTestProfile: !!draftMessage, 
        finalState: {
          published: filteredProfile.published,
          indexable: filteredProfile.indexable,
          onboardingCompleted: filteredProfile.onboardingCompleted
        }
      };
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
    const professionalData = proData ? {
      professionalId: proData.uid || appointmentData.professionalId,
      name: proData.name,
      slug: proData.slug,
      plan: proData.plan || 'free',
      workingHours: proData.workingHours || {
        startTime: proData.startTime || '08:00',
        endTime: proData.endTime || '18:00',
        workingDays: proData.workingDays || [1, 2, 3, 4, 5],
        breakStart: proData.breakStart,
        breakEnd: proData.breakEnd
      },
      avatar: isDataUriImage(proData.avatar || proData.photoUrl) ? null : (proData.avatar || proData.photoUrl)
    } : null;

    // P0 CRITICAL: Only expose WhatsApp if the professional is Pro
    if (professionalData && professionalData.plan === 'pro') {
      (professionalData as any).whatsapp = proData.whatsapp;
    }

    const safeAppointmentData = {
      appointmentId: appointmentId,
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
      professional: professionalData
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

    const isTestProfileData = isNonPublicProfile(userData);

    // If it is classified as a non-public/test/fake profile and is NOT the official 'helena-prado' demo, return secure 404
    if (isTestProfileData && cleanSlug !== "helena-prado") {
      logger.warn("PUBLIC_PROFILE", "Blocked access to non-public/test profile", { slug: cleanSlug });
      return res.status(404).json({ error: "Perfil não encontrado." });
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const startStr = startOfMonth.toISOString().split('T')[0];

    // 4. Fetch extra public data to consolidate payload (Improves security and performance)
    const [servicesSnap, reviewsSnap, statsSnap, apptsSnap] = await Promise.all([
      db.collection("services")
        .where("professionalId", "==", uid)
        .where("active", "==", true)
        .get(),
      db.collection("reviews")
        .where("professionalId", "==", uid)
        .where("publicApproved", "==", true)
        .limit(15)
        .get(),
      db.collection("review_stats")
        .doc(uid)
        .get(),
      db.collection("appointments")
        .where("professionalId", "==", uid)
        .where("date", ">=", startStr)
        .get()
    ]);

    let monthlyAppointmentsCount = 0;
    apptsSnap.forEach(doc => {
      const status = doc.data().status;
      if (['confirmed', 'completed', 'accepted'].includes(status)) {
        monthlyAppointmentsCount++;
      }
    });

    let roundedBookings = 0;
    if (monthlyAppointmentsCount >= 100) roundedBookings = 100;
    else if (monthlyAppointmentsCount >= 50) roundedBookings = 50;
    else if (monthlyAppointmentsCount >= 20) roundedBookings = 20;
    else if (monthlyAppointmentsCount >= 10) roundedBookings = 10;
    else roundedBookings = monthlyAppointmentsCount;

    const sanitizedServices = servicesSnap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name,
        description: d.description,
        price: d.price,
        duration: d.duration,
        category: d.category,
        order: d.order
      };
    });

    const sanitizedReviews = reviewsSnap.docs
      .filter(doc => {
        const d = doc.data();
        return d.publicDisplayMode !== 'private' && d.publicDisplayMode !== 'hide';
      })
      .map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          rating: d.rating,
          comment: d.comment,
          firstName: d.firstName,
          tags: d.tags || [],
          publicDisplayMode: d.publicDisplayMode || 'named',
          neighborhood: d.neighborhood,
          serviceName: d.serviceName,
          locationLabel: d.locationLabel,
          submittedAt: d.submittedAt ? (d.submittedAt.toDate ? d.submittedAt.toDate().toISOString() : d.submittedAt) : null
        };
      });

    const statsData = statsSnap.exists ? statsSnap.data() : { averageRating: 0, totalReviews: 0 };
    statsData.totalCompletedBookings = roundedBookings;

    // 5. Sanitize data - Return ONLY what's needed for the public profile
    const sanitizedData: any = {
      professionalId: uid, // Renamed from uid for consistency
      name: userData.name,
      displayName: userData.displayName || userData.businessName || userData.name,
      slug: userData.slug,
      avatar: isDataUriImage(userData.avatar || userData.photoUrl) ? null : (userData.avatar || userData.photoUrl),
      photoUrl: isDataUriImage(userData.photoUrl || userData.avatar) ? null : (userData.photoUrl || userData.avatar),
      bio: userData.bio,
      headline: userData.headline,
      specialty: userData.specialty,
      city: userData.city,
      neighborhood: userData.neighborhood,
      address: userData.address || userData.publicAddress,
      serviceMode: userData.serviceMode,
      workingHours: userData.workingHours,
      professionalIdentity: userData.professionalIdentity,
      portfolio: (userData.portfolio || []).filter((item: any) => item && item.url && !isDataUriImage(item.url)),
      coverImage: isDataUriImage(userData.coverImage) ? null : userData.coverImage,
      profileTheme: userData.profileTheme,
      paymentMethods: userData.paymentMethods || [],
      instagram: userData.instagram,
      plan: userData.plan || 'free',
      acceptsInstallments: false, // Default to false, will be gated below
      services: sanitizedServices,
      reviews: sanitizedReviews,
      stats: statsData
    };

    // P0 CRITICAL: Only expose WhatsApp if the plan is Pro
    if (sanitizedData.plan === 'pro') {
      if (!isTestProfileData) {
        sanitizedData.whatsapp = userData.whatsapp;
      } else {
        // Safe dummy number for test profiles to prevent rendering breaks while keeping privacy
        sanitizedData.whatsapp = "5511999999999";
      }
      
      // P0: Only allow acceptsInstallments if plan is pro AND professional accepts credit card
      const payments = (userData.paymentMethods || []).map((m: any) => String(m).toLowerCase().trim());
      const hasCreditCard = payments.some((m: string) => 
        ['credit_card', 'credito', 'crédito', 'cartao_credito', 'cartão de crédito', 'credit'].includes(m)
      );
      
      if (userData.acceptsInstallments === true && hasCreditCard) {
        sanitizedData.acceptsInstallments = true;
      }
    }

    // Additional P1 protection: mask address or other details for demo (helena-prado) or any test files to not expose real info
    if (isTestProfileData) {
      if (sanitizedData.address) {
        sanitizedData.address = "Endereço Demonstrativo, São Paulo - SP";
      }
      sanitizedData.instagram = "nera_demo";
    }

    return res.json(sanitizedData);
  } catch (err: any) {
    logger.error("PUBLIC_PROFILE", "Error fetching profile", { slug: cleanSlug, error: err.message });
    return res.status(500).json({ error: "Erro ao carregar perfil." });
  }
});

/**
 * GET /api/profile/public-directory
 * Returns a list of professionals for the directory page, sanitized and filtered.
 */
router.get("/public-directory", publicReadLimiter, async (req, res) => {
  try {
    const db = getDb();
    if (!db) throw new Error("Database not connected");

    // P0: Defensive filter list for test/fake accounts
    const BANNED_KEYWORDS = [
      'teste', 'test', 'shitley', 'pilonha', '77777', 'exemplo', 'fake', 'provisorio',
      'asdf', 'qwerty', '12345', 'nenhum', 'vazio', 'null', 'undefined', 'helena-prado',
      'qa', 'audit', 'regress', 'jajajsje', 'bubu', 'bebê', 'fsdf', 'asdasd', 'sadhduahsudhaus',
      'testeeeee', '77777', 'joaquina princesa'
    ];

    // Basic query for directory - only published and indexable profiles
    let q: admin.firestore.Query = db.collection("users")
      .where("onboardingCompleted", "==", true)
      .where("indexable", "==", true)
      .limit(100); 

    const snapshot = await q.get();
    
    let professionals = snapshot.docs
      .map(doc => {
        const data = doc.data();
        
        // Strict quality filtering against any fake, test, QA, example or non-public profile
        if (isNonPublicProfile(data)) return null;

        const name = (data.displayName || data.name || "").trim();

        // Sanitize: Return only what's needed for the directory card.
        return {
          name: name,
          slug: data.slug,
          avatar: isDataUriImage(data.avatar || data.photoUrl) ? null : (data.avatar || data.photoUrl),
          specialty: data.specialty || '',
          city: data.city || '',
          neighborhood: data.neighborhood || '',
          averageRating: data.averageRating || 0,
          totalReviews: data.totalReviews || 0,
          isVerified: (data.planRank || 0) >= 1,
          serviceMode: data.serviceMode,
          professionalIdentity: {
            mainSpecialty: data.professionalIdentity?.mainSpecialty,
            differentials: data.professionalIdentity?.differentials
          },
          // Temporary field for sorting, will be removed before sending
          _planRank: data.planRank || 0
        };
      })
      .filter((p): p is any => p !== null);

    // Memory sort: _planRank desc, then averageRating desc
    professionals.sort((a, b) => {
      if (b._planRank !== a._planRank) {
        return b._planRank - a._planRank;
      }
      return b.averageRating - a.averageRating;
    });

    // Limit to 40 after sorting and remove the temporary sort field
    const finalResults = professionals.slice(0, 40).map(p => {
      const { _planRank, ...rest } = p;
      return rest;
    });

    res.json(finalResults);
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
        name: data.name || 'Nova Profissional',
        slug: data.slug || '',
        specialty: data.specialty || '',
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
