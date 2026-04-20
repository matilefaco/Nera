import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db, createBookingRequest, handleBookingError } from '../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Clock, ChevronRight, Sparkles, ShieldCheck, Instagram, Info, MessageCircle,
  Plus, X, Camera, ChevronDown, ArrowRight, Star, Zap, CheckCircle2, Users, MapPin, Home, Award
} from 'lucide-react';
import { formatCurrency, cn, buildWhatsappLink, splitSmartBio } from '../lib/utils';
import { toast } from 'sonner';
import Logo from '../components/Logo';
import PremiumButton from '../components/PremiumButton';
import BookingModal from '../components/BookingModal';
import { UserProfile, Service, Review, Appointment } from '../types';

import { getAvailableSlots } from '../lib/bookingUtils';
import { PublicHero } from '../components/public/PublicHero';
import { ServicesSection } from '../components/public/ServicesSection';
import { PortfolioSection } from '../components/public/PortfolioSection';
import { ReviewsSection } from '../components/public/ReviewsSection';
import { AboutSection } from '../components/public/AboutSection';
import { FinalCTA } from '../components/public/FinalCTA';

// --- Static Mock Data for Example Profile ---
const MOCK_PROFILE: UserProfile = {
  uid: 'mock-helena',
  name: 'Helena Prado',
  email: 'helena@exemplo.com',
  whatsapp: '11999999999',
  slug: 'helena-prado',
  avatar: 'https://images.unsplash.com/photo-1607008829749-c0f284a49fc4?auto=format&fit=crop&w=800&q=80',
  bio: 'Especialista em beleza natural e cuidados integrativos. Com mais de 10 anos de experiência, acredito que a beleza real nasce do equilíbrio e do autocuidado consciente.',
  headline: 'Visagista & Especialista em Design de Olhar',
  specialty: 'Beauty Artist',
  city: 'São Paulo',
  neighborhood: 'Jardins',
  serviceMode: 'hybrid',
  workingHours: {
    startTime: '09:00',
    endTime: '19:00',
    workingDays: [1, 2, 3, 4, 5, 6]
  },
  professionalIdentity: {
    mainSpecialty: 'Estética Facial',
    subSpecialties: ['Microagulhamento', 'Limpeza de Pele', 'Peeling'],
    yearsExperience: '5+',
    serviceStyle: ['Premium e sofisticada', 'Técnica e precisa'],
    differentials: ['Pontualidade', 'Biossegurança', 'Produtos premium'],
    attendsAt: 'hybrid'
  },
  portfolio: [
    {
      id: '1',
      url: 'https://images.unsplash.com/photo-1560750588-73207b1ef5b8?auto=format&fit=crop&w=800&q=80',
      category: 'Estética Facial',
      createdAt: new Date().toISOString()
    },
    {
      id: '2',
      url: 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&w=800&q=80',
      category: 'Design de Sobrancelhas',
      createdAt: new Date().toISOString()
    },
    {
      id: '3',
      url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80',
      category: 'Skincare',
      createdAt: new Date().toISOString()
    },
    {
      id: '4',
      url: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=800&q=80',
      category: 'Ritual Facial',
      createdAt: new Date().toISOString()
    },
    {
      id: '5',
      url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80',
      category: 'Transformação',
      createdAt: new Date().toISOString()
    },
  ],
  services: [], // Placeholder, fetched separately in mock logic
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const MOCK_SERVICES: Service[] = [
  { id: 's1', name: 'Design de Sobrancelhas Premium', price: 120, duration: 45, description: 'Mapeamento facial completo e design personalizado com pinça e acabamento.' },
  { id: 's2', name: 'Limpeza de Pele Profunda', price: 250, duration: 90, description: 'Extração cuidadosa, peeling de diamante e máscara revitalizante.' },
  { id: 's3', name: 'Revitalização Facial Nera', price: 180, duration: 60, description: 'Ritual de hidratação profunda com massagem relaxante e ativos botânicos.' }
];

const MOCK_REVIEWS: Review[] = [
  { id: 'r1', bookingId: 'b1', professionalId: 'mock-helena', serviceId: 's1', serviceName: 'Design', rating: 5, tags: ['Pontualidade', 'Excelente'], comment: 'Incrível! O cuidado da Helena é sem igual.', publicDisplayMode: 'named', publicApproved: true, firstName: 'Mariana', neighborhood: 'Pinheiros', createdAt: new Date().toISOString() },
  { id: 'r2', bookingId: 'b2', professionalId: 'mock-helena', serviceId: 's2', serviceName: 'Limpeza', rating: 5, tags: ['Biossegurança'], comment: 'Me sinto renovada após cada sessão.', publicDisplayMode: 'named', publicApproved: true, firstName: 'Beatriz', neighborhood: 'Vila Madalena', createdAt: new Date().toISOString() }
];

const MOCK_STATS = {
  averageRating: 4.9,
  totalReviews: 48,
  totalCompletedBookings: 156,
  topTags: ['Excelência', 'Pontualidade', 'Ambiente Acolhedor']
};

const PublicProfileSkeleton = () => (
  <div className="min-h-screen bg-brand-parchment flex flex-col items-center pt-40 px-6">
    <div className="relative mb-16">
      <div className="w-56 h-72 rounded-[60px] bg-brand-linen/60 border-8 border-brand-white shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-shimmer" />
      </div>
    </div>
    <div className="flex flex-col items-center w-full max-w-4xl space-y-12 mb-20 text-center">
      <div className="space-y-4">
        <div className="h-4 w-40 bg-brand-linen/60 rounded-full mx-auto animate-pulse" />
        <div className="h-10 w-64 bg-brand-linen/80 rounded-xl mx-auto animate-pulse" />
      </div>
      <div className="w-full space-y-6">
        <div className="h-20 md:h-32 w-full bg-brand-linen/40 rounded-[40px] animate-pulse overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shimmer" />
        </div>
      </div>
    </div>
  </div>
);

export default function PublicProfile() {
  const { slug } = useParams();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const servicesRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [preSelectedService, setPreSelectedService] = useState<Service | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showInterestPopup, setShowInterestPopup] = useState(false);
  const [interestPopupDismissed, setInterestPopupDismissed] = useState(false);
  const [nextSlot, setNextSlot] = useState<{ date: string, time: string } | null>(null);
  const [totalWeeklySlots, setTotalWeeklySlots] = useState<number | null>(null);

  const { heroBio, aboutBio } = React.useMemo(() => {
    return splitSmartBio(profile?.bio);
  }, [profile?.bio]);

  const profileState = React.useMemo(() => {
    if (!profile) return null;
    return {
      hasBio: !!profile.bio,
      hasPortfolio: !!(profile.portfolio && profile.portfolio.length > 0),
      hasReviews: reviews.length > 0,
      hasStats: !!(stats?.totalCompletedBookings > 0 || stats?.averageRating),
      hasDifferentials: !!(profile.professionalIdentity?.differentials && profile.professionalIdentity.differentials.length > 0)
    };
  }, [profile, reviews, stats]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100);
      const scrollPercent = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
      if (scrollPercent > 0.7 && !showInterestPopup && !interestPopupDismissed && !isBookingModalOpen) {
        setShowInterestPopup(true);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [showInterestPopup, interestPopupDismissed, isBookingModalOpen]);

  useEffect(() => {
    const fetchData = async () => {
      if (!slug) {
        setLoading(false);
        return;
      }

      if (slug === 'helena-prado' || slug === 'exemplo') {
        setTimeout(() => {
          setProfile(MOCK_PROFILE);
          setServices(MOCK_SERVICES);
          setReviews(MOCK_REVIEWS);
          setStats(MOCK_STATS);
          setLoading(false);
        }, 500);
        return;
      }

      try {
        const q = query(collection(db, 'users'), where('slug', '==', slug));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const userData = snapshot.docs[0].data();
          const professionalId = snapshot.docs[0].id;
          setProfile({ ...userData, uid: professionalId } as UserProfile);
          
          const servicesQ = query(collection(db, 'services'), 
            where('professionalId', '==', professionalId), 
            where('active', '==', true)
          );
          const servicesSnapshot = await getDocs(servicesQ);
          setServices(servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service)));

          const statsDoc = await getDocs(query(collection(db, 'review_stats'), where('professionalId', '==', professionalId)));
          if (!statsDoc.empty) {
            setStats(statsDoc.docs[0].data());
          }

          const reviewsQ = query(
            collection(db, 'reviews'), 
            where('professionalId', '==', professionalId),
            where('publicApproved', '==', true),
            where('publicDisplayMode', 'in', ['named', 'anonymous'])
          );
          const reviewsSnapshot = await getDocs(reviewsQ);
          setReviews(reviewsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review)));

          if (!userData.portfolio || userData.portfolio.length === 0) {
            const portfolioQ = query(collection(db, 'users', professionalId, 'portfolio'), orderBy('createdAt', 'desc'));
            const portfolioSnapshot = await getDocs(portfolioQ);
            if (!portfolioSnapshot.empty) {
              const portfolioItems = portfolioSnapshot.docs.map(doc => ({
                id: doc.id,
                url: doc.data().url || doc.data().imageUrl,
                category: doc.data().category,
                createdAt: doc.data().createdAt || new Date().toISOString()
              }));
              setProfile(prev => prev ? { ...prev, portfolio: portfolioItems } : null);
            }
          }
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error("Error fetching public profile:", error);
        toast.error('Não foi possível carregar as informações agora.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [slug]);

  useEffect(() => {
    const findAvailabilityData = async () => {
      if (!profile?.uid || !profile?.workingHours || services.length === 0) return;
      const duration = Number(services[0]?.duration) || 60;
      let totalCount = 0;
      let firstSlotFound = false;
      
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        const apptsQ = query(
          collection(db, 'appointments'),
          where('professionalId', '==', profile.uid),
          where('date', '==', dateStr),
          where('status', 'in', ['confirmed', 'completed'])
        );
        const snapshot = await getDocs(apptsQ);
        const appts = snapshot.docs.map(doc => doc.data() as Appointment);
        
        const slots = getAvailableSlots({
          selectedDate: dateStr,
          serviceDuration: duration,
          workingHours: profile.workingHours,
          appointments: appts,
          manualBlockedSlots: []
        });

        totalCount += slots.length;
        if (slots.length > 0 && !firstSlotFound) {
          setNextSlot({ date: dateStr, time: slots[0] });
          firstSlotFound = true;
        }
      }
      setTotalWeeklySlots(totalCount);
    };
    
    if (profile && services.length > 0) {
      findAvailabilityData();
    }
  }, [profile, services]);

  const urgencyInfo = React.useMemo(() => {
    if (!profile || services.length === 0 || totalWeeklySlots === null) return null;
    let message = "Horários limitados nesta semana";
    let isUrgent = true;
    if (totalWeeklySlots > 10) {
      message = "Agenda aberta para novos atendimentos";
      isUrgent = false;
    } else if (totalWeeklySlots === 0) {
      message = "Alta procura nos próximos dias";
    }
    return { message, isUrgent, isAgendaFull: totalWeeklySlots === 0 };
  }, [profile, services, totalWeeklySlots]);

  if (loading) return <PublicProfileSkeleton />;
  
  if (!profile) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-brand-parchment p-6 text-center">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-24 h-24 bg-brand-linen text-brand-terracotta rounded-full flex items-center justify-center mb-10 border border-brand-mist shadow-sm">
        <Info size={40} strokeWidth={1.5} />
      </motion.div>
      <h1 className="text-4xl font-serif font-normal text-brand-ink mb-6">Página não encontrada</h1>
      <p className="body-text text-brand-stone mb-12 max-w-sm mx-auto leading-relaxed">
        O link que você acessou pode estar incorreto ou o perfil da profissional ainda não foi publicado.
      </p>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <Link to="/" className="w-full sm:w-auto bg-brand-ink text-brand-white px-10 py-5 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all premium-shadow">Voltar para o início</Link>
        <Link to="/p/helena-prado" className="w-full sm:w-auto bg-brand-white text-brand-ink border border-brand-mist px-10 py-5 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-linen transition-all">Ver perfil de exemplo</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-brand-parchment flex flex-col selection:bg-brand-terracotta/10">
      <AnimatePresence>
        {scrolled && !isBookingModalOpen && !loading && (
          <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[150] md:hidden">
            <button onClick={() => setIsBookingModalOpen(true)} className="flex items-center gap-3 bg-brand-ink text-brand-white px-7 py-4 rounded-full text-[10px] font-bold uppercase tracking-[0.18em] shadow-2xl hover:bg-brand-terracotta transition-all whitespace-nowrap active:scale-95">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-terracotta animate-pulse" />
              Reservar horário
              <ArrowRight size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <PublicHero 
        profile={profile} services={services} nextSlot={nextSlot} 
        heroBio={heroBio}
        onBookingClick={(s) => { if(s) setPreSelectedService(s); setIsBookingModalOpen(true); }} 
      />

      <div ref={servicesRef}>
        <ServicesSection 
          services={services} 
          onSelectService={(s) => { setPreSelectedService(s); setIsBookingModalOpen(true); }} 
        />
      </div>

      <PortfolioSection portfolio={profile.portfolio || []} onBookingClick={() => setIsBookingModalOpen(true)} />
      <AboutSection profile={profile} aboutBio={aboutBio} />
      <ReviewsSection reviews={reviews} stats={stats} />
      <FinalCTA onBookingClick={() => setIsBookingModalOpen(true)} completedBookings={stats?.totalCompletedBookings} />

      <footer className="bg-brand-white border-t border-brand-mist py-14 px-6 text-center">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-7">
          <div className="text-[12px] font-normal tracking-[0.4em] uppercase text-brand-stone opacity-40">Nera</div>
          <div className="flex flex-wrap justify-center gap-8">
            <Link to="/" className="text-[9px] font-medium uppercase tracking-widest text-brand-stone hover:text-brand-ink transition-colors">Início</Link>
            <Link to="/profissional" className="text-[9px] font-medium uppercase tracking-widest text-brand-stone hover:text-brand-ink transition-colors">Seja uma Profissional</Link>
          </div>
          <div className="flex gap-4">
            {profile.instagram && (
              <a href={`https://instagram.com/${profile.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full border border-brand-mist flex items-center justify-center text-brand-stone hover:text-brand-terracotta transition-all">
                <Instagram size={15} />
              </a>
            )}
            {profile.whatsapp && (
              <a href={buildWhatsappLink(profile.whatsapp)} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full border border-brand-mist flex items-center justify-center text-brand-stone hover:text-brand-terracotta transition-all">
                <MessageCircle size={15} />
              </a>
            )}
          </div>
          <p className="text-[8px] uppercase tracking-[0.15em] text-brand-stone opacity-30 mt-4">© {new Date().getFullYear()} {profile.name} · Powered by Nera</p>
        </div>
      </footer>

      <BookingModal profile={profile} services={services} open={isBookingModalOpen} onClose={() => setIsBookingModalOpen(false)} initialService={preSelectedService} />

      <AnimatePresence>
        {showInterestPopup && !isBookingModalOpen && (
          <div className="fixed bottom-8 left-6 right-6 md:left-auto md:right-10 md:w-96 z-[400]">
            <motion.div initial={{ y: 100, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 100, opacity: 0, scale: 0.9 }} className="bg-brand-ink text-brand-white p-8 rounded-[40px] shadow-2xl relative overflow-hidden border border-white/10">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand-terracotta/20 rounded-full blur-3xl" />
              <button onClick={() => { setShowInterestPopup(false); setInterestPopupDismissed(true); }} className="absolute top-6 right-6 p-1 text-white/40 hover:text-white transition-colors">
                <X size={18} />
              </button>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-terracotta animate-pulse" />
                  <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/60">
                    Horário disponível
                  </span>
                </div>
                <h3 className="text-xl font-serif mb-2 leading-tight">
                  Ainda está pensando?
                </h3>
                <p className="text-xs text-white/60 font-light mb-8 leading-relaxed">
                  A agenda da {profile?.name.split(' ')[0]} costuma fechar rápido esta semana.
                </p>
                <div className="flex flex-col gap-3">
                  <PremiumButton variant="terracotta" className="w-full py-4 text-[10px]" onClick={() => { setShowInterestPopup(false); setIsBookingModalOpen(true); }}>Reservar agora</PremiumButton>
                  <a href={buildWhatsappLink(profile?.whatsapp)} target="_blank" className="flex items-center justify-center gap-2 py-4 text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors">
                    <MessageCircle size={14} /> Falar no WhatsApp
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
