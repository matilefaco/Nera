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
import { formatCurrency, cn, getHumanError } from '../lib/utils';
import { toast } from 'sonner';
import Logo from '../components/Logo';
import AppLoadingScreen from '../components/AppLoadingScreen';
import { UserProfile, Service, Review, ServiceArea, Appointment } from '../types';

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

const PremiumButton = ({ children, onClick, variant = 'primary', className, disabled, loading, loadingText }: PremiumButtonProps & { loadingText?: string }) => {
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
        <div className="flex items-center gap-3">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
            <Sparkles size={18} />
          </motion.div>
          {loadingText && <span>{loadingText}</span>}
        </div>
      ) : children}
    </button>
  );
};

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
  const [bookingAttempted, setBookingAttempted] = useState(false);
  const [bookingMode, setBookingMode] = useState<'studio' | 'home' | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [dayAppointments, setDayAppointments] = useState<Appointment[]>([]);
  const [manualBlockedSlots, setManualBlockedSlots] = useState<string[]>([]);
  const [showRestoreDraft, setShowRestoreDraft] = useState(false);

  // Persistence Logic: Saving draft to localStorage
  useEffect(() => {
    if (!profile?.uid) return;

    const draft = {
      professionalId: profile.uid,
      serviceId: selectedService?.id,
      mode: bookingMode,
      date: selectedDate,
      time: selectedTime,
      clientName,
      clientPhone,
      clientEmail,
      selectedAreaId: selectedArea?.name
    };
    
    // Only save if at least one meaningful field is filled
    if (selectedService || selectedDate || clientName || clientPhone) {
      localStorage.setItem('booking_draft', JSON.stringify(draft));
    }
  }, [selectedService, bookingMode, selectedDate, selectedTime, clientName, clientPhone, clientEmail, selectedArea, profile?.uid]);

  // Persistence Logic: Checking for existing draft on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem('booking_draft');
    if (savedDraft && profile?.uid) {
      try {
        const parsed = JSON.parse(savedDraft);
        // Only show modal if the draft belongs to this specific professional
        if (parsed.professionalId === profile.uid) {
          setShowRestoreDraft(true);
        }
      } catch (e) {
        localStorage.removeItem('booking_draft');
      }
    }
  }, [profile?.uid]);

  const handleRestoreDraft = () => {
    const savedDraft = localStorage.getItem('booking_draft');
    if (!savedDraft) return;

    try {
      const draft = JSON.parse(savedDraft);
      
      // Map service ID to actual service object
      if (draft.serviceId) {
        const service = services.find(s => s.id === draft.serviceId);
        if (service) setSelectedService(service);
      }
      
      if (draft.mode) setBookingMode(draft.mode);
      if (draft.date) setSelectedDate(draft.date);
      if (draft.time) setSelectedTime(draft.time);
      if (draft.clientName) setClientName(draft.clientName);
      if (draft.clientPhone) setClientPhone(draft.clientPhone);
      if (draft.clientEmail) setClientEmail(draft.clientEmail);
      
      if (draft.selectedAreaId && profile?.serviceAreas) {
        const area = profile.serviceAreas.find((a: ServiceArea) => a.name === draft.selectedAreaId);
        if (area) setSelectedArea(area);
      }

      // Determine the best step to resume
      if (draft.clientName || draft.clientPhone) {
        setStep(4);
      } else if (draft.date && draft.time) {
        setStep(4);
      } else if (draft.date) {
        setStep(3);
      } else {
        setStep(2);
      }
      
      setShowRestoreDraft(false);
    } catch (e) {
      console.error("Error restoring draft", e);
      localStorage.removeItem('booking_draft');
    }
  };

  const handleClearDraft = () => {
    localStorage.removeItem('booking_draft');
    setShowRestoreDraft(false);
  };

  const availableSlots = React.useMemo(() => {
    if (!profile?.workingHours || !selectedDate) return [];
    
    return getAvailableSlots({
      selectedDate,
      serviceDuration: Number(selectedService?.duration) || 60,
      workingHours: profile.workingHours,
      appointments: dayAppointments,
      manualBlockedSlots
    });
  }, [selectedDate, selectedService, profile, dayAppointments, manualBlockedSlots]);

  // Finding next available slot for hero
  const [nextSlot, setNextSlot] = useState<{ date: string, time: string } | null>(null);

  useEffect(() => {
    const findNextSlot = async () => {
      if (!profile?.uid || !profile?.workingHours || services.length === 0) return;
      
      const duration = Number(services[0]?.duration) || 60;
      const daysToCheck = [0, 1, 2, 3, 4, 5, 6, 7]; // Check next 7 days
      
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
          manualBlockedSlots: [] // Can't easily check manual blocks here without multiple queries, 
                                 // but appointments are the main constraint
        });

        if (slots.length > 0) {
          setNextSlot({ date: dateStr, time: slots[0] });
          break;
        }
      }
    };
    
    if (profile && services.length > 0) {
      findNextSlot();
    }
  }, [profile, services]);

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
    if (selectedDate && profile?.uid) {
      // 1. Listen for manual blocked slots
      const slotsRef = collection(db, 'blocked_slots');
      const slotsQ = query(
        slotsRef, 
        where('professionalId', '==', profile.uid),
        where('date', '==', selectedDate)
      );
      
      const unsubscribeSlots = onSnapshot(slotsQ, (snapshot) => {
        const manualBlocked = snapshot.docs.map(doc => doc.data().time);
        setManualBlockedSlots(manualBlocked);
      }, (err) => {
        console.error("[Availability] Error listening to blocks:", err);
      });

      // 2. Listen for confirmed or completed appointments
      const apptsRef = collection(db, 'appointments');
      const apptsQ = query(
        apptsRef,
        where('professionalId', '==', profile.uid),
        where('date', '==', selectedDate),
        where('status', 'in', ['confirmed', 'completed'])
      );
      
      const unsubscribeAppts = onSnapshot(apptsQ, (snapshot) => {
        const appointmentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Appointment));
        setDayAppointments(appointmentsData);
      }, (err) => {
        console.error("[Availability] Error listening to appointments:", err);
      });

      return () => {
        unsubscribeSlots();
        unsubscribeAppts();
      };
    }
  }, [selectedDate, profile?.uid]);

  const calculateTotalPrice = () => {
    if (!selectedService) return 0;
    const basePrice = Number(selectedService.price) || 0;
    return basePrice + (selectedArea?.fee || 0);
  };

  const handleBooking = async () => {
    setBookingAttempted(true);
    if (!profile || !selectedService) {
      console.warn('[Booking] Missing profile or service', { profile: !!profile, service: !!selectedService });
      return;
    }

    if (!clientName.trim() || !clientPhone.trim() || !clientEmail.trim() || (isHomeService && !clientAddress.trim())) {
      toast.error('Por favor, preencha os campos destacados.');
      return;
    }
    
    // Validation for email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clientEmail.trim())) {
      toast.error('O e-mail informado parece não ser válido.');
      return;
    }

    setBookingLoading(true);
    setBookingSuccess(false);
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
      setBookingSuccess(true);
      localStorage.removeItem('booking_draft');
      
      // Short delay to show success on the button before switching screen
      setTimeout(() => {
        setStep(5); // Success screen (now step 5)
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 800);
    } catch (error: any) {
      handleBookingError(error);
    } finally {
      setBookingLoading(false);
    }
  };

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
              onClick={() => setStep(2)}
              className="bg-brand-ink text-brand-white px-6 py-3 rounded-full text-[9px] font-medium uppercase tracking_widest"
            >
              Reservar
            </button>
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
              <h1 className="text-3xl md:text-4xl font-serif font-normal text-brand-ink/40 tracking-tight">
                {profile.name}
              </h1>
            </div>

            <div className="max-w-4xl mx-auto">
              <h2 className="text-[52px] md:text-[88px] font-serif font-normal text-brand-ink leading-[1.05] tracking-tight mb-10">
                {profile.headline || (
                  profile.specialty 
                    ? `${profile.specialty} sofisticado com acabamento impecável` 
                    : "Beleza minimalista com precisão absoluta"
                )}
              </h2>
              
              <p className="text-lg md:text-2xl font-light text-brand-stone italic max-w-2xl mx-auto leading-relaxed border-l border-brand-mist/50 pl-8">
                "Cada detalhe pensado para valorizar sua beleza de forma única e elevar sua confiança."
              </p>
            </div>
          </div>

          {/* Location Context */}
          <div className="flex flex-col items-center gap-6 mb-16">
            <div className="flex flex-wrap items-center justify-center gap-6 text-[11px] md:text-[12px] font-medium uppercase tracking-[0.25em] text-brand-stone">
              <div className="flex items-center gap-2.5">
                <MapPin size={16} className="text-brand-terracotta" />
                <span className="border-b border-brand-mist pb-0.5">Atendimento em {profile.city}</span>
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

            <div className="flex flex-col sm:flex-row items-center justify-center gap-8 px-4 w-full">
              <PremiumButton 
                onClick={() => {
                  if (services.length > 0 && !selectedService) setSelectedService(services[0]);
                  setStep(2);
                }} 
                className="w-full sm:w-auto min-w-[320px] py-8 text-[13px] font-bold shadow-2xl hover:scale-[1.02] active:scale-[0.98]"
                variant="terracotta"
              >
                Reservar agora <ChevronRight size={18} className="ml-1" />
              </PremiumButton>
              
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
                {stats?.totalCompletedBookings > 10 ? 'Centenas de atendimentos realizados com excelência' : 'Foco absoluto em naturalidade e precisão'}
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
                  <p className="text-xs text-brand-stone leading-relaxed font-light">
                    {diff.toLowerCase().includes('pontual') ? 'Respeito total ao seu tempo com agendamentos precisos.' :
                     diff.toLowerCase().includes('premium') || diff.toLowerCase().includes('produto') ? 'Produtos selecionados das melhores marcas mundiais.' :
                     diff.toLowerCase().includes('silencioso') || diff.toLowerCase().includes('confort') ? 'Ambiente planejado para seu total relaxamento.' :
                     'Padrão de excelência e cuidado em cada detalhe do atendimento.'}
                  </p>
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
                    setSelectedService(service);
                    setStep(2); // Goes to Service + Mode (Step 1 of the new flow)
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
                          <span className="text-[11px] text-brand-terracotta/60 font-bold uppercase tracking-[0.2em]">
                             Acabamento natural e impecável
                          </span>
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

      {/* 5. REGIONS / LOGISTICS / STUDIO ADDRESS */}
      <section className="py-32 px-6 bg-brand-white border-y border-brand-mist">
        <div className="max-w-5xl mx-auto">
          <div className="text-center space-y-4 mb-20">
            <span className="label-text block">Localização & Atendimento</span>
            <h2 className="heading-section text-brand-ink">Onde você deseja ser atendida?</h2>
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
                      if (profile.serviceMode === 'hybrid') setBookingMode('studio');
                      if (services.length > 0 && !selectedService) setSelectedService(services[0]);
                      setStep(2);
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
                      if (profile.serviceMode === 'hybrid') setBookingMode('home');
                      if (services.length > 0 && !selectedService) setSelectedService(services[0]);
                      setStep(2);
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
            <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-brand-terracotta/60 block">Últimas vagas disponíveis</span>
            <h2 className="text-5xl md:text-7xl font-serif font-normal leading-tight">Pronta para agendar seu horário?</h2>
            <p className="text-brand-blush/60 text-lg md:text-xl max-w-2xl mx-auto font-light leading-relaxed">
              Junte-se a clientes que já transformaram seu olhar e autoestima com um atendimento exclusivo e personalizado.
            </p>
            
            <div className="flex flex-col items-center gap-10 pt-8">
              <PremiumButton 
                variant="terracotta" 
                className="min-w-[320px] py-8 text-sm group"
                onClick={() => {
                  setStep(2);
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
            <div className="font-signature text-3xl text-brand-terracotta/30">
               Beauty in Details
            </div>
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
            <a href={`https://wa.me/${profile.whatsapp}`} target="_blank" className="w-10 h-10 rounded-full border border-brand-mist flex items-center justify-center text-brand-stone hover:text-brand-terracotta hover:border-brand-terracotta transition-all">
              <MessageCircle size={18} />
            </a>
          </div>

          <p className="text-[9px] text-brand-stone/40 uppercase tracking-widest">
            © {new Date().getFullYear()} {profile.name} • Powered by Nera
          </p>
        </div>
      </footer>

      {/* --- RESTORE DRAFT MODAL --- */}
      <AnimatePresence>
        {showRestoreDraft && (
          <div className="fixed inset-0 bg-brand-ink/60 backdrop-blur-md z-[600] flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-brand-white w-full max-w-md rounded-[40px] p-10 text-center shadow-2xl border border-brand-mist"
            >
              <div className="w-16 h-16 bg-brand-linen text-brand-terracotta rounded-full flex items-center justify-center mx-auto mb-8">
                <Clock size={32} />
              </div>
              <h3 className="text-2xl font-serif text-brand-ink mb-3">Continuar agendamento?</h3>
              <p className="text-sm text-brand-stone font-light mb-10 leading-relaxed">
                Identificamos que você iniciou um agendamento anteriormente. Deseja continuar de onde parou?
              </p>
              
              <div className="flex flex-col gap-4">
                <PremiumButton 
                  variant="terracotta" 
                  className="w-full py-6"
                  onClick={handleRestoreDraft}
                >
                  Continuar Agendamento
                </PremiumButton>
                <button 
                  onClick={handleClearDraft}
                  className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-stone hover:text-brand-ink transition-colors py-2"
                >
                  Começar do zero
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- BOOKING MODAL OVERLAY --- */}
      <AnimatePresence>
        {step >= 2 && step <= 4 && (
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
              <div className="flex gap-2 mb-8">
                {[2, 3, 4].map((s) => (
                   <div key={s} className={cn("h-1 flex-1 rounded-full transition-all duration-500", step >= s ? "bg-brand-terracotta" : "bg-brand-mist")} />
                ))}
              </div>

              {/* Step 2: Escolha do Serviço + Modo */}
              {step === 2 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                  <h3 className="text-2xl font-serif text-brand-ink mb-2">Sua Experiência</h3>
                  <p className="text-xs text-brand-stone font-light mb-10">Selecione o serviço e onde deseja ser atendida.</p>
                  
                  <div className="space-y-8">
                    {/* Modo de Atendimento (if hybrid) */}
                    {profile.serviceMode === 'hybrid' && (
                      <div className="space-y-4">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">Onde prefere o atendimento?</label>
                        <div className="grid grid-cols-2 gap-4">
                          <button 
                            onClick={() => setBookingMode('studio')}
                            className={cn(
                              "flex items-center gap-4 p-5 rounded-2xl border transition-all",
                              bookingMode === 'studio' ? "bg-brand-ink text-brand-white border-brand-ink" : "bg-brand-white border-brand-mist text-brand-stone hover:border-brand-ink"
                            )}
                          >
                            <Building2 size={20} className={bookingMode === 'studio' ? "text-brand-terracotta" : "text-brand-mist"} />
                            <span className="text-xs font-medium uppercase tracking-widest">No Estúdio</span>
                          </button>
                          <button 
                            onClick={() => setBookingMode('home')}
                            className={cn(
                              "flex items-center gap-4 p-5 rounded-2xl border transition-all",
                              bookingMode === 'home' ? "bg-brand-ink text-brand-white border-brand-ink" : "bg-brand-white border-brand-mist text-brand-stone hover:border-brand-ink"
                            )}
                          >
                            <Home size={20} className={bookingMode === 'home' ? "text-brand-terracotta" : "text-brand-mist"} />
                            <span className="text-xs font-medium uppercase tracking-widest">Em Casa</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Neighborhood selection for home service */}
                    {isHomeService && profile.serviceAreaType === 'custom' && (
                      <div className="space-y-4">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">Em qual bairro você está?</label>
                        <div className="flex flex-wrap gap-2">
                          {profile.serviceAreas?.map((area) => (
                            <button
                              key={area.name}
                              onClick={() => setSelectedArea(area)}
                              className={cn(
                                "px-6 py-3 rounded-full border text-[10px] font-bold uppercase tracking-widest transition-all",
                                selectedArea?.name === area.name 
                                  ? "bg-brand-ink text-brand-white border-brand-ink" 
                                  : "bg-brand-white border-brand-mist text-brand-stone hover:border-brand-ink"
                              )}
                            >
                              {area.name} {area.fee > 0 && `(+${formatCurrency(area.fee)})`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">Qual experiência deseja viver hoje?</label>
                      <div className="space-y-3">
                        {services.map((service) => (
                          <button
                            key={service.id}
                            onClick={() => { setSelectedService(service); }}
                            className={cn(
                              "w-full p-6 text-left rounded-[24px] border transition-all flex justify-between items-center group relative overflow-hidden",
                              selectedService?.id === service.id 
                                ? "bg-brand-ink border-brand-ink text-brand-white" 
                                : "bg-brand-parchment border-brand-mist hover:border-brand-ink"
                            )}
                          >
                            <div className="flex-1 relative z-10">
                              <h4 className={cn("font-serif text-lg", selectedService?.id === service.id ? "text-brand-white" : "text-brand-ink")}>
                                {service.name}
                              </h4>
                              <span className="text-[10px] uppercase tracking-widest opacity-60">{service.duration} min</span>
                            </div>
                            <div className="text-xl font-serif text-brand-terracotta relative z-10">
                              {formatCurrency(service.price)}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <PremiumButton 
                      className="w-full mt-8" 
                      variant="terracotta"
                      disabled={!selectedService || (isHomeService && profile.serviceAreaType === 'custom' && !selectedArea)}
                      onClick={() => setStep(3)}
                    >
                      Continuar <ArrowRight size={18} className="ml-1" />
                    </PremiumButton>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Data e Horário (Consolidated) */}
              {step === 3 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                  <div className="flex items-center gap-4 mb-2">
                    <button onClick={() => setStep(2)} className="text-brand-stone hover:text-brand-ink"><ArrowLeft size={20} /></button>
                    <h3 className="text-2xl font-serif text-brand-ink">Selecione o melhor dia para você</h3>
                  </div>
                  <p className="text-xs text-brand-stone font-light mb-10 ml-9">Escolha a data ideal para sua experiência.</p>
                  
                  {/* Calendar Strip */}
                  <div className="flex overflow-x-auto gap-3 pb-4 mb-10 no-scrollbar -mx-2 px-2">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(offset => {
                      const date = new Date();
                      date.setDate(date.getDate() + offset);
                      const dateStr = date.toISOString().split('T')[0];
                      const isSelected = selectedDate === dateStr;
                      
                      return (
                        <button 
                          key={offset}
                          onClick={() => setSelectedDate(dateStr)}
                          className={cn(
                            "min-w-[70px] aspect-[4/5] rounded-2xl flex flex-col items-center justify-center transition-all border shrink-0",
                            isSelected 
                              ? "bg-brand-ink text-brand-white border-brand-ink premium-shadow scale-105" 
                              : "bg-brand-parchment border-brand-mist hover:border-brand-ink"
                          )}
                        >
                          <span className="text-[8px] font-bold uppercase tracking-widest mb-1 opacity-40">
                            {date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
                          </span>
                          <span className="text-lg font-serif">{date.getDate()}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Time Slots */}
                  <div className="space-y-4 mb-12">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">Horários disponíveis</label>
                    <div className="grid grid-cols-3 gap-3">
                      {selectedDate ? (
                        availableSlots.length > 0 ? (
                          availableSlots.map(time => (
                            <button 
                              key={time}
                              onClick={() => setSelectedTime(time)}
                              className={cn(
                                "py-5 rounded-2xl border transition-all text-sm font-medium flex items-center justify-center gap-2",
                                selectedTime === time 
                                  ? "bg-brand-ink text-brand-white border-brand-ink" 
                                  : "bg-brand-white border-brand-mist hover:border-brand-ink text-brand-ink"
                              )}
                            >
                              <Clock size={14} className={selectedTime === time ? "text-brand-terracotta" : "text-brand-mist"} />
                              {time}
                            </button>
                          ))
                        ) : (
                          <div className="col-span-3 py-16 text-center bg-brand-linen/30 rounded-3xl border border-dashed border-brand-mist">
                            <p className="text-sm text-brand-stone font-light italic">Sem horários para este dia</p>
                          </div>
                        )
                      ) : (
                        <div className="col-span-3 py-16 text-center bg-brand-parchment/50 rounded-3xl border border-dashed border-brand-mist">
                          <p className="text-sm text-brand-stone font-light italic">Selecione uma data acima</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <PremiumButton 
                    variant="terracotta" 
                    className="w-full" 
                    disabled={!selectedDate || !selectedTime}
                    onClick={() => setStep(4)}
                  >
                    Confirmar este horário <ArrowRight size={18} className="ml-1" />
                  </PremiumButton>
                </motion.div>
              )}

              {/* Step 4: Seus Dados + Confirmação (Consolidated) */}
              {step === 4 && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="flex items-center gap-4 mb-2">
                    <button onClick={() => setStep(3)} className="text-brand-stone hover:text-brand-ink"><ArrowLeft size={20} /></button>
                    <h3 className="text-2xl font-serif text-brand-ink">Só falta confirmar seus dados</h3>
                  </div>
                  <p className="text-xs text-brand-stone font-light mb-10 ml-9">Quase lá! Revise as informações da sua reserva.</p>
                  
                  <div className="bg-brand-ink text-brand-white rounded-[32px] p-8 mb-8 space-y-6 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-terracotta/20 rounded-full -mr-16 -mt-16 blur-3xl opacity-50" />
                    
                    <div className="flex justify-between items-start pb-6 border-b border-brand-white/10 relative z-10">
                      <div className="flex-1">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-brand-blush/40 block mb-2">{selectedService?.name}</span>
                        <div className="flex items-center gap-4 text-xs font-light text-brand-blush/80">
                          <span className="flex items-center gap-1.5"><CalendarIcon size={12} /> {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                          <span className="flex items-center gap-1.5"><Clock size={12} /> {selectedTime}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-brand-blush/40 block mb-2">Total</span>
                        <h4 className="text-2xl font-serif text-brand-terracotta leading-none">{formatCurrency(calculateTotalPrice())}</h4>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 mb-8">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">
                        Seu Nome <span className="text-brand-terracotta">*</span>
                      </label>
                      <input 
                        type="text" 
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Nome completo"
                        className={cn(
                          "w-full px-6 py-5 bg-brand-parchment border rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all text-sm",
                          !clientName && bookingAttempted ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist"
                        )}
                      />
                      {!clientName && bookingAttempted && (
                        <p className="text-[9px] text-brand-terracotta font-bold uppercase tracking-wider ml-2 mt-1">Este campo é obrigatório</p>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">
                          WhatsApp <span className="text-brand-terracotta">*</span>
                        </label>
                        <input 
                          type="tel" 
                          value={clientPhone}
                          onChange={(e) => setClientPhone(e.target.value)}
                          placeholder="(85) 99999-9999"
                          className={cn(
                            "w-full px-6 py-5 bg-brand-parchment border rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all text-sm",
                            !clientPhone && bookingAttempted ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist"
                          )}
                        />
                        {!clientPhone && bookingAttempted && (
                          <p className="text-[9px] text-brand-terracotta font-bold uppercase tracking-wider ml-2 mt-1">Este campo é obrigatório</p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">
                          E-mail <span className="text-brand-terracotta">*</span>
                        </label>
                        <input 
                          type="email" 
                          value={clientEmail}
                          onChange={(e) => setClientEmail(e.target.value)}
                          placeholder="seu@e-mail.com"
                          className={cn(
                            "w-full px-6 py-5 bg-brand-parchment border rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all text-sm",
                            !clientEmail && bookingAttempted ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist"
                          )}
                        />
                        {!clientEmail && bookingAttempted && (
                          <p className="text-[9px] text-brand-terracotta font-bold uppercase tracking-wider ml-2 mt-1">Este campo é obrigatório</p>
                        )}
                        <p className="text-[9px] text-brand-stone/60 ml-2 font-light mt-1">
                          Usaremos seu e-mail para enviar a confirmação do agendamento
                        </p>
                      </div>
                    </div>

                    {isHomeService && (
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">
                          Endereço de Atendimento <span className="text-brand-terracotta">*</span>
                        </label>
                        <textarea 
                          value={clientAddress}
                          onChange={(e) => setClientAddress(e.target.value)}
                          placeholder="Rua, número, bairro e qualquer ponto de referência"
                          className={cn(
                            "w-full px-6 py-5 bg-brand-parchment border rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all text-sm resize-none h-28",
                            !clientAddress && bookingAttempted ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist"
                          )}
                        />
                        {!clientAddress && bookingAttempted && (
                          <p className="text-[9px] text-brand-terracotta font-bold uppercase tracking-wider ml-2 mt-1">Este campo é obrigatório</p>
                        )}
                      </div>
                    )}
                  </div>

                  <PremiumButton 
                    variant="terracotta" 
                    className="w-full py-7"
                    loading={bookingLoading}
                    loadingText="Finalizando solicitação..."
                    disabled={!clientName || !clientPhone || !clientEmail || (isHomeService && !clientAddress)}
                    onClick={handleBooking}
                  >
                    Solicitar meu horário <Check size={18} className="ml-1" />
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
              className="w-24 h-24 bg-brand-linen text-brand-terracotta rounded-full flex items-center justify-center mb-8"
            >
              <Check size={48} />
            </motion.div>
            
            <h2 className="text-3xl md:text-4xl font-serif text-brand-ink mb-3 leading-tight">Reserva recebida com sucesso</h2>
            <p className="body-text text-brand-stone mb-10 max-w-xs mx-auto">
              Sua solicitação foi enviada e em breve você receberá a confirmação diretamente no WhatsApp.
            </p>

            {/* Resume Card */}
            {selectedService && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-brand-parchment rounded-3xl border border-brand-mist p-8 w-full max-w-sm mb-12 text-left shadow-sm"
              >
                <span className="text-[9px] font-bold uppercase tracking-widest text-brand-stone block mb-4 border-b border-brand-mist/50 pb-2">Resumo da solicitação</span>
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] text-brand-stone uppercase tracking-wide block mb-1">Serviço</span>
                    <span className="font-serif text-brand-ink">{selectedService.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] text-brand-stone uppercase tracking-wide block mb-1">Data</span>
                      <span className="text-sm font-medium text-brand-ink">
                        {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-brand-stone uppercase tracking-wide block mb-1">Horário</span>
                      <span className="text-sm font-medium text-brand-ink">{selectedTime}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="flex flex-col w-full max-w-sm gap-4">
              <PremiumButton 
                variant="terracotta"
                className="w-full py-6"
                onClick={() => {
                  const message = `Olá! Acabei de solicitar um agendamento de ${selectedService?.name} para o dia ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')} às ${selectedTime} pelo Nera.`;
                  const phone = profile?.phone || profile?.whatsapp || '';
                  window.open(`https://wa.me/55${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
                }}
              >
                <MessageCircle size={18} /> Falar no WhatsApp
              </PremiumButton>
              
              <button 
                onClick={() => {
                  setStep(1);
                  setSelectedService(null);
                  setSelectedDate('');
                  setSelectedTime('');
                  setBookingSuccess(false);
                }}
                className="text-[11px] font-bold uppercase tracking-widest text-brand-stone hover:text-brand-ink py-4 transition-colors"
              >
                Voltar para o perfil
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
