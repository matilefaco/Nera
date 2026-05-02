import { useAuth } from '../AuthContext';
import { PlanFeatures } from '../types';
import { PLAN_CONFIGS, PlanType } from '../constants/plans';

export function usePlanFeatures() {
  const { profile } = useAuth();
  
  const rawPlan = (profile?.plan || 'free').toLowerCase() as PlanType;
  const expiresAt = profile?.planExpiresAt;
  
  // Check if plan is expired
  const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;
  
  // Effective plan
  const activePlan: PlanType = isExpired ? 'free' : (PLAN_CONFIGS[rawPlan] ? rawPlan : 'free');

  const config = PLAN_CONFIGS[activePlan];
  const features: PlanFeatures = config.features;

  const isPremium = () => activePlan !== 'free';
  const isProPlan = () => activePlan === 'pro';

  return {
    features,
    plan: activePlan,
    isExpired,
    isPremium,
    isProPlan,
    allowedThemes: config.themes,
  };
}
