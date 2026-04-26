import { useAuth } from '../AuthContext';
import { PlanFeatures } from '../types';

export function usePlanFeatures() {
  const { profile } = useAuth();
  
  const plan = profile?.plan || 'free';
  const expiresAt = profile?.planExpiresAt;
  
  // Check if plan is expired
  const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;
  
  // Effective plan
  const activePlan = isExpired ? 'free' : plan;

  const features: PlanFeatures = {
    unlimitedBookings: activePlan === 'essencial' || activePlan === 'pro',
    whatsappNotifications: activePlan === 'essencial' || activePlan === 'pro',
    advancedDashboard: activePlan === 'pro',
    waitlist: activePlan === 'pro',
    antiNoShow: activePlan === 'pro',
    coupons: activePlan === 'essencial' || activePlan === 'pro',
    analytics: activePlan === 'pro',
  };

  const isPremium = () => activePlan !== 'free';
  const isProPlan = () => activePlan === 'pro';

  return {
    features,
    plan: activePlan,
    isExpired,
    isPremium,
    isProPlan,
  };
}
