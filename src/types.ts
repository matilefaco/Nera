export interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
  description?: string;
}

export interface PortfolioItem {
  id: string;
  url: string;
  category?: string;
  createdAt: string;
}

export interface ServiceArea {
  name: string;
  fee: number;
}

export interface WorkingHours {
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  workingDays: number[]; // 0-6 (Sunday-Saturday)
}

export interface ProfessionalIdentity {
  mainSpecialty: string;
  subSpecialties: string[];
  yearsExperience: string; // "1-2", "3-5", "5+"
  serviceStyle: string[]; // e.g., ["Delicada e detalhista", "Rápida e eficiente"]
  differentials: string[]; // e.g., ["Pontualidade", "Biossegurança"]
  attendsAt: 'studio' | 'home' | 'hybrid';
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  whatsapp: string;
  slug: string; // Unique public identifier (official)
  
  avatar?: string;
  bio?: string; // Top-level official (removed from professionalIdentity)
  headline?: string; // Top-level official (removed from professionalIdentity)
  specialty?: string;
  city?: string;
  neighborhood?: string;
  
  instagram?: string; // Official social link
  paymentMethods?: ('pix' | 'credito' | 'debito' | 'dinheiro' | 'transferencia')[];
  
  // Anti No-Show Settings
  antiNoShowEnabled?: boolean;
  advancePaymentRequired?: boolean;
  delayTolerance?: 10 | 15 | 20;

  pinterest?: string;
  facebook?: string;
  
  serviceMode: 'studio' | 'home' | 'hybrid';
  serviceAreaType?: 'city_wide' | 'custom';
  pricingStrategy?: 'extra' | 'none'; // Official pricing strategy
  
  workingHours: WorkingHours; // Official format
  
  professionalIdentity?: ProfessionalIdentity; // Official structure
  
  /** @deprecated Use standalone services collection. Do NOT write to this field. */
  services: Service[];
  serviceAreas?: ServiceArea[];
  portfolio?: PortfolioItem[];
  
  studioAddress?: {
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state?: string;
    reference: string;
    
    // Complementary info
    hasParking?: boolean;
    parkingInfo?: string;
    hasAccessibility?: boolean;
    accessibilityInfo?: string;
    isSafeLocation?: boolean;
    locationNotes?: string;
    privacyMode?: 'public_full' | 'neighborhood_only';
  };
  
  onboardingCompleted?: boolean;
  onboardingStep?: number;
  
  waitlistMode?: 'auto' | 'manual';
  callmebotApiKey?: string;
  callmebotPhone?: string;
  whatsappNotificationsEnabled?: boolean;
  
  createdAt: string;
  plan?: 'free' | 'essencial' | 'pro';
  planExpiresAt?: string; // ISO date
  trialStartedAt?: string;
  referralCode?: string; // código único de indicação
  updatedAt: string;

  // --- LEGACY FIELDS FOR COMPATIBILITY ---
  /** @deprecated Use workingHours.startTime */
  startTime?: string;
  /** @deprecated Use workingHours.endTime */
  endTime?: string;
  /** @deprecated Use workingHours.workingDays */
  workingDays?: number[];
}

export interface Review {
  id: string;
  bookingId: string;
  professionalId: string;
  serviceId: string;
  serviceName: string;
  rating: number;
  tags: string[];
  comment?: string;
  publicDisplayMode: 'named' | 'anonymous' | 'private';
  publicApproved: boolean;
  firstName: string;
  neighborhood?: string;
  createdAt: string;
}

export interface Appointment {
  id: string;
  
  clientName: string;
  clientEmail: string; // Mandatory
  clientWhatsapp: string;
  clientMessage?: string;
  
  serviceId: string;
  serviceName: string;
  duration: number;
  price: number;
  travelFee?: number;
  totalPrice?: number;
  
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  
  locationType: 'studio' | 'home';
  locationDetail?: string; // neighborhood or address
  neighborhood?: string;
  address?: string | {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    reference?: string;
  };
  
  status: 'pending' | 'accepted' | 'confirmed' | 'cancelled' | 'cancelled_by_client' | 'cancelled_by_professional' | 'completed' | 'expired';
  notes?: string;
  
  clientConfirmedAt?: any; // When client hits "confirm presence"
  cancellationReason?: string; // Why it was cancelled
  rescheduledAt?: any; // When it was last rescheduled (client or pro)
  previousDate?: string; 
  previousTime?: string;
  lastChangeBy?: 'professional' | 'client' | 'system';
  changeMessage?: string; // Summary of change for alerts
  
  // Anti-No-Show System
  clientScore?: 'reliable' | 'attention' | 'risk';
  reminder24hSentAt?: any;
  reminder6hSentAt?: any;
  reviewRequestedAt?: any;
  reviewedAt?: any;
  waitlistNotifiedAt?: any;
  token: string;
  publicToken?: string;
  manageToken?: string;
  reservationCode?: string;
  manageSlug?: string;

  professionalId: string;
  professionalName?: string;
  professionalWhatsapp?: string;
  
  clientConfirmed24h?: boolean;
  noShow?: boolean; // Marked by professional if client missed
  retentionSent?: boolean; // For repurchase system

  couponId?: string;
  appliedCouponCode?: string;

  createdAt: any;
  updatedAt?: any;
}

export interface BlockedSchedule {
  id: string;
  professionalId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  reason?: 'compromisso' | 'descanso' | 'curso' | 'pessoal' | 'outro';
  customReason?: string;
  type: 'manual' | 'automatic' | 'full_day';
  isRecurring?: boolean;
  recurringDays?: number[]; // 0-6
  createdAt: any;
}

export interface WaitlistEntry {
  id: string;
  professionalId: string;
  clientName: string;
  clientWhatsapp: string;
  requestedDate: string; // YYYY-MM-DD
  serviceId: string;
  serviceName: string;
  period: 'morning' | 'afternoon' | 'night' | 'any';
  preferredTime?: string; // HH:mm
  assignedTime?: string; // HH:mm assigned by system or pro
  status: 'waiting' | 'invited' | 'expired' | 'booked' | 'cancelled';
  invitationSentAt?: any;
  invitationExpiresAt?: any;
  createdAt: any;
}

export interface WaitlistStats {
  recoveredSlots: number;
  savedRevenue: number;
  totalEntries: number;
}

export interface Coupon {
  id: string;
  professionalId: string;
  code: string; // Ex: "PRIMEIRA10"
  type: 'percentage' | 'fixed'; // % ou valor fixo
  value: number; // 10 = 10% ou R$10
  description?: string; // "10% no primeiro atendimento"
  maxUses?: number; // null = ilimitado
  usedCount: number;
  expiresAt?: string; // ISO date
  active: boolean;
  serviceIds?: string[]; // null = todos os serviços
  createdAt: any;
}

export interface AnalyticsEvent {
  id: string;
  professionalId: string;
  type: 'visit' | 'click_book';
  referrer?: string;
  origin: 'instagram' | 'direct' | 'other';
  timestamp: any;
}

export interface ClientSummary {
  id: string; // professionalId_clientKey
  professionalId: string;
  clientKey: string; // phone (clean) or email
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  totalAppointments: number;
  confirmedAppointments: number;
  cancelledAppointments: number;
  noShowCount: number;
  totalSpent: number;
  lastAppointmentDate: string;
  lastServiceName: string;
  firstAppointmentDate: string;
  updatedAt: string;
  createdAt: string;
}
