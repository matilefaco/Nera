import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'motion/react';
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
  AlertCircle, ShieldCheck, Lock, Sun, Moon, Zap, Star, Camera, Smartphone, DollarSign, Info
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { notify } from '../lib/notify';
import { 
  formatCurrency, getTodayLocale, buildWhatsappLink, 
  generateWaitlistInviteMessage, cn, formatDateKey, parseLocalDate, cleanWhatsapp
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

const isDev = import.meta.env.DEV;
const devLog = (...args: any[]) => isDev && console.log(...args);

type DashboardTab = "hoje" | "crescimento";

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

export default function Dashboard() {
  const { user, profile } = useAuth();
  const { features, plan } = usePlanFeatures();
  
  const [activeTab, setActiveTab] = useState<DashboardTab>(() => {
    const saved = localStorage.getItem("nera_dashboard_tab");
    return saved === "hoje" || saved === "crescimento" ? saved : "hoje";
  });

  useEffect(() => {
    localStorage.setItem("nera_dashboard_tab", activeTab);
  }, [activeTab]);

  const [appointments, setAppointments] = useState<Appointment[]>([]);

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

  const [confirmedToday, setConfirmedToday] = useState<Appointment[]>([]);
  const [dailyRevenue, setDailyRevenue] = useState(0);
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
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isDashboardBlockOpen, setIsDashboardBlockOpen] = useState(false);
  const [isQuickBlockOpen, setIsQuickBlockOpen] = useState(false);
  const [insightDismissed, setInsightDismissed] = useState(false);
  const [pushBannerDismissed, setPushBannerDismissed] = useState(() => {
    return localStorage.getItem("nera_push_banner_dismissed") === "true";
  });
  const [blockTipDismissed, setBlockTipDismissed] = useState(() => {
    return localStorage.getItem("nera_block_tip_dismissed") === "true";
  });
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
      console.error('Error fetching client summaries count:', err);
    });
    return () => { isMounted = false; };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const qAlerts = query(
      collection(db, 'alerts'),
      where('professionalId', '==', user.uid),
      where('read', '==', false),
      orderBy('createdAt', 'desc')
    );

    const unsubAlerts = onSnapshot(qAlerts, (snap) => {
      try {
        const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
setAlerts(docs);
      } catch (err) {
        console.error("Error in onSnapshot callback:", err);
      }
    }, (error) => {
      console.error('[Dashboard] Subscription error on qAlerts:', error);
    });

    return () => unsubAlerts();
  }, [user]);

  const handleMarkAlertRead = async (alertId: string) => {
    try {
      await updateDoc(doc(db, 'alerts', alertId), { read: true });
    } catch (err) {
      console.error('Failed to mark alert as read:', err);
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
        console.error("Error processing getDocs callback:", err);
      }
    }).catch((error) => {
      console.error('[Dashboard] Fetch error on qAnalytics:', error);
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
      where('date', '==', today),
      orderBy('time', 'asc')
    );

    const unsubToday = onSnapshot(qToday, (snapshot) => {
      try {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Appointment));
const relevantToday = docs.filter(a => isRevenueStatus(a.status));
setConfirmedToday(relevantToday);
setDailyRevenue(calculateFinancialMetrics(relevantToday).monthlyRevenue);
      } catch (err) {
        console.error("Error in onSnapshot callback:", err);
      }
    }, (error) => {
      console.error('[Dashboard] Subscription error on qToday:', error);
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
      try {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Appointment));
setUnconfirmedTomorrow(docs);
      } catch (err) {
        console.error("Error in onSnapshot callback:", err);
      }
    }, (error) => {
      console.error('[Dashboard] Subscription error on qUnconfirmed:', error);
    });

    const todayNum = new Date();
    const firstDayLastMonth = new Date(todayNum.getFullYear(), todayNum.getMonth() - 1, 1);
    const startDateStr = formatDateKey(firstDayLastMonth);

    const thirtyDaysFromNow = new Date(todayNum);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const endDateStr = formatDateKey(thirtyDaysFromNow);

    const appointmentsCacheKey = `${user.uid}:${startDateStr}:${endDateStr}`;
    const cachedAppointments = appointmentsHistoryCache.get(appointmentsCacheKey);

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

      getDocs(qAll).then((snapshot) => {
        if (!isMounted) return;
        try {
          const appointmentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
          appointmentsHistoryCache.set(appointmentsCacheKey, { data: appointmentsData, fetchedAt: Date.now() });
          setAppointments(appointmentsData);
          // Metrics calculation moved to hook
        } catch (err) {
          console.error("Error processing getDocs callback:", err);
        }
      }).catch((error) => { 
        console.error("Firestore getDocs error:", error); 
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
      where('professionalId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubWaitlist = onSnapshot(qWaitlist, (snapshot) => {
      try {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as WaitlistEntry));
        setWaitlist(docs.filter(doc => ['waiting', 'invited'].includes(doc.status)));
      } catch (err) {
        console.error("Error in onSnapshot callback:", err);
      }
    }, (error) => {
      console.error('[Dashboard] Subscription error on qWaitlist:', error);
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
        console.error("Error processing getDocs callback:", err);
      }
    }).catch((error) => { console.error('[Dashboard] Fetch error on qBlocked:', error); });

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
        console.error("Error processing getDocs callback:", err);
      }
    }).catch((error) => {
      console.error('[Dashboard] Fetch error on qInactive:', error);
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
        console.error("Error processing getDocs callback:", err);
      }
    }).catch((error) => { console.error("Firestore getDocs error:", error); });

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
        console.error("Error processing getDocs callback:", err);
      }
    }).catch((error) => {
      console.error('[Dashboard] Fetch error on qWl:', error);
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
        notify.success(`Reserva confirmada! ID: ${id}`);
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
        
        notify.success('Reserva marcada como indisponível.');
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
      console.error("[DASHBOARD FLOW ERROR]", error);
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
        if (import.meta.env.DEV) console.warn('Appointment without valid time found:', appt.id);
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
      console.log("[PUSH UI] Notification supported:", "Notification" in window);
      console.log("[PUSH UI] ServiceWorker supported:", "serviceWorker" in navigator);
      console.log("[PUSH UI] PushManager supported:", "PushManager" in window);
      if ("Notification" in window) {
        console.log("[PUSH UI] permission:", Notification.permission);
      }
    }
  }, []);

  const handleEnablePushNotifications = async () => {
    try {
      if (import.meta.env.DEV) console.log("[PUSH BUTTON] clicked");
      setIsPushLoading(true);
      
      const success = await requestPermission();
      if (import.meta.env.DEV) console.log("[PUSH BUTTON] requestPermission finished. Success:", success);

      if (success) {
        notify.success('Notificações ativadas com sucesso!');
      } else if (Notification.permission === 'denied') {
        notify.error('Notificações bloqueadas no navegador. Ative as permissões nas configurações do site.');
      }
    } catch (error: any) {
      console.error("[PUSH BUTTON ERROR]", error);
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
      notify.success('Relatório gerado com sucesso!');
    } catch (error: any) {
      console.error("[REPORT ERROR]", error);
      notify.error(error, 'Erro ao baixar relatório. Tente novamente.');
    } finally {
      setIsReportLoading(false);
    }
  };

  if (isInitialLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <AppLayout activeRoute="dashboard">
      <PageErrorBoundary 
        title="Não foi possível carregar este painel." 
        message="Tivemos um contratempo ao gerar suas métricas. Recarregar costuma resolver."
      >
      <FirstVisitTip 
        pageKey="dashboard"
        title="Sua central de operações"
        description="Aqui você vê todos os agendamentos, receita e ações rápidas. Tudo que você precisa para o dia a dia está nesta página."
      />
      <div className="p-6 md:p-12 pb-[calc(140px+env(safe-area-inset-bottom))] md:pb-16 max-w-2xl mx-auto w-full space-y-10">
        
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
              to="/perfil" 
              className="px-4 py-2 bg-white border border-yellow-200 rounded-full text-[9px] font-bold uppercase tracking-widest text-brand-ink hover:bg-yellow-100 transition-all shrink-0"
            >
              Atualizar Perfil
            </Link>
          </motion.div>
        )}

        {/* Soft Upgrade CTA for Free Plan */}
        {plan === 'free' && usageCount >= 10 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-brand-linen/50 border border-brand-mist p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm"
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-stone mb-2">Sucesso na Agenda</p>
              <h2 className="text-xl font-serif text-brand-ink mb-1">Você recebeu {usageCount} reservas este mês.</h2>
              <p className="text-sm text-brand-stone/80">Profissionais em crescimento normalmente migram para o Essencial para continuar recebendo reservas ilimitadas.</p>
            </div>
            <Link 
              to="/planos" 
              className="px-6 py-3 bg-brand-ink text-brand-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-brand-stone transition-all shrink-0 text-center"
            >
              Ver Planos
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
                <span className={cn(
                  "text-[9px] uppercase tracking-[0.2em] font-bold px-2 py-0.5 rounded flex items-center",
                  plan === 'pro' || plan === 'essencial' 
                    ? "text-brand-ink bg-brand-linen border border-brand-mist/50" 
                    : "text-brand-stone bg-brand-mist/10 border border-brand-mist/30"
                )}>
                  Plano {
                    plan === 'pro' ? 'Pro' : 
                    plan === 'essencial' ? 'Essencial' : 
                    'Gratuito'
                  }
                </span>
                {(plan === 'free') && (
                  <Link to="/planos" className="text-[10px] text-brand-terracotta hover:text-brand-sienna transition-colors font-medium relative top-[-1px]">
                    Upgrade
                  </Link>
                )}
                <span className="text-brand-mist text-[10px] hidden sm:inline">|</span>
                <p className="text-[12px] text-brand-stone font-light hidden sm:block">
                  <strong className="font-medium text-brand-ink">{appointments.filter(a => {
                    if (!a.date) return false;
                    const d = safeParseLocalDate(a.date);
                    if (!d) return false;
                    const now = new Date();
                    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                  }).length}</strong> atendimentos no mês
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 hide-scrollbar pt-4 md:pt-0">
            <button 
              onClick={() => setIsQuickBlockOpen(true)}
              className="flex flex-1 md:flex-none justify-center items-center gap-2 px-4 py-2 border border-brand-mist/80 bg-brand-white text-brand-ink rounded-[12px] text-[9px] font-bold uppercase tracking-widest hover:bg-brand-linen transition-colors shadow-none whitespace-nowrap"
            >
              <Lock size={12} className="text-brand-stone/80" /> Bloquear
            </button>
            <button 
              onClick={() => setIsShareModalOpen(true)}
              className="flex flex-1 md:flex-none justify-center items-center gap-2 px-5 py-2 bg-brand-ink text-brand-white rounded-[12px] text-[9px] font-bold uppercase tracking-widest hover:bg-brand-ink/90 transition-colors shadow-sm whitespace-nowrap"
            >
              <Share2 size={12} /> Link direto
            </button>
          </div>
        </header>

        {/* DASHBOARD TABS */}
        <div className="flex bg-[#FAF9F8] p-1.5 rounded-xl border border-brand-mist/30 text-[10px] font-bold uppercase tracking-widest w-full md:w-fit overflow-x-auto hide-scrollbar">
          <button 
            onClick={() => setActiveTab("hoje")}
            className={cn(
              "px-5 py-2.5 rounded-lg transition-all flex items-center gap-2 relative whitespace-nowrap",
              activeTab === "hoje" ? "bg-white shadow-sm text-brand-ink border border-brand-mist/40" : "text-brand-stone/80 hover:text-brand-ink"
            )}
          >
            Hoje
            {pendingCount > 0 && (
              <span className="flex items-center justify-center min-w-[14px] h-[14px] px-1 bg-red-500 text-white rounded-full text-[8px] font-bold animate-pulse">
                {pendingCount}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab("crescimento")}
            className={cn(
              "px-5 py-2.5 rounded-lg transition-all flex items-center gap-2 relative whitespace-nowrap",
              activeTab === "crescimento" ? "bg-white shadow-sm text-brand-ink border border-brand-mist/40" : "text-brand-stone/80 hover:text-brand-ink"
            )}
          >
            Crescimento
            {inactiveClientsCount > 0 && (
              <span className="w-1.5 h-1.5 bg-brand-terracotta rounded-full" />
            )}
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
              <section className="bg-brand-white p-6 md:p-8 rounded-[32px] border border-brand-mist shadow-sm flex flex-col gap-6 relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-brand-linen pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand-linen text-brand-ink rounded-xl">
                      <TrendingUp size={16} />
                    </div>
                    <div>
                      <h3 className="text-[9px] font-bold uppercase tracking-[0.3em] text-brand-stone mb-1 flex items-center">
                        Performance
                      </h3>
                      <p className="text-xs font-serif text-brand-ink italic">Resultados da vitrine</p>
                    </div>
                  </div>
                  <div className="flex bg-brand-linen p-1 rounded-full text-[8px] font-bold uppercase tracking-widest">
                    <span className="px-3 py-1 bg-brand-white rounded-full shadow-sm text-brand-ink">Últimos 30 dias</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-6">
                  <div className="space-y-1">
                    <p className="text-[8px] font-bold uppercase tracking-widest text-brand-stone">Visitas na vitrine</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-xl font-serif text-brand-ink">{growthMetrics.visits30d}</p>
                      <span className="text-[8px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">+{growthMetrics.visits7d} na semana</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-bold uppercase tracking-widest text-brand-stone">Cliques em Reservar</p>
                    <p className="text-xl font-serif text-brand-ink">{growthMetrics.clicksBook}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-[8px] font-bold uppercase tracking-widest text-brand-stone">Taxa de Conversão</p>
                    {features.advancedDashboard ? (
                      <p className="text-xl font-serif text-brand-ink">{growthMetrics.convRate.toFixed(1)}%</p>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="text-xl font-serif text-brand-mist">---</p>
                        <Lock size={10} className="text-brand-mist" />
                      </div>
                    )}
                  </div>
                </div>

                {/* BLOCO ÚNICO "Growth Pro" */}
                {!features.advancedDashboard ? (
                  <div className="mt-2 bg-brand-parchment/60 p-5 rounded-[20px] border border-brand-mist/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                        <Sparkles size={18} className="text-brand-terracotta" />
                      </div>
                      <div>
                         <h4 className="text-sm font-serif text-brand-ink mb-0.5">Growth Pro</h4>
                         <p className="text-[10px] text-brand-stone font-light italic max-w-[280px]">
                           Descubra origem das clientes, serviço campeão e melhores horários.
                         </p>
                      </div>
                    </div>
                    <Link to="/planos" className="w-full sm:w-auto mt-2 sm:mt-0">
                      <PremiumButton variant="terracotta" className="w-full text-[9px] py-3 px-6 flex items-center justify-center gap-2">
                        Ver planos <ChevronRight size={12} />
                      </PremiumButton>
                    </Link>
                  </div>
                ) : (
                   /* Growth Pro Desbloqueado */
                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-brand-linen mt-2">
                     {/* Origem Principal */}
                     <div className="p-4 bg-brand-parchment/30 rounded-2xl border border-brand-mist/50 text-center">
                       <p className="text-[8px] font-bold uppercase tracking-widest text-brand-stone mb-1">Origem Principal</p>
                       <p className="text-xs font-serif text-brand-ink">{growthMetrics.mainOrigin}</p>
                     </div>
                     {/* Serviço Campeão */}
                     <div className="p-4 bg-brand-parchment/30 rounded-2xl border border-brand-mist/50 text-center">
                        <p className="text-[8px] font-bold uppercase tracking-widest text-brand-stone mb-1">Serviço Campeão</p>
                        <p className="text-xs font-serif text-brand-ink truncate px-2">{growthMetrics.topService}</p>
                     </div>
                     {/* Horário + Vendido */}
                     <div className="p-4 bg-brand-parchment/30 rounded-2xl border border-brand-mist/50 text-center">
                        <p className="text-[8px] font-bold uppercase tracking-widest text-brand-stone mb-1">Melhor Horário</p>
                        <p className="text-xs font-serif text-brand-ink">{growthMetrics.bestTime}</p>
                     </div>
                   </div>
                )}
                
                {/* AI Insights - Apenas se for Pro e não tiver fechado */}
                <AnimatePresence>
                  {features.advancedDashboard && !insightDismissed && (
                    <motion.div 
                      key="growth-insight"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-brand-linen/40 p-4 rounded-2xl border border-brand-mist/30 flex items-start gap-3 overflow-hidden relative mt-2"
                    >
                      <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-brand-terracotta shrink-0 shadow-sm border border-brand-mist/20">
                        <Zap size={16} />
                      </div>
                      <div className="flex-1 pr-6">
                        <h4 className="text-[10px] font-bold text-brand-ink uppercase tracking-widest mb-1">Dica de Performance</h4>
                        <p className="text-[11px] text-brand-stone font-light leading-relaxed italic">
                          {growthMetrics.growthInsight}
                        </p>
                      </div>
                      <button 
                        onClick={() => setInsightDismissed(true)}
                        className="absolute top-4 right-4 p-1 text-brand-stone hover:text-brand-ink"
                      >
                        <X size={12} />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
                
              </section>
            )}
          </div>
        )}



        {/* HOJE SIMPLE VIEW */}
        {activeTab === "hoje" && (
          <div className="flex flex-col gap-8">
            {/* Notificações Banner */}
            {!isSubscribed && !pushBannerDismissed && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-brand-ink p-8 rounded-[40px] shadow-xl relative overflow-hidden group"
              >
                {/* Visual Background Element */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-terracotta/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-brand-terracotta/20 transition-colors" />
                
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-brand-terracotta/20 text-brand-terracotta rounded-2xl flex items-center justify-center shrink-0">
                      <Zap size={28} />
                    </div>
                    <div>
                      <h4 className="text-base font-serif text-brand-white">Ative notificações no celular</h4>
                      <p className="text-xs text-white/60 font-light italic mt-1 leading-relaxed">
                        Saiba instantaneamente quando chegar uma nova reserva, mesmo com o app fechado.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                    <button
                      onClick={handleEnablePushNotifications}
                      disabled={isPushLoading}
                      className="w-full sm:w-auto px-8 py-4 bg-brand-terracotta text-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-brand-sienna transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      {isPushLoading ? 'Ativando...' : 'Ativar notificações'}
                      {!isPushLoading && <CheckCircle2 size={14} />}
                    </button>
                    <button 
                      onClick={() => {
                        setPushBannerDismissed(true);
                        localStorage.setItem("nera_push_banner_dismissed", "true");
                      }}
                      className="text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors"
                    >
                      Depois
                    </button>
                  </div>
                </div>
              </motion.div>
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
                          {alert.clientName} cancelou {alert.serviceName} às {alert.scheduledTime}. 
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
                className="bg-brand-linen/40 px-5 py-4 rounded-[20px] border border-brand-mist/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 group hover:border-brand-mist transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-brand-terracotta/80 shrink-0" />
                  <p className="text-[13px] font-serif text-brand-ink">
                    <span className="font-medium text-brand-terracotta">{pendingCount} {pendingCount === 1 ? 'novo pedido' : 'pedidos pendentes'}</span> na fila de confirmação
                  </p>
                </div>
                <Link to="/pedidos" className="w-fit ml-5 sm:ml-0 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-brand-terracotta hover:text-brand-sienna transition-colors py-1">
                  Avaliar <ChevronRight size={12} className="text-brand-terracotta/50 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </motion.div>
            )}

            {/* Resumo Financeiro Hoje / Day 1 Activation */}
            {appointments.length === 0 && pendingCount === 0 && (!totalClientsCountFromSummaries || totalClientsCountFromSummaries === 0) ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-brand-white p-8 md:p-12 rounded-[40px] border border-brand-mist shadow-xl relative overflow-hidden group mb-2"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-linen rounded-full blur-3xl opacity-60 -mr-20 -mt-20 pointer-events-none transition-opacity group-hover:opacity-80" />
                <div className="relative z-10 max-w-lg">
                  <div className="w-16 h-16 bg-brand-ink text-brand-white rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                    <Sparkles size={32} />
                  </div>
                  <h4 className="text-3xl md:text-4xl font-serif text-brand-ink mb-3 leading-tight">Seu espaço está pronto.</h4>
                  <p className="text-sm text-brand-stone italic mb-8 leading-relaxed">
                    Tudo configurado! O próximo passo é deixar suas clientes encontrarem você. Compartilhe seu link exclusivo e comece a receber pedidos diretamente na sua Nera.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-4">
                    <button 
                      onClick={() => setIsShareModalOpen(true)} 
                      className="w-full sm:w-auto px-8 py-4 bg-brand-ink text-brand-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-lg flex items-center justify-center gap-2 group-hover:bg-brand-espresso"
                    >
                      <Share2 size={16} /> Divulgar agenda
                    </button>
                    <Link 
                      to="/profile" 
                      className="w-full sm:w-auto px-8 py-4 bg-brand-parchment border border-brand-mist text-brand-ink rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-brand-linen transition-all flex items-center justify-center gap-2"
                    >
                      Ver meu perfil
                    </Link>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="bg-[#FAF9F8] p-5 rounded-2xl border border-brand-mist/50">
                {displayedConfirmedToday.length === 0 && (
                  <div className="mb-4 pb-4 border-b border-brand-mist/40">
                    <p className="text-[14px] font-serif text-brand-stone italic">Dia tranquilo até agora — vamos preencher?</p>
                    {daysSinceLastAppointment !== null && daysSinceLastAppointment > 0 && (
                      <p className="text-[9px] font-bold uppercase tracking-widest text-brand-stone/60 mt-2">
                        Último agendamento há {daysSinceLastAppointment} {daysSinceLastAppointment === 1 ? 'dia' : 'dias'}
                      </p>
                    )}
                  </div>
                )}
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                  <div className="flex items-center gap-5 md:gap-8 overflow-x-auto hide-scrollbar">
                    <div className="flex-none">
                      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand-stone/80 mb-1.5">Faturamento Hoje</p>
                      <p className="text-[22px] md:text-2xl leading-none font-serif text-brand-ink tracking-tight">{formatCurrency(displayedDailyRevenue)}</p>
                    </div>
                    <div className="w-px h-8 bg-brand-mist/60 shrink-0" />
                    <div className="flex-none">
                      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand-stone/80 mb-1.5">Agendamentos</p>
                      <p className="text-[22px] md:text-2xl leading-none font-serif text-brand-ink tracking-tight">{displayedConfirmedToday.length}</p>
                    </div>
                  </div>
                  
                  <Link to="/financeiro" className="mt-2 md:mt-0 pt-4 md:pt-0 border-t border-brand-mist/40 md:border-0 w-full md:w-auto shrink-0">
                    <button className="w-full md:w-auto px-5 py-2.5 bg-brand-white text-brand-ink border border-brand-mist/60 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-[#F2EFEA] hover:border-brand-mist transition-all flex items-center justify-center gap-2 group shadow-sm">
                      Ver financeiro <span className="transform transition-transform text-brand-stone group-hover:translate-x-0.5 group-hover:text-brand-ink">→</span>
                    </button>
                  </Link>
                </div>
              </div>
            )}

            {/* Timeline de Hoje */}
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
                        "bg-brand-white px-5 py-4 md:px-6 md:py-5 rounded-[24px] border border-brand-mist shadow-sm flex items-center justify-between group hover:border-brand-mist/80 transition-colors",
                        isCompletedStatus(appt.status) && "bg-brand-linen/40 border-dashed shadow-none"
                      )}
                    >
                      <div className="flex items-center gap-4 md:gap-5 w-full">
                        <div className="text-center min-w-[48px] shrink-0">
                          <p className={cn("text-[17px] font-serif font-bold leading-none", isCompletedStatus(appt.status) ? "text-brand-stone opacity-60" : "text-brand-ink")}>{appt.time}</p>
                        </div>
                        <div className="h-8 w-px bg-brand-mist/60 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className={cn("text-[13px] font-bold truncate", isCompletedStatus(appt.status) ? "text-brand-stone opacity-60" : "text-brand-ink")}>{appt.clientName}</h4>
                            {isCompletedStatus(appt.status) && <CheckCircle2 size={12} className="text-brand-stone opacity-50 shrink-0" />}
                          </div>
                          <p className="text-[11px] text-brand-stone italic truncate leading-tight pr-2 mt-0.5">{appt.serviceName}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1.5 shrink-0 pl-2">
                        {isConfirmedLikeStatus(appt.status) && isPastTime(appt.time) && (
                          <button
                            onClick={() => handleComplete(appt)}
                            disabled={processingId === appt.id}
                            className="flex items-center gap-1 px-3 py-1.5 bg-brand-parchment/60 border border-brand-mist/50 text-brand-terracotta rounded-full text-[9px] font-bold uppercase tracking-widest hover:bg-brand-linen transition-colors active:scale-95 whitespace-nowrap"
                          >
                            {processingId === appt.id ? "..." : "Finalizar"}
                          </button>
                        )}
                        <Link to="/agenda" className="p-2 text-brand-mist hover:text-brand-terracotta transition-colors">
                          <ChevronRight size={16} />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-brand-white p-12 rounded-[40px] border border-brand-mist border-dashed text-center">
                  <h4 className="font-serif text-2xl text-brand-ink mb-2">Hoje ainda está livre</h4>
                  <p className="text-brand-stone italic text-sm mb-8">Aproveite para movimentar sua agenda:</p>
                  
                  <div className="flex flex-col gap-3 max-w-xs mx-auto">
                    <button 
                      onClick={() => setIsShareModalOpen(true)}
                      className="w-full py-4 bg-brand-ink text-brand-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-md group"
                    >
                      Atrair clientes agora →
                    </button>
                    <Link 
                      to="/clients"
                      className="w-full py-4 bg-brand-linen text-brand-ink rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-brand-mist transition-all text-center"
                    >
                      Ver clientes
                    </Link>
                    <Link 
                      to="/services"
                      className="w-full py-4 bg-brand-white border border-brand-mist text-brand-ink rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-brand-linen transition-all text-center"
                    >
                      Criar serviço
                    </Link>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

      </div>

      {/* --- SHARE VITRINE MODAL --- */}
      <AnimatePresence>
        {isShareModalOpen && (
          <div className="fixed inset-0 bg-brand-ink/40 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-brand-white w-full max-w-md rounded-[40px] p-8 shadow-2xl border border-brand-mist relative"
            >
              <button 
                onClick={() => setIsShareModalOpen(false)}
                className="absolute top-6 right-6 p-2 hover:bg-brand-parchment rounded-full text-brand-stone transition-colors"
              >
                <X size={20} />
              </button>

              <div className="text-center mb-10">
                <div className="w-16 h-16 bg-brand-linen text-brand-terracotta rounded-full flex items-center justify-center mx-auto mb-6">
                  <Share2 size={32} />
                </div>
                <h3 className="text-2xl font-serif text-brand-ink mb-2">Compartilhar minha Vitrine</h3>
                <p className="text-sm text-brand-stone font-light">Transforme cada acesso em um possível agendamento.</p>
              </div>

              <div className="space-y-4">
                <button 
                  onClick={() => {
                    const url = getPublicProfileUrl(profile?.slug);
                    const text = `Acabei de abrir novos horários ✨ Reserve online comigo: ${url}`;
                    window.open(buildWhatsappLink('', text), '_blank');
                    setIsShareModalOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-5 bg-brand-parchment rounded-[24px] hover:bg-brand-white border border-transparent hover:border-brand-mist transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-brand-white rounded-xl flex items-center justify-center text-brand-terracotta group-hover:scale-110 transition-transform">
                      <MessageCircle size={20} />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-semibold text-brand-ink uppercase tracking-widest">WhatsApp</p>
                      <p className="text-[10px] text-brand-stone font-medium uppercase tracking-widest">Enviar para meus contatos</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-brand-mist" />
                </button>

                <button 
                  onClick={() => {
                    const url = getPublicProfileUrl(profile?.slug);
                    navigator.clipboard.writeText(url);
                    notify.success('Link copiado. Abra o Instagram e cole nos seus Stories!');
                    setIsShareModalOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-5 bg-brand-parchment rounded-[24px] hover:bg-brand-white border border-transparent hover:border-brand-mist transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-brand-white rounded-xl flex items-center justify-center text-brand-terracotta group-hover:scale-110 transition-transform">
                      <Instagram size={20} />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-semibold text-brand-ink uppercase tracking-widest">Instagram Stories</p>
                      <p className="text-[10px] text-brand-stone font-medium uppercase tracking-widest">Copiar link para o sticker</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-brand-mist" />
                </button>

                <button 
                  onClick={() => {
                    const url = getPublicProfileUrl(profile?.slug);
                    navigator.clipboard.writeText(url);
                    notify.success('Link copiado para a área de transferência.');
                    setIsShareModalOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-5 bg-brand-parchment rounded-[24px] hover:bg-brand-white border border-transparent hover:border-brand-mist transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-brand-white rounded-xl flex items-center justify-center text-brand-stone group-hover:scale-110 transition-transform">
                      <Copy size={20} />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-semibold text-brand-ink uppercase tracking-widest">Copiar Link</p>
                      <p className="text-[10px] text-brand-stone font-medium uppercase tracking-widest">Link direto da vitrine</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-brand-mist" />
                </button>
              </div>

              <div className="mt-8 p-5 bg-brand-linen/30 rounded-[24px] border border-brand-mist/50">
                <p className="text-[10px] font-bold text-brand-terracotta uppercase tracking-[0.2em] mb-2">Sugestão de texto:</p>
                <p className="text-xs text-brand-ink font-light italic">
                  "Acabei de abrir novos horários ✨ Reserve online comigo: {getPublicProfileUrl(profile?.slug)}"
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                      <p className="text-[10px] text-brand-stone uppercase tracking-widest">Serviço</p>
                      <p className="text-brand-ink font-medium">{selectedRequest.serviceName}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-brand-stone uppercase tracking-widest">Financeiro</p>
                      <div className="flex flex-col">
                        <span className="text-brand-ink font-bold text-lg">{formatCurrency((selectedRequest.finalPrice ?? (selectedRequest.price || 0)) + (selectedRequest.travelFee || 0))}</span>
                        <div className="flex flex-col text-[10px] text-brand-stone mt-1">
                          {selectedRequest.couponCode && selectedRequest.discountAmount > 0 ? (
                            <>
                              <span className="text-brand-terracotta bg-brand-terracotta/5 border border-brand-terracotta/20 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider w-fit mb-1">
                                Cupom {selectedRequest.couponCode} aplicado
                              </span>
                              <span className="opacity-80">Base: De <span className="line-through">{formatCurrency(selectedRequest.originalPrice || 0)}</span> por {formatCurrency(selectedRequest.finalPrice ?? (selectedRequest.price || 0))}</span>
                            </>
                          ) : (
                            <span className="opacity-80">Base: {formatCurrency(selectedRequest.price || 0)}</span>
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

                  {selectedRequest.notes && (
                    <div className="pt-6 border-t border-brand-mist">
                      <p className="text-[10px] text-brand-stone uppercase tracking-widest mb-2">Observações da Cliente</p>
                      <div className="p-4 bg-brand-linen rounded-2xl text-xs text-brand-ink italic font-light">
                        "{selectedRequest.notes}"
                      </div>
                    </div>
                  )}

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
                    
                    {features.waitlist && (
                      <button 
                        onClick={() => setIsWaitlistModalOpen(true)}
                        className="p-5 bg-brand-linen rounded-[24px] border border-brand-mist flex flex-col items-start gap-2 hover:bg-brand-white transition-all group"
                      >
                        <p className="text-[10px] text-brand-terracotta uppercase tracking-widest font-bold">Vaga Presa?</p>
                        <div className="flex items-center gap-2">
                           <Users size={14} className="text-brand-terracotta group-hover:scale-110 transition-transform" />
                           <span className="text-[10px] text-brand-ink uppercase tracking-widest">Avisar Lista de Espera</span>
                        </div>
                      </button>
                    )}
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
                <p className="text-[10px] font-bold text-brand-terracotta uppercase tracking-[0.3em] mb-3 relative z-10">Eficiência Automática</p>
                <p className="text-[11px] text-white/70 leading-relaxed italic relative z-10">
                  No modo <strong>Automático</strong>, o Nera envia um convite por WhatsApp assim que uma vaga compatível surge. A primeira a aceitar fica com o horário — sem você precisar mover um dedo.
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
      {!blockTipDismissed && blockedSchedules.length === 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-48px)] max-w-sm md:bottom-12">
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-brand-ink text-white p-4 rounded-2xl shadow-xl border border-white/10 flex items-center gap-4 relative pr-12"
          >
            <div className="w-8 h-8 bg-brand-terracotta rounded-full flex items-center justify-center shrink-0">
              <Lock size={16} />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5">Dica Profissional</p>
              <p className="text-[11px] text-white/70 leading-tight">Vai viajar ou descansar? Use o <span className="text-white font-bold">Bloquear Agenda</span> para evitar reservas indevidas.</p>
            </div>
            <button 
              onClick={() => {
                localStorage.setItem("nera_block_tip_dismissed", "true");
                setBlockTipDismissed(true);
              }} 
              className="absolute top-2 right-2 p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors"
              title="Fechar dica"
            >
              <X size={14} />
            </button>
            <button onClick={() => setIsQuickBlockOpen(true)} className="p-2 hover:bg-white/10 rounded-full text-white/60">
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
