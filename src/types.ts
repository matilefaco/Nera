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
  specialty: string;
  bio?: string;
  location?: string;
  whatsapp?: string;
  slug: string;
  avatar?: string;
  neighborhood?: string;
  onboardingCompleted?: boolean;
  onboardingStep?: number;
  professionalIdentity?: ProfessionalIdentity;
  studioAddress?: {
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    reference: string;
  };
  serviceAreas?: { name: string; fee: number }[];
  portfolio?: { id: string; url: string; category: string; createdAt: string }[];
  createdAt: string;
  updatedAt?: string;
}
