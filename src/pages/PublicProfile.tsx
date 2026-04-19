import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db, createBookingRequest, handleBookingError } from '../firebase';
import { collection, query, where, getDocs, addDoc, orderBy, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, Phone, Calendar as CalendarIcon, Clock, 
  CheckCircle2, ChevronRight, ArrowLeft, Sparkles,
  ShieldCheck, Instagram, Heart, Info, MessageCircle,
  ExternalLink, ArrowDown, Star, Share2, Copy,
  Check, Award, Users, Zap, HelpCircle, Home, Plus, X, Camera, Building2, Globe, ChevronDown, ArrowRight
} from 'lucide-react';
import { formatCurrency, cn, getHumanError, buildWhatsappLink } from '../lib/utils';
import { toast } from 'sonner';
import Logo from '../components/Logo';
import AppLoadingScreen from '../components/AppLoadingScreen';
import PremiumButton from '../components/PremiumButton';
import BookingModal from '../components/BookingModal';
import { UserProfile, Service, Review, ServiceArea, Appointment } from '../types';

import { getAvailableSlots } from '../lib/bookingUtils';

// --- Static Mock Data for Example Profile ---
const MOCK_PROFILE: UserProfile = {
  uid: 'mock-helena',
  name: 'Helena Prado',
  email: 'helena@exemplo.com',
  whatsapp: '11999999999',
  slug: 'helena-prado',
  avatar: 'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?auto=format&fit=crop&q=80&w=800',
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
    { id: '1', url: 'https://picsum.photos/seed/beauty1/800/1000', category: 'Design', createdAt: new Date().toISOString() },
    { id: '2', url: 'https://picsum.photos/seed/beauty2/800/1000', category: 'Skincare', createdAt: new Date().toISOString() },
    { id: '3', url: 'https://picsum.photos/seed/beauty3/800/1000', category: 'Maquiagem', createdAt: new Date().toISOString() }
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

// --- Sub-components for the Premium Slug Page ---

interface SectionHeadingProps {
  label: string;
  title: string;
  subtitle?: string;
  centered?: boolean;
}

const SectionHeading = ({ label, title, subtitle, centered = true }: SectionHeadingProps) => (
  <div className={cn("mb-16", centered ? "text-center" : "text-left")}>
    <span className="label-text mb-4 block">{label}</span>
    <h2 className="heading-section text-brand-ink mb-4">{title}</h2>
    {subtitle && <p className="body-text text-brand-stone max-w-lg mx-auto italic">{subtitle}</p>}
  </div>
);

const PublicProfileSkeleton = () => (
  <div className="min-h-screen bg-brand-parchment flex flex-col items-center pt-40 px-6">
    {/* Avatar Skeleton */}
    <div className="relative mb-16">
      <div className="w-56 h-72 rounded-[60px] bg-brand-linen/60 border-8 border-brand-white shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-shimmer" />
      </div>
    </div>

    {/* Identity Skeleton */}
    <div className="flex flex-col items-center w-full max-w-4xl space-y-12 mb-20 text-center">
      <div className="space-y-4">
        <div className="h-4 w-40 bg-brand-linen/60 rounded-full mx-auto animate-pulse" />
        <div className="h-10 w-64 bg-brand-linen/80 rounded-xl mx-auto animate-pulse" />
      </div>

      <div className="w-full space-y-6">
        <div className="h-20 md:h-32 w-full bg-brand-linen/40 rounded-[40px] animate-pulse overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shimmer" />
        </div>
        <div className="h-4 w-3/4 bg-brand-linen/30 rounded-full mx-auto animate-pulse" />
        <div className="h-4 w-1/2 bg-brand-linen/20 rounded-full mx-auto animate-pulse" />
      </div>
    </div>

    {/* Section Divider Skeleton */}
    <div className="w-full max-w-6xl flex items-center gap-4 mb-16">
      <div className="h-px flex-1 bg-brand-mist/50" />
      <div className="h-4 w-32 bg-brand-linen/40 rounded-full animate-pulse" />
      <div className="h-px flex-1 bg-brand-mist/50" />
    </div>

    {/* Services Grid Skeleton */}
    <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20 text-left">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-brand-white p-10 rounded-[40px] border border-brand-mist h-64 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-brand-parchment/30 to-transparent -translate-x-full animate-shimmer" />
          <div className="space-y-4 relative z-10">
            <div className="h-7 w-3/4 bg-brand-linen/60 rounded-lg animate-pulse" />
            <div className="h-4 w-full bg-brand-linen/30 rounded-lg animate-pulse" />
            <div className="h-4 w-5/6 bg-brand-linen/20 rounded-lg animate-pulse" />
          </div>
          <div className="h-14 w-full bg-brand-linen/30 rounded-full relative z-10 animate-pulse" />
        </div>
      ))}
    </div>
  </div>
);

export default function PublicProfile() {
  const { slug } = useParams();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<any>(null); // Stats type not fully defined yet, keeping any for now
  const [loading, setLoading] = useState(true);
  const servicesRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  
  // Profile Completeness Logic
  const profileState = React.useMemo(() => {
    if (!profile) return null;
    return {
      hasBio: !!profile.bio,
      hasPortfolio: !!(profile.portfolio && profile.portfolio.length > 0),
      hasReviews: reviews.length > 0,
      hasStats: !!(stats?.totalCompletedBookings > 0 || stats?.averageRating),
      hasDifferentials: !!(profile.professionalIdentity?.differentials && profile.professionalIdentity.differentials.length > 0),
      hasServiceAreas: !!(profile.serviceAreas && profile.serviceAreas.length > 0),
      isNew: reviews.length === 0 && (!stats || stats.totalCompletedBookings < 5)
    };
  }, [profile, reviews, stats]);

  // UI & Summary State
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [preSelectedService, setPreSelectedService] = useState<Service | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [hasInteractedWithService, setHasInteractedWithService] = useState(false);
  const [showInterestPopup, setShowInterestPopup] = useState(false);
  const [interestPopupDismissed, setInterestPopupDismissed] = useState(false);
  const [nextSlot, setNextSlot] = useState<{ date: string, time: string } | null>(null);
  const [totalWeeklySlots, setTotalWeeklySlots] = useState<number | null>(null);

  // Interest detection logic stays in PublicProfile
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100);
      
      // Interest Detection: Scroll reach 70%
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

      // Check for Example/Demo Slug
      if (slug === 'helena-prado' || slug === 'exemplo') {
        setTimeout(() => {
          setProfile(MOCK_PROFILE);
          setServices(MOCK_SERVICES);
          setReviews(MOCK_REVIEWS);
          setStats(MOCK_STATS);
          setLoading(false);
        }, 500); // Small delay for UX transition
        return;
      }

      try {
        const q = query(collection(db, 'users'), where('slug', '==', slug));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const userData = snapshot.docs[0].data();
          const professionalId = snapshot.docs[0].id;
          setProfile({ ...userData, uid: professionalId });
          
          // Fetch Services
          const servicesQ = query(collection(db, 'services'), 
            where('professionalId', '==', professionalId), 
            where('active', '==', true)
          );
          const servicesSnapshot = await getDocs(servicesQ);
          setServices(servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

          // Fetch Stats
          const statsDoc = await getDocs(query(collection(db, 'review_stats'), where('professionalId', '==', professionalId)));
          if (!statsDoc.empty) {
            setStats(statsDoc.docs[0].data());
          }

          // Fetch Reviews
          const reviewsQ = query(
            collection(db, 'reviews'), 
            where('professionalId', '==', professionalId),
            where('publicApproved', '==', true),
            where('publicDisplayMode', 'in', ['named', 'anonymous'])
          );
          const reviewsSnapshot = await getDocs(reviewsQ);
          setReviews(reviewsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

          // Fetch Portfolio
          // New structure stores portfolio as an array of PortfolioItem in the user document.
          if (!userData.portfolio || userData.portfolio.length === 0) {
            try {
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
            } catch (portErr) {
              console.warn('[PublicProfile] Error fetching legacy portfolio sub-collection:', portErr);
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
      const daysToCheck = [0, 1, 2, 3, 4, 5, 6]; 
      let totalCount = 0;
      let firstSlotFound = false;
      
      for (const dayOffset of daysToCheck) {
        const date = new Date();
        date.setDate(date.getDate() + dayOffset);
        const dateStr = date.toISOString().split('T')[0];
        
        // Fetch appointments for this day to check availability
        const apptsRef = collection(db, 'appointments');
        const apptsQ = query(
          apptsRef,
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

  // Scarcity & Urgency Logic
  const urgencyInfo = React.useMemo(() => {
    if (!profile || services.length === 0 || totalWeeklySlots === null) return null;
    
    let message = "Horários limitados nesta semana";
    let isUrgent = true;

    if (totalWeeklySlots === 0) {
      message = "Alta procura nos próximos dias";
    } else if (totalWeeklySlots <= 3) {
      message = "Últimos horários disponíveis esta semana";
    } else if (totalWeeklySlots > 10) {
      message = "Agenda aberta para novos atendimentos";
      isUrgent = false; // "Desejo" but not "Urgency" in a stressing way
    } else if (nextSlot) {
      const today = new Date();
      const nextDate = new Date(nextSlot.date + 'T12:00:00');
      const diffDays = Math.ceil(Math.abs(nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 3) {
        message = "Agenda concorrida — reserve com antecedência";
      }
    }

    return {
      message,
      isUrgent,
      isAgendaFull: totalWeeklySlots === 0
    };
  }, [profile, services, nextSlot, totalWeeklySlots]);

  const scrollToServices = () => {
    servicesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) return <PublicProfileSkeleton />;
  
  if (!profile) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-brand-parchment p-6 text-center">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-24 h-24 bg-brand-linen text-brand-terracotta rounded-full flex items-center justify-center mb-10 border border-brand-mist shadow-sm"
      >
        <Info size={40} strokeWidth={1.5} />
      </motion.div>
      <h1 className="text-4xl font-serif font-normal text-brand-ink mb-6">Página não encontrada</h1>
      <p className="body-text text-brand-stone mb-12 max-w-sm mx-auto leading-relaxed">
        O link que você acessou pode estar incorreto ou o perfil da profissional ainda não foi publicado.
      </p>
      
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <Link 
          to="/" 
          className="w-full sm:w-auto bg-brand-ink text-brand-white px-10 py-5 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all premium-shadow"
        >
          Voltar para o início
        </Link>
        <Link 
          to="/p/helena-prado" 
          className="w-full sm:w-auto bg-brand-white text-brand-ink border border-brand-mist px-10 py-5 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-linen transition-all"
        >
          Ver perfil de exemplo
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-brand-parchment flex flex-col selection:bg-brand-terracotta/10">
      
      {/* Intelligent Mobile Floating CTA */}
      <AnimatePresence>
        {scrolled && !isBookingModalOpen && !loading && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-6 right-6 z-[150] md:hidden"
          >
            <PremiumButton 
              variant="terracotta" 
              className="w-full py-6 shadow-2xl backdrop-blur-md bg-brand-terracotta/95 border border-white/20"
              onClick={() => {
                setIsBookingModalOpen(true);
              }}
            >
              <div className="flex items-center justify-between w-full px-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Agendar Horário</span>
                <div className="flex items-center gap-2">
                  {stats?.totalCompletedBookings > 0 && (
                    <span className="text-[9px] text-white/60 normal-case tracking-normal">Próximo: {urgencyInfo?.isAgendaFull ? 'Sob consulta' : (nextSlot ? `${new Date(nextSlot.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}` : 'Em breve')}</span>
                  )}
                  <ChevronRight size={16} />
                </div>
              </div>
            </PremiumButton>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. HERO PREMIUM */}
      <header className="relative min-h-[95vh] flex flex-col items-center justify-center pt-40 pb-32 px-6 text-center overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-15%] right-[-10%] w-[600px] h-[600px] bg-brand-linen/40 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-15%] left-[-10%] w-[500px] h-[500px] bg-brand-blush/30 rounded-full blur-[100px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-10 max-w-4xl mx-auto"
        >
          {/* Refined Avatar Container */}
          <div className="relative w-36 h-36 md:w-44 md:h-44 mx-auto mb-16 px-4">
            <div className="absolute inset-0 bg-brand-terracotta/5 rounded-full scale-110 blur-2xl" />
            <div className="relative w-full h-full rounded-full overflow-hidden border-[4px] border-brand-white shadow-2xl premium-shadow ring-1 ring-brand-mist/50">
              {(profile.avatar || profile.avatarUrl) ? (
                <img src={profile.avatar || profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full bg-brand-linen flex items-center justify-center text-brand-terracotta text-5xl font-serif">
                  {profile.name?.[0]}
                </div>
              )}
            </div>
            <div className="absolute -bottom-2 -right-1 w-11 h-11 bg-brand-white rounded-full flex items-center justify-center shadow-lg border border-brand-mist">
              <ShieldCheck size={22} className="text-brand-terracotta" />
            </div>
          </div>

          {/* Professional Identity & Emotional Headline */}
          <div className="flex flex-col items-center space-y-12 mb-20 px-4">
            <div className="space-y-4">
              <span className="text-[10px] md:text-[11px] font-bold text-brand-terracotta uppercase tracking-[0.6em] block">
                Profissional Verificada Nera
              </span>
              <p className="text-[9px] text-brand-stone font-medium uppercase tracking-widest">Atendimento profissional e personalizado</p>
              <h1 className="text-3xl md:text-4xl font-serif font-normal text-brand-ink tracking-tight">
                {profile.name}
              </h1>
            </div>

            {/* Social Proof Dynamic Block */}
            {stats && (stats.totalCompletedBookings > 0 || stats.averageRating > 0) && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex flex-wrap items-center justify-center gap-4"
              >
                {stats.totalCompletedBookings > 10 ? (
                  <div className="flex items-center gap-2.5 px-6 py-3 bg-brand-white border border-brand-mist rounded-full shadow-sm">
                    <Users size={14} className="text-brand-terracotta" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-ink">
                      +{stats.totalCompletedBookings} clientes atendidas
                    </span>
                  </div>
                ) : stats.totalCompletedBookings > 0 ? (
                  <div className="flex items-center gap-2.5 px-6 py-3 bg-brand-white border border-brand-mist rounded-full shadow-sm">
                    <CheckCircle2 size={14} className="text-brand-terracotta" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-ink">
                      Profissional em destaque
                    </span>
                  </div>
                ) : null}

                {stats.averageRating > 4.5 && (
                  <div className="flex items-center gap-2.5 px-6 py-3 bg-brand-white border border-brand-mist rounded-full shadow-sm">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star key={i} size={10} className={i <= Math.round(stats.averageRating) ? "text-brand-terracotta fill-brand-terracotta" : "text-brand-mist"} />
                      ))}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-ink">
                      {stats.averageRating.toFixed(1)} de excelência
                    </span>
                  </div>
                )}
              </motion.div>
            )}

            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-[52px] md:text-[88px] font-serif font-normal text-brand-ink leading-[1.05] tracking-tight">
                {profile.headline || (
                  profile.specialty 
                    ? `Especialista em ${profile.specialty}` 
                    : (services[0]?.name ? `Atendimento de ${services[0].name}` : null)
                )}
              </h2>
            </div>
          </div>

          {/* Location Context */}
          <div className="flex flex-col items-center gap-6 mb-16">
            <div className="flex flex-wrap items-center justify-center gap-6 text-[11px] md:text-[12px] font-medium uppercase tracking-[0.25em] text-brand-stone">
              <div className="flex items-center gap-2.5">
                <MapPin size={16} className="text-brand-terracotta" />
                <span className="border-b border-brand-mist pb-0.5">
                  Atendimento em {profile.city}
                  {(profile.serviceMode === 'studio' || profile.serviceMode === 'hybrid') && profile.studioAddress?.neighborhood && (
                    <span className="ml-1 opacity-60 font-light normal-case tracking-normal">• {profile.studioAddress.neighborhood}</span>
                  )}
                </span>
              </div>
              <span className="w-1 h-1 bg-brand-mist rounded-full hidden md:block" />
              <div className="flex items-center gap-2.5">
                <Home size={16} className="text-brand-terracotta" />
                <span>
                  {profile.serviceMode === 'home' ? 'Atendimento em domicílio' : 
                   profile.serviceMode === 'studio' ? 'Atendimento no estúdio' : 
                   'Domicílio e Estúdio'}
                </span>
              </div>
            </div>
          </div>

          {/* 3-Step Booking Logic Integration */}
          {/* Main CTAs & Service Highlight */}
          <div className="flex flex-col items-center gap-12 mb-20 px-4">
            {services.length > 0 && (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-6 text-brand-ink/60 font-medium">
                  <span className="text-xl md:text-2xl font-serif">{services[0].name}</span>
                  <span className="w-1 h-1 bg-brand-mist rounded-full" />
                  <span className="text-xl md:text-2xl font-serif text-brand-terracotta">{formatCurrency(services[0].price)}</span>
                  <span className="w-1 h-1 bg-brand-mist rounded-full" />
                  <span className="text-sm uppercase tracking-widest">{services[0].duration} min</span>
                </div>
                {nextSlot && (
                  <div className="flex items-center gap-2 text-brand-terracotta text-[10px] font-bold uppercase tracking-[0.2em] animate-pulse">
                    <Zap size={12} /> Próximo horário disponível: {new Date(nextSlot.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às {nextSlot.time}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col items-center justify-center gap-10 pt-8 w-full">
              <div className="flex flex-col items-center gap-4 w-full">
                {urgencyInfo && (
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-[0.3em]",
                    urgencyInfo.isUrgent ? "text-brand-terracotta animate-pulse" : "text-brand-stone"
                  )}>
                    {urgencyInfo.message}
                  </span>
                )}
                <PremiumButton 
                  onClick={() => {
                    if (services.length > 0 && !preSelectedService) setPreSelectedService(services[0]);
                    setIsBookingModalOpen(true);
                  }} 
                  className="w-full sm:w-auto min-w-[320px] py-8 text-[13px] font-bold shadow-2xl hover:scale-[1.02] active:scale-[0.98]"
                  variant="terracotta"
                >
                  Reservar agora <ChevronRight size={18} className="ml-1" />
                </PremiumButton>
              </div>
              
              {profile.instagram && (
                <a 
                  href={`https://instagram.com/${profile.instagram.replace('@', '')}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-widest text-brand-stone hover:text-brand-ink transition-all group"
                >
                  <div className="w-10 h-10 rounded-full border border-brand-mist flex items-center justify-center group-hover:bg-brand-linen transition-colors">
                    <Instagram size={18} className="group-hover:text-brand-terracotta transition-colors" />
                  </div>
                  <span>Ver Portfólio</span>
                </a>
              )}
            </div>
          </div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 1 }}
            className="flex flex-col items-center gap-4 text-brand-mist"
          >
            <span className="text-[9px] uppercase tracking-[0.3em] font-medium">Deslize para ver mais</span>
            <motion.div 
              animate={{ y: [0, 8, 0] }} 
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <ChevronDown size={20} />
            </motion.div>
          </motion.div>
        </motion.div>
      </header>

      {/* 2. AUTHORITY & TRUST BAR */}
      <section className="px-6 -mt-16 relative z-30">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-brand-mist bg-brand-white rounded-[56px] overflow-hidden shadow-2xl shadow-brand-ink/5">
            {profile.professionalIdentity?.yearsExperience && (
              <motion.div 
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="p-12 md:p-16 border-b md:border-b-0 md:border-r border-brand-mist flex flex-col items-center text-center group transition-all duration-500"
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-brand-terracotta mb-6">Trajetória</span>
                <h3 className="text-2xl md:text-3xl font-serif text-brand-ink leading-tight">
                  Mais de {profile.professionalIdentity.yearsExperience} anos aperfeiçoando cada detalhe
                </h3>
              </motion.div>
            )}

            {(profile.specialty || profile.professionalIdentity?.mainSpecialty) && (
              <motion.div 
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="p-12 md:p-16 border-b md:border-b-0 md:border-r border-brand-mist flex flex-col items-center text-center group transition-all duration-500"
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-brand-terracotta mb-6">Referência</span>
                <h3 className="text-2xl md:text-3xl font-serif text-brand-ink leading-tight">
                  Referência em {profile.specialty || profile.professionalIdentity?.mainSpecialty} e precisão
                </h3>
              </motion.div>
            )}

            <motion.div 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="p-12 md:p-16 flex flex-col items-center text-center group transition-all duration-500"
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-brand-terracotta mb-6">Excelência</span>
              <h3 className="text-2xl md:text-3xl font-serif text-brand-ink leading-tight">
                {stats?.totalCompletedBookings > 20 
                  ? 'Centenas de atendimentos realizados com total precisão' 
                  : stats?.totalCompletedBookings > 0 
                    ? `Mais de ${stats.totalCompletedBookings} experiências de beleza concluídas`
                    : 'Foco absoluto em naturalidade e precisão técnica'}
              </h3>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 2.2 VERTICAL GUIDE LINE COMPONENT */}
      <div className="flex justify-center py-24">
        <div className="w-px h-32 bg-gradient-to-b from-brand-mist to-transparent" />
      </div>

      {/* 2.5 DIFFERENTIALS PILLARS (The requested authority section) */}
      {profile.professionalIdentity?.differentials && profile.professionalIdentity.differentials.length > 0 && (
        <section className="pt-32 pb-16 px-6">
          <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
            {profile.professionalIdentity.differentials.slice(0, 3).map((diff: string, i: number) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex items-start gap-6 group"
              >
                <div className="w-12 h-12 shrink-0 bg-brand-white border border-brand-mist rounded-2xl flex items-center justify-center text-brand-terracotta group-hover:bg-brand-terracotta group-hover:text-brand-white transition-all duration-500">
                  {i === 0 ? <Zap size={20} /> : i === 1 ? <ShieldCheck size={20} /> : <Award size={20} />}
                </div>
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-ink mb-1 group-hover:text-brand-terracotta transition-colors">{diff}</h4>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* 2.5 INSIGHTS AGGREGATED (Layer 3) */}
      {profileState?.hasReviews && stats?.topTags && stats.topTags.length > 0 && (
        <section className="pt-24 px-6">
          <div className="max-w-5xl mx-auto flex flex-wrap justify-center gap-6">
            {stats.topTags.map((tag: string, i: number) => (
              <div key={i} className="flex items-center gap-3 px-6 py-3 bg-brand-white border border-brand-mist rounded-full shadow-sm">
                <div className="w-2 h-2 rounded-full bg-brand-terracotta" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-ink">{tag}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. EDITORIAL ABOUT SECTION */}
      {profileState?.hasBio && (
        <section className="py-48 px-6 overflow-hidden relative">
          {/* Subtle signature watermark */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[22vw] font-serif text-brand-linen/10 italic -rotate-12 select-none pointer-events-none whitespace-nowrap">
            Beauty in Details
          </div>

          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-24 items-center relative z-10">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="aspect-[4/5] rounded-[60px] overflow-hidden border border-brand-mist premium-shadow">
                <img 
                  src={(profile.portfolio?.[0]?.url || profile.portfolio?.[0]) || (profile.avatar || profile.avatarUrl)} 
                  alt="About" 
                  className="w-full h-full object-cover grayscale-[40%] hover:grayscale-0 transition-all duration-1000 scale-105 hover:scale-100"
                  referrerPolicy="no-referrer"
                />
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-12"
            >
              <div className="space-y-6">
                <span className="text-[10px] font-bold uppercase tracking-[0.6em] text-brand-terracotta block">A Filosofia</span>
                <h2 className="text-[52px] md:text-[68px] font-serif leading-[1.1] text-brand-ink">
                   {profile.name.split(' ')[0]} <br/> <span className="italic font-light text-brand-stone">Curatorship</span>
                </h2>
              </div>
              
              <div className="space-y-8 body-text text-brand-stone text-xl font-light leading-relaxed">
                <p className="whitespace-pre-line border-l-2 border-brand-terracotta/20 pl-8">
                  {profile.bio}
                </p>
                {profileState.hasDifferentials && (
                  <div className="pt-8 flex flex-wrap gap-3">
                    {profile.professionalIdentity?.differentials?.map((tag: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 px-6 py-2.5 bg-brand-white border border-brand-mist/50 rounded-full text-[9px] font-bold uppercase tracking-widest text-brand-ink">
                        <Star size={10} className="text-brand-terracotta" /> {tag}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-8 relative">
                <div className="text-3xl font-serif italic text-brand-ink/30 border-t border-brand-mist pt-10">
                   "O essencial, feito com precisão."
                </div>
                {/* Handwritten signature accent */}
                <div className="absolute -bottom-8 right-0 font-signature text-[42px] text-brand-terracotta/40 -rotate-3 select-none pointer-events-none">
                  {profile.name.split(' ')[0]}
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Visual Break / Spacer */}
      <div className="flex justify-center py-24">
        <div className="w-px h-48 bg-gradient-to-b from-transparent via-brand-mist to-transparent" />
      </div>

      {/* 3.5 ALTERNATIVE TRUST BLOCK (Removed as it is now integrated into Authority section) */}

      {/* 4. SERVICES SECTION */}
      <section ref={servicesRef} className="py-32 px-6 bg-brand-white border-y border-brand-mist">
        <div className="max-w-5xl mx-auto">
          <SectionHeading 
            label="Menu de Serviços" 
            title="Escolha sua Experiência" 
            subtitle="Procedimentos pensados para valorizar sua beleza de forma única e sofisticada."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {services.length > 0 ? (
              services.map((service, i) => (
                <motion.div 
                  key={service.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => {
                    setPreSelectedService(service);
                    setHasInteractedWithService(true);
                    setIsBookingModalOpen(true);
                  }}
                  className="group relative bg-brand-white border border-brand-mist p-12 rounded-[56px] cursor-pointer hover:border-brand-terracotta/30 hover:shadow-2xl transition-all duration-700 flex flex-col justify-between h-full overflow-hidden"
                >
                  <div className="relative z-10">
                    <div className="flex flex-col mb-8">
                      {i === 0 && (
                        <span className="text-[9px] font-bold text-brand-terracotta uppercase tracking-[0.4em] mb-4 block">Destaque Premium</span>
                      )}
                      
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="text-3xl md:text-4xl font-serif text-brand-ink group-hover:text-brand-terracotta transition-colors leading-[1.1] mb-2">
                             {service.name}
                          </h3>
                        </div>
                        <div className="text-xl md:text-2xl font-serif text-brand-stone/50 tracking-tighter shrink-0 pt-1">
                          {formatCurrency(service.price)}
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-brand-stone/80 text-sm leading-relaxed mb-8 max-w-[90%] font-light italic">
                      "{service.description || 'Uma experiência completa de cuidado e bem-estar para valorizar sua beleza única.'}"
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between pt-10 border-t border-brand-mist/20 mt-auto relative z-10">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-brand-linen flex items-center justify-center text-brand-terracotta group-hover:bg-brand-terracotta group-hover:text-brand-white transition-all duration-500 shadow-sm">
                        <Clock size={20} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] text-brand-stone uppercase tracking-widest font-bold">Duração</span>
                        <span className="text-xs font-serif text-brand-ink">{service.duration} minutos</span>
                      </div>
                    </div>
                    
                    <div className="bg-brand-ink text-brand-white px-8 py-4 rounded-full text-[10px] font-bold uppercase tracking-widest group-hover:bg-brand-terracotta transition-all duration-500 premium-shadow">
                      Reservar
                    </div>
                  </div>

                  {/* Decorative background number */}
                  <div className="absolute -bottom-10 -right-4 text-[120px] font-serif text-brand-linen/40 select-none pointer-events-none group-hover:text-brand-terracotta/5 transition-colors">
                    0{i + 1}
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="col-span-full py-24 text-center border-2 border-dashed border-brand-mist rounded-[40px]">
                <Sparkles size={32} className="text-brand-mist mx-auto mb-4" />
                <p className="text-brand-stone font-serif italic text-lg">Consulte a disponibilidade via WhatsApp.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 6. EDITORIAL PORTFOLIO GRID */}
      <section className="py-32 px-6 bg-brand-white overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <SectionHeading 
            label="Portfólio Editorial" 
            title="O Olhar em Detalhes" 
            subtitle="Resultados com precisão, naturalidade e acabamento elegante em cada design."
          />

          {profileState?.hasPortfolio ? (
            <div className="columns-1 md:columns-2 lg:columns-3 gap-12 space-y-12">
              {profile.portfolio?.map((item: any, i: number) => {
                const imageUrl = typeof item === 'string' ? item : (item.url || (item as any).imageUrl);
                const category = typeof item === 'string' ? '' : item.category;
                
                return (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.8 }}
                    onClick={() => setSelectedImage(imageUrl)}
                    className="relative group rounded-[40px] overflow-hidden border border-brand-mist/50 cursor-zoom-in break-inside-avoid shadow-sm hover:shadow-2xl transition-all duration-700 bg-brand-parchment"
                  >
                    <div className="relative aspect-[4/5] overflow-hidden">
                      <img 
                        src={imageUrl} 
                        alt={category || `Trabalho de ${profile.name}`} 
                        className="w-full h-full object-cover transition-all duration-1000 group-hover:scale-110 grayscale-[30%] group-hover:grayscale-0"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-brand-ink/10 group-hover:bg-transparent transition-colors duration-700" />
                    </div>
                    {(category || profile.specialty) && (
                      <div className="p-8 bg-brand-white border-t border-brand-mist/50">
                        <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-brand-terracotta block mb-2">{category || profile.specialty}</span>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-medium uppercase tracking-widest text-brand-ink">Ver Detalhes</span>
                          <div className="w-8 h-8 rounded-full bg-brand-linen flex items-center justify-center text-brand-terracotta group-hover:bg-brand-terracotta group-hover:text-brand-white transition-all duration-500">
                            <Plus size={16} />
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="max-w-2xl mx-auto py-32 text-center border border-dashed border-brand-mist rounded-[60px] bg-brand-parchment/30">
              <div className="w-20 h-20 bg-brand-white rounded-3xl flex items-center justify-center text-brand-mist mx-auto mb-8 shadow-sm">
                <Camera size={36} strokeWidth={1} />
              </div>
              <h3 className="text-2xl font-serif text-brand-ink mb-3 leading-tight">Portfólio em atualização</h3>
              <p className="text-[10px] text-brand-stone font-bold uppercase tracking-[0.3em]">Novos trabalhos para te inspirar em breve.</p>
            </div>
          )}
        </div>
      </section>

      {/* Lightbox Overlay */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedImage(null)}
            className="fixed inset-0 z-[500] bg-brand-ink/95 backdrop-blur-md flex items-center justify-center p-4 md:p-12 cursor-zoom-out"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-5xl w-full aspect-auto max-h-[90vh] flex items-center justify-center"
            >
              <img 
                src={selectedImage} 
                className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" 
                alt="Enlarged Portfolio"
                referrerPolicy="no-referrer"
              />
              <button 
                onClick={(e) => { e.stopPropagation(); setSelectedImage(null); }}
                className="absolute top-4 right-4 md:-top-12 md:-right-12 w-12 h-12 bg-brand-white/10 hover:bg-brand-white/20 text-brand-white rounded-full flex items-center justify-center transition-all border border-brand-white/10"
              >
                <X size={24} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 7. PROVA SOCIAL / TESTIMONIALS (Layer 2) */}
      {reviews.length > 0 && (
        <section className="py-32 px-6 bg-brand-linen/30">
          <div className="max-w-5xl mx-auto">
            <SectionHeading label="Experiências" title="O que elas dizem" subtitle="Avaliações reais de clientes que já vivenciaram a experiência." />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {reviews.slice(0, 6).map((review, i) => (
                <motion.div 
                  key={review.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-brand-white p-10 rounded-[40px] border border-brand-mist premium-shadow relative"
                >
                  <div className="flex gap-1 mb-6 text-brand-terracotta">
                    {[...Array(5)].map((_, j) => (
                      <Star 
                        key={j} 
                        size={14} 
                        fill={j < review.rating ? "currentColor" : "none"} 
                        className={j < review.rating ? "" : "text-brand-mist"}
                      />
                    ))}
                  </div>
                  {review.comment && (
                    <p className="body-text text-brand-ink italic mb-8">"{review.comment}"</p>
                  )}
                  <div className="flex items-center justify-between pt-6 border-t border-brand-mist">
                    <div className="flex flex-col">
                      <span className="text-sm font-serif text-brand-ink">
                        {review.publicDisplayMode === 'anonymous' ? 'Cliente Nera' : review.firstName}
                      </span>
                      {review.neighborhood && (
                        <span className="text-[9px] text-brand-stone uppercase tracking-widest">{review.neighborhood}</span>
                      )}
                    </div>
                    <span className="text-[9px] uppercase tracking-widest text-brand-stone text-right">{review.serviceName}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 8. FINAL CALL TO ACTION */}
      <section className="py-40 px-6 bg-brand-ink text-brand-white relative overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
           <div className="absolute -top-[20%] -right-[10%] w-[800px] h-[800px] border border-brand-white/20 rounded-full" />
           <div className="absolute -bottom-[20%] -left-[10%] w-[600px] h-[600px] border border-brand-white/10 rounded-full" />
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-12"
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-brand-terracotta/60 block">
              {urgencyInfo?.isNextSlotDistant ? "Agenda concorrida — reserve com antecedência" : "Horários limitados nesta semana"}
            </span>
            <h2 className="text-5xl md:text-7xl font-serif font-normal leading-tight">Pronta para agendar seu horário?</h2>
            <p className="text-brand-blush/60 text-lg md:text-xl max-w-2xl mx-auto font-light leading-relaxed">
              Junte-se a clientes que já transformaram seu olhar e autoestima com um atendimento exclusivo e personalizado.
            </p>
            
            <div className="flex flex-col items-center gap-10 pt-8">
              <PremiumButton 
                variant="terracotta" 
                className="min-w-[320px] py-8 text-sm group"
                onClick={() => {
                  setIsBookingModalOpen(true);
                  document.getElementById('booking-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <div className="flex items-center justify-center gap-3">
                  Agendar Agora <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </PremiumButton>
              
              <div className="flex flex-wrap justify-center items-center gap-10 text-[10px] font-bold uppercase tracking-[0.3em] text-brand-blush/30">
                <div className="flex items-center gap-3"><ShieldCheck size={16} className="text-brand-terracotta" /> Agendamento Seguro</div>
                <div className="flex items-center gap-3"><Clock size={16} className="text-brand-terracotta" /> Confirmação Imediata</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 10. REFINED FOOTER */}
      <footer className="py-20 px-6 bg-brand-white border-t border-brand-mist text-center">
        <div className="max-w-5xl mx-auto flex flex-col items-center gap-12">
          <div className="space-y-4">
            <Logo variant="light" className="w-20 opacity-30 grayscale mx-auto" />
          </div>
          
          <div className="flex flex-wrap justify-center gap-10 text-[10px] font-medium uppercase tracking-widest text-brand-stone">
            <Link to="/" className="hover:text-brand-ink transition-colors">Início</Link>
            <Link to="/register" className="hover:text-brand-ink transition-colors">Seja uma Profissional</Link>
            <a href="#" className="hover:text-brand-ink transition-colors">Termos</a>
            <a href="#" className="hover:text-brand-ink transition-colors">Privacidade</a>
          </div>

          <div className="flex gap-6">
            {profile.instagram && (
              <a href={`https://instagram.com/${profile.instagram.replace('@', '')}`} target="_blank" className="w-10 h-10 rounded-full border border-brand-mist flex items-center justify-center text-brand-stone hover:text-brand-terracotta hover:border-brand-terracotta transition-all">
                <Instagram size={18} />
              </a>
            )}
            <a href={buildWhatsappLink(profile.whatsapp)} target="_blank" className="w-10 h-10 rounded-full border border-brand-mist flex items-center justify-center text-brand-stone hover:text-brand-terracotta hover:border-brand-terracotta transition-all">
              <MessageCircle size={18} />
            </a>
          </div>

          <p className="text-[9px] text-brand-stone/40 uppercase tracking-widest">
            © {new Date().getFullYear()} {profile.name} • Powered by Nera
          </p>
        </div>
      </footer>

      {/* --- BOOKING MODAL COMPONENT --- */}
      <BookingModal 
        profile={profile}
        services={services}
        open={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        initialService={preSelectedService}
      />

      {/* --- INTEREST DETECTION POPUP (SOFT CTA) --- */}
      <AnimatePresence>
        {showInterestPopup && !isBookingModalOpen && (
          <div className="fixed bottom-8 left-6 right-6 md:left-auto md:right-10 md:w-96 z-[400]">
            <motion.div 
              initial={{ y: 100, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 100, opacity: 0, scale: 0.9 }}
              className="bg-brand-ink text-brand-white p-8 rounded-[40px] shadow-2xl relative overflow-hidden border border-white/10"
            >
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand-terracotta/20 rounded-full blur-3xl" />
              
              <button 
                onClick={() => {
                  setShowInterestPopup(false);
                  setInterestPopupDismissed(true);
                }}
                className="absolute top-6 right-6 p-1 text-white/40 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>

              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-brand-terracotta flex items-center justify-center text-white">
                    <Sparkles size={16} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Convite Especial</span>
                </div>
                
                <h3 className="text-xl font-serif mb-2 leading-tight">Quer garantir um horário?</h3>
                <p className="text-xs text-white/60 font-light mb-8 leading-relaxed">
                  Notei seu interesse! A agenda da {profile?.name.split(' ')[0]} costuma lotar rápido nestes dias.
                </p>

                <div className="flex flex-col gap-3">
                  <PremiumButton 
                    variant="terracotta" 
                    className="w-full py-4 text-[10px]"
                    onClick={() => {
                      setShowInterestPopup(false);
                      setIsBookingModalOpen(true);
                    }}
                  >
                    Reservar agora
                  </PremiumButton>
                  <a 
                    href={buildWhatsappLink(profile?.whatsapp, 'Oi! Estava vendo seu perfil no Nera e gostaria de tirar uma dúvida sobre os horários.')}
                    target="_blank"
                    className="flex items-center justify-center gap-2 py-4 text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors"
                  >
                    <MessageCircle size={14} /> Falar no WhatsApp
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- FLOATING CTA (Mobile) --- */}
      <AnimatePresence>
        {!isBookingModalOpen && scrolled && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-6 right-6 z-[150] md:hidden"
          >
            <PremiumButton 
              variant="terracotta" 
              className="w-full py-6 shadow-2xl backdrop-blur-md bg-brand-terracotta/95 border border-white/20"
              onClick={() => setIsBookingModalOpen(true)}
            >
              <div className="flex items-center justify-between w-full px-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Agendar Horário</span>
                <div className="flex items-center gap-2">
                  {stats?.totalCompletedBookings > 0 && (
                    <span className="text-[9px] text-white/60 normal-case tracking-normal">
                      Próximo: {urgencyInfo?.isAgendaFull ? 'Sob consulta' : (nextSlot ? `${new Date(nextSlot.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}` : 'Em breve')}
                    </span>
                  )}
                  <ChevronRight size={16} />
                </div>
              </div>
            </PremiumButton>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
