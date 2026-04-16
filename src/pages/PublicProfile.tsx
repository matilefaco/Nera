import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db, createBookingRequest } from '../firebase';
import { collection, query, where, getDocs, addDoc, orderBy } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, Phone, Calendar as CalendarIcon, Clock, 
  CheckCircle2, ChevronRight, ArrowLeft, Sparkles,
  ShieldCheck, Instagram, Heart, Info, MessageCircle,
  ExternalLink, ArrowDown, Star, Share2, Copy,
  Check, Award, Users, Zap, HelpCircle, Home, Plus, X, Camera, Building2, Globe
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { toast } from 'sonner';
import Logo from '../components/Logo';
import { UserProfile, Service, Review, ServiceArea } from '../types';

import { getAvailableSlots } from '../lib/bookingUtils';

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

interface PremiumButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'terracotta';
  className?: string;
  disabled?: boolean;
  loading?: boolean;
}

const PremiumButton = ({ children, onClick, variant = 'primary', className, disabled, loading }: PremiumButtonProps) => {
  const baseStyles = "relative overflow-hidden px-10 py-5 rounded-full text-[11px] font-medium uppercase tracking-[0.2em] transition-all duration-500 flex items-center justify-center gap-3";
  const variants: Record<string, string> = {
    primary: "bg-brand-ink text-brand-white hover:bg-brand-espresso premium-shadow",
    secondary: "bg-brand-white text-brand-ink border border-brand-mist hover:border-brand-ink",
    terracotta: "bg-brand-terracotta text-brand-white hover:bg-brand-sienna premium-shadow",
  };

  return (
    <button 
      onClick={onClick} 
      disabled={disabled || loading}
      className={cn(baseStyles, variants[variant], className, (disabled || loading) && "opacity-50 cursor-not-allowed")}
    >
      {loading ? (
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
          <Sparkles size={18} />
        </motion.div>
      ) : children}
    </button>
  );
};

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
      hasBio: !!(profile.bio || profile.professionalIdentity?.bio),
      hasPortfolio: !!(profile.portfolio && profile.portfolio.length > 0),
      hasReviews: reviews.length > 0,
      hasStats: !!(stats?.totalCompletedBookings > 0 || stats?.averageRating || profile.professionalIdentity?.yearsExperience),
      hasDifferentials: !!(profile.professionalIdentity?.differentials && profile.professionalIdentity.differentials.length > 0),
      hasServiceAreas: !!(profile.serviceAreas && profile.serviceAreas.length > 0),
      isNew: reviews.length === 0 && (!stats || stats.totalCompletedBookings < 5)
    };
  }, [profile, reviews, stats]);

  // Booking Flow State
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedArea, setSelectedArea] = useState<ServiceArea | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [bookingMode, setBookingMode] = useState<'studio' | 'home' | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [blockedSlots, setBlockedSlots] = useState<string[]>([]);

  const availableSlots = React.useMemo(() => {
    return getAvailableSlots({
      selectedDate,
      selectedService,
      profile,
      blockedSlots
    });
  }, [selectedDate, selectedService, profile, blockedSlots]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 100);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!slug) {
        setLoading(false);
        return;
      }

      try {
        const q = query(collection(db, 'users'), where('slug', '==', slug));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const userData = snapshot.docs[0].data();
          const professionalId = snapshot.docs[0].id;
          setProfile({ ...userData, uid: professionalId });
          
          // Set initial booking mode if not hybrid
          if (userData.serviceMode === 'home') setBookingMode('home');
          if (userData.serviceMode === 'studio') setBookingMode('studio');
          
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
          // The new structure stores portfolio as an array in the user document.
          // We already have userData.portfolio from the first fetch.
          // If it's missing or we want to support legacy sub-collection:
          if (!userData.portfolio || userData.portfolio.length === 0) {
            try {
              const portfolioQ = query(collection(db, 'users', professionalId, 'portfolio'), orderBy('createdAt', 'desc'));
              const portfolioSnapshot = await getDocs(portfolioQ);
              if (!portfolioSnapshot.empty) {
                const portfolioItems = portfolioSnapshot.docs.map(doc => ({
                  url: doc.data().imageUrl,
                  category: doc.data().category
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
        toast.error("Erro ao carregar perfil");
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [slug]);

  useEffect(() => {
    if (selectedDate && profile?.uid) {
      const fetchAvailabilityData = async () => {
        try {
          // 1. Fetch manual blocked slots
          const slotsRef = collection(db, 'blocked_slots');
          const slotsQ = query(
            slotsRef, 
            where('professionalId', '==', profile.uid),
            where('date', '==', selectedDate)
          );
          const slotsSnapshot = await getDocs(slotsQ);
          const manualBlocked = slotsSnapshot.docs.map(doc => doc.data().time);

          // 2. Fetch confirmed appointments to calculate occupied windows
          const apptsRef = collection(db, 'appointments');
          const apptsQ = query(
            apptsRef,
            where('professionalId', '==', profile.uid),
            where('date', '==', selectedDate),
            where('status', '==', 'confirmed')
          );
          const apptsSnapshot = await getDocs(apptsQ);
          
          const occupiedSlots = new Set(manualBlocked);
          
          apptsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const startStr = data.time; // HH:mm
            const duration = Number(data.duration) || 60;
            
            const [h, m] = startStr.split(':').map(Number);
            const startTotal = h * 60 + m;
            
            // Mark every 30min slot within the appointment duration as blocked
            for (let t = startTotal; t < startTotal + duration; t += 30) {
              const hh = Math.floor(t / 60);
              const mm = t % 60;
              occupiedSlots.add(`${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`);
            }
          });

          setBlockedSlots(Array.from(occupiedSlots));
        } catch (err) {
          console.error("[Availability] Error fetching data:", err);
        }
      };
      fetchAvailabilityData();
    }
  }, [selectedDate, profile?.uid]);

  const calculateTotalPrice = () => {
    if (!selectedService) return 0;
    const basePrice = Number(selectedService.price) || 0;
    return basePrice + (selectedArea?.fee || 0);
  };

  const handleBooking = async () => {
    if (!profile || !selectedService) {
      console.warn('[Booking] Missing profile or service', { profile: !!profile, service: !!selectedService });
      return;
    }
    
    // Validation for home service
    if (isHomeService && !clientAddress.trim()) {
      toast.error('Por favor, informe o endereço para o atendimento');
      return;
    }

    setBookingLoading(true);
    console.log('[Booking] Starting booking process...', {
      professionalId: profile.uid,
      service: selectedService.name,
      date: selectedDate,
      time: selectedTime,
      client: clientName
    });

    try {
      const totalPrice = calculateTotalPrice();
      const bookingId = await createBookingRequest({
        professionalId: profile.uid,
        professionalName: profile.name,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        duration: selectedService.duration,
        price: selectedService.price,
        travelFee: selectedArea?.fee || 0,
        totalPrice: totalPrice,
        locationType: isHomeService ? 'home' : 'studio',
        neighborhood: selectedArea?.name || '',
        address: clientAddress.trim(),
        clientName: clientName.trim(),
        clientWhatsapp: clientPhone.replace(/\D/g, ''),
        clientEmail: clientEmail.trim().toLowerCase(),
        date: selectedDate,
        time: selectedTime,
      });
      
      console.log('[Booking] Success! Booking ID:', bookingId);
      setStep(5); // Success
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error("[Booking] CRITICAL ERROR:", error);
      toast.error('Erro ao agendar horário. Por favor, tente novamente.');
    } finally {
      setBookingLoading(false);
    }
  };

  const scrollToServices = () => {
    servicesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-brand-parchment">
      <motion.div 
        animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }} 
        transition={{ repeat: Infinity, duration: 2 }} 
        className="text-brand-terracotta"
      >
        <Logo variant="light" className="w-24 opacity-20" />
      </motion.div>
    </div>
  );
  
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

  const isHomeService = bookingMode === 'home';

  return (
    <div className="min-h-screen bg-brand-parchment flex flex-col selection:bg-brand-terracotta/10">
      
      {/* Sticky Header for Mobile Conversion */}
      <AnimatePresence>
        {scrolled && step === 1 && (
          <motion.div 
            initial={{ y: -100 }} 
            animate={{ y: 0 }} 
            exit={{ y: -100 }}
            className="fixed top-0 left-0 w-full bg-brand-white/80 backdrop-blur-md border-b border-brand-mist z-[100] px-6 py-4 flex items-center justify-between md:hidden"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden border border-brand-mist">
                <img src={profile.avatar || profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <span className="font-serif text-brand-ink text-sm">{profile.name.split(' ')[0]}</span>
            </div>
            <button 
              onClick={scrollToServices}
              className="bg-brand-ink text-brand-white px-6 py-3 rounded-full text-[9px] font-medium uppercase tracking-widest"
            >
              Agendar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. HERO PREMIUM */}
      <header className="relative min-h-[90vh] flex flex-col items-center justify-center pt-32 pb-24 px-6 text-center overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-brand-linen/40 rounded-full blur-[100px]" />
          <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-brand-blush/30 rounded-full blur-[80px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-10 max-w-3xl mx-auto"
        >
          {/* Avatar with refined border */}
          <div className="relative w-40 h-40 md:w-48 md:h-48 mx-auto mb-12">
            <div className="absolute inset-0 bg-brand-terracotta/10 rounded-full animate-pulse" />
            <div className="relative w-full h-full rounded-full overflow-hidden border-[6px] border-brand-white shadow-2xl">
              {(profile.avatar || profile.avatarUrl) ? (
                <img src={profile.avatar || profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full bg-brand-linen flex items-center justify-center text-brand-terracotta text-6xl font-serif">
                  {profile.name?.[0]}
                </div>
              )}
            </div>
            <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-brand-white rounded-full flex items-center justify-center shadow-lg border border-brand-mist">
              <ShieldCheck size={24} className="text-brand-terracotta" />
            </div>
          </div>

          <span className="label-text mb-6 block text-brand-terracotta">Profissional Verificada</span>
          <h1 className="display-hero text-brand-ink mb-6">{profile.name}</h1>
          
          <div className="flex flex-col items-center gap-4 mb-10">
            {profile.specialty && (
              <p className="text-[12px] md:text-[14px] font-medium text-brand-stone uppercase tracking-[0.4em]">{profile.specialty}</p>
            )}
            <div className="h-px w-12 bg-brand-mist" />
            {(profile.headline || profile.professionalIdentity?.headline) && (
              <p className="body-text text-brand-stone max-w-md italic text-lg">
                "{profile.headline || profile.professionalIdentity?.headline}"
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-8 mb-16 text-[11px] font-medium uppercase tracking-widest text-brand-stone">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-brand-terracotta" />
              <span className="editorial-underline">{profile.city}</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-brand-terracotta" />
              <span>Confirmação Instantânea</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <PremiumButton onClick={scrollToServices} className="w-full sm:w-auto min-w-[280px]">
              Reservar Experiência <ChevronRight size={18} />
            </PremiumButton>
            {profile.instagram && (
              <a 
                href={`https://instagram.com/${profile.instagram.replace('@', '')}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-widest text-brand-stone hover:text-brand-ink transition-colors group"
              >
                <Instagram size={18} className="group-hover:text-brand-terracotta transition-colors" />
                <span>Ver Portfólio</span>
              </a>
            )}
          </div>
        </motion.div>

        <motion.div 
          animate={{ y: [0, 10, 0] }} 
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 text-brand-mist"
        >
          <ArrowDown size={24} />
        </motion.div>
      </header>

      {/* 2. STATUS CARD / TRUST BAR */}
      {profileState?.hasStats && (
        <section className="px-6 -mt-12 relative z-20">
          <div className="max-w-5xl mx-auto flex flex-wrap justify-center gap-4 md:gap-8">
            {stats?.totalCompletedBookings > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="bg-brand-white/80 backdrop-blur-md border border-brand-mist p-6 md:p-8 rounded-[32px] text-center premium-shadow flex-1 min-w-[140px]"
              >
                <div className="w-10 h-10 bg-brand-linen rounded-2xl flex items-center justify-center text-brand-terracotta mx-auto mb-4">
                  <Users size={20} />
                </div>
                <div className="text-2xl font-serif text-brand-ink mb-1">{stats.totalCompletedBookings}+</div>
                <div className="text-[9px] uppercase tracking-widest text-brand-stone font-medium">Atendimentos</div>
              </motion.div>
            )}

            {stats?.averageRating && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="bg-brand-white/80 backdrop-blur-md border border-brand-mist p-6 md:p-8 rounded-[32px] text-center premium-shadow flex-1 min-w-[140px]"
              >
                <div className="w-10 h-10 bg-brand-linen rounded-2xl flex items-center justify-center text-brand-terracotta mx-auto mb-4">
                  <Star size={20} />
                </div>
                <div className="text-2xl font-serif text-brand-ink mb-1">{stats.averageRating}/5</div>
                <div className="text-[9px] uppercase tracking-widest text-brand-stone font-medium">Avaliação</div>
              </motion.div>
            )}

            {profile.professionalIdentity?.yearsExperience && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="bg-brand-white/80 backdrop-blur-md border border-brand-mist p-6 md:p-8 rounded-[32px] text-center premium-shadow flex-1 min-w-[140px]"
              >
                <div className="w-10 h-10 bg-brand-linen rounded-2xl flex items-center justify-center text-brand-terracotta mx-auto mb-4">
                  <Award size={20} />
                </div>
                <div className="text-2xl font-serif text-brand-ink mb-1">{profile.professionalIdentity.yearsExperience} anos</div>
                <div className="text-[9px] uppercase tracking-widest text-brand-stone font-medium">Experiência</div>
              </motion.div>
            )}
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
        <section className="py-32 px-6 overflow-hidden">
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="aspect-[4/5] rounded-[40px] overflow-hidden border border-brand-mist premium-shadow">
                <img 
                  src={(profile.portfolio?.[0]?.url || profile.portfolio?.[0]) || (profile.avatar || profile.avatarUrl)} 
                  alt="About" 
                  className="w-full h-full object-cover grayscale-[20%] hover:grayscale-0 transition-all duration-1000"
                  referrerPolicy="no-referrer"
                />
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <span className="label-text mb-6 block">Sobre</span>
              <h2 className="heading-section text-brand-ink mb-8">
                {profile.headline || profile.professionalIdentity?.headline || `Conheça ${profile.name.split(' ')[0]}`}
              </h2>
              <div className="space-y-6 body-text text-brand-stone text-lg">
                <p className="whitespace-pre-line">
                  {profile.bio || profile.professionalIdentity?.bio}
                </p>
                {profileState.hasDifferentials && (
                  <div className="pt-6 flex flex-wrap gap-4">
                    {profile.professionalIdentity?.differentials?.map((tag: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 px-4 py-2 bg-brand-white border border-brand-mist rounded-full text-[10px] font-medium uppercase tracking-widest text-brand-stone">
                        <Check size={12} className="text-brand-terracotta" /> {tag}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* 3.5 ALTERNATIVE TRUST BLOCK (For new profiles) */}
      {profileState?.isNew && profileState.hasDifferentials && !profileState.hasBio && (
        <section className="py-32 px-6 bg-brand-white border-y border-brand-mist">
          <div className="max-w-5xl mx-auto text-center">
            <SectionHeading 
              label="Diferenciais" 
              title="Por que agendar comigo?" 
              subtitle="Compromisso com a excelência e satisfação em cada detalhe do atendimento."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {profile.professionalIdentity?.differentials?.map((diff: string, i: number) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="p-8 bg-brand-parchment rounded-[32px] border border-brand-mist"
                >
                  <div className="w-12 h-12 bg-brand-white rounded-2xl flex items-center justify-center text-brand-terracotta mx-auto mb-6 shadow-sm">
                    <Sparkles size={24} />
                  </div>
                  <h4 className="text-lg font-serif text-brand-ink mb-2">{diff}</h4>
                  <p className="text-xs text-brand-stone font-light uppercase tracking-widest">Garantia de Qualidade</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 4. SERVICES SECTION */}
      <section ref={servicesRef} className="py-32 px-6 bg-brand-white border-y border-brand-mist">
        <div className="max-w-5xl mx-auto">
          <SectionHeading 
            label="Menu de Serviços" 
            title="Escolha sua Experiência" 
            subtitle="Procedimentos pensados para valorizar sua beleza de forma única e sofisticada."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {services.length > 0 ? (
              services.map((service, i) => (
                <motion.div 
                  key={service.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="group relative bg-brand-parchment/50 border border-brand-mist p-10 rounded-[40px] hover:bg-brand-white hover:border-brand-terracotta/20 transition-all duration-500 premium-shadow"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-6 mb-8">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-2xl font-serif text-brand-ink group-hover:text-brand-terracotta transition-colors leading-tight">
                          {service.name}
                        </h3>
                        {i === 0 && (
                          <span className="px-3 py-1 bg-brand-terracotta/10 text-brand-terracotta text-[8px] font-bold uppercase tracking-widest rounded-full shrink-0">
                            Mais Desejado
                          </span>
                        )}
                      </div>
                      <p className="body-text text-brand-stone text-sm leading-relaxed max-w-md">
                        {service.description}
                      </p>
                    </div>
                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2">
                      <div className="text-2xl font-serif text-brand-terracotta whitespace-nowrap">
                        {formatCurrency(service.price)}
                      </div>
                      <div className="text-[9px] uppercase tracking-widest text-brand-stone font-medium flex items-center gap-1.5 bg-brand-linen/50 px-3 py-1.5 rounded-full sm:bg-transparent sm:p-0">
                        <Clock size={10} className="text-brand-terracotta" /> {service.duration} min
                      </div>
                    </div>
                  </div>
                  
                  <PremiumButton 
                    variant="secondary" 
                    className="w-full group-hover:bg-brand-ink group-hover:text-brand-white"
                    onClick={() => { setSelectedService(service); setStep(2); }}
                  >
                    Selecionar Data
                  </PremiumButton>
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

      {/* 5. REGIONS / LOGISTICS / STUDIO ADDRESS */}
      <section className="py-32 px-6 bg-brand-white border-y border-brand-mist">
        <div className="max-w-5xl mx-auto">
          <div className="text-center space-y-4 mb-20">
            <span className="label-text block">Localização & Atendimento</span>
            <h2 className="heading-section text-brand-ink">Aonde você deseja ser atendida?</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Studio Card */}
            {(profile.serviceMode === 'studio' || profile.serviceMode === 'hybrid') && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="bg-brand-parchment p-10 rounded-[40px] border border-brand-mist relative group overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-8 text-brand-mist group-hover:text-brand-terracotta/20 transition-colors">
                  <Building2 size={80} />
                </div>
                <div className="relative z-10 flex flex-col h-full">
                  <div className="w-14 h-14 bg-brand-ink text-brand-white rounded-2xl flex items-center justify-center mb-8 shadow-lg">
                    <MapPin size={28} />
                  </div>
                  <h3 className="text-2xl font-serif text-brand-ink mb-6">Atendimento no Estúdio</h3>
                  <div className="space-y-4 mb-10 flex-1">
                    <p className="text-brand-stone font-light leading-relaxed">
                      Conheça o nosso espaço preparado com todo carinho para te receber com segurança, conforto e privacidade.
                    </p>
                    <div className="pt-6 border-t border-brand-mist/50">
                      <p className="text-[10px] font-bold text-brand-terracotta uppercase tracking-widest mb-2">Endereço</p>
                      <p className="text-brand-ink font-medium leading-relaxed">
                        {profile.studioAddress?.street}, {profile.studioAddress?.number}
                        {profile.studioAddress?.complement && <span className="block italic font-light text-brand-stone">{profile.studioAddress.complement}</span>}
                        <span className="block">{profile.studioAddress?.neighborhood} — {profile.studioAddress?.city}</span>
                      </p>
                      {profile.studioAddress?.reference && (
                        <p className="mt-3 text-[11px] text-brand-stone italic flex items-start gap-2">
                          <Info size={12} className="mt-0.5" /> Ref: {profile.studioAddress.reference}
                        </p>
                      )}
                    </div>
                  </div>
                  <PremiumButton 
                    variant="secondary" 
                    className="w-full"
                    onClick={() => {
                      document.getElementById('booking-section')?.scrollIntoView({ behavior: 'smooth' });
                      setStep(1);
                      if (profile.serviceMode === 'hybrid') setBookingMode('studio');
                    }}
                  >
                    Agendar no Estúdio
                  </PremiumButton>
                </div>
              </motion.div>
            )}

            {/* Home Service Card */}
            {(profile.serviceMode === 'home' || profile.serviceMode === 'hybrid') && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="bg-brand-linen p-10 rounded-[40px] border border-brand-mist relative group overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-8 text-brand-mist group-hover:text-brand-terracotta/20 transition-colors">
                  <Home size={80} />
                </div>
                <div className="relative z-10 flex flex-col h-full">
                  <div className="w-14 h-14 bg-brand-terracotta text-brand-white rounded-2xl flex items-center justify-center mb-8 shadow-lg">
                    <Globe size={28} />
                  </div>
                  <h3 className="text-2xl font-serif text-brand-ink mb-6">Atendimento em Domicílio</h3>
                  <div className="space-y-4 mb-10 flex-1">
                    <p className="text-brand-stone font-light leading-relaxed">
                      {profile.serviceAreaType === 'city_wide' 
                        ? `Atendimento VIP em todo o território de ${profile.city}. Levamos toda a estrutura necessária até você.`
                        : `Atendimento exclusivo em bairros selecionados de ${profile.city}. Conforto e praticidade.`}
                    </p>
                    
                    <div className="pt-6 border-t border-brand-mist/50">
                      <p className="text-[10px] font-bold text-brand-terracotta uppercase tracking-widest mb-4">Regiões Atendidas</p>
                      {profile.serviceAreaType === 'city_wide' ? (
                        <div className="flex items-center gap-3 p-4 bg-brand-white/50 rounded-2xl border border-brand-mist/30">
                          <CheckCircle2 size={16} className="text-green-600" />
                          <span className="text-sm font-medium text-brand-ink">Toda a cidade de {profile.city}</span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {profile.serviceAreas?.map((area: any) => (
                            <span key={area.name} className="px-4 py-2 bg-brand-white/50 border border-brand-mist/30 rounded-xl text-xs font-medium text-brand-ink">
                              {area.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <PremiumButton 
                    variant="primary" 
                    className="w-full"
                    onClick={() => {
                      document.getElementById('booking-section')?.scrollIntoView({ behavior: 'smooth' });
                      setStep(1);
                      if (profile.serviceMode === 'hybrid') setBookingMode('home');
                    }}
                  >
                    Agendar em Casa
                  </PremiumButton>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* 6. EDITORIAL PORTFOLIO GRID */}
      <section className="py-32 px-6 bg-brand-white overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <SectionHeading 
            label="O Olhar em Detalhes" 
            title="Resultados com Precisão" 
            subtitle="Naturalidade, definição e acabamento elegante em cada design."
          />

          {profileState?.hasPortfolio ? (
            <div className="columns-1 md:columns-2 lg:columns-3 gap-8 space-y-8">
              {profile.portfolio?.map((item: any, i: number) => {
                const imageUrl = typeof item === 'string' ? item : item.url;
                const category = typeof item === 'string' ? '' : item.category;
                
                return (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="relative group rounded-[32px] overflow-hidden border border-brand-mist premium-shadow break-inside-avoid"
                  >
                    <img 
                      src={imageUrl} 
                      alt={category || `Trabalho de ${profile.name}`} 
                      className="w-full object-cover transition-all duration-1000 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                    {category && (
                      <div className="absolute inset-0 bg-brand-ink/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-8">
                        <span className="text-brand-white text-[10px] font-medium uppercase tracking-widest">{category}</span>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="max-w-2xl mx-auto py-24 text-center border border-dashed border-brand-mist rounded-[40px] bg-brand-parchment/30">
              <div className="w-16 h-16 bg-brand-white rounded-2xl flex items-center justify-center text-brand-mist mx-auto mb-6 shadow-sm">
                <Camera size={32} strokeWidth={1} />
              </div>
              <h3 className="text-xl font-serif text-brand-ink mb-2">Portfólio em atualização</h3>
              <p className="text-xs text-brand-stone font-medium uppercase tracking-widest">Novos trabalhos serão adicionados em breve.</p>
            </div>
          )}
        </div>
      </section>

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

      {/* 8. DISPONIBILIDADE / CTA FINAL */}
      <section className="py-32 px-6 bg-brand-ink text-brand-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
           <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] border border-brand-white rounded-full" />
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-[42px] md:text-[56px] font-serif font-normal mb-10 leading-tight">Pronta para sua transformação?</h2>
            <p className="text-brand-blush/60 text-lg md:text-xl mb-12 max-w-xl mx-auto font-light">
              Garanta sua vaga e desfrute de um atendimento exclusivo.
            </p>
            
            <div className="flex flex-col items-center gap-8">
              <PremiumButton 
                variant="terracotta" 
                className="min-w-[300px] py-7 text-sm"
                onClick={scrollToServices}
              >
                Agendar Agora
              </PremiumButton>
              
              <div className="flex items-center gap-8 text-[10px] font-medium uppercase tracking-[0.2em] text-brand-blush/40">
                <div className="flex items-center gap-2"><CheckCircle2 size={14} /> 100% Seguro</div>
                <div className="flex items-center gap-2"><MessageCircle size={14} /> Suporte via WhatsApp</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 10. REFINED FOOTER */}
      <footer className="py-20 px-6 bg-brand-white border-t border-brand-mist text-center">
        <div className="max-w-5xl mx-auto flex flex-col items-center gap-12">
          <Logo variant="light" className="w-20 opacity-30 grayscale" />
          
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
            <a href={`https://wa.me/${profile.whatsapp}`} target="_blank" className="w-10 h-10 rounded-full border border-brand-mist flex items-center justify-center text-brand-stone hover:text-brand-terracotta hover:border-brand-terracotta transition-all">
              <MessageCircle size={18} />
            </a>
          </div>

          <p className="text-[9px] text-brand-stone/40 uppercase tracking-widest">
            © {new Date().getFullYear()} {profile.name} • Powered by Nera
          </p>
        </div>
      </footer>

      {/* --- BOOKING MODAL OVERLAY --- */}
      <AnimatePresence>
        {step > 1 && step < 5 && (
          <div className="fixed inset-0 bg-brand-ink/40 backdrop-blur-sm z-[200] flex items-end md:items-center justify-center p-0 md:p-6">
            <motion.div 
              initial={{ y: "100%" }} 
              animate={{ y: 0 }} 
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-brand-white w-full max-w-2xl rounded-t-[40px] md:rounded-[40px] p-8 md:p-12 shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <button 
                onClick={() => setStep(1)} 
                className="absolute right-8 top-8 text-brand-stone hover:text-brand-ink transition-colors"
              >
                <X size={24} />
              </button>

              {/* Progress Indicator */}
              <div className="flex gap-2 mb-12">
                {[2, 3, 4].map((s) => (
                  <div key={s} className={cn("h-1 flex-1 rounded-full transition-all duration-500", step >= s ? "bg-brand-terracotta" : "bg-brand-mist")} />
                ))}
              </div>

              {/* Step 2: Date & Time */}
              {step === 2 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                  <h3 className="text-2xl font-serif text-brand-ink mb-2">Quando deseja ser atendida?</h3>
                  <p className="text-xs text-brand-stone font-light mb-10">Selecione o melhor dia e horário para você.</p>
                  
                  <div className="flex gap-3 overflow-x-auto pb-6 no-scrollbar mb-10">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(offset => {
                      const date = new Date();
                      date.setDate(date.getDate() + offset);
                      const dateStr = date.toISOString().split('T')[0];
                      const isSelected = selectedDate === dateStr;
                      return (
                        <button 
                          key={offset}
                          onClick={() => setSelectedDate(dateStr)}
                          className={cn(
                            "min-w-[70px] h-24 rounded-2xl flex flex-col items-center justify-center transition-all shrink-0",
                            isSelected ? "bg-brand-ink text-brand-white premium-shadow" : "bg-brand-parchment border border-brand-mist"
                          )}
                        >
                          <span className="text-[9px] font-medium uppercase opacity-40 mb-2">
                            {date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
                          </span>
                          <span className="text-xl font-serif">{date.getDate()}</span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedDate && (
                    <div className="grid grid-cols-3 gap-3">
                      {availableSlots.length > 0 ? (
                        availableSlots.map(time => (
                          <button 
                            key={time}
                            onClick={() => { setSelectedTime(time); setStep(3); }}
                            className="py-4 rounded-xl border border-brand-mist text-sm font-medium text-brand-ink hover:border-brand-ink hover:bg-brand-linen transition-all"
                          >
                            {time}
                          </button>
                        ))
                      ) : (
                        <div className="col-span-3 py-10 text-center bg-brand-parchment rounded-2xl border border-dashed border-brand-mist">
                          <p className="text-sm text-brand-stone font-light">Não há horários disponíveis nesta data.</p>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Step 3: Location Selection / Details */}
              {step === 3 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                  <h3 className="text-2xl font-serif text-brand-ink mb-2">Local do Atendimento</h3>
                  <p className="text-xs text-brand-stone font-light mb-10">Onde a mágica vai acontecer?</p>
                  
                  {profile.serviceMode === 'hybrid' && !bookingMode ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <button 
                        onClick={() => setBookingMode('studio')}
                        className="p-8 bg-brand-white border border-brand-mist rounded-[32px] text-center hover:border-brand-ink transition-all group"
                      >
                        <Building2 size={32} className="text-brand-terracotta mx-auto mb-4 group-hover:scale-110 transition-transform" />
                        <span className="font-medium block mb-1">No Estúdio</span>
                        <span className="text-[10px] text-brand-stone font-light leading-tight">Vou até o estúdio da profissional.</span>
                      </button>
                      <button 
                        onClick={() => setBookingMode('home')}
                        className="p-8 bg-brand-white border border-brand-mist rounded-[32px] text-center hover:border-brand-ink transition-all group"
                      >
                        <Home size={32} className="text-brand-terracotta mx-auto mb-4 group-hover:scale-110 transition-transform" />
                        <span className="font-medium block mb-1">Em Domicílio</span>
                        <span className="text-[10px] text-brand-stone font-light leading-tight">Desejo ser atendida no meu endereço.</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      {isHomeService ? (
                        <div className="space-y-3">
                          {profile.serviceAreaType === 'city_wide' ? (
                            <div className="bg-brand-parchment p-8 rounded-2xl border border-brand-mist text-center">
                              <MapPin size={24} className="text-brand-terracotta mx-auto mb-4" />
                              <p className="text-sm text-brand-ink font-medium mb-2">Atendimento em domicílio</p>
                              <p className="text-xs text-brand-stone font-light mb-8">
                                Atendimento em qualquer bairro de {profile.city}.
                              </p>
                              <PremiumButton onClick={() => { setSelectedArea({ name: profile.city || '', fee: 0 }); setStep(4); }} className="w-full">Confirmar Cidade</PremiumButton>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-stone mb-4 ml-1">Selecione seu bairro:</p>
                              {profile.serviceAreas?.map((area: any) => (
                                <button 
                                  key={area.name}
                                  onClick={() => { setSelectedArea(area); setStep(4); }}
                                  className="w-full p-6 bg-brand-parchment border border-brand-mist rounded-2xl text-left flex justify-between items-center hover:border-brand-ink transition-all"
                                >
                                  <div>
                                    <span className="font-medium block">{area.name}</span>
                                    {area.fee > 0 && <span className="text-[10px] text-brand-stone italic">Taxa de deslocamento: {formatCurrency(area.fee)}</span>}
                                  </div>
                                  <ChevronRight size={18} className="text-brand-mist" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-brand-parchment p-8 rounded-2xl border border-brand-mist text-center">
                          <MapPin size={24} className="text-brand-terracotta mx-auto mb-4" />
                          <p className="text-sm text-brand-ink font-medium mb-2">Atendimento no Estúdio</p>
                          <p className="text-xs text-brand-stone font-light mb-8 italic">
                            {profile.studioAddress 
                              ? `${profile.studioAddress.street}, ${profile.studioAddress.number}${profile.studioAddress.complement ? ` - ${profile.studioAddress.complement}` : ''}, ${profile.studioAddress.neighborhood}, ${profile.studioAddress.city}`
                              : profile.address || profile.city}
                          </p>
                          <PremiumButton onClick={() => setStep(4)} className="w-full">Confirmar Estúdio</PremiumButton>
                        </div>
                      )}
                      
                      {profile.serviceMode === 'hybrid' && (
                        <button 
                          onClick={() => setBookingMode(null)}
                          className="w-full mt-6 text-[10px] font-bold uppercase tracking-widest text-brand-stone hover:text-brand-ink transition-colors"
                        >
                          Alterar modalidade de atendimento
                        </button>
                      )}
                    </>
                  )}
                </motion.div>
              )}

              {/* Step 4: Confirmation */}
              {step === 4 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                  <h3 className="text-2xl font-serif text-brand-ink mb-2">Quase lá...</h3>
                  <p className="text-xs text-brand-stone font-light mb-10">Confirme seus dados para finalizar o agendamento.</p>
                  
                  <div className="space-y-4 mb-10">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">Seu Nome</label>
                      <input 
                        type="text" 
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Nome completo"
                        className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-xl outline-none focus:ring-1 focus:ring-brand-ink transition-all text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">WhatsApp</label>
                      <input 
                        type="tel" 
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        placeholder="(00) 00000-0000"
                        className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-xl outline-none focus:ring-1 focus:ring-brand-ink transition-all text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">E-mail</label>
                      <input 
                        type="email" 
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        placeholder="seu@email.com"
                        className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-xl outline-none focus:ring-1 focus:ring-brand-ink transition-all text-sm"
                      />
                    </div>

                    {isHomeService && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-1"
                      >
                        <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">Endereço Completo (Rua, nº, apto)</label>
                        <textarea 
                          value={clientAddress}
                          onChange={(e) => setClientAddress(e.target.value)}
                          placeholder="Ex: Rua Silva Jatahy, 123 - Apto 402"
                          className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-xl outline-none focus:ring-1 focus:ring-brand-ink transition-all text-sm h-24 resize-none"
                        />
                      </motion.div>
                    )}
                  </div>

                  <div className="bg-brand-linen/50 p-8 rounded-3xl border border-brand-mist mb-10">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-xs text-brand-stone">Serviço</span>
                      <span className="text-xs font-medium">{selectedService.name}</span>
                    </div>
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-xs text-brand-stone">Data e Hora</span>
                      <span className="text-xs font-medium">{new Date(selectedDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} às {selectedTime}</span>
                    </div>
                    <div className="flex justify-between items-center pt-4 border-t border-brand-mist">
                      <span className="text-sm font-serif italic">Total</span>
                      <span className="text-xl font-serif text-brand-terracotta">{formatCurrency(calculateTotalPrice())}</span>
                    </div>
                  </div>

                  <PremiumButton 
                    onClick={handleBooking} 
                    loading={bookingLoading}
                    disabled={!clientName || !clientPhone || !clientEmail || (isHomeService && !clientAddress)}
                    className="w-full py-6"
                  >
                    Finalizar Agendamento
                  </PremiumButton>
                </motion.div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Step 5: Success Overlay (Full Screen) */}
      <AnimatePresence>
        {step === 5 && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="fixed inset-0 bg-brand-white z-[300] flex flex-col items-center justify-center p-8 text-center"
          >
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              transition={{ type: "spring", damping: 15 }}
              className="w-24 h-24 bg-brand-linen text-brand-terracotta rounded-full flex items-center justify-center mb-10"
            >
              <Check size={48} />
            </motion.div>
            <h2 className="text-4xl font-serif text-brand-ink mb-6">Reserva Realizada</h2>
            <p className="body-text text-brand-stone mb-12 max-w-xs mx-auto">
              Tudo pronto! Sua reserva com {profile.name} foi confirmada. Você receberá um lembrete em breve.
            </p>
            <PremiumButton onClick={() => setStep(1)} className="min-w-[250px]">
              Voltar à Vitrine
            </PremiumButton>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
