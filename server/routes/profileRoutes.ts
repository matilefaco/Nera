import express from 'express';
import { getDb } from '../firebaseAdmin.js';
import admin from 'firebase-admin';

export const profileRouter = express.Router();

// Middleware to parse JSON if not already parsed
profileRouter.use(express.json());

profileRouter.post("/complete-onboarding", async (req, res) => {
  const { userId, profile, address, services } = req.body;
  const db = getDb();

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  if (!services || services.length === 0) {
    return res.status(400).json({ error: "Adicione pelo menos um serviço para publicar sua página." });
  }

  try {
    const batch = db.batch();

    // 1. Update user profile
    const userRef = db.collection('users').doc(userId);
    batch.update(userRef, {
      ...profile,
      studioAddress: address,
      onboardingCompleted: true,
      onboardingStep: 6, // Final step
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 2. Clear existing services to avoid duplicates if re-running onboarding (as per requirement 8)
    // Note: Requirement 8 says "não duplicar serviços". Clearing and re-creating is one way, 
    // or checking existing ones. For simplicity and following "FIX ESTRUTURAL", we ensure a fresh sync.
    const existingServices = await db.collection('services').where('professionalId', '==', userId).get();
    existingServices.forEach(doc => {
      batch.delete(doc.ref);
    });

    // 3. Create new services
    services.forEach((service: any) => {
      const serviceRef = db.collection('services').doc();
      batch.set(serviceRef, {
        ...service,
        professionalId: userId, // Ensure real UID is used
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    await batch.commit();

    console.log(`[ONBOARDING_COMPLETED] User: ${userId}, Services: ${services.length}`);
    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("[ONBOARDING_ERROR]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

profileRouter.get("/", (req, res) => res.json({ msg: "Profile API Active" }));
