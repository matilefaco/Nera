
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
    }
  },
  essencial: {
    themes: ['terracotta', 'rose', 'sage'],
    features: {
      unlimitedBookings: true,
      whatsappNotifications: true,
      advancedDashboard: false,
      waitlist: false,
      antiNoShow: false,
      coupons: true,
      analytics: false,
      reports: false,
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
    }
  }
};

export const THEME_ACCESS = {
  free: PLAN_CONFIGS.free.themes,
  essencial: PLAN_CONFIGS.essencial.themes,
  pro: PLAN_CONFIGS.pro.themes,
};
