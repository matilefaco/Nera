import { getDb } from "../firebaseAdmin.js";
import { PlanFeatures } from "../../src/types.js";

export const checkPlanFeature = (featureName: keyof PlanFeatures) => {
  return async (req: any, res: any, next: any) => {
    const db = getDb();
    // Identifying professionalId from different possible places
    // If req.uid exists, use it exclusively and ignore spoofed body/header values.
    let professionalId = req.uid;
    if (!professionalId) {
      professionalId = req.headers['x-professional-id'] || 
                       req.body?.professionalId || 
                       req.body?.payload?.professionalId || 
                       req.query?.professionalId;
    }
    
    if (!professionalId) {
      return res.status(401).json({
        error: "Identificação do profissional ausente.",
        code: "PLAN_AUTH_REQUIRED"
      });
    }

    try {
      const proDoc = await db.collection('users').doc(String(professionalId)).get();
      if (!proDoc.exists) {
        return res.status(403).json({
          error: "Profissional não encontrado.",
          code: "PLAN_USER_NOT_FOUND"
        });
      }
      
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
        antiNoShow: activePlan === 'essencial' || activePlan === 'pro',
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
      return res.status(503).json({
        error: "Falha ao verificar os limites do plano.",
        code: "PLAN_CHECK_UNAVAILABLE"
      });
    }
  };
};
