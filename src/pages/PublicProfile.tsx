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
} from "../lib/utils";
import { getTheme } from "../lib/themes";
import { notify } from "../lib/notify";
import Logo from "../components/Logo";
import PremiumButton from "../components/PremiumButton";
import BookingModal from "../components/BookingModal";
import WaitlistModal from "../components/WaitlistModal";
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

const isDev = import.meta.env.DEV;
const devLog = (...args: any[]) => isDev && console.log(...args);

// --- Static Mock Data for Example Profile ---
const MOCK_PROFILE: UserProfile = {
  uid: "mock-helena",
  name: "Helena Prado",
  email: "helena@exemplo.com",
  whatsapp: "11999999999",
  slug: "helena-prado",
  avatar: "https://i.imgur.com/gBdf3tO.png",
  bio: "Especialista em design de sobrancelhas naturais. Com foco em harmonização facial, meu trabalho é realçar sua beleza autêntica sem transformações artificiais. Cada traço é pensado para valorizar o seu olhar de forma única e elegante.",
  headline: "Especialista em Design de Sobrancelhas Naturais",
  specialty: "Sobrancelhas e Harmonização do Olhar",
  city: "São Paulo",
  neighborhood: "Jardins",
  serviceMode: "hybrid",
  workingHours: {
    startTime: "09:00",
    endTime: "19:00",
    workingDays: [1, 2, 3, 4, 5, 6],
  },
  professionalIdentity: {
    mainSpecialty: "Design de Sobrancelhas",
    subSpecialties: [
      "Brow Lamination",
      "Micropigmentação Natural",
      "Design com Henna",
    ],
    yearsExperience: "8",
    serviceStyle: ["Minimalista e Natural", "Premium e Personalizado"],
    differentials: [
      "Biossegurança rigorosa",
      "Atendimento pontual",
      "Produtos de alta performance",
    ],
    attendsAt: "hybrid",
  },
  portfolio: [
    {
      id: "1",
      url: "https://i.imgur.com/O9b1cB9.png", // processo
      category: "Processo",
      createdAt: new Date().toISOString(),
    },
    {
      id: "2",
      url: "https://i.imgur.com/pk8kE8K_d.webp?maxwidth=760&fidelity=grand", // close resultado
      category: "Resultado",
      createdAt: new Date().toISOString(),
    },
    {
      id: "3",
      url: "https://i.imgur.com/D8hEvtH_d.webp?maxwidth=1520&fidelity=grand", // antes/depois
      category: "Antes e Depois",
      createdAt: new Date().toISOString(),
    },
  ],
  services: [], // Placeholder, fetched separately in mock logic
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const MOCK_SERVICES: Service[] = [
  {
    id: "s1",
    name: "Sobrancelhas Harmonizadas",
    price: 150,
    duration: 45,
    description:
      "Sobrancelhas alinhadas ao seu rosto, com resultado natural e harmonioso que valoriza seu olhar.",
  },
  {
    id: "s2",
    name: "Brow Lamination Premium",
    price: 280,
    duration: 60,
    description:
      "Efeito de sobrancelhas cheias e disciplinadas, ideal para quem busca volume com elegância.",
  },
  {
    id: "s3",
    name: "Micropigmentação Soft",
    price: 950,
    duration: 150,
    description:
      "Preenchimento fio a fio ultra-realista para quem deseja acordar pronta todos os dias.",
  },
];

const MOCK_REVIEWS: Review[] = [
  {
    id: "r1",
    bookingId: "b1",
    professionalId: "mock-helena",
    serviceId: "s1",
    serviceName: "Design",
    rating: 5,
    tags: ["Excelência", "Pontualidade"],
    comment:
      "A Helena é uma verdadeira artista. Minhas sobrancelhas nunca ficaram tão harmoniosas e naturais. Ela realmente entende como valorizar o olhar.",
    publicDisplayMode: "named",
    publicApproved: true,
    firstName: "Mariana",
    neighborhood: "Pinheiros",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // há 2 dias
  },
  {
    id: "r2",
    bookingId: "b2",
    professionalId: "mock-helena",
    serviceId: "s2",
    serviceName: "Lamination",
    rating: 5,
    tags: ["Ambiente Acolhedor", "Biossegurança"],
    comment:
      "Experiência impecável. O design valorizou muito meu rosto sem parecer nada artificial. O ambiente é super relaxante e profissional.",
    publicDisplayMode: "named",
    publicApproved: true,
    firstName: "Beatriz",
    neighborhood: "Vila Madalena",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // há 1 semana
  },
  {
    id: "r3",
    bookingId: "b3",
    professionalId: "mock-helena",
    serviceId: "s3",
    serviceName: "Micropigmentação",
    rating: 5,
    tags: ["Excelência", "Resultado Natural"],
    comment:
      "Finalmente encontrei alguém que respeita o formato natural das minhas sobrancelhas. Me sinto muito mais confiante e a recuperação foi super rápida.",
    publicDisplayMode: "named",
    publicApproved: true,
    firstName: "Carolina",
    neighborhood: "Jardins",
    createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(), // há 3 semanas
  },
];

const MOCK_STATS = {
  averageRating: 4.9,
  totalReviews: 48,
  totalCompletedBookings: 156,
  topTags: ["Excelência", "Pontualidade", "Ambiente Acolhedor"],
};

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
    console.log(`[PublicProfile] effect started for slug: ${slug}`);
    
    const fetchData = async () => {
      if (!slug) {
        console.log(`[PublicProfile] No slug, setting loading to false`);
        if (isMounted) setLoading(false);
        return;
      }

      if (slug === "helena-prado" || slug === "exemplo") {
        setTimeout(() => {
          if (!isMounted) return;
          setProfile(MOCK_PROFILE);
          setServices(MOCK_SERVICES);
          setReviews(MOCK_REVIEWS);
          setStats(MOCK_STATS);
          setLoading(false);
        }, 500);
        return;
      }

      try {
        console.log(`[PublicProfile] starting getDocs for slug: ${slug}`);
        
        const q = query(collection(db, "users"), where("slug", "==", slug));
        
        // Fix for Safari iOS infinite getDocs hang (WebSocket/Auth lock): 
        // Force a timeout after 8 seconds so the UI never gets permanently stuck.
        let timeoutId: any;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error("FIRESTORE_TIMEOUT")), 8000);
        });
        timeoutPromise.catch(() => {}); // Prevent unhandled promise rejection
        
        const snapshot = await Promise.race([
          getDocs(q),
          timeoutPromise
        ]);
        clearTimeout(timeoutId);

        console.log(`[PublicProfile] getDocs resolved. empty: ${snapshot.empty}`);

        if (!isMounted) {
          console.log(`[PublicProfile] component unmounted before getting snapshot result`);
          return;
        }

        if (!snapshot.empty) {
          const userData = snapshot.docs[0].data();
          const professionalId = snapshot.docs[0].id;
          
          if (isMounted) {
            console.log(`[PublicProfile] found user, setting profile and loading to false eagerly`);
            setProfile({ ...userData, uid: professionalId } as UserProfile);
            setLoading(false); // Eagerly unblock UI to prevent infinite skeleton
          }

          // Growth Analytics: Log Visit
          if (slug !== "helena-prado" && slug !== "exemplo") {
            logAnalyticsEvent(professionalId, "visit").catch((err) => {
              console.log("[PublicProfile] Analytics error:", err);
            });
          }

          console.log(`[PublicProfile] Starting secondary background parallel fetches`);
          // Secondary fetches should be silent, independent, and parallel
          Promise.allSettled([
            // 1. Services
            (async () => {
              const servicesQ = query(
                collection(db, "services"),
                where("professionalId", "==", professionalId),
                where("active", "==", true),
              );
              const servicesSnapshot = await getDocs(servicesQ);
              if (!isMounted) return;
              const rawServices = servicesSnapshot.docs.map(
                (doc) => ({ id: doc.id, ...doc.data() }) as Service,
              );
              const validServices = rawServices
                .filter((s) => s.active !== false && s.name?.trim() && (s.price ?? 0) > 0 && s.professionalId)
                .map((s) => ({ ...s, duration: Number(s.duration) >= 15 && Number(s.duration) <= 480 ? Number(s.duration) : 60 }));
              
              const normalizedGroups = new Map<string, Service[]>();
              validServices.forEach((s) => {
                const normName = s.name.toLowerCase().trim();
                if (!normalizedGroups.has(normName)) normalizedGroups.set(normName, []);
                normalizedGroups.get(normName)!.push(s);
              });

              const dedupedServices = Array.from(normalizedGroups.values()).map(group => {
                if (group.length === 1) return group[0];
                return group.sort((a, b) => {
                  const aHasDesc = !!a.description?.trim();
                  const bHasDesc = !!b.description?.trim();
                  if (aHasDesc !== bHasDesc) return aHasDesc ? -1 : 1;
                  return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
                })[0];
              });
              if (isMounted) setServices(dedupedServices);
            })(),

            // 2. Stats
            (async () => {
              const statsDoc = await getDocs(query(collection(db, "review_stats"), where("professionalId", "==", professionalId)));
              if (!isMounted) return;
              if (!statsDoc.empty) setStats(statsDoc.docs[0].data());
            })(),

            // 3. Reviews
            (async () => {
              const reviewsQ = query(
                collection(db, "reviews"),
                where("professionalId", "==", professionalId),
                where("publicApproved", "==", true),
                where("publicDisplayMode", "in", ["named", "anonymous"]),
                limit(15)
              );
              const reviewsSnapshot = await getDocs(reviewsQ);
              if (!isMounted) return;
              setReviews(reviewsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Review));
            })(),

            // 4. Portfolio (Legacy)
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
        } else {
          console.log(`[PublicProfile] snapshot is empty. Setting profile to null.`);
          if (isMounted) setProfile(null);
        }
      } catch (error: any) {
        console.error("Critical error fetching public profile:", error);
        if (error.message === "FIRESTORE_TIMEOUT") {
          if (isMounted) setLoadError('timeout');
        } else {
          notify.error("Não foi possível carregar as informações do perfil.");
        }
      } finally {
        console.log(`[PublicProfile] finally block executed. isMounted: ${isMounted}`);
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      console.log(`[PublicProfile] unmount cleanup executed for slug: ${slug}`);
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
      if (!profile?.uid || !profile?.workingHours || services.length === 0)
        return;

      devLog(`[NEXT_SLOT] Starting calculation for pro: ${profile.uid}`);

      try {
        const now = new Date();
        const duration = Number(services[0]?.duration) || 60;

        // Fetch all blocked schedules for the week once
        const blockedQ = query(
          collection(db, "blocked_schedules"),
          where("professionalId", "==", profile.uid),
        );
        const blockedSnap = await getDocs(blockedQ);
        const blockedSchedules = blockedSnap.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as any,
        );

        // Fetch all appointments for the next 7 days once to avoid loop queries
        const todayStr = getLocalDateStr(now);
        const endGame = new Date();
        endGame.setDate(endGame.getDate() + 14);
        const endGameStr = getLocalDateStr(endGame);

        const apptsQ = query(
          collection(db, "appointments"),
          where("professionalId", "==", profile.uid),
          where("date", ">=", todayStr),
          where("date", "<=", endGameStr)
        );
        const snapshot = await getDocs(apptsQ);
        const allAppts = snapshot.docs
          .map((doc) => doc.data() as Appointment)
          .filter(a => ["pending", "confirmed", "completed"].includes(a.status));

        const result = getNextAvailableSlot({
          workingHours: profile.workingHours,
          appointments: allAppts,
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
            console.error(
              `[BADGE BUG] Badge attempted to show unavailable slot for ${result.date} ${result.time}. Agenda shows 0 slots.`,
            );
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
          <Link
            to="/p/helena-prado"
            className="w-full sm:w-auto bg-brand-white text-brand-ink border border-brand-mist px-10 py-5 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-linen transition-all"
          >
            Ver perfil de exemplo
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
        title={`${profile.name} | ${profile.specialty || "Profissional Nera"}`}
        description={
          profile.bio ||
          `Agende um horário com ${profile.name}, especialista em beleza.`
        }
        image={profile.avatar}
        url={`https://usenera.com/p/${profile.slug}`}
      />
      {/* Demo Badge */}
      {(slug === "helena-prado" || slug === "exemplo") && (
        <div className="fixed top-5 left-0 right-0 z-[200] flex justify-center pointer-events-none px-4">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="bg-brand-linen/90 backdrop-blur-xl border border-brand-mist/60 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.08)] rounded-full p-1.5 pl-5 pr-1.5 pointer-events-auto flex items-center gap-4 max-w-full overflow-hidden"
          >
            <span className="flex items-center gap-2.5">
              <Sparkles size={13} className="text-brand-terracotta" />
              <span className="font-serif text-brand-espresso text-[13px] font-medium tracking-wide whitespace-nowrap">
                Vitrine de Demonstração
              </span>
            </span>
            <Link
              to="/register"
              className="bg-brand-white hover:bg-brand-terracotta text-brand-ink hover:text-brand-white transition-all duration-300 rounded-full px-4 py-2 text-[9px] uppercase tracking-[0.15em] font-bold whitespace-nowrap flex items-center gap-1.5 border border-brand-mist/50"
            >
              <span className="hidden sm:inline">Crie seu perfil</span> grátis
              <ArrowRight size={10} />
            </Link>
          </motion.div>
        </div>
      )}
      <AnimatePresence>
        {scrolledPastHero &&
          !isCtaVisibleInContent &&
          !isBookingModalOpen &&
          !loading && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[150] md:hidden"
            >
              <button
                onClick={() => {
                  if (profile && profile.uid !== "mock-helena") {
                    logAnalyticsEvent(profile.uid, "click_book_sticky");
                  }
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
        customBio={
          profile.slug === "helena-prado" || profile.slug === "exemplo"
            ? "Cada atendimento é personalizado, respeitando o formato do seu rosto e seu estilo. Meu objetivo é realçar sua beleza natural com leveza, sem exageros, criando um resultado elegante e duradouro."
            : aboutBio
        }
      />
      <PortfolioSection
        portfolio={profile.portfolio || []}
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
      <PaymentMethods professionalName={profile.name} />
      <WeekAvailability
        availability={weeklyAvailability}
        onSelectDate={(date) => {
          if (profile && profile.uid !== "mock-helena") {
            logAnalyticsEvent(profile.uid, "week_calendar_click");
          }
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
        <FinalCTA
          onBookingClick={() => {
            if (profile && profile.uid !== "mock-helena") {
              logAnalyticsEvent(profile.uid, "click_book_final");
            }
            if (urgencyInfo?.isAgendaFull && features?.waitlist) {
              setIsWaitlistOpen(true);
            } else {
              setIsBookingModalOpen(true);
            }
          }}
          completedBookings={stats?.totalCompletedBookings}
        />
      </div>
      <div className="h-32 md:hidden" /> {/* Bottom spacing for mobile CTA */}
      {urgencyInfo?.isAgendaFull && features?.waitlist && (
        <section className="px-6 pb-20 -mt-10">
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
      <footer className="bg-brand-white border-t border-brand-mist py-14 px-6 text-center">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-7">
          <div className="text-[12px] font-normal tracking-[0.4em] uppercase text-brand-stone opacity-40">
            Nera
          </div>
          <div className="flex flex-wrap justify-center gap-8">
            <Link
              to="/"
              className="text-[9px] font-medium uppercase tracking-widest text-brand-stone hover:text-brand-ink transition-colors"
            >
              Início
            </Link>
            <Link
              to="/profissional"
              className="text-[9px] font-medium uppercase tracking-widest text-brand-stone hover:text-brand-ink transition-colors"
            >
              Seja uma Profissional
            </Link>
          </div>
          <div className="flex gap-4">
            {profile.instagram && (
              <a
                href={`https://instagram.com/${profile.instagram.replace("@", "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full border border-brand-mist flex items-center justify-center text-brand-stone hover:text-brand-terracotta transition-all"
              >
                <Instagram size={15} />
              </a>
            )}
            {profile.whatsapp && (
              <a
                href={buildWhatsappLink(profile.whatsapp)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full border border-brand-mist flex items-center justify-center text-brand-stone hover:text-brand-terracotta transition-all"
              >
                <MessageCircle size={15} />
              </a>
            )}
          </div>
          <p className="text-[8px] uppercase tracking-[0.15em] text-brand-stone opacity-30 mt-4">
            © {new Date().getFullYear()} {profile.name} · Powered by Nera
          </p>
        </div>
      </footer>
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
    </div>
  );
}
