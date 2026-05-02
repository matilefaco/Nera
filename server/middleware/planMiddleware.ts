import { db } from "../firebaseAdmin.js";
import { PlanFeatures } from "../../src/types.js";

export const checkPlanFeature = (featureName: keyof PlanFeatures) => {
  return async (req: any, res: any, next: any) => {
    // Identifying professionalId from different possible places
    const professionalId = req.headers['x-professional-id'] || req.body.professionalId || req.query.professionalId;
    
    if (!professionalId) {
      // If we can't identify the professional, we assume it's a request that shouldn't be gated or will be caught later
      return next(); 
    }

    try {
      const proDoc = await db.collection('users').doc(String(professionalId)).get();
      if (!proDoc.exists) return next();
      
      const pro = proDoc.data();
      const plan = pro?.plan || 'free';
      const expiresAt = pro?.planExpiresAt;
      
      const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;
      const activePlan = isExpired ? 'free' : plan;

      const features: PlanFeatures = {
        unlimitedBookings: activePlan === 'essencial' || activePlan === 'pro',
        whatsappNotifications: activePlan === 'essencial' || activePlan === 'pro',
        advancedDashboard: activePlan === 'pro',
        waitlist: activePlan === 'pro',
        antiNoShow: activePlan === 'pro',
        coupons: activePlan === 'essencial' || activePlan === 'pro',
        analytics: activePlan === 'pro',
        reports: activePlan === 'pro',
      };

      if (!features[featureName]) {
        return res.status(403).json({ 
          error: `O recurso '${featureName}' não está disponível no servidor para o seu plano atual (${activePlan}).`,
          feature: featureName,
          plan: activePlan,
          code: 'PLAN_GATED_FEATURE'
        });
      }

      next();
    } catch (err) {
      console.error('Error checking plan feature:', err);
      next();
    }
  };
};
