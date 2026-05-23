import React, { useEffect, useState, useRef } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { PLAN_CONFIGS, PlanType } from "../constants/plans";
import {
  db,
  createBookingRequest,
  handleBookingError,
  logAnalyticsEvent,
} from "../firebase";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import {
  Clock,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  Instagram,
  Info,
  MessageCircle,
  Plus,
  X,
  Camera,
  ChevronDown,
  ArrowRight,
  Star,
  CheckCircle2,
  Users,
  MapPin,
  Home,
  Award,
  ArrowLeft,
} from "lucide-react";
import {
  formatCurrency,
  cn,
  buildWhatsappLink,
  splitSmartBio,
  isFakeContent
} from "../lib/utils";
import { formatSpecialtyLabel } from "../lib/copy";
import { getTheme } from "../lib/themes";
import { notify } from "../lib/notify";
import Logo from "../components/Logo";
import PremiumButton from "../components/PremiumButton";
// Lazy components
const BookingModal = React.lazy(() => import("../components/BookingModal"));
const WaitlistModal = React.lazy(() => import("../components/WaitlistModal"));
import { UserProfile, Service, Review, Appointment } from "../types";

import {
  getAvailableSlots,
  getDayAvailability,
  getNextAvailableSlot,
  getLocalDateStr,
  getBookableSlotsForDate,
} from "../lib/bookingUtils";
import { PublicHero } from "../components/public/PublicHero";
import { ServicesSection } from "../components/public/ServicesSection";
import { PortfolioSection } from "../components/public/PortfolioSection";
import { ReviewsSection } from "../components/public/ReviewsSection";
import { FinalCTA } from "../components/public/FinalCTA";
import { ConfidenceSection } from "../components/public/ConfidenceSection";
import {
  WeekAvailability,
  WeeklyDayAvailability,
} from "../components/public/WeekAvailability";
import { ExpertIntro } from "../components/public/ExpertIntro";
import { PaymentMethods } from "../components/public/PaymentMethods";
import SEOHead from "../components/SEOHead";
import { PublicProfileErrorBoundary } from "../components/public/PublicProfileErrorBoundary";

const isDev = import.meta.env.DEV || (typeof window !== 'undefined' && window.location.hostname.includes('ais-'));
const devLog = (...args: any[]) => isDev && console.log(...args);

import { Skeleton } from "../components/ui/Skeleton";

const PublicProfileSkeleton = () => (
  <div className="min-h-screen bg-brand-parchment flex flex-col items-center pt-40 px-6">
    <div className="relative mb-16">
      <Skeleton className="w-56 h-72 rounded-[60px] border-8 border-brand-white shadow-2xl" />
    </div>
    <div className="flex flex-col items-center w-full max-w-4xl space-y-12 mb-20 text-center">
      <div className="space-y-4">
        <Skeleton className="h-4 w-40 rounded-full mx-auto" />
        <Skeleton className="h-10 w-64 rounded-xl mx-auto" />
      </div>
      <div className="w-full space-y-6">
        <Skeleton className="h-20 md:h-32 w-full rounded-[40px]" />
      </div>
    </div>
  </div>
);
export default function PublicProfile() {
  return (
    <PublicProfileErrorBoundary>
      <PublicProfileContent />
    </PublicProfileErrorBoundary>
  );
}

function PublicProfileContent() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const waitlistToken = searchParams.get("w");

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<'timeout' | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const servicesRef = useRef<HTMLDivElement>(null);
  const finalCtaRef = useRef<HTMLDivElement>(null);
  const [scrolledPastHero, setScrolledPastHero] = useState(false);
  const [isCtaVisibleInContent, setIsCtaVisibleInContent] = useState(false);

  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false);

  // Existing state...
  const [preSelectedService, setPreSelectedService] = useState<Service | null>(
    null,
  );
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showInterestPopup, setShowInterestPopup] = useState(false);
  const [interestPopupDismissed, setInterestPopupDismissed] = useState(false);
  const [nextSlot, setNextSlot] = useState<{
    date: string;
    time: string;
  } | null>(null);
  const [totalWeeklySlots, setTotalWeeklySlots] = useState<number | null>(null);
  const [weeklyAvailability, setWeeklyAvailability] = useState<
    WeeklyDayAvailability[]
  >([]);
  const [selectedInitialDate, setSelectedInitialDate] = useState<string | null>(
    null,
  );
  const [isAgendaFull, setIsAgendaFull] = useState(false);
  const [activeWaitlistEntry, setActiveWaitlistEntry] = useState<any>(null);

  const profilePlan = (profile?.plan || "free") as PlanType;
  const features = PLAN_CONFIGS[profilePlan]?.features;

  const { hero: heroBio, about: aboutBio } = React.useMemo(() => {
    return splitSmartBio(profile?.bio);
  }, [profile?.bio]);

  useEffect(() => {
    const handleScroll = () => {
      // Show sticky CTA only after 30% scroll
      const scrollY = window.scrollY;
      const docHeight = document.documentElement.scrollHeight;
      const winHeight = window.innerHeight;
      const scrollPercent = scrollY / (docHeight - winHeight);

      setScrolledPastHero(scrollPercent > 0.3);

      // Check if the final CTA or any other prominent booking button is visible
      if (finalCtaRef.current) {
        const rect = finalCtaRef.current.getBoundingClientRect();
        setIsCtaVisibleInContent(rect.top < winHeight && rect.bottom > 0);
      }

      if (
        scrollPercent > 0.8 &&
        !showInterestPopup &&
        !interestPopupDismissed &&
        !isBookingModalOpen
      ) {
        setShowInterestPopup(true);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [showInterestPopup, interestPopupDismissed, isBookingModalOpen]);

  useEffect(() => {
    let isMounted = true;
    devLog(`[PublicProfile] effect started for slug: ${slug}`);
    
    const fetchData = async () => {
      if (!slug) {
        devLog(`[PublicProfile] No slug, setting loading to false`);
        if (isMounted) setLoading(false);
        return;
      }

      // --- HELENA PRADO MOCK FALLBACK ---
      if (slug === 'helena-prado') {
        devLog(`[PublicProfile] Loading static Helena Prado demo`);
        
        const HELENA_MOCK = {
          name: 'Helena Prado',
          slug: 'helena-prado',
          uid: 'demo-helena-prado',
          professionalId: 'demo-helena-prado',
          email: 'demo@usenera.com',
          specialty: 'Sobrancelhas e Harmonização do Olhar',
          city: 'São Paulo',
          neighborhood: 'Jardins',
          serviceMode: 'hybrid',
          headline: 'Especialista em Design de Sobrancelhas Naturais',
          bio: 'Especialista em design de sobrancelhas naturais. Com foco em harmonização facial, meu trabalho é realçar sua beleza autêntica sem transformações artificiais. Cada traço é pensado para valorizar o seu olhar de forma única e elegante.',
          avatar: 'https://i.imgur.com/gBdf3tO.png',
          coverImage: 'https://images.unsplash.com/photo-1600125867375-9c5ae5cf61ac?q=80&w=1200&auto=format&fit=crop',
          professionalIdentity: {
            yearsExperience: '8',
            mainSpecialty: 'Design de Sobrancelhas',
            subSpecialties: ['Brow Lamination', 'Micropigmentação Natural', 'Design com Henna'],
            serviceStyle: ['Minimalista e Natural', 'Premium e Personalizado'],
            differentials: ['Biossegurança rigorosa', 'Atendimento pontual', 'Produtos de alta performance']
          },
          profileTheme: {
            variant: 'terracotta'
          },
          whatsapp: '5511999999999',
          instagram: 'helenaprado.beauty',
          indexable: false,
          published: true,
          plan: 'pro',
          paymentMethods: ['pix', 'credit_card', 'debit_card'],
          acceptsInstallments: false,
          workingDays: [1, 2, 3, 4, 5],
          startTime: '09:00',
          endTime: '18:00',
          serviceAreas: [],
          studioAddress: {
            street: 'Rua Oscar Freire',
            number: '1234',
            complement: 'Conj. 41',
            neighborhood: 'Jardins',
            city: 'São Paulo',
            privacyMode: 'reveal_after_booking',
            hasParking: true,
            parkingInfo: 'Valet no local',
            isSafeLocation: true
          },
          portfolio: [
            { id: '1', url: 'https://i.imgur.com/O9b1cB9.png', category: 'Processo' },
            { id: '2', url: 'https://i.imgur.com/pk8kE8K_d.webp?maxwidth=760&fidelity=grand', category: 'Resultado' },
            { id: '3', url: 'https://i.imgur.com/D8hEvtH_d.webp?maxwidth=1520&fidelity=grand', category: 'Antes e Depois' }
          ]
        };
        
        const HELENA_SERVICES = [
          { id: '1', name: 'Sobrancelhas Harmonizadas', price: 150, duration: 45, description: 'Sobrancelhas alinhadas ao seu rosto, com resultado natural e harmonioso que valoriza seu olhar.' },
          { id: '2', name: 'Brow Lamination Premium', price: 280, duration: 60, description: 'Efeito de sobrancelhas cheias e disciplinadas, ideal para quem busca volume com elegância.' },
          { id: '3', name: 'Micropigmentação Soft', price: 950, duration: 150, description: 'Preenchimento fio a fio ultra-realista para quem deseja acordar pronta todos os dias.' }
        ];

        const HELENA_REVIEWS = [
          { id: '1', comment: 'Trabalho impecável! A Helena conseguiu manter a naturalidade que eu tanto queria.', firstName: 'Mariana', neighborhood: 'Pinheiros', rating: 5, createdAt: new Date().toISOString() },
          { id: '2', comment: 'Profissional super atenciosa, o estúdio é lindo e o resultado superou minhas expectativas.', firstName: 'Beatriz', neighborhood: 'Vila Madalena', rating: 5, createdAt: new Date().toISOString() },
          { id: '3', comment: 'Já fiz com várias outras pessoas, mas ninguém faz a harmonização como ela.', firstName: 'Carolina', neighborhood: 'Jardins', rating: 5, createdAt: new Date().toISOString() }
        ];

        const HELENA_STATS = {
          rating: 5.0,
          reviewCount: 42,
          completedBookings: 180
        };

        if (isMounted) {
          setProfile(HELENA_MOCK as unknown as UserProfile);
          setServices(HELENA_SERVICES as any[]);
          setReviews(HELENA_REVIEWS as any[]);
          setStats(HELENA_STATS as any);
          setLoading(false);
        }
        return;
      }
      // --- END MOCK ---

      try {
        devLog(`[PublicProfile] starting robust resolution for slug: ${slug} via API`);
        
        // 1. Fetch sanitized profile from backend API
        const response = await fetch(`/api/profile/public-profile/${slug}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            devLog(`[PublicProfile] No user found for slug: ${slug}`);
            if (isMounted) {
              setLoading(false);
              setProfile(null);
            }
            return;
          }
          
          if (response.status === 409) {
             if (isDev) console.error(`[PublicProfile] High priority conflict for slug: ${slug}`);
             if (isMounted) {
               setLoading(false);
               setProfile(null);
             }
             return;
          }

          throw new Error(`API_ERROR_${response.status}`);
        }

        const userData = await response.json();
        const professionalId = userData.professionalId;

        if (!isMounted) return;

        devLog(`[PublicProfile] Resolved user fetch completed via API. ProfessionalId: ${professionalId}`);

        if (isMounted) {
          devLog(`[PublicProfile] setting profile for ${professionalId} and ending loading`);
          setProfile(userData as UserProfile);
          
          if (userData.services) setServices(userData.services);
          if (userData.reviews) {
            const cleanReviews = (userData.reviews as Review[]).filter(r => !isFakeContent(r.comment) && !isFakeContent(r.firstName));
            setReviews(cleanReviews);
          }
          if (userData.stats) setStats(userData.stats);
          
          setLoading(false); 
        }

        // Growth Analytics: Log Visit
        logAnalyticsEvent(professionalId, "visit").catch((err) => {
          devLog("[PublicProfile] Analytics error:", err);
        });

        devLog(`[PublicProfile] Starting secondary background tasks`);
        // Parallel fetches for portfolio (since it's not and shouldn't be in the main payload for size reasons)
        Promise.allSettled([
            // Portfolio (Legacy & for completeness)
            (async () => {
              if (!userData.portfolio || userData.portfolio.length === 0) {
                const portfolioQ = query(
                  collection(db, "users", professionalId, "portfolio"),
                  orderBy("createdAt", "desc"),
                  limit(12)
                );
                const portfolioSnapshot = await getDocs(portfolioQ);
                if (!isMounted) return;
                if (!portfolioSnapshot.empty) {
                  const portfolioItems = portfolioSnapshot.docs.map((doc) => ({
                    id: doc.id,
                    url: doc.data().url || doc.data().imageUrl,
                    category: doc.data().category,
                    createdAt: doc.data().createdAt || new Date().toISOString(),
                  }));
                  setProfile((prev) => prev ? { ...prev, portfolio: portfolioItems } : null);
                }
              }
            })()
          ]);
      } catch (error: any) {
        if (isDev) console.error("Critical error fetching public profile:", error);
        if (error.message === "FIRESTORE_TIMEOUT") {
          if (isMounted) setLoadError('timeout');
        } else {
          notify.error("Não foi possível carregar as informações do perfil.");
        }
      } finally {
        devLog(`[PublicProfile] finally block executed. isMounted: ${isMounted}`);
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      devLog(`[PublicProfile] unmount cleanup executed for slug: ${slug}`);
      isMounted = false;
    };
  }, [slug, retryCount]);

  // Handle Waitlist Invitation
  useEffect(() => {
    async function checkWaitlist() {
      if (!waitlistToken || !profile) return;
      try {
        const snap = await getDocs(
          query(
            collection(db, "waitlist"),
            where("__name__", "==", waitlistToken),
          ),
        );
        if (!snap.empty) {
          const entry = snap.docs[0].data();
          // Check expiration
          if (entry.status === "invited" && entry.invitationExpiresAt) {
            const expiry = new Date(entry.invitationExpiresAt);
            if (expiry > new Date()) {
              setActiveWaitlistEntry({ id: snap.docs[0].id, ...entry });
              setPreSelectedService(
                services.find((s) => s.id === entry.serviceId) || null,
              );
              setIsBookingModalOpen(true);
              notify.success("Sua vaga reservada está te esperando! ✨");
            } else {
              notify.error("Este convite de espera expirou.");
            }
          }
        }
      } catch (e) {
        devLog("Waitlist check failed", e);
      }
    }
    checkWaitlist();
  }, [waitlistToken, profile, services]);

  useEffect(() => {
    const findAvailabilityData = async () => {
      const profId = profile?.professionalId || profile?.uid;
      if (!profId || !profile?.workingHours || services.length === 0)
        return;

      devLog(`[NEXT_SLOT] Starting calculation for pro: ${profId}`);

      try {
        const now = new Date();
        const duration = Number(services[0]?.duration) || 60;

        // Fetch all blocked schedules for the week once
        const blockedQ = query(
          collection(db, "blocked_schedules"),
          where("professionalId", "==", profId),
        );
        const blockedSnap = await getDocs(blockedQ);
        const blockedSchedules = blockedSnap.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as any,
        );

        // Fetch all appointments for the next 14 days securely via backend (Blindagem)
        const todayStr = getLocalDateStr(now);
        const endGame = new Date();
        endGame.setDate(endGame.getDate() + 14);
        const endGameStr = getLocalDateStr(endGame);
  
        const slotsResponse = await fetch(`/api/public/occupied-slots/${profId}?start=${todayStr}&end=${endGameStr}`);
        const { slots: allAppts } = await slotsResponse.json();
  
        const result = getNextAvailableSlot({
          workingHours: profile.workingHours,
          appointments: allAppts as any[],
          blockedSchedules,
          serviceDuration: duration,
          daysToLookAhead: 14,
        });

        // Calculate Weekly Availability
        const weekly: WeeklyDayAvailability[] = [];
        for (let i = 0; i < 7; i++) {
          const targetDate = new Date();
          targetDate.setDate(now.getDate() + i);
          const dateStr = getLocalDateStr(targetDate);
          const dayOfWeek = targetDate.getDay();

          const slots = getBookableSlotsForDate({
            date: dateStr,
            workingHours: profile.workingHours,
            appointments: allAppts.filter((a) => a.date === dateStr),
            blockedSchedules,
            serviceDuration: duration,
            now,
          });

          const isWorkingDay = (
            profile.workingHours.workingDays || [1, 2, 3, 4, 5]
          ).includes(dayOfWeek);

          let status: "available" | "low" | "full" | "closed" = "available";
          if (!isWorkingDay) {
            status = "closed";
          } else if (slots.length === 0) {
            status = "full";
          } else if (slots.length <= 3) {
            status = "low";
          }

          weekly.push({
            date: dateStr,
            label:
              i === 0
                ? "Hoje"
                : targetDate
                    .toLocaleDateString("pt-BR", { weekday: "short" })
                    .replace(".", "")
                    .toUpperCase(),
            dayNumber: targetDate.getDate().toString(),
            status,
            slotsCount: slots.length,
          });
        }
        setWeeklyAvailability(weekly);

        if (result) {
          // PROVA REAL: Re-verificar se os slots do dia escolhido realmente existem no motor mestre
          const verificationSlots = getAvailableSlots({
            selectedDate: result.date,
            serviceDuration: duration,
            workingHours: profile.workingHours,
            appointments: allAppts.filter((a) => a.date === result.date),
            blockedSchedules,
          });

          devLog(
            `[BADGE DEBUG] Final Verification for ${result.date}: ${verificationSlots.length} slots found.`,
          );

          if (verificationSlots.length === 0) {
            if (isDev) {
              console.error(
                `[BADGE BUG] Badge attempted to show unavailable slot for ${result.date} ${result.time}. Agenda shows 0 slots.`,
              );
            }
            setNextSlot(null);
            setTotalWeeklySlots(0);
            setIsAgendaFull(true);
          } else {
            devLog(
              `[BADGE DEBUG] Success: Badge showing confirmed slot ${result.time} on ${result.date}`,
            );
            setNextSlot({ date: result.date, time: result.time });
            setTotalWeeklySlots(result.totalWeeklySlots);
            setIsAgendaFull(result.totalWeeklySlots === 0);
          }
        } else {
          devLog(`[BADGE DEBUG] No slots found in the next 14 days`);
          setTotalWeeklySlots(0);
          setIsAgendaFull(true);
        }

        devLog(`[NEXT_SLOT] Calculation finished.`);
      } catch (e) {
        devLog("[NEXT_SLOT] Failed to find availability data:", e);
      }
    };

    if (profile && services.length > 0) {
      findAvailabilityData();
    }
  }, [profile, services]);

  const urgencyInfo = React.useMemo(() => {
    if (!profile || services.length === 0 || totalWeeklySlots === null)
      return null;
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

  if (loadError === 'timeout') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-parchment p-6 text-center">
        <motion.div
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           className="bg-brand-white p-8 md:p-10 rounded-[40px] shadow-2xl max-w-md w-full border border-brand-sand/30"
        >
          <div className="w-20 h-20 bg-brand-terracotta/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-brand-terracotta" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="font-playfair text-2xl md:text-3xl text-brand-navy mb-4">
            Não conseguimos carregar esta vitrine agora
          </h1>
          <p className="font-outfit text-brand-brown/80 mb-8 max-w-[280px] mx-auto text-sm md:text-base">
            A conexão demorou mais que o esperado. Tente novamente ou abra no navegador.
          </p>
          <div className="flex flex-col gap-4">
            <button
               onClick={() => {
                 setLoading(true);
                 setLoadError(null);
                 setRetryCount(c => c + 1);
               }}
               className="w-full py-4 px-6 bg-brand-terracotta text-white rounded-2xl font-outfit font-medium hover:bg-brand-navy transition-colors shadow-lg shadow-brand-terracotta/30"
            >
              Tentar novamente
            </button>
            <button
               onClick={() => window.open(window.location.href, '_blank')}
               className="w-full py-4 px-6 bg-transparent border border-brand-sand text-brand-navy rounded-2xl font-outfit font-medium hover:bg-brand-sand/30 transition-colors"
            >
              Abrir no navegador
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!profile)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-parchment p-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-24 h-24 bg-brand-linen text-brand-terracotta rounded-full flex items-center justify-center mb-10 border border-brand-mist shadow-sm"
        >
          <Info size={40} strokeWidth={1.5} />
        </motion.div>
        <h1 className="text-4xl font-serif font-normal text-brand-ink mb-6">
          Página não encontrada
        </h1>
        <p className="body-text text-brand-stone mb-12 max-w-sm mx-auto leading-relaxed">
          O link que você acessou pode estar incorreto ou o perfil da
          profissional ainda não foi publicado.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link
            to="/"
            className="w-full sm:w-auto bg-brand-ink text-brand-white px-10 py-5 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all premium-shadow"
          >
            Voltar para o início
          </Link>
        </div>
      </div>
    );

  const theme = getTheme(profile?.profileTheme?.variant);

  return (
    <div
      className="min-h-screen bg-brand-parchment flex flex-col selection:bg-brand-terracotta/10"
      style={
        {
          "--theme-primary": theme.primary,
          "--theme-accent": theme.accent,
          "--theme-accent-rgb": theme.accentRGB,
          "--theme-background": theme.background,
          "--theme-border": theme.border,
        } as React.CSSProperties
      }
    >
      <SEOHead
        title={profile.specialty ? `${profile.name} | ${formatSpecialtyLabel(profile.specialty)} | Nera` : `${profile.name} | Nera`}
        description={
          profile.bio ||
          `Conheça a vitrine profissional de ${profile.name} na Nera.`
        }
        image={profile.ogImageUrl || profile.avatar || "https://usenera.com/og-default.png"}
        url={`https://usenera.com/p/${profile.slug}`}
      />
      {slug === 'helena-prado' && (
        <div className="w-full bg-brand-white/80 backdrop-blur-sm border-b border-brand-mist/50 py-2 sm:py-3 px-4 sm:px-6 sticky top-0 z-[200] flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-1 sm:gap-0">
          <Link to="/" className="flex items-center gap-2 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-brand-stone hover:text-brand-ink transition-colors">
            <ArrowLeft size={12} className="sm:w-3.5 sm:h-3.5" /> Voltar para o início
          </Link>
          <div className="flex items-center gap-1 sm:gap-1.5 bg-brand-parchment border border-brand-mist/50 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full">
            <Sparkles size={10} className="text-brand-terracotta sm:w-3 sm:h-3" />
            <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-brand-stone">Exemplo de vitrine</span>
          </div>
        </div>
      )}
      <AnimatePresence>
        {scrolledPastHero &&
          !showInterestPopup &&
          !isCtaVisibleInContent &&
          !isBookingModalOpen &&
          !isWaitlistOpen &&
          !loading && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[150] md:hidden"
            >
              <button
                onClick={() => {
                  const profId = profile?.professionalId || profile?.uid;
                  logAnalyticsEvent(profId || '', "click_book_sticky");
                  if (urgencyInfo?.isAgendaFull && features?.waitlist) {
                    setIsWaitlistOpen(true);
                  } else {
                    if (services.length > 0) setPreSelectedService(services[0]);
                    setIsBookingModalOpen(true);
                  }
                }}
                className="flex items-center gap-3 bg-brand-ink text-brand-white px-7 py-4 rounded-full text-[10px] font-bold uppercase tracking-[0.18em] shadow-2xl hover:bg-brand-terracotta transition-all whitespace-nowrap active:scale-95"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-brand-terracotta animate-pulse" />
                {urgencyInfo?.isAgendaFull && features?.waitlist
                  ? "Fila de espera"
                  : "Reservar agora"}
                <ArrowRight size={14} />
              </button>
            </motion.div>
          )}
      </AnimatePresence>
      <PublicHero
        profile={profile}
        services={services}
        nextSlot={nextSlot}
        heroBio={heroBio}
        stats={stats}
        isAgendaFull={urgencyInfo?.isAgendaFull && features?.waitlist}
        totalWeeklySlots={totalWeeklySlots}
        onWaitlistClick={() => features?.waitlist && setIsWaitlistOpen(true)}
        onBookingClick={(s) => {
          if (urgencyInfo?.isAgendaFull && features?.waitlist) {
            setIsWaitlistOpen(true);
          } else {
            if (s) setPreSelectedService(s);
            setIsBookingModalOpen(true);
          }
        }}
      />
      <div ref={servicesRef}>
        <ServicesSection
          services={services}
          profile={profile}
          onSelectService={(s) => {
            if (urgencyInfo?.isAgendaFull && features?.waitlist) {
              setIsWaitlistOpen(true);
            } else {
              setPreSelectedService(s);
              setIsBookingModalOpen(true);
            }
          }}
        />
      </div>
      <ExpertIntro
        profile={profile}
        stats={stats}
        customBio={aboutBio}
      />
      <PortfolioSection
        portfolio={profile.portfolio || []}
        professionalName={profile.name}
        specialty={
          profile.professionalIdentity?.mainSpecialty || profile.specialty
        }
        onBookingClick={() => {
          if (urgencyInfo?.isAgendaFull && features?.waitlist) {
            setIsWaitlistOpen(true);
          } else {
            setIsBookingModalOpen(true);
          }
        }}
      />
      <ReviewsSection reviews={reviews} stats={stats} />
      <PaymentMethods 
        professionalName={profile.name} 
        paymentMethods={profile.paymentMethods}
        acceptsInstallments={profile.acceptsInstallments}
      />
      <WeekAvailability
        availability={weeklyAvailability}
        onSelectDate={(date) => {
          const profId = profile?.professionalId || profile?.uid;
          logAnalyticsEvent(profId || '', "week_calendar_click");
          const day = weeklyAvailability.find((d) => d.date === date);
          if (day?.status === "full" && features?.waitlist) {
            setIsWaitlistOpen(true);
          } else if (day?.status !== "closed") {
            setSelectedInitialDate(date);
            if (services.length > 0) setPreSelectedService(services[0]);
            setIsBookingModalOpen(true);
          } else {
            notify.info("A profissional não atende neste dia.");
          }
        }}
      />
      <ConfidenceSection profile={profile} stats={stats} />
      <div ref={finalCtaRef}>
        {!urgencyInfo?.isAgendaFull || !features?.waitlist ? (
          <FinalCTA
            profile={profile}
            onBookingClick={() => {
              const profId = profile?.professionalId || profile?.uid;
              logAnalyticsEvent(profId || '', "click_book_final");
              setIsBookingModalOpen(true);
            }}
            completedBookings={stats?.totalCompletedBookings}
          />
        ) : null}
        
        <div className="h-24 md:hidden" /> {/* Bottom spacing for mobile CTA */}
        {urgencyInfo?.isAgendaFull && features?.waitlist && (
          <section className="px-6 pb-16 md:pb-20 -mt-10">
            <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-xl mx-auto bg-brand-ink text-brand-white p-10 rounded-[50px] text-center relative overflow-hidden shadow-2xl border border-white/5"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-brand-terracotta/20 rounded-full -mr-20 -mt-20 blur-3xl opacity-50" />
            <div className="relative z-10">
              <div className="w-16 h-16 bg-brand-linen/10 rounded-full flex items-center justify-center mx-auto mb-6 text-brand-terracotta">
                <Users size={32} />
              </div>
              <h3 className="text-3xl font-serif mb-4 leading-tight">
                Agenda lotada?
              </h3>
              <p className="text-sm text-brand-stone/80 font-light mb-10 leading-relaxed max-w-xs mx-auto italic">
                Não se preocupe. Entre na nossa lista de prioridade e seja
                avisada assim que surgir uma desistência.
              </p>
              <PremiumButton
                variant="terracotta"
                className="w-full py-5"
                onClick={() => setIsWaitlistOpen(true)}
              >
                Entrar na lista de espera
              </PremiumButton>
            </div>
          </motion.div>
        </section>
      )}
      </div>
      <footer className="bg-brand-parchment border-t border-brand-mist/30 py-12 md:py-16 px-6 text-center">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-8">
          <div className="flex flex-wrap justify-center gap-10">
            <Link
              to="/"
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-stone hover:text-brand-ink transition-colors"
            >
              Início
            </Link>
            <Link
              to="/register"
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-stone hover:text-brand-ink transition-colors"
            >
              Seja uma Profissional
            </Link>
          </div>
          
          <div className="flex gap-5">
            {profile.instagram && (
              <a
                href={`https://instagram.com/${profile.instagram.replace("@", "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full border border-brand-mist/60 flex items-center justify-center text-brand-stone hover:text-brand-terracotta hover:border-brand-terracotta transition-all"
              >
                <Instagram size={16} />
              </a>
            )}
            {profile.whatsapp && profile.plan === 'pro' && (
              <a
                href={buildWhatsappLink(profile.whatsapp)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full border border-brand-mist/60 flex items-center justify-center text-brand-stone hover:text-brand-terracotta hover:border-brand-terracotta transition-all"
              >
                <MessageCircle size={16} />
              </a>
            )}
          </div>
          
          <div className="pt-8 border-t border-brand-mist/20 w-full max-w-xs mx-auto">
            <a href="/" className="inline-block mb-3 font-serif text-xl tracking-tight text-brand-stone hover:text-brand-ink transition-colors">nera</a>
            <p className="text-[9px] uppercase tracking-[0.2em] text-brand-stone/60 leading-loose">
              © {new Date().getFullYear()} Nera<br />
              <span className="opacity-60">Plataforma para profissionais da beleza</span>
            </p>
          </div>
        </div>
      </footer>
      <React.Suspense fallback={null}>
        <BookingModal
          profile={profile}
          services={services}
          open={isBookingModalOpen}
          onClose={() => {
            setIsBookingModalOpen(false);
            setSelectedInitialDate(null);
          }}
          initialService={preSelectedService}
          initialDate={selectedInitialDate}
          waitlistEntry={activeWaitlistEntry}
        />
        <WaitlistModal
          profile={profile}
          services={services}
          open={isWaitlistOpen}
          onClose={() => setIsWaitlistOpen(false)}
        />
      </React.Suspense>
    </div>
  );
}
