import { useAuth } from '../AuthContext';
import { PlanFeatures } from '../types';
import { PLAN_CONFIGS, PlanType } from '../constants/plans';
import { isCaptureMode } from '../constants/captureMode';
import { isDemoEmail } from '../constants/demoAccounts';

export function usePlanFeatures() {
  const { profile, user } = useAuth();
  
  const isCapture = isCaptureMode();

  const isLocalDevelopmentEnvironment = 
    typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || 
     window.location.hostname === '127.0.0.1' || 
     import.meta.env.DEV);

  const canUseCapturePro =
    isCapture &&
    (
      isDemoEmail(user?.email) ||
      (profile?.isDemo === true && profile?.demoProfile === "studio-aurora") ||
      isLocalDevelopmentEnvironment
    );

  const rawPlan = canUseCapturePro ? 'pro' : ((profile?.plan || 'free').toLowerCase() as PlanType);
  const signupPlan = canUseCapturePro ? 'pro' : (profile?.signupPlan as PlanType | undefined);
  const expiresAt = canUseCapturePro ? null : profile?.planExpiresAt;
  const subStatus = canUseCapturePro ? 'active' : profile?.stripeSubscriptionStatus;
  
  // 1. Hard block if account is being deleted
  let isExpired = false;
  
  if (!canUseCapturePro && (profile?.accountStatus === 'scheduled_for_deletion' || profile?.accountStatus === 'deleted')) {
    isExpired = true;
  } else if (!canUseCapturePro && rawPlan !== 'free') {
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
  const activePlan: PlanType = canUseCapturePro ? 'pro' : (isExpired ? 'free' : (PLAN_CONFIGS[rawPlan] ? rawPlan : 'free'));

  const config = PLAN_CONFIGS[activePlan];
  const features: PlanFeatures = config.features;

  const isPremium = () => canUseCapturePro || activePlan !== 'free';
  const isProPlan = () => canUseCapturePro || activePlan === 'pro';

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
