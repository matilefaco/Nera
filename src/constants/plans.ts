
export type PlanType = 'free' | 'essencial' | 'pro';

export interface PlanConfig {
  themes: string[];
  features: {
    unlimitedBookings: boolean;
    whatsappNotifications: boolean;
    advancedDashboard: boolean;
    waitlist: boolean;
    antiNoShow: boolean;
    coupons: boolean;
    analytics: boolean;
    reports: boolean;
    referrals: boolean;
  };
}

export const PLAN_CONFIGS: Record<PlanType, PlanConfig> = {
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

export const THEME_ACCESS = {
  free: PLAN_CONFIGS.free.themes,
  essencial: PLAN_CONFIGS.essencial.themes,
  pro: PLAN_CONFIGS.pro.themes,
};
