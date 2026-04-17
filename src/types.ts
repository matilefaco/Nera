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
  pinterest?: string;
  facebook?: string;
  
  serviceMode: 'studio' | 'home' | 'hybrid';
  serviceAreaType?: 'city_wide' | 'custom';
  pricingStrategy?: 'extra' | 'none'; // Official pricing strategy
  
  workingHours: WorkingHours; // Official format
  
  professionalIdentity?: ProfessionalIdentity; // Official structure
  
  services: Service[];
  serviceAreas?: ServiceArea[];
  portfolio?: PortfolioItem[];
  
  studioAddress?: {
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    reference: string;
  };
  
  onboardingCompleted?: boolean;
  onboardingStep?: number;
  
  createdAt: string;
  updatedAt: string;

  // --- LEGACY FIELDS FOR COMPATIBILITY ---
  startTime?: string; // Legacy field
  endTime?: string; // Legacy field
  workingDays?: number[]; // Legacy field
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
  clientEmail: string;
  clientWhatsapp: string;
  
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
  address?: string;
  
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
  
  professionalId: string;
  professionalName?: string;
  
  createdAt: string;
  updatedAt?: string;
}
