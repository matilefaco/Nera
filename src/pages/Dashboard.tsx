import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { db, auth, handleBookingError, inviteFromWaitlist, updateAppointmentStatus } from '../firebase';
import { 
  collection, query, where, onSnapshot, orderBy, doc, updateDoc, 
  addDoc, deleteDoc, serverTimestamp, limit, getDocs, getCountFromServer
} from 'firebase/firestore';
import { 
  Calendar, Clock, Users, LogOut, 
  Settings, List, MessageCircle, CheckCircle2, 
  Share2, Plus, MapPin, Check, TrendingUp, Heart,
  ChevronRight, Sparkles, Home, X, Instagram, Copy, Inbox,
  AlertCircle, ShieldCheck, Lock, Sun, Moon, Zap, Star, Camera, Smartphone, DollarSign, Info, Ticket, Gift, Loader2, Eye
} from 'lucide-react';
import { notify } from '../lib/notify';
import { 
  formatCurrency, getTodayLocale, buildWhatsappLink, 
  generateWaitlistInviteMessage, cn, formatDateKey, parseLocalDate, cleanWhatsapp, isFakeContent, formatLocalDate
} from '../lib/utils';
import { calculateFinancialMetrics } from '../lib/financialMetrics';
import { getClientScore } from '../lib/clientUtils';
import HelpTooltip from '../components/HelpTooltip';
import Logo from '../components/Logo';
import { Appointment, WaitlistEntry, BlockedSchedule, AnalyticsEvent, Service, WhatsAppLog } from '../types';
import { isRevenueStatus, isPendingStatus, isCompletedStatus, isConfirmedLikeStatus } from '../constants/appointmentStatus';
import { AnimatePresence } from 'motion/react';
import AppLayout from '../components/AppLayout';
import { SharingPreviewSection } from '../components/SharingPreviewSection';
import BlockAvailabilityModal from '../components/BlockAvailabilityModal';
import QuickBlockModal from '../components/QuickBlockModal';
import UpgradeModal from '../components/UpgradeModal';
import PremiumButton from '../components/PremiumButton';
import ShareVitrineModal from '../components/ShareVitrineModal';
import WeeklyRevenueSummary from '../components/WeeklyRevenueSummary';
import InstallPrompt from '../components/InstallPrompt';
import { usePendingAppointments } from '../contexts/PendingAppointmentsContext';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { getAvailableSlots, getDayAvailability } from '../lib/bookingUtils';
import { PageErrorBoundary } from '../components/PageErrorBoundary';
import { FirstVisitTip } from '../components/FirstVisitTip';
import { DashboardSkeleton } from '../components/ui/DashboardSkeleton';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';

import { usePlanFeatures } from '../hooks/usePlanFeatures';
import { useUpgradeTriggers } from '../hooks/useUpgradeTriggers';
import { getPublicProfileUrl } from '../lib/env';

import { ActivationChecklist } from '../components/ActivationChecklist';

// --- SAFE HELPERS ---
function safeString(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return value;
}

function safeDateLabel(date?: string | null, fallback = '—'): string {
  if (!date || typeof date !== 'string' || date.indexOf('-') === -1) return fallback;
  const parts = date.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return date;
}

function safeParseLocalDate(date?: string | null): Date | null {
  if (!date || typeof date !== 'string' || date.indexOf('-') === -1) return null;
  const parts = date.split('-').map(Number);
  if (parts.length === 3 && parts.every(p => !isNaN(p))) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return null;
}

function safeFormatDateKey(date?: string | null, fallback = 'Recorrente'): string {
  const parsed = safeParseLocalDate(date);
  if (!parsed) return fallback;
  return formatDateKey(parsed);
}

function safeLocaleCompare(a?: string | null, b?: string | null): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return String(a).localeCompare(String(b));
}
// --------------------

const isDev = import.meta.env.DEV || (typeof window !== 'undefined' && window.location.hostname.includes('ais-'));
const devLog = (...args: any[]) => isDev && console.log(...args);

type DashboardTab = "hoje" | "crescimento" | "gestao";

interface AnalyticsCacheEntry {
  data: AnalyticsEvent[];
  fetchedAt: number;
}

const ANALYTICS_CACHE_TTL_MS = 5 * 60 * 1000;
const analyticsEventsCache = new Map<string, AnalyticsCacheEntry>();

interface AppointmentsCacheEntry {
  data: Appointment[];
  fetchedAt: number;
}

const APPOINTMENTS_CACHE_TTL_MS = 5 * 60 * 1000;
const appointmentsHistoryCache = new Map<string, AppointmentsCacheEntry>();
const dashboardTodayCache = new Map<string, { confirmedToday: Appointment[], revenue: number }>();

export default function Dashboard() {
  const { user, profile } = useAuth();
  const { features, plan, signupPlan } = usePlanFeatures();
  const { refreshProfile } = useAuth();
  const [searchParams] = useSearchParams();
  
  // Auto-sync if plan is free but we expect something else
  useEffect(() => {
    if (plan === 'free' && signupPlan && signupPlan !== 'free') {
      const reconcile = async () => {
        try {
          const token = await user?.getIdToken();
          const res = await fetch('/api/plans/reconcile-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ targetUid: user?.uid })
          });
          const data = await res.json();
          if (data.success) {
            refreshProfile();
          }
        } catch (err) {
          if (isDev) console.error("Auto-reconcile failed:", err);
        }
      };

      // Try reconcile once after 5s
      const timer = setTimeout(reconcile, 5000);
      
      // Also poll every 10s for 3 times
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        refreshProfile();
        if (attempts >= 3) clearInterval(interval);
      }, 10000);

      return () => {
        clearTimeout(timer);
        clearInterval(interval);
      };
    }
  }, [plan, signupPlan, refreshProfile, user]);
  const [activeTab, setActiveTab] = useState<DashboardTab>(() => {
    // 1. Check URL param first (priority)
    const tabParam = searchParams.get('tab');
    if (tabParam === "hoje" || tabParam === "crescimento" || tabParam === "gestao") {
      return tabParam as DashboardTab;
    }

    // 2. Check localStorage
    const saved = localStorage.getItem("nera_dashboard_tab");
    if (saved === "hoje" || saved === "crescimento" || saved === "gestao") {
      return saved as DashboardTab;
    }

    // 3. Absolute Default
    return "hoje";
  });

  useEffect(() => {
    localStorage.setItem("nera_dashboard_tab", activeTab);
  }, [activeTab]);

  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    if (!user) return [];
    const todayNum = new Date();
    const firstDayLastMonth = new Date(todayNum.getFullYear(), todayNum.getMonth() - 1, 1);
    const thirtyDaysFromNow = new Date(todayNum);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const key = `${user.uid}:${formatDateKey(firstDayLastMonth)}:${formatDateKey(thirtyDaysFromNow)}`;
    const cache = appointmentsHistoryCache.get(key);
    if (cache && Date.now() - cache.fetchedAt < APPOINTMENTS_CACHE_TTL_MS) {
      return cache.data;
    }
    return [];
  });

  useEffect(() => {
    if (profile) {
      devLog("[DASHBOARD PLAN DEBUG] uid:", user?.uid);
      devLog("[DASHBOARD PLAN DEBUG] firestore plan:", profile.plan);
      devLog("[DASHBOARD PLAN DEBUG] planRank:", profile.planRank);
      devLog("[DASHBOARD PLAN DEBUG] planExpiresAt:", profile.planExpiresAt);
    }
  }, [profile, user]);
  
  const { 
    isUpgradeModalOpen, 
    upgradeFeature, 
    usageCount, 
    closeUpgradeModal, 
    checkFeatureAccess,
    openUpgradeModal
  } = useUpgradeTriggers(appointments);

  const [confirmedToday, setConfirmedToday] = useState<Appointment[]>(() => {
    return user ? (dashboardTodayCache.get(user.uid)?.confirmedToday || []) : [];
  });
  const [dailyRevenue, setDailyRevenue] = useState(() => {
    return user ? (dashboardTodayCache.get(user.uid)?.revenue || 0) : 0;
  });
  const [optimisticUpdates, setOptimisticUpdates] = useState<Record<string, string>>({});

  const { pendingAppointments: pendingRequests, pendingCount: contextPendingCount } = usePendingAppointments();
  const [selectedRequest, setSelectedRequest] = useState<Appointment | null>(null);

  const displayedPending = useMemo(() => {
    return pendingRequests.filter(req => !optimisticUpdates[req.id]);
  }, [pendingRequests, optimisticUpdates]);
  const pendingCount = displayedPending.length;

  const displayedConfirmedToday = useMemo(() => {
    const today = getTodayLocale();
    const confirmed = [...confirmedToday];
    
    // Add pending requests that were optimistically confirmed today
    pendingRequests.forEach(req => {
      if (optimisticUpdates[req.id] === 'confirmed' && req.date === today && !confirmed.find(c => c.id === req.id)) {
        confirmed.push({ ...req, status: 'confirmed' });
      }
    });
    
    // Remove if optimistically cancelled
    return confirmed.filter(req => optimisticUpdates[req.id] !== 'cancelled_by_professional').sort((a,b) => safeLocaleCompare(a.time, b.time));
  }, [confirmedToday, pendingRequests, optimisticUpdates]);

  const nextUpcomingAppointment = useMemo(() => {
    const today = getTodayLocale();
    
    const allAppsMap = new Map<string, Appointment>();
    appointments.forEach(a => allAppsMap.set(a.id, a));
    confirmedToday.forEach(a => allAppsMap.set(a.id, a));
    
    const allAppointments = Array.from(allAppsMap.values());
    
    const confirmed = allAppointments.filter(a => 
      a.status === 'confirmed' || a.status === 'accepted' || a.status === 'completed'
    );
    const now = new Date();
    const nowHour = now.getHours().toString().padStart(2, '0');
    const nowMin = now.getMinutes().toString().padStart(2, '0');
    const nowTime = `${nowHour}:${nowMin}`;

    const future = confirmed.filter(a => {
      if (a.date > today) return true;
      if (a.date === today && a.time >= nowTime && !isCompletedStatus(a.status)) return true;
      return false;
    }).sort((a,b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return safeLocaleCompare(a.time, b.time);
    });

    return future[0] || null;
  }, [appointments, confirmedToday]);

  const [pendingReviewsCount, setPendingReviewsCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    const fetchPendingReviews = async () => {
      try {
        const snapshot = await getCountFromServer(
          query(
            collection(db, 'reviews'),
            where('professionalId', '==', user.uid),
            where('moderationStatus', '==', 'pending')
          )
        );
        if (isMounted) setPendingReviewsCount(snapshot.data().count);
      } catch (err) {
        if (isDev) console.error("Error fetching pending reviews count:", err);
      }
    };
    fetchPendingReviews();
    return () => { isMounted = false; };
  }, [user]);

  const displayedDailyRevenue = useMemo(() => {
    return calculateFinancialMetrics(displayedConfirmedToday).monthlyRevenue;
  }, [displayedConfirmedToday]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const [isConfirmRejectOpen, setIsConfirmRejectOpen] = useState(false);
  const [requestToReject, setRequestToReject] = useState<Appointment | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isWaitlistModalOpen, setIsWaitlistModalOpen] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(() => {
    if (!user) return true;
    const todayNum = new Date();
    const firstDayLastMonth = new Date(todayNum.getFullYear(), todayNum.getMonth() - 1, 1);
    const thirtyDaysFromNow = new Date(todayNum);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const key = `${user.uid}:${formatDateKey(firstDayLastMonth)}:${formatDateKey(thirtyDaysFromNow)}`;
    const cache = appointmentsHistoryCache.get(key);
    return !(cache && Date.now() - cache.fetchedAt < APPOINTMENTS_CACHE_TTL_MS);
  });
  const [agendaHojeStatus, setAgendaHojeStatus] = useState<'loading' | 'loaded' | 'error' | 'stalled'>(() => {
    return user && dashboardTodayCache.has(user.uid) ? 'loaded' : 'loading';
  });
  const [isDashboardBlockOpen, setIsDashboardBlockOpen] = useState(false);
  const [isQuickBlockOpen, setIsQuickBlockOpen] = useState(false);
  const [insightDismissed, setInsightDismissed] = useState(false);
  const [pushBannerDismissed, setPushBannerDismissed] = useState(() => {
    return profile?.dismissedTips?.pushBanner || localStorage.getItem("nera_push_banner_dismissed") === "true";
  });
  const [blockTipDismissed, setBlockTipDismissed] = useState(() => {
    return profile?.dismissedTips?.blockTip || localStorage.getItem("nera_block_tip_dismissed") === "true";
  });

  // Sync state if profile loads later
  useEffect(() => {
    if (profile?.dismissedTips?.pushBanner && !pushBannerDismissed) setPushBannerDismissed(true);
    if (profile?.dismissedTips?.blockTip && !blockTipDismissed) setBlockTipDismissed(true);
  }, [profile?.dismissedTips]);

  const handleDismissTip = async (tipKey: string) => {
    if (!user) return;
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      await updateDoc(doc(db, 'users', user.uid), {
        [`dismissedTips.${tipKey}`]: true
      });
    } catch (err) {
      console.error(`Failed to dismiss ${tipKey}`, err);
    }
  };
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [unconfirmedTomorrow, setUnconfirmedTomorrow] = useState<Appointment[]>([]);
  const [waitlistMode, setWaitlistMode] = useState<'auto' | 'manual'>('manual');
  const [blockedSchedules, setBlockedSchedules] = useState<BlockedSchedule[]>([]);
  const [referralLink, setReferralLink] = useState('');
  const [analyticsEvents, setAnalyticsEvents] = useState<AnalyticsEvent[]>([]);
  const [totalClientsCountFromSummaries, setTotalClientsCountFromSummaries] = useState<number | null>(null);
  const {
    confirmedAppointments,
    totalClientsCount,
    monthlyRevenue,
    prevMonthlyRevenue,
    returningThisWeek,
    monthlyStats,
    servicesByMonth,
    daysSinceLastAppointment,
    growthMetrics,
    financialMetrics
  } = useDashboardMetrics(appointments, analyticsEvents, totalClientsCountFromSummaries);
  const [inactiveClientsCount, setInactiveClientsCount] = useState(0);
  const [inactiveClients, setInactiveClients] = useState<any[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isServicesLoading, setIsServicesLoading] = useState(true);
  const [whatsappLogs, setWhatsappLogs] = useState<WhatsAppLog[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    const qCount = query(
      collection(db, 'client_summaries'),
      where('professionalId', '==', user.uid)
    );
    getCountFromServer(qCount).then(snap => {
      if (isMounted) {
        setTotalClientsCountFromSummaries(snap.data().count);
      }
    }).catch(err => {
      if (isDev) console.error('Error fetching client summaries count:', err);
    });
    return () => { isMounted = false; };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    const qAlerts = query(
      collection(db, 'alerts'),
      where('professionalId', '==', user.uid),
      where('read', '==', false),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubAlerts = onSnapshot(qAlerts, (snap) => {
      if (!isMounted) return;
      try {
        const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAlerts(docs);

      } catch (err) {
        if (isDev) console.error("Error in onSnapshot callback:", err);
      }
    }, (error) => {
      if (isDev) console.error('[Dashboard] Subscription error on qAlerts:', error);
    });

    return () => {
      isMounted = false;
      unsubAlerts();
    };
  }, [user]);

  const handleMarkAlertRead = async (alertId: string) => {
    try {
      await updateDoc(doc(db, 'alerts', alertId), { read: true });
    } catch (err) {
      if (isDev) console.error('Failed to mark alert as read:', err);
    }
  };

  // Triggers handled by hook

  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    const cached = analyticsEventsCache.get(user.uid);
    if (cached && Date.now() - cached.fetchedAt < ANALYTICS_CACHE_TTL_MS) {
      setAnalyticsEvents(cached.data);
      return;
    }

    const qAnalytics = query(
      collection(db, 'analytics_events'),
      where('professionalId', '==', user.uid),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    getDocs(qAnalytics).then((snapshot) => {
      if (!isMounted) return;
      try {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as AnalyticsEvent));
        analyticsEventsCache.set(user.uid, { data: docs, fetchedAt: Date.now() });
        setAnalyticsEvents(docs);

      } catch (err) {
        if (isDev) console.error("Error processing getDocs callback:", err);
      }
    }).catch((error) => {
      if (isDev) console.error('[Dashboard] Fetch error on qAnalytics:', error);
    });
    return () => { isMounted = false; };
  }, [user?.uid]);






  const getContextualTip = () => {
    if (pendingCount > 0) return `Você tem ${pendingCount} pedido${pendingCount > 1 ? 's' : ''} aguardando confirmação.`;
    if (displayedConfirmedToday.length === 0) return 'Nenhuma reserva hoje. Que tal compartilhar seu link nos Stories para atrair clientes?';
    
    const variations = [
      "Adicione novas fotos ao portfólio para mostrar a evolução do seu trabalho.",
      "Revisou seus horários de bloqueio? Garanta seu tempo de descanso e evite imprevistos.",
      "Mantenha seus serviços mais procurados no topo da lista para facilitar a reserva.",
      "Compartilhe seu link Nera hoje para converter curiosidade em agendamentos reais.",
      "Ajuste suas taxas por bairro para garantir a lucratividade do seu atendimento."
    ];
    
    // Pick one variation based on the current day to keep it fresh
    const index = new Date().getDate() % variations.length;
    return variations[index];
  };

  const dailyTip = getContextualTip();

  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    const today = getTodayLocale();
    
    // Query: All appointments for today
    const qToday = query(
      collection(db, 'appointments'),
      where('professionalId', '==', user.uid),
      where('date', '==', today)
    );

    // Fallback to clear loading state if network stalls
    const timeoutId = setTimeout(() => {
      if (isMounted) setAgendaHojeStatus(prev => prev === 'loading' ? 'stalled' : prev);
    }, 2000);

    const unsubToday = onSnapshot(qToday, (snapshot) => {
      if (!isMounted) return;
      clearTimeout(timeoutId);
      try {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Appointment))
          .filter(a => !isFakeContent(a.clientName))
          .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        const relevantToday = docs.filter(a => isRevenueStatus(a.status));
        const rev = calculateFinancialMetrics(relevantToday).monthlyRevenue;
        
        setConfirmedToday(prev => {
           if (snapshot.metadata.fromCache && relevantToday.length === 0 && prev.length > 0) {
             return prev;
           }
           if (user?.uid) {
             dashboardTodayCache.set(user.uid, { confirmedToday: relevantToday, revenue: rev });
           }
           return relevantToday;
        });
        
        setDailyRevenue(prev => {
           if (snapshot.metadata.fromCache && relevantToday.length === 0 && prev > 0) {
             return prev;
           }
           return rev;
        });
      } catch (err) {
        if (isDev) console.error("Error in onSnapshot callback:", err);
        setAgendaHojeStatus('error');
      } finally {

        setAgendaHojeStatus('loaded');
      }
    }, (error) => {
      if (isDev) console.error('[Dashboard] Subscription error on qToday:', error);
      setAgendaHojeStatus('error');
    });

    // Query: Unconfirmed for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatDateKey(tomorrow);

    const qUnconfirmed = query(
      collection(db, 'appointments'),
      where('professionalId', '==', user.uid),
      where('date', '==', tomorrowStr),
      where('status', '==', 'pending_confirmation')
    );

    const unsubUnconfirmed = onSnapshot(qUnconfirmed, (snapshot) => {
      if (!isMounted) return;
      try {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Appointment))
          .filter(a => !isFakeContent(a.clientName));
        setUnconfirmedTomorrow(docs);
      } catch (err) {
        if (isDev) console.error("Error in onSnapshot callback:", err);
      }
    }, (error) => {
      if (isDev) console.error('[Dashboard] Subscription error on qUnconfirmed:', error);
    });

    const todayNum = new Date();
    const firstDayLastMonth = new Date(todayNum.getFullYear(), todayNum.getMonth() - 1, 1);
    const startDateStr = formatDateKey(firstDayLastMonth);

    const thirtyDaysFromNow = new Date(todayNum);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const endDateStr = formatDateKey(thirtyDaysFromNow);

    const appointmentsCacheKey = `${user.uid}:${startDateStr}:${endDateStr}`;
    const cachedAppointments = appointmentsHistoryCache.get(appointmentsCacheKey);

    let fetchValid = true;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 8000)
    );

    if (cachedAppointments && Date.now() - cachedAppointments.fetchedAt < APPOINTMENTS_CACHE_TTL_MS) {
      setAppointments(cachedAppointments.data);
      if (isMounted) {
        setIsInitialLoading(false);
      }
    } else {
      // Query: Historical and upcoming appointments to calculate metrics
      const qAll = query(
        collection(db, 'appointments'),
        where('professionalId', '==', user.uid),
        where('date', '>=', startDateStr),
        where('date', '<=', endDateStr),
        orderBy('date', 'desc')
      );

      Promise.race([getDocs(qAll), timeoutPromise]).then((result) => {
        const snapshot = result as any;
        if (!isMounted) return;
        try {
          const appointmentsData = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Appointment));
          appointmentsHistoryCache.set(appointmentsCacheKey, { data: appointmentsData, fetchedAt: Date.now() });
          setAppointments(appointmentsData);
          // Metrics calculation moved to hook
        } catch (err) {
          if (isDev) console.error("Error processing getDocs callback:", err);
        }
      }).catch((error) => { 
        if (!isMounted) return;
        if (isDev) console.error("Firestore getDocs error:", error); 
        fetchValid = false;
      }).finally(() => {
        if (isMounted) {

          setIsInitialLoading(false);
        }
      });
    }

    // Profile Settings are now handled in a separate useEffect

    // Query: Waitlist
    const qWaitlist = query(
      collection(db, 'waitlist'),
      where('professionalId', '==', user.uid)
    );

    const unsubWaitlist = onSnapshot(qWaitlist, (snapshot) => {
      if (!isMounted) return;
      try {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as WaitlistEntry));
        const filteredDocs = docs.filter(doc => ['waiting', 'invited'].includes(doc.status));
        // Sort manually to avoid requiring a composite index in Firestore
        filteredDocs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setWaitlist(filteredDocs);
      } catch (err) {
        if (isDev) console.error("Error in onSnapshot callback:", err);
      }
    }, (error) => {
      if (isDev) console.error('[Dashboard] Subscription error on qWaitlist:', error);
    });

    // Query: Blocked Schedules
    const blockedRef = collection(db, 'blocked_schedules');
    const dayOfWeek = safeParseLocalDate(today)?.getDay() || 0;
    const qBlocked = query(blockedRef, where('professionalId', '==', user.uid), limit(100));
    
    getDocs(qBlocked).then((snap) => {
      if (!isMounted) return;
      try {
        const allBlocked = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        const todayBlocked = allBlocked.filter(b => {
            const isToday = b.date === today;
            const isRecurringToday = b.isRecurring && Array.isArray(b.recurringDays) && b.recurringDays.includes(dayOfWeek);
            return isToday || isRecurringToday;
        });
        setBlockedSchedules(todayBlocked);
      } catch (err) {
        if (isDev) console.error("Error processing getDocs callback:", err);
      }
    }).catch((error) => { if (isDev) console.error('[Dashboard] Fetch error on qBlocked:', error); });

    // Query: Inactive clients from summaries
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = formatDateKey(thirtyDaysAgo);

    const qInactive = query(
      collection(db, 'client_summaries'),
      where('professionalId', '==', user.uid),
      where('lastAppointmentDate', '<', thirtyDaysAgoStr),
      orderBy('lastAppointmentDate', 'desc'),
      limit(20)
    );

    getDocs(qInactive).then((snapshot) => {
      if (!isMounted) return;
      try {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setInactiveClientsCount(docs.length);
        setInactiveClients(docs);
      } catch (err) {
        if (isDev) console.error("Error processing getDocs callback:", err);
      }
    }).catch((error) => {
      if (isDev) console.error('[Dashboard] Fetch error on qInactive:', error);
    });

    // Query: All services
    const qServices = query(
      collection(db, 'services'),
      where('professionalId', '==', user.uid)
    );

    getDocs(qServices).then((snapshot) => {
      if (!isMounted) return;
      try {
        const rawServices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Service));
        const filtered = rawServices.filter((s: any) => 
            s.active !== false &&
            s.name?.trim() &&
            Number(s.price) > 0
          ).map((s: any) => {
            let parsedDuration = Number(s.duration) || 0;
            if (parsedDuration < 15 || parsedDuration > 480) parsedDuration = 60;
            return {
              ...s,
              duration: parsedDuration
            };
          });
        const grouped = new Map<string, any[]>();
        filtered.forEach(s => {
            const key = s.name.trim().toLowerCase().replace(/\s+/g, ' ');
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)!.push(s);
          });
        const uniqueServices = Array.from(grouped.values()).map(list => {
            if (list.length === 1) return list[0];
            
            // Critérios de desempate se houver duplicados:
            // 1. Tem descrição
            // 2. Mais recente (updatedAt ou createdAt)
            return [...list].sort((a, b) => {
              const aDesc = !!(a as any).description?.trim();
              const bDesc = !!(b as any).description?.trim();
              if (aDesc !== bDesc) return aDesc ? -1 : 1;
              
              const aTime = new Date((a as any).updatedAt || (a as any).createdAt || 0).getTime();
              const bTime = new Date((b as any).updatedAt || (b as any).createdAt || 0).getTime();
              return bTime - aTime;
            })[0];
          });
        setServices(uniqueServices);
      } catch (err) {
        if (isDev) console.error("Error processing getDocs callback:", err);
      } finally {
        if (isMounted) {

          setIsServicesLoading(false);
        }
      }
    }).catch((error) => { 
      if (isDev) console.error("Firestore getDocs error:", error); 
      if (isMounted) {
        if (isDev) console.log(`[P0] Dashboard: services query finished at ${Date.now()}`);
        setIsServicesLoading(false);
      }
    });

    // Query: WhatsApp Logs
    const qWl = query(
      collection(db, 'whatsapp_logs'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    getDocs(qWl).then((snapshot) => {
      if (!isMounted) return;
      try {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as WhatsAppLog));
        setWhatsappLogs(docs);
      } catch (err) {
        if (isDev) console.error("Error processing getDocs callback:", err);
      }
    }).catch((error) => {
      if (isDev) console.error('[Dashboard] Fetch error on qWl:', error);
    });

    return () => {
      isMounted = false;
      unsubToday();
      unsubUnconfirmed();
      unsubWaitlist();
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!profile) return;
    setWaitlistMode(profile.waitlistMode || 'manual');
    if (profile.referralCode) {
      const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
      setReferralLink(`${appUrl}/register?ref=${profile.referralCode}`);
    }
  }, [profile]);

  const availability = useMemo(() => {
    if (!profile?.workingHours) return null;
    
    return getDayAvailability({
      selectedDate: getTodayLocale(),
      serviceDuration: 60,
      workingHours: profile.workingHours,
      appointments,
      blockedSchedules
    });
  }, [profile, appointments, blockedSchedules]);

  const freeSlotsToday = availability?.availableCount || 0;

  const handleRespond = async (id: string, decision: 'confirmed' | 'cancelled_by_professional', appointment?: any) => {
    if (processingId === id) return;
    
    if (!user?.uid) {
      notify.error("Sessão expirada. Entre novamente.");
      setTimeout(() => window.location.href = '/login', 2000);
      return;
    }

    setProcessingId(id);
    
    // Optimistic UI Update immediately
    setOptimisticUpdates(prev => ({ ...prev, [id]: decision }));

    try {
      const token = await user.getIdToken(true);
      
      if (decision === 'confirmed') {
        const res = await fetch(`/api/appointments/${id}/confirm`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ professionalId: user.uid })
        });
        
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Erro ao confirmar (${res.status})`);
        }
        
        setConfirmedId(id);
        notify.success('Horário confirmado.');
        await new Promise(resolve => setTimeout(resolve, 800));
      } else {
        const res = await fetch(`/api/appointments/${id}/decline`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });
        
        if (!res.ok) {
           const errData = await res.json().catch(() => ({}));
           throw new Error(errData.error || `Erro ao recusar (${res.status})`);
        }
        
        notify.success('Indisponibilidade registrada.');
        setIsConfirmRejectOpen(false);
        setRequestToReject(null);
      }
      
      if (selectedRequest?.id === id) {
        setIsModalOpen(false);
      }
    } catch (error: any) {
      // Revert optimistic update on failure
      setOptimisticUpdates(prev => {
        const reset = { ...prev };
        delete reset[id];
        return reset;
      });
      if (isDev) console.error("[DASHBOARD FLOW ERROR]", error);
      notify.error(error, 'Não foi possível concluir. Tente novamente.');
    } finally {
      setProcessingId(null);
      setConfirmedId(null);
    }
  };

  const toggleWaitlistMode = async () => {
    if (!user) return;
    const newMode = waitlistMode === 'auto' ? 'manual' : 'auto';
    setWaitlistMode(newMode);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        waitlistMode: newMode,
        updatedAt: new Date().toISOString()
      });
      notify.success(`Lista de espera: modo ${newMode === 'auto' ? 'Automático' : 'Manual'} ativado`);
    } catch (e) {
      notify.error('Erro ao atualizar configuração.');
    }
  };

  const handleInvite = async (entry: WaitlistEntry) => {
    setProcessingId(entry.id);
    try {
      const time = entry.preferredTime || '15:00'; 
      await inviteFromWaitlist(entry.id, time);
      
      const msg = generateWaitlistInviteMessage(
        entry.clientName,
        entry.requestedDate,
        time,
        profile?.slug || '',
        entry.id,
        profile?.name
      );
      
      window.open(buildWhatsappLink(entry.clientWhatsapp, msg), '_blank');
      notify.success('Convite enviado!');
    } catch (e) {
      notify.error('Erro ao enviar convite.');
    } finally {
      setProcessingId(null);
    }
  };

  const isPastTime = (time: string | undefined): boolean => {
    if (!time || typeof time !== 'string' || !time.includes(':')) return false;
    const [h, m] = time.split(":").map(Number);
    const apptDate = new Date();
    apptDate.setHours(h, m, 0);
    // Mostrar botao a partir de 30 min depois do horario
    const cutoff = new Date(apptDate.getTime() + 30 * 60 * 1000);
    return new Date() >= cutoff;
  };

  const ongoingAppt = useMemo(() => {
    if (activeTab !== 'hoje') return null;
    const now = new Date();
    return displayedConfirmedToday.find(appt => {
      if (!isConfirmedLikeStatus(appt.status)) return false;
      if (!appt.time || typeof appt.time !== 'string' || !appt.time.includes(':')) {
        return false;
      }
      const [h, m] = appt.time.split(':').map(Number);
      const apptDate = new Date();
      apptDate.setHours(h, m, 0);
      const diff = (now.getTime() - apptDate.getTime()) / (1000 * 60);
      return diff >= 0 && diff <= 90; // Active within 90 minutes of start
    });
  }, [displayedConfirmedToday, activeTab]);

  const handleComplete = async (app: Appointment) => {
    setProcessingId(app.id);
    try {
      const idToken = await user?.getIdToken();
      const res = await fetch(`/api/appointments/${app.id}/complete`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${idToken}`,
          "Content-Type": "application/json"
        }
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Erro ao concluir (${res.status})`);
      }

      const token = Array.from(window.crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2, '0')).join('');
      await addDoc(collection(db, 'review_requests'), {
        bookingId: app.id,
        professionalId: user!.uid,
        clientDisplayName: app.clientName,
        clientNeighborhood: app.neighborhood || '',
        token,
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      setConfirmedId(app.id);
      notify.success('Atendimento finalizado. Preparando envio de avaliação.');
      
      const reviewLink = `${window.location.origin}/review/${token}`;
      try {
        await navigator.clipboard.writeText(reviewLink);
      } catch {}
      
      const text = `Oi, ${app.clientName} 🤎\nObrigada pela visita de hoje.\nSe puder, deixe sua avaliação por aqui:\n${reviewLink}`;
      window.open(`https://wa.me/55${cleanWhatsapp(app.clientWhatsapp || '')}?text=${encodeURIComponent(text)}`, '_blank');
      
      await new Promise(resolve => setTimeout(resolve, 800));
    } catch (error) {
      handleBookingError(error);
    } finally {
      setProcessingId(null);
      setConfirmedId(null);
    }
  };

  const { isSupported, isSubscribed, permission, requestPermission } = usePushNotifications();
  const [isPushLoading, setIsPushLoading] = useState(false);

  useEffect(() => {
    if (import.meta.env.DEV) {
      devLog("[PUSH UI] Notification supported:", "Notification" in window);
      devLog("[PUSH UI] ServiceWorker supported:", "serviceWorker" in navigator);
      devLog("[PUSH UI] PushManager supported:", "PushManager" in window);
      if ("Notification" in window) {
        devLog("[PUSH UI] permission:", Notification.permission);
      }
    }
  }, []);

  const handleEnablePushNotifications = async () => {
    try {
      devLog("[PUSH BUTTON] clicked");
      setIsPushLoading(true);
      
      const success = await requestPermission();
      devLog("[PUSH BUTTON] requestPermission finished. Success:", success);

      if (success) {
      notify.success('Notificações ativadas.');
      } else if (Notification.permission === 'denied') {
        notify.error('Notificações bloqueadas no navegador. Ative as permissões nas configurações do site.');
      }
    } catch (error: any) {
      if (isDev) console.error("[PUSH BUTTON ERROR]", error);
      // Not throwing here to allow finally block to run and clear loading
    } finally {
      setIsPushLoading(false);
    }
  };

  const currentMonthISO = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [isReportLoading, setIsReportLoading] = useState(false);

  const handleDownloadReport = async () => {
    if (!features.reports) {
      openUpgradeModal('reports');
      return;
    }

    try {
      setIsReportLoading(true);
      if (!user?.uid) return;
      
      const token = await user.getIdToken();
      const response = await fetch(`/api/reports/monthly?month=${currentMonthISO}&professionalId=${user.uid}`, {
        headers: {
          'x-professional-id': user.uid,
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Falha ao gerar relatório');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nera-relatorio-${currentMonthISO}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      notify.success('Relatório gerado.');
    } catch (error: any) {
      if (isDev) console.error("[REPORT ERROR]", error);
      notify.error(error, 'Erro ao baixar relatório. Tente novamente.');
    } finally {
      setIsReportLoading(false);
    }
  };



  if (isInitialLoading) {
    return <DashboardSkeleton />;
  }

  const isNewAccount = appointments.length === 0 && pendingCount === 0 && (!totalClientsCountFromSummaries || totalClientsCountFromSummaries === 0);

  return (
    <AppLayout activeRoute="dashboard">
      <PageErrorBoundary 
        title="Não foi possível carregar este painel." 
        message="Tivemos um contratempo ao gerar suas métricas. Recarregar costuma resolver."
      >
      {!isNewAccount && (
        <FirstVisitTip 
          pageKey="dashboard"
          title="Sua central de operações"
          description="Aqui você vê todos os agendamentos, receita e ações rápidas. Tudo que você precisa para o dia a dia está nesta página."
        />
      )}
      <div className="p-6 md:p-12 pb-[calc(140px+env(safe-area-inset-bottom))] md:pb-16 max-w-5xl mx-auto w-full space-y-10">
        
        {/* Sync Pending Banner */}
        {plan === 'free' && signupPlan && signupPlan !== 'free' && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-brand-linen/80 border border-brand-mist/50 p-5 rounded-3xl flex items-center justify-between gap-4 shadow-sm backdrop-blur-sm"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-brand-stone shrink-0 shadow-sm border border-brand-mist/30">
                <Loader2 size={24} strokeWidth={1} className="animate-spin text-brand-terracotta" />
              </div>
              <div>
                <p className="text-[12px] font-bold text-brand-ink mb-0.5">Finalizando sua ativação</p>
                <p className="text-[11px] text-brand-stone font-light">A Nera está sincronizando seu acesso Premium.</p>
              </div>
            </div>
            <button 
              onClick={async () => {
                const token = await user?.getIdToken();
                const res = await fetch('/api/plans/reconcile-user', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({ targetUid: user?.uid })
                });
                const data = await res.json();
                if (data.success) {
                  notify.success('Assinatura ativada com sucesso.');
                  refreshProfile();
                } else {
                  notify.warning('Sua ativação ainda está sendo processada. Isso pode levar alguns instantes.');
                }
              }}
              className="px-5 py-2.5 bg-white border border-brand-mist/60 rounded-xl text-[9px] font-bold uppercase tracking-widest text-brand-ink hover:bg-[#FAF9F8] transition-all shadow-sm shrink-0 whitespace-nowrap focus:ring-4 ring-brand-ink/5"
            >
              Verificar Status
            </button>
          </motion.div>
        )}

        {/* Avatar Skipped Reminder Banner */}
        {profile?.avatarSkipped && !profile?.avatar && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-yellow-50 border border-yellow-200 p-4 rounded-2xl flex items-center justify-between gap-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600 shrink-0">
                <Camera size={20} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-brand-ink leading-tight">Adicione sua foto de perfil</p>
                <p className="text-[10px] text-brand-stone font-light italic">Profissionais com foto recebem 3x mais clientes.</p>
              </div>
            </div>
            <Link 
              to="/profile" 
              className="px-4 py-2 bg-white border border-yellow-200 rounded-full text-[9px] font-bold uppercase tracking-widest text-brand-ink hover:bg-yellow-100 transition-all shrink-0"
            >
              Atualizar Perfil
            </Link>
          </motion.div>
        )}

        {/* Missing Service Duration Banner */}
        {services.some(s => !s.duration) && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center justify-between gap-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 shrink-0">
                <AlertCircle size={20} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-brand-ink leading-tight">Um ou mais serviços sem duração definida pode estar afetando sua agenda.</p>
                <p className="text-[10px] text-brand-stone font-light italic">As clientes só podem agendar serviços com duração válida.</p>
              </div>
            </div>
            <Link 
              to="/services" 
              className="px-4 py-2 bg-white border border-amber-200 rounded-full text-[9px] font-bold uppercase tracking-widest text-brand-ink hover:bg-amber-100 transition-all shrink-0"
            >
              Corrigir agora →
            </Link>
          </motion.div>
        )}

        {/* 1. HEADER LIMPO */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3">
            <div className="space-y-1">
              <h1 className="text-3xl font-serif text-brand-ink tracking-tight">
                Olá, {safeString(profile?.name).split(' ')[0]} ✨
              </h1>
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <Link to="/planos" className={cn(
                  "text-[9px] uppercase tracking-[0.2em] font-bold px-2 py-0.5 rounded flex items-center hover:opacity-80 transition-opacity",
                  plan === 'pro' || plan === 'essencial' 
                    ? "text-brand-ink bg-brand-linen border border-brand-mist/50" 
                    : "text-brand-stone bg-brand-mist/10 border border-brand-mist/30"
                )}>
                  {plan === 'pro' && 'Plano Pro'}
                  {plan === 'essencial' && 'Plano Essencial'}
                  {plan === 'free' && 'Plano Gratuito'}
                </Link>
                {plan === 'free' && (
                  <Link to="/planos" className="text-[10px] text-brand-terracotta hover:text-brand-sienna transition-colors font-medium relative top-[-1px]">
                    Upgrade
                  </Link>
                )}
                <span className="text-brand-mist text-[10px] hidden sm:inline">|</span>
                <p className="text-[12px] text-brand-stone font-light hidden sm:block">
                  {plan === 'free' ? (
                    <>
                      <strong className="font-medium text-brand-ink">{usageCount}</strong> de 15 reservas online usadas este mês
                    </>
                  ) : (
                    <>
                      <strong className="font-medium text-brand-ink">{usageCount}</strong> atendimentos no mês
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 hide-scrollbar pt-4 md:pt-0">
            {profile?.slug && (
              <a 
                href={getPublicProfileUrl(profile.slug)} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex flex-1 md:flex-none justify-center items-center gap-2 px-4 py-2 border border-brand-mist/80 bg-brand-white text-brand-ink rounded-[12px] text-[9px] font-bold uppercase tracking-widest hover:bg-brand-linen transition-colors shadow-none whitespace-nowrap"
              >
                <Eye size={12} className="text-brand-stone/80" /> Ver minha página
              </a>
            )}
            <button 
              onClick={() => setIsQuickBlockOpen(true)}
              className="flex flex-1 md:flex-none justify-center items-center gap-2 px-4 py-2 border border-brand-mist/80 bg-brand-white text-brand-ink rounded-[12px] text-[9px] font-bold uppercase tracking-widest hover:bg-brand-linen transition-colors shadow-none whitespace-nowrap"
            >
              <Lock size={12} className="text-brand-stone/80" /> Bloquear horário
            </button>
            <button 
              onClick={() => setIsShareModalOpen(true)}
              className="flex flex-1 md:flex-none justify-center items-center gap-2 px-5 py-2 bg-brand-ink text-brand-white rounded-[12px] text-[9px] font-bold uppercase tracking-widest hover:bg-brand-ink/90 transition-colors shadow-sm whitespace-nowrap"
            >
              <Share2 size={12} /> Link direto
            </button>
          </div>
        </header>

        {pendingReviewsCount > 0 && (
          <div className="bg-brand-parchment border border-brand-mist rounded-[16px] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm animate-fade-in my-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-linen flex items-center justify-center text-brand-terracotta flex-shrink-0">
                <Star size={20} className="fill-brand-terracotta/20 text-brand-terracotta" />
              </div>
              <div>
                <p className="text-sm font-medium text-brand-ink">Você possui {pendingReviewsCount} {pendingReviewsCount === 1 ? 'avaliação aguardando' : 'avaliações aguardando'} aprovação.</p>
                <p className="text-[11px] text-brand-stone mt-0.5">Revise o feedback recebido para exibir no seu perfil.</p>
              </div>
            </div>
            <Link 
              to="/avaliacoes" 
              className="text-[10px] font-bold uppercase tracking-widest text-brand-ink bg-brand-white border border-brand-mist/80 hover:bg-brand-mist/20 transition-colors px-6 py-2.5 rounded-full whitespace-nowrap text-center"
            >
              Revisar avaliações
            </Link>
          </div>
        )}

        {/* DASHBOARD TABS */}
        <div className="grid grid-cols-3 bg-[#FAF9F8] p-1.5 rounded-xl border border-brand-mist/30 text-[9px] md:text-[10px] font-bold uppercase tracking-widest w-full">
          <button 
            onClick={() => setActiveTab("hoje")}
            className={cn(
              "py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 relative whitespace-nowrap outline-none",
              activeTab === "hoje" ? "bg-white shadow-sm text-brand-ink border border-brand-mist/40" : "text-brand-stone/80 hover:text-brand-ink border border-transparent hover:border-transparent focus:border-transparent focus:ring-0"
            )}
          >
            Hoje
            {pendingCount > 0 && (
              <span className="flex items-center justify-center min-w-[14px] h-[14px] px-1 bg-brand-terracotta text-white rounded-full text-[8px] font-bold animate-pulse">
                {pendingCount}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab("crescimento")}
            className={cn(
              "py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 relative whitespace-nowrap outline-none",
              activeTab === "crescimento" ? "bg-white shadow-sm text-brand-ink border border-brand-mist/40" : "text-brand-stone/80 hover:text-brand-ink border border-transparent hover:border-transparent focus:border-transparent focus:ring-0"
            )}
          >
            Crescimento
            {inactiveClientsCount > 0 && (
              <span className="w-1.5 h-1.5 bg-brand-terracotta rounded-full shrink-0" />
            )}
          </button>
          <button 
            onClick={() => setActiveTab("gestao")}
            className={cn(
              "py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 relative whitespace-nowrap outline-none",
              activeTab === "gestao" ? "bg-white shadow-sm text-brand-ink border border-brand-mist/40" : "text-brand-stone/80 hover:text-brand-ink border border-transparent hover:border-transparent focus:border-transparent focus:ring-0"
            )}
          >
            Gestão
          </button>
        </div>

        {/* CRESCIMENTO CONTENT */}
        {activeTab === "crescimento" && (
          <div className="flex flex-col gap-8">
            {profile && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <SharingPreviewSection profile={profile} />
              </motion.div>
            )}

            {/* Growth Dashboard: KPIs simplificados e Growth Pro */}
            {growthMetrics && (
              <section className="bg-[#FCFBF9] p-6 md:p-8 rounded-[32px] border border-brand-mist/40 shadow-sm flex flex-col gap-6 relative overflow-hidden transition-all opacity-90">
                <div className="flex items-center justify-between border-b border-brand-mist/30 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#FAF9F8] border border-brand-mist/60 text-brand-stone/60 rounded-xl">
                      <TrendingUp size={16} />
                    </div>
                    <div>
                      <h3 className="text-[9px] font-bold uppercase tracking-[0.3em] text-brand-stone mb-1 flex items-center">
                        Crescimento
                      </h3>
                      <p className="text-[13px] font-serif text-brand-ink italic">Visão de sua vitrine</p>
                    </div>
                  </div>
                  <div className="flex bg-[#FAF9F8] border border-brand-mist/40 p-1 rounded-full text-[8px] font-bold uppercase tracking-widest hidden sm:flex">
                    <span className="px-3 py-1 bg-white border border-brand-mist/30 rounded-full shadow-sm text-brand-ink">Últimos 30 dias</span>
                  </div>
                </div>

                {isNewAccount ? (
                  <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
                    <div className="w-14 h-14 bg-[#FAF9F8] rounded-2xl flex items-center justify-center text-brand-stone/30 mb-5 border border-brand-mist/20">
                      <TrendingUp size={24} strokeWidth={1} />
                    </div>
                    <p className="text-sm font-serif text-brand-ink mb-1 italic">Sua vitrine está pronta para prosperar</p>
                    <p className="text-[10px] text-brand-stone font-light px-8 max-w-xs mx-auto mb-8 uppercase tracking-widest leading-relaxed">Os dados de crescimento aparecerão aqui conforme as primeiras clientes reservarem.</p>
                    <button 
                      onClick={() => setIsShareModalOpen(true)}
                      className="bg-brand-ink text-brand-white px-8 py-3.5 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-espresso transition-all shadow-md focus:ring-4 ring-brand-ink/10 flex items-center gap-2"
                    >
                      <Share2 size={14} /> Compartilhar meu link
                    </button>
                  </div>
                ) : !features.advancedDashboard ? (
                  // Essencial / Free View - Teaser (Blocked Growth)
                  <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                    <div className="w-16 h-16 bg-[#FAF9F8] rounded-[20px] flex items-center justify-center text-brand-stone mb-6 border border-brand-mist/30 shadow-sm">
                      <TrendingUp size={28} strokeWidth={1.5} />
                    </div>
                    <h4 className="text-xl font-serif text-brand-ink mb-3 tracking-tight">Insights avançados da sua vitrine</h4>
                    <p className="text-[13px] text-brand-stone font-light px-8 max-w-sm mx-auto mb-8 leading-relaxed">
                      No PRO, você acompanha crescimento, desempenho e comportamento da sua agenda em tempo real.
                    </p>
                    <Link to="/planos" className="inline-block">
                      <PremiumButton variant="ink" className="text-[10px] py-3.5 px-8 flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all">
                        <Sparkles size={14} className="text-brand-terracotta" /> Conhecer PRO
                      </PremiumButton>
                    </Link>
                  </div>
                ) : (
                  // Pro View
                  <div className="flex flex-col gap-6">
                    {/* Hero Insight */}
                    {growthMetrics.growthInsightsList && growthMetrics.growthInsightsList.length > 0 && (
                      <div className="bg-[#FAF9F8] border border-brand-mist/40 p-5 rounded-[24px] flex items-start gap-4 shadow-sm relative overflow-hidden">
                        <div className="absolute -top-4 -right-4 p-4 opacity-[0.03] pointer-events-none text-brand-ink">
                          <Sparkles size={80} />
                        </div>
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-brand-mist/30 text-brand-stone">
                          <Zap size={18} />
                        </div>
                        <div className="flex-1 z-10">
                          <div className="flex items-center gap-2 mb-1.5">
                            <h4 className="text-[10px] font-bold text-brand-ink uppercase tracking-widest">{growthMetrics.growthInsightsList[0].title}</h4>
                            <span className="text-[7px] font-bold text-brand-stone bg-white border border-brand-mist/40 px-1.5 py-0.5 rounded uppercase tracking-widest">Insight da semana</span>
                          </div>
                          <p className="text-[13px] text-brand-ink font-serif leading-relaxed italic pr-4">
                            "{growthMetrics.growthInsightsList[0].description}"
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Pro Metrics Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                       <div className="p-4 bg-brand-white rounded-2xl border border-brand-mist/40 shadow-sm">
                         <p className="text-[8px] font-bold uppercase tracking-widest text-brand-stone mb-1">Visitas na vitrine (30d)</p>
                         <div className="flex items-baseline gap-2">
                           <p className="text-xl font-serif text-brand-ink">{growthMetrics.visits30d}</p>
                           {growthMetrics.visits7d > 0 && <span className="text-[9px] font-serif italic text-brand-stone/60">+{growthMetrics.visits7d} na semana</span>}
                         </div>
                       </div>
                       <div className="p-4 bg-brand-white rounded-2xl border border-brand-mist/40 shadow-sm">
                         <p className="text-[8px] font-bold uppercase tracking-widest text-brand-stone mb-1">Conversão média</p>
                         <p className="text-xl font-serif text-brand-ink">{growthMetrics.convRate.toFixed(1)}%</p>
                       </div>
                       <div className="p-4 bg-brand-white rounded-2xl border border-brand-mist/40 shadow-sm">
                          <p className="text-[8px] font-bold uppercase tracking-widest text-brand-stone mb-1">Serviço Campeão</p>
                          <p className="text-sm font-serif text-brand-ink truncate font-medium">{growthMetrics.topService}</p>
                       </div>
                       <div className="p-4 bg-brand-white rounded-2xl border border-brand-mist/40 shadow-sm">
                          <p className="text-[8px] font-bold uppercase tracking-widest text-brand-stone mb-1">Melhor Horário</p>
                          <p className="text-sm font-serif text-brand-ink font-medium">{growthMetrics.bestTime}</p>
                       </div>
                    </div>

                    {/* Secondary Insights */}
                    {growthMetrics.growthInsightsList && growthMetrics.growthInsightsList.length > 1 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                        {growthMetrics.growthInsightsList.slice(1).map((insight: any, idx: number) => (
                          <div key={idx} className="p-4 rounded-2xl border border-brand-mist/40 flex items-start gap-3 bg-brand-white shadow-sm">
                            <div className="w-8 h-8 rounded-xl bg-[#FAF9F8] border border-brand-mist/60 flex items-center justify-center text-brand-stone/70 shrink-0">
                               {insight.icon === 'Star' ? <Star size={14} /> : insight.icon === 'Clock' ? <Clock size={14} /> : <Sparkles size={14} />}
                            </div>
                            <div>
                              <h4 className="text-[9px] font-bold text-brand-stone uppercase tracking-widest mb-1">{insight.title}</h4>
                              <p className="text-[11px] text-brand-ink font-light leading-relaxed">
                                {insight.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>
        )}



        {/* GESTÃO CONTENT */}
        {activeTab === "gestao" && (
          <div className="flex flex-col gap-8 opacity-90 animate-in fade-in duration-500">
            <section className="bg-[#FCFBF9] p-6 md:p-8 rounded-[32px] border border-brand-mist/40 shadow-sm flex flex-col gap-6 relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-brand-mist/30 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#FAF9F8] border border-brand-mist/60 text-brand-stone/60 rounded-xl">
                    <Settings size={16} />
                  </div>
                  <h3 className="text-lg font-serif text-brand-ink">Gestão do negócio</h3>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                <Link to="/financeiro" className="flex items-center justify-between p-4 bg-brand-white border border-brand-mist/40 rounded-2xl shadow-sm hover:border-brand-mist transition-all active:scale-[0.98] group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#FAF9F8] border border-brand-mist/60 flex items-center justify-center group-hover:bg-brand-white transition-colors text-brand-ink">
                      <DollarSign size={20} className="text-brand-stone/70 group-hover:text-brand-ink transition-colors" />
                    </div>
                    <div>
                      <h3 className="text-[13px] font-bold text-brand-ink">Financeiro</h3>
                      <p className="text-[11px] text-brand-stone font-light mt-0.5">Receita, histórico e exportações.</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-brand-stone/40 group-hover:text-brand-ink transition-colors" />
                </Link>

                <Link to="/cupons" className="flex items-center justify-between p-4 bg-brand-white border border-brand-mist/40 rounded-2xl shadow-sm hover:border-brand-mist transition-all active:scale-[0.98] group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#FAF9F8] border border-brand-mist/60 flex items-center justify-center group-hover:bg-brand-white transition-colors text-brand-ink">
                      <Ticket size={20} className="text-brand-stone/70 group-hover:text-brand-ink transition-colors" />
                    </div>
                    <div>
                      <h3 className="text-[13px] font-bold text-brand-ink">Cupons</h3>
                      <p className="text-[11px] text-brand-stone font-light mt-0.5">Crie incentivos para suas clientes.</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-brand-stone/40 group-hover:text-brand-ink transition-colors" />
                </Link>

                <Link to="/indicacoes" className="flex items-center justify-between p-4 bg-brand-white border border-brand-mist/40 rounded-2xl shadow-sm hover:border-brand-mist transition-all active:scale-[0.98] group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#FAF9F8] border border-brand-mist/60 flex items-center justify-center group-hover:bg-brand-white transition-colors text-brand-ink">
                      <Gift size={20} className="text-brand-stone/70 group-hover:text-brand-ink transition-colors" />
                    </div>
                    <div>
                      <h3 className="text-[13px] font-bold text-brand-ink">Indicações</h3>
                      <p className="text-[11px] text-brand-stone font-light mt-0.5">Acompanhe convites e recompensas.</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-brand-stone/40 group-hover:text-brand-ink transition-colors" />
                </Link>
              </div>
            </section>
          </div>
        )}

        {/* HOJE SIMPLE VIEW */}
        {activeTab === "hoje" && (
          <div className="flex flex-col gap-8">
            {/* Crescimento da Vitrine / Compartilhamento */}
            <ActivationChecklist 
              profile={profile}
              appointments={appointments}
              services={services}
              isLoading={isInitialLoading || isServicesLoading}
              onShareClick={() => setIsShareModalOpen(true)}
            />

            {/* Resumo Financeiro Hoje / Day 1 Activation */}
            {appointments.length === 0 && pendingCount === 0 && (!totalClientsCountFromSummaries || totalClientsCountFromSummaries === 0) ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[#FCFBF9] p-8 md:p-12 rounded-[40px] border border-dashed border-brand-mist shadow-sm relative overflow-hidden group mb-2 opacity-95 text-center flex flex-col items-center"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-white rounded-full blur-[80px] opacity-70 -mr-20 -mt-20 pointer-events-none transition-opacity group-hover:opacity-100" />
                <div className="relative z-10 max-w-lg">
                  <div className="w-14 h-14 bg-white border border-brand-mist/60 text-brand-ink rounded-2xl flex items-center justify-center mb-6 shadow-sm mx-auto">
                    <Calendar size={24} strokeWidth={1.5} className="text-brand-terracotta/80" />
                  </div>
                  <h4 className="text-2xl md:text-3xl font-serif text-brand-ink mb-3 leading-tight italic">Traga sua agenda para a Nera</h4>
                  <p className="text-[13px] text-brand-stone font-light mb-8 leading-relaxed max-w-sm mx-auto">
                    Você já tem clientes marcados? Adicione seus próximos atendimentos para visualizar tudo em um só lugar.
                    <br/><br/>
                    <span className="text-[11px] text-brand-stone/70">Você pode registrar seus atendimentos manuais sem consumir o limite de reservas online do plano gratuito.</span>
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                    <Link 
                      to="/agenda?openManual=true"
                      className="w-full sm:w-auto px-10 py-4.5 bg-brand-ink text-brand-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-espresso transition-all shadow-md flex items-center justify-center gap-2"
                    >
                      <Plus size={16} /> Adicionar primeiro agendamento
                    </Link>
                    <button 
                      onClick={() => setIsShareModalOpen(true)}
                      className="text-[10px] font-bold uppercase tracking-widest text-brand-stone hover:text-brand-ink transition-colors flex items-center gap-1"
                    >
                      <Share2 size={12} /> Compartilhar página
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="bg-[#FCFBF9] p-6 rounded-[32px] border border-brand-mist/40 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="flex flex-col w-full md:w-auto">
                  {(agendaHojeStatus === 'loading' || agendaHojeStatus === 'stalled') && displayedConfirmedToday.length === 0 ? (
                    <>
                      <div className="mb-4 pb-4 border-b border-brand-mist/40 mt-1">
                        <div className="animate-pulse flex items-center gap-2 mb-2">
                           <Loader2 size={12} className="animate-spin text-brand-stone" />
                           <span className="text-[12px] font-serif text-brand-stone italic text-opacity-80">
                             {agendaHojeStatus === 'stalled' ? 'Sincronizando agenda (sua conexão pode estar lenta)...' : 'Atualizando sua agenda...'}
                           </span>
                        </div>
                        <div className="h-3 bg-brand-mist/40 rounded w-1/3 mt-3"></div>
                      </div>
                      <div className="flex items-center gap-6 md:gap-8 overflow-x-auto hide-scrollbar mt-1">
                        <div className="flex-none animate-pulse">
                          <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-brand-stone/40 mb-1.5">Faturamento Hoje</p>
                          <div className="h-6 bg-brand-mist/60 rounded w-20"></div>
                        </div>
                        <div className="flex-none animate-pulse">
                          <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-brand-stone/40 mb-1.5">Agendamentos</p>
                          <div className="h-6 bg-brand-mist/60 rounded w-10"></div>
                        </div>
                      </div>
                    </>
                  ) : agendaHojeStatus === 'error' && displayedConfirmedToday.length === 0 ? (
                    <div className="mb-4 pb-4 border-b border-brand-mist/40">
                      <p className="text-[14px] font-serif text-red-800/60 italic">Erro ao carregar sua agenda. Tente novamente.</p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-4 pb-4 border-b border-brand-mist/40">
                        {displayedConfirmedToday.length === 0 ? (
                          <p className="text-[14px] font-serif text-brand-stone italic">Sua agenda está livre no momento.</p>
                        ) : (
                          <div className="flex items-center gap-2">
                             <p className="text-[14px] font-serif text-brand-stone italic">Você tem {displayedConfirmedToday.length} agendamento{displayedConfirmedToday.length > 1 ? 's' : ''} hoje.</p>
                             {(agendaHojeStatus === 'loading' || agendaHojeStatus === 'stalled') && (
                               <Loader2 size={10} className="animate-spin text-brand-stone opacity-50" />
                             )}
                          </div>
                        )}
                        
                        {nextUpcomingAppointment ? (
                          <p className="text-[10px] font-medium tracking-widest text-brand-stone/80 mt-2">
                            PRÓXIMO: <span className="font-bold text-brand-ink">{formatLocalDate(nextUpcomingAppointment.date, { day: '2-digit', month: '2-digit' })} às {nextUpcomingAppointment.time}</span> com <span className="text-brand-ink font-semibold">{nextUpcomingAppointment.clientName}</span>
                          </p>
                        ) : daysSinceLastAppointment !== null && daysSinceLastAppointment > 0 && (
                          <p className="text-[9px] font-medium uppercase tracking-widest text-brand-stone/60 mt-1">
                            Último agendamento há {daysSinceLastAppointment} {daysSinceLastAppointment === 1 ? 'dia' : 'dias'}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-6 md:gap-8 overflow-x-auto hide-scrollbar mt-1">
                        <div className="flex-none">
                          <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-brand-stone/60 mb-1.5">Faturamento Hoje</p>
                          <p className="text-[22px] md:text-2xl leading-none font-serif text-brand-ink tracking-tight">{formatCurrency(displayedDailyRevenue)}</p>
                        </div>
                        <div className="w-px h-8 bg-brand-mist/40 shrink-0" />
                        <div className="flex-none">
                          <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-brand-stone/60 mb-1.5">Agendamentos</p>
                          <p className="text-[22px] md:text-2xl leading-none font-serif text-brand-ink tracking-tight">{displayedConfirmedToday.length}</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                
                <Link to="/financeiro" className="mt-2 md:mt-0 pt-4 md:pt-0 border-t border-brand-mist/40 md:border-0 w-full md:w-auto shrink-0 flex justify-end">
                  <button className="w-full md:w-auto px-6 py-2.5 bg-brand-white text-brand-ink border border-brand-mist/60 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-[#FAF9F8] transition-colors shadow-sm">
                    Ver detalhes
                  </button>
                </Link>
              </div>
            )}

            {/* Last-Minute Cancellation Alerts */}
            <AnimatePresence>
              {alerts.map((alert) => (
                <motion.div 
                  key={alert.id}
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className="bg-red-50 border border-red-200 p-4 rounded-3xl overflow-hidden shadow-sm"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600 shrink-0">
                        <X size={20} />
                      </div>
                      <div className="flex-1">
                        <p className="text-[11px] font-bold text-red-900 leading-tight">Cancelamento de última hora!</p>
                        <p className="text-[10px] text-red-700 font-light mt-1">
                          {alert.clientName} cancelou {alert.additionalServices?.length > 0 ? [alert.serviceName, ...alert.additionalServices.map((s:any) => s.name)].join(" e ") : alert.serviceName} às {alert.scheduledTime}. 
                          <span className="font-bold ml-1">Faltavam apenas {alert.hoursUntil}h.</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <button 
                        onClick={() => handleMarkAlertRead(alert.id)}
                        className="px-4 py-2 bg-white border border-red-200 rounded-full text-[9px] font-bold uppercase tracking-widest text-red-700 hover:bg-red-100 transition-all"
                      >
                        Marcar como lido
                      </button>
                      <Link 
                        to="/agenda" 
                        className="px-4 py-2 bg-red-600 rounded-full text-[9px] font-bold uppercase tracking-widest text-white hover:bg-red-700 transition-all shadow-sm"
                      >
                        Ver agenda
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Pedidos Pendentes Alerta */}
            {pendingCount > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-brand-white p-5 sm:p-6 rounded-[24px] border border-brand-terracotta/20 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-5 shrink-0 relative overflow-hidden hover:border-brand-terracotta/30 hover:shadow-md transition-all duration-300 group"
              >
                <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-gradient-to-b from-brand-terracotta/40 to-brand-terracotta/80" />
                
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-brand-linen flex items-center justify-center text-brand-terracotta shrink-0">
                    <Inbox size={20} className="stroke-[1.5] sm:w-[22px] sm:h-[22px]" />
                  </div>
                  <div className="flex flex-col">
                    <h4 className="text-[16px] sm:text-[17px] font-serif text-brand-ink tracking-tight mb-1">
                      <strong className="font-medium text-brand-terracotta">{pendingCount} {pendingCount === 1 ? 'cliente aguardando' : 'clientes aguardando'}</strong> confirmação
                    </h4>
                    <p className="text-[13px] text-brand-stone font-light leading-snug max-w-sm">
                      Revise os detalhes e confirme o agendamento.
                    </p>
                  </div>
                </div>

                <Link 
                  to="/pedidos" 
                  className="w-full sm:w-auto mt-2 sm:mt-0 flex justify-center items-center gap-2 px-6 py-3 sm:py-2.5 bg-brand-ink text-brand-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-brand-ink/90 transition-colors shrink-0 shadow-sm"
                >
                  Revisar {pendingCount === 1 ? 'pedido' : 'pedidos'} <ChevronRight size={14} className="text-white/60" />
                </Link>
              </motion.div>
            )}

            {/* Timeline de Hoje */}
            {!(isNewAccount && displayedConfirmedToday.length === 0) && (
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-bold text-brand-stone uppercase tracking-[0.3em]">Agenda de Hoje</h3>
                </div>

                {displayedConfirmedToday.length > 0 ? (
                  <div className="space-y-4">
                    {displayedConfirmedToday.map((appt) => (
                      <div 
                        key={appt.id} 
                        className={cn(
                          "bg-[#FCFBF9] px-5 py-4 md:px-6 md:py-5 rounded-[24px] border border-brand-mist/60 shadow-sm flex items-center justify-between transition-colors opacity-90",
                          isCompletedStatus(appt.status) && "bg-transparent border-dashed shadow-none opacity-60"
                        )}
                      >
                        <div className="flex items-center gap-4 md:gap-5 w-full">
                          <div className="text-center min-w-[48px] shrink-0">
                            <p className={cn("text-[17px] font-serif font-bold leading-none", isCompletedStatus(appt.status) ? "text-brand-stone" : "text-brand-ink")}>{appt.time}</p>
                          </div>
                          <div className="h-8 w-px bg-brand-mist/40 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className={cn("text-[13px] font-bold truncate", isCompletedStatus(appt.status) ? "text-brand-stone" : "text-brand-ink")}>{appt.clientName}</h4>
                              {isCompletedStatus(appt.status) && <CheckCircle2 size={12} className="text-brand-stone shrink-0" />}
                            </div>
                            <p className="text-[11px] text-brand-stone font-light truncate leading-tight pr-2 mt-0.5">
                              {appt.additionalServices?.length > 0 
                                ? [appt.serviceName, ...appt.additionalServices.map((s:any) => s.name)].join(" • ") 
                                : appt.serviceName}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1.5 shrink-0 pl-2">
                          {isConfirmedLikeStatus(appt.status) && isPastTime(appt.time) && (
                            <button
                              onClick={() => handleComplete(appt)}
                              disabled={processingId === appt.id}
                              className="flex items-center gap-1 px-3 py-1.5 bg-brand-white border border-brand-mist/40 text-brand-ink rounded-full text-[9px] font-medium tracking-wide shadow-sm hover:bg-[#FAF9F8] transition-colors active:scale-95 whitespace-nowrap"
                            >
                              {processingId === appt.id ? "..." : "Finalizar"}
                            </button>
                          )}
                          <Link to="/agenda" className="p-2 text-brand-stone/60 hover:text-brand-ink transition-colors">
                            <ChevronRight size={16} />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-[#FCFBF9] p-12 rounded-[40px] border border-brand-mist/40 border-dashed text-center flex flex-col items-center shadow-sm">
                    <div className="w-14 h-14 bg-[#FAF9F8] rounded-2xl flex items-center justify-center text-brand-stone/40 mb-6 border border-brand-mist/30">
                      <Calendar size={24} strokeWidth={1} />
                    </div>
                    <h4 className="font-serif text-xl md:text-2xl text-brand-ink mb-1 italic">Sua próxima reserva aparecerá aqui</h4>
                    <p className="text-[11px] text-brand-stone font-light max-w-xs mx-auto mb-10 leading-relaxed uppercase tracking-widest">
                      A sua agenda está pronta para receber novas clientes.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm mx-auto justify-center">
                      <button 
                        onClick={() => setIsShareModalOpen(true)}
                        className="w-full sm:w-auto px-10 py-4 bg-brand-ink text-brand-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-espresso transition-all shadow-md focus:ring-4 ring-brand-ink/20"
                      >
                        Atrair Clientes
                      </button>
                      <Link 
                        to="/clients"
                        className="w-full sm:w-auto px-10 py-4 bg-brand-parchment text-brand-ink border border-brand-mist/40 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-linen transition-all text-center shadow-sm"
                      >
                        Ver Clientes
                      </Link>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Notificações Banner (Compact Strip) */}
            {isSupported && !isSubscribed && !pushBannerDismissed && !isNewAccount && pendingCount === 0 && alerts.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#FCFBF9] border border-brand-mist/50 p-5 rounded-[24px] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-brand-terracotta/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
                
                <div className="flex items-center gap-3 relative z-10">
                   <div className="w-10 h-10 rounded-full bg-brand-white flex items-center justify-center shrink-0 border border-brand-mist shadow-sm">
                      <Zap size={16} className="text-brand-terracotta" />
                   </div>
                   <div>
                     <p className="text-sm font-serif text-brand-ink">Ative notificações no celular</p>
                     <p className="text-[11px] text-brand-stone font-light mt-0.5">Para não perder novos agendamentos.</p>
                   </div>
                </div>
                
                <div className="flex items-center gap-3 relative z-10">
                   <button
                     onClick={handleEnablePushNotifications}
                     disabled={isPushLoading}
                     className="px-6 py-2.5 bg-brand-ink text-brand-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-brand-espresso transition-all flex items-center gap-2 whitespace-nowrap shadow-sm"
                   >
                     {isPushLoading ? 'Ativando...' : 'Ativar Agora'}
                     {!isPushLoading && <CheckCircle2 size={14} />}
                   </button>
                   <button 
                     onClick={() => {
                       setPushBannerDismissed(true);
                       localStorage.setItem("nera_push_banner_dismissed", "true");
                       handleDismissTip("pushBanner");
                     }}
                     className="p-2.5 text-brand-stone hover:bg-brand-mist/20 rounded-full transition-colors focus:ring-2 ring-brand-ink/10 outline-none"
                   >
                     <X size={16} />
                   </button>
                </div>
              </motion.div>
            )}

          </div>
        )}

      </div>

      <ShareVitrineModal 
        isOpen={isShareModalOpen} 
        onClose={() => setIsShareModalOpen(false)} 
        profile={profile} 
      />

      {/* Request Details Modal */}
      <AnimatePresence>
        {isModalOpen && selectedRequest && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-brand-ink/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-brand-white rounded-[40px] overflow-hidden shadow-2xl"
            >
              <div className="p-10 sm:p-12">
                <div className="flex justify-between items-start mb-10">
                  <div>
                    <span className="text-[10px] font-medium text-brand-terracotta uppercase tracking-widest mb-2 block">Detalhes da Solicitação</span>
                    <h2 className="text-3xl font-serif text-brand-ink">{selectedRequest.clientName}</h2>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 text-brand-stone hover:text-brand-ink transition-colors">
                    <LogOut size={24} className="rotate-180" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <p className="text-[10px] text-brand-stone uppercase tracking-widest">Serviço<span className="none">{selectedRequest.additionalServices?.length ? 's' : ''}</span></p>
                      <p className="text-brand-ink font-medium">
                        {selectedRequest.additionalServices?.length > 0 
                          ? [selectedRequest.serviceName, ...selectedRequest.additionalServices.map((s:any) => s.name)].join(" • ")
                          : selectedRequest.serviceName}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-brand-stone uppercase tracking-widest">Financeiro</p>
                      <div className="flex flex-col">
                        <span className="text-brand-ink font-bold text-lg">{formatCurrency(selectedRequest.totalPrice ?? selectedRequest.finalPrice ?? (selectedRequest.price || 0))}</span>
                        <div className="flex flex-col text-[10px] text-brand-stone mt-1">
                          {selectedRequest.couponCode && selectedRequest.discountAmount > 0 ? (
                            <>
                              <span className="text-brand-terracotta bg-brand-terracotta/5 border border-brand-terracotta/20 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider w-fit mb-1">
                                Cupom {selectedRequest.couponCode} aplicado
                              </span>
                              <span className="opacity-80">Base: De <span className="line-through">{formatCurrency(selectedRequest.originalPrice || 0)}</span> por {formatCurrency(Math.max(0, (selectedRequest.originalPrice || 0) - selectedRequest.discountAmount))}</span>
                            </>
                          ) : (
                            <span className="opacity-80">Base: {formatCurrency(selectedRequest.originalPrice ?? (selectedRequest.price || 0))}</span>
                          )}
                          {selectedRequest.travelFee > 0 && <span className="opacity-80">Taxa Extra: {formatCurrency(selectedRequest.travelFee)}</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6 pt-6 border-t border-brand-mist">
                    <div className="space-y-1">
                      <p className="text-[10px] text-brand-stone uppercase tracking-widest">Data</p>
                      <p className="text-brand-ink font-light">{safeDateLabel(selectedRequest.date)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-brand-stone uppercase tracking-widest">Horário</p>
                      <p className="text-brand-ink font-light">{selectedRequest.time}</p>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-brand-mist space-y-4">
                    <p className="text-[10px] text-brand-stone uppercase tracking-widest">Logística e Local</p>
                    <div className="p-5 bg-brand-parchment rounded-[24px] border border-brand-mist shadow-inner space-y-3">
                      <div className="flex items-center gap-3">
                        {selectedRequest.locationType === 'home' ? <Home size={18} className="text-brand-terracotta" /> : <MapPin size={18} className="text-brand-terracotta" />}
                        <p className="text-brand-ink font-bold text-xs">{selectedRequest.locationType === 'home' ? 'Atendimento em Domicílio' : 'Seu Estúdio'}</p>
                      </div>
                      <p className="text-brand-stone text-xs font-light leading-relaxed pl-7">
                        {selectedRequest.locationType === 'home' 
                          ? (typeof selectedRequest.address === 'object' 
                              ? `${selectedRequest.address.street}, ${selectedRequest.address.number}${selectedRequest.address.complement ? ` - ${selectedRequest.address.complement}` : ''} - ${selectedRequest.address.neighborhood}, ${selectedRequest.address.city}${selectedRequest.address.reference ? ` (Ref: ${selectedRequest.address.reference})` : ''}`
                              : (selectedRequest.address || selectedRequest.neighborhood || 'Endereço a combinar')) 
                          : profile?.studioAddress 
                            ? `${profile.studioAddress.street}, ${profile.studioAddress.number}${profile.studioAddress.complement ? ` - ${profile.studioAddress.complement}` : ''}, ${profile.studioAddress.neighborhood} - ${profile.studioAddress.city}`
                            : 'Atendimento no seu endereço cadastrado'}
                      </p>
                      {selectedRequest.locationDetail && (
                        <p className="text-brand-terracotta text-[10px] font-medium italic pl-7">
                          Ponto de ref: {selectedRequest.locationDetail}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-brand-mist">
                    <p className="text-[10px] text-brand-stone uppercase tracking-widest mb-2">Observações da Cliente</p>
                    <div className="p-4 bg-brand-linen rounded-2xl text-xs text-brand-ink italic font-light">
                      {selectedRequest.notes ? `"${selectedRequest.notes}"` : "Nenhuma observação enviada."}
                    </div>
                  </div>

                  {/* ANTI-NO-SHOW: CLIENT SCORE & WAITLIST */}
                  <div className="pt-6 border-t border-brand-mist grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-5 bg-brand-parchment rounded-[24px] border border-brand-mist">
                       <p className="text-[10px] text-brand-stone uppercase tracking-widest mb-3">Saúde do Cliente</p>
                       <div className="flex items-center gap-3">
                         {(() => {
                           const score = getClientScore(appointments, selectedRequest.clientWhatsapp);
                           return (
                             <>
                               <div className={cn(
                                 "w-10 h-10 rounded-full flex items-center justify-center",
                                 score === 'reliable' ? "bg-green-100 text-green-600" :
                                 score === 'attention' ? "bg-amber-100 text-amber-600" :
                                 score === 'risk' ? "bg-red-100 text-red-600" : "bg-brand-linen text-brand-stone"
                               )}>
                                 <ShieldCheck size={20} />
                               </div>
                               <div>
                                  <p className="text-xs font-bold text-brand-ink">
                                    {score === 'reliable' ? 'Perfil Confiável' :
                                     score === 'attention' ? 'Em Atenção' : 
                                     score === 'risk' ? 'Alto Risco' : 'Novo Cliente'}
                                  </p>
                                  <p className="text-[9px] text-brand-stone uppercase tracking-wider">Baseado no histórico</p>
                               </div>
                             </>
                           );
                         })()}
                       </div>
                    </div>
                    
                    <button 
                      onClick={() => {
                        if (checkFeatureAccess('waitlist')) {
                          setIsWaitlistModalOpen(true);
                        }
                      }}
                      className="p-5 bg-brand-linen rounded-[24px] border border-brand-mist flex flex-col items-start gap-2 hover:bg-brand-white transition-all group"
                    >
                      <p className="text-[10px] text-brand-terracotta uppercase tracking-widest font-bold">Vaga Presa?</p>
                      <div className="flex items-center gap-2">
                         <Users size={14} className="text-brand-terracotta group-hover:scale-110 transition-transform" />
                         <span className="text-[10px] text-brand-ink uppercase tracking-widest">Avisar Lista de Espera</span>
                      </div>
                    </button>
                  </div>

                  <div className="pt-6 border-t border-brand-mist space-y-3">
                    <p className="text-[10px] text-brand-stone uppercase tracking-widest">Contato</p>
                    <div className="flex flex-col gap-2">
                      <a 
                        href={buildWhatsappLink(selectedRequest.clientWhatsapp)}
                        target="_blank"
                        className="flex items-center justify-between p-4 bg-white rounded-2xl border border-brand-mist group"
                      >
                        <div className="flex items-center gap-3">
                          <MessageCircle size={16} className="text-green-500" />
                          <span className="text-sm font-medium text-brand-ink">{selectedRequest.clientWhatsapp}</span>
                        </div>
                        <ChevronRight size={14} className="text-brand-stone group-hover:translate-x-1 transition-transform" />
                      </a>
                      {selectedRequest.clientEmail && (
                        <div className="px-4 py-2 text-xs text-brand-stone italic truncate">
                          {selectedRequest.clientEmail}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-12 flex gap-4">
                  <button 
                    onClick={() => handleRespond(selectedRequest.id, 'confirmed', selectedRequest)}
                    disabled={!!processingId}
                    className="flex-1 py-6 bg-brand-ink text-brand-white rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {processingId === selectedRequest.id ? 'Fidelizando...' : 'Confirmar Reserva'}
                  </button>
                  <button 
                    onClick={() => {
                      setRequestToReject(selectedRequest);
                      setIsConfirmRejectOpen(true);
                    }}
                    disabled={!!processingId}
                    className="flex-1 py-6 bg-brand-white border border-brand-mist text-brand-stone rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-linen transition-all disabled:opacity-50"
                  >
                    Indisponível
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rejection Confirmation Modal */}
      <AnimatePresence>
        {isConfirmRejectOpen && requestToReject && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setIsConfirmRejectOpen(false); setRequestToReject(null); }}
              className="absolute inset-0 bg-brand-ink/40 backdrop-blur-[2px]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm bg-brand-white rounded-[32px] p-8 shadow-2xl border border-brand-mist text-center"
            >
              <div className="w-16 h-16 bg-brand-terracotta/10 text-brand-terracotta rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                <X size={32} />
              </div>
              <h3 className="text-xl font-serif text-brand-ink mb-2">Confirmar recusa?</h3>
              <p className="text-sm text-brand-stone font-light mb-8 leading-relaxed">
                Tem certeza que deseja marcar como <span className="font-medium text-brand-ink">indisponível</span> esta reserva de <span className="font-medium text-brand-ink">{requestToReject.clientName}</span>? Esta ação não poderá ser desfeita.
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => handleRespond(requestToReject.id, 'cancelled_by_professional', requestToReject)}
                  disabled={processingId === requestToReject.id}
                  className="w-full py-4 bg-brand-terracotta text-brand-white rounded-2xl text-[10px] font-medium uppercase tracking-widest hover:bg-brand-sienna transition-all shadow-lg"
                >
                  {processingId === requestToReject.id ? 'Finalizando...' : 'Indisponível'}
                </button>
                <button 
                  onClick={() => { setIsConfirmRejectOpen(false); setRequestToReject(null); }}
                  className="w-full py-4 bg-brand-parchment text-brand-stone rounded-2xl text-[10px] font-medium uppercase tracking-widest hover:bg-brand-mist transition-all"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* --- WAITLIST NOTIFICATION MODAL --- */}
      <AnimatePresence>
        {isWaitlistModalOpen && (
          <div className="fixed inset-0 bg-brand-ink/40 backdrop-blur-sm z-[250] flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-brand-white w-full max-w-lg rounded-[40px] p-10 shadow-2xl border border-brand-mist relative"
            >
              <button 
                onClick={() => setIsWaitlistModalOpen(false)}
                className="absolute top-8 right-8 p-2 hover:bg-brand-parchment rounded-full text-brand-stone transition-colors"
              >
                <X size={20} />
              </button>
 
              <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-brand-linen text-brand-terracotta rounded-full flex items-center justify-center">
                    <Users size={32} />
                  </div>
                  <div>
                    <h3 className="text-3xl font-serif text-brand-ink mb-1">Lista de Espera</h3>
                    <p className="text-[10px] text-brand-stone uppercase tracking-widest font-bold">Agenda Inteligente Nera</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 bg-brand-parchment p-2 rounded-2xl border border-brand-mist shadow-inner">
                  <span className={cn("text-[9px] font-bold uppercase tracking-widest px-3", waitlistMode === 'manual' ? "text-brand-ink" : "text-brand-stone opacity-40")}>Manual</span>
                  <button 
                    onClick={toggleWaitlistMode}
                    className={cn(
                      "w-12 h-6 rounded-full relative transition-all duration-300",
                      waitlistMode === 'auto' ? "bg-brand-terracotta" : "bg-brand-mist"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm",
                      waitlistMode === 'auto' ? "left-7" : "left-1"
                    )} />
                  </button>
                  <span className={cn("text-[9px] font-bold uppercase tracking-widest px-3", waitlistMode === 'auto' ? "text-brand-terracotta" : "text-brand-stone opacity-40")}>Automático</span>
                </div>
              </div>

              {/* STATS AREA */}
              <div className="grid grid-cols-1 gap-4 mb-10 relative">
                {!features.waitlist && (
                  <div className="absolute inset-0 z-20 bg-brand-white/80 backdrop-blur-sm flex items-center justify-center rounded-[32px] border border-brand-mist border-dashed">
                    <div className="text-center p-6">
                      <Lock size={24} className="mx-auto mb-3 text-brand-terracotta" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-ink mb-1">Lista de Espera Pro</p>
                      <button 
                        onClick={() => { setIsWaitlistModalOpen(false); openUpgradeModal('waitlist'); }}
                        className="text-[9px] text-brand-terracotta underline font-bold uppercase tracking-widest mt-2"
                      >
                        Desbloquear agora
                      </button>
                    </div>
                  </div>
                )}
                <div className="p-6 bg-brand-parchment rounded-[28px] border border-brand-mist/50">
                  <p className="text-[9px] text-brand-stone uppercase tracking-widest mb-2">Vagas Disponíveis</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-serif text-brand-ink">{waitlist.length}</span>
                    <Sparkles size={16} className="text-brand-terracotta" />
                  </div>
                </div>
              </div>

              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {waitlist.length > 0 ? (
                  waitlist.map((entry) => (
                    <div key={entry.id} className="p-6 bg-brand-parchment rounded-[28px] border border-brand-mist/50 flex items-center justify-between group hover:bg-brand-white hover:shadow-md transition-all">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-bold text-brand-ink">{entry.clientName}</p>
                          {entry.status === 'invited' && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[8px] font-bold uppercase tracking-widest rounded-full animate-pulse">
                              Convidada
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-brand-stone text-[10px] uppercase tracking-widest font-medium">
                          <span>{safeDateLabel(entry.requestedDate)}</span>
                          <span>•</span>
                          <span>{entry.period === 'any' ? 'Qualquer horário' : entry.period}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a 
                          href={buildWhatsappLink(entry.clientWhatsapp)}
                          target="_blank"
                          className="w-10 h-10 flex items-center justify-center bg-brand-white text-brand-stone border border-brand-mist rounded-xl hover:text-brand-terracotta transition-all"
                        >
                          <MessageCircle size={18} />
                        </a>
                        <button 
                          onClick={() => handleInvite(entry)}
                          disabled={processingId === entry.id}
                          className="px-6 py-3 bg-brand-ink text-brand-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-terracotta transition-all shadow-sm disabled:opacity-50 flex items-center justify-center min-w-[100px]"
                        >
                          {processingId === entry.id ? 'Avisando...' : 'Convidar'}
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 bg-brand-parchment/30 rounded-[32px] border border-dashed border-brand-mist">
                    <p className="text-brand-stone text-xs italic">Ninguém aguardando por enquanto.</p>
                  </div>
                )}
              </div>

              <div className="mt-10 p-6 bg-brand-ink text-brand-white rounded-[32px] border border-white/10 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand-terracotta/20 rounded-full blur-3xl opacity-50" />
                <p className="text-[10px] font-bold text-brand-terracotta uppercase tracking-[0.3em] mb-3 relative z-10">Sempre Conectada</p>
                <p className="text-[11px] text-white/70 leading-relaxed italic relative z-10">
                  Organize interessadas e acompanhe oportunidades. Quando surgir uma vaga, você pode priorizar clientes que já estão aguardando horários futuros.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Dashboard Block Modal - Using the unified BlockAvailabilityModal */}
      <BlockAvailabilityModal 
        open={isDashboardBlockOpen}
        onClose={() => setIsDashboardBlockOpen(false)}
        selectedDate={getTodayLocale()}
        professionalId={user?.uid || ''}
        appointments={appointments}
        workingHours={profile?.workingHours as any}
      />

      <QuickBlockModal
        open={isQuickBlockOpen}
        onClose={() => setIsQuickBlockOpen(false)}
        professionalId={user?.uid || ''}
        onAdvanced={() => setIsDashboardBlockOpen(true)}
      />

      {/* 9. PRIMEIRA EXPERIÊNCIA / HINT (Se não houver bloqueios ativos) */}
      {!blockTipDismissed && (!isSupported || isSubscribed || pushBannerDismissed || isNewAccount) && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-48px)] max-w-sm md:bottom-12">
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-brand-ink text-white p-4 rounded-2xl shadow-xl border border-white/10 flex items-center gap-4 relative pr-12 cursor-pointer"
            onClick={() => setIsShareModalOpen(true)}
          >
            <div className="w-8 h-8 bg-brand-terracotta rounded-full flex items-center justify-center shrink-0">
              <Share2 size={16} />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5">Dica de Crescimento</p>
              <p className="text-[11px] text-white/70 leading-tight">Seu link oficial já está pronto. <span className="text-white font-bold">Compartilhe sua página</span> para receber clientes.</p>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                localStorage.setItem("nera_share_tip_dismissed", "true");
                setBlockTipDismissed(true);
                handleDismissTip("blockTip");
              }} 
              className="absolute top-2 right-2 p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors"
              title="Fechar dica"
            >
              <X size={14} />
            </button>
            <button onClick={() => setIsShareModalOpen(true)} className="p-2 hover:bg-white/10 rounded-full text-white/60">
              <ChevronRight size={18} />
            </button>
          </motion.div>
        </div>
      )}

      <UpgradeModal 
        open={isUpgradeModalOpen} 
        onClose={closeUpgradeModal}
        feature={upgradeFeature}
        count={usageCount}
        totalClients={totalClientsCount}
        averageTicket={financialMetrics.averageTicket}
      />

      {/* Floating Action Button for active appointment */}
      {ongoingAppt && (
        <div className="fixed bottom-[104px] right-5 md:hidden z-40">
          <motion.button
            initial={{ scale: 0, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleComplete(ongoingAppt)}
            disabled={processingId === ongoingAppt.id}
            className="h-12 px-5 bg-brand-white/95 backdrop-blur-md text-brand-ink rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-brand-mist/80 flex items-center justify-center gap-2 relative group"
          >
            <CheckCircle2 size={16} className="text-brand-terracotta" />
            <span className="text-[10px] font-bold uppercase tracking-widest pt-[1px]">Finalizar</span>
          </motion.button>
        </div>
      )}
      </PageErrorBoundary>
    </AppLayout>
  );
}

// Sub-component for Dashboard Block Flow (DEPRECATED - using unified modal above)
// removed DashboardBlockModal...
