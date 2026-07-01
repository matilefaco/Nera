
export type PlanType = 'free' | 'essencial' | 'pro';

export interface PlanConfig {
  themes: string[];
  portfolioLimit: number;
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
    exportCsv: boolean;
    crm: boolean;
  };
}

export const PLAN_CONFIGS: Record<PlanType, PlanConfig> = {
  free: {
    themes: ['terracotta'],
    portfolioLimit: 6,
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
      exportCsv: false,
      crm: false,
    }
  },
  essencial: {
    themes: ['terracotta', 'rose', 'sage'],
    portfolioLimit: 12,
    features: {
      unlimitedBookings: true,
      whatsappNotifications: false,
      advancedDashboard: false,
      waitlist: false,
      antiNoShow: true,
      coupons: false,
      analytics: true,
      reports: false,
      referrals: false,
      exportCsv: true,
      crm: false,
    }
  },
  pro: {
    themes: ['terracotta', 'rose', 'sage', 'navy', 'plum'],
    portfolioLimit: 18,
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
      exportCsv: true,
      crm: true,
    }
  }
};

export const THEME_ACCESS = {
  free: PLAN_CONFIGS.free.themes,
  essencial: PLAN_CONFIGS.essencial.themes,
  pro: PLAN_CONFIGS.pro.themes,
};
