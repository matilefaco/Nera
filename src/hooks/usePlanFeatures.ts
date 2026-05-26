import { useAuth } from '../AuthContext';
import { PlanFeatures } from '../types';
import { PLAN_CONFIGS, PlanType } from '../constants/plans';

export function usePlanFeatures() {
  const { profile } = useAuth();
  
  const rawPlan = (profile?.plan || 'free').toLowerCase() as PlanType;
  const signupPlan = profile?.signupPlan as PlanType | undefined;
  const expiresAt = profile?.planExpiresAt;
  const subStatus = profile?.stripeSubscriptionStatus;
  
  // 1. Hard block if account is being deleted
  let isExpired = false;
  
  if (profile?.accountStatus === 'scheduled_for_deletion' || profile?.accountStatus === 'deleted') {
    isExpired = true;
  } else if (rawPlan !== 'free') {
    // 2. Strict subscription verification
    const timeIsExpired = expiresAt ? new Date(expiresAt).getTime() < Date.now() : false;
    
    // A subscription is considered "Good standing" if active or trialing
    const hasActiveSub = subStatus === 'active' || subStatus === 'trialing';
    
    // If explicit expiration date has passed, it's expired
    if (expiresAt && timeIsExpired) {
      isExpired = true;
    } 
    // If not in good standing, they ONLY keep access if they have a verifiable future expiration date
    // (e.g. they canceled but still have paid time remaining)
    else if (!hasActiveSub) {
      if (!expiresAt || timeIsExpired) {
        isExpired = true;
      }
    }
  }
  
  // Effective plan handles fallbacks securely
  const activePlan: PlanType = isExpired ? 'free' : (PLAN_CONFIGS[rawPlan] ? rawPlan : 'free');

  const config = PLAN_CONFIGS[activePlan];
  const features: PlanFeatures = config.features;

  const isPremium = () => activePlan !== 'free';
  const isProPlan = () => activePlan === 'pro';

  return {
    features,
    plan: activePlan,
    signupPlan,
    isExpired,
    isPremium,
    isProPlan,
    allowedThemes: config.themes,
    portfolioLimit: config.portfolioLimit,
  };
}
