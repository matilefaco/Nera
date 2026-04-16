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
  startTime: string;
  endTime: string;
  workingDays: number[]; // 0-6 (Sunday-Saturday)
}

export interface ProfessionalIdentity {
  mainSpecialty: string;
  subSpecialties: string[];
  yearsExperience: string; // "1-2", "3-5", "5+"
  serviceStyle: string[]; // e.g., ["Delicada e detalhista", "Rápida e eficiente"]
  differentials: string[]; // e.g., ["Pontualidade", "Biossegurança"]
  attendsAt: 'studio' | 'home' | 'hybrid';
  bio: string;
  headline: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  username: string; // slug/username
  email: string;
  whatsapp: string;
  avatar?: string;
  bio?: string;
  headline?: string;
  specialty?: string;
  city?: string;
  neighborhood?: string;
  slug?: string; // Alias for username
  serviceAreaType?: 'city_wide' | 'custom';
  
  professionalIdentity?: ProfessionalIdentity;
  
  services: Service[];
  
  workingHours: WorkingHours;
  
  serviceMode: 'studio' | 'home' | 'hybrid';
  
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
  
  status: 'pending' | 'confirmed' | 'declined' | 'cancelled';
  
  professionalId: string;
  professionalName?: string;
  
  createdAt: string;
  updatedAt?: string;
}
