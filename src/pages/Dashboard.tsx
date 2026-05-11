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
import { getClientScore } from '../lib/clientUtils';
import HelpTooltip from '../components/HelpTooltip';
import Logo from '../components/Logo';
import { Appointment, WaitlistEntry, BlockedSchedule, AnalyticsEvent, Service, WhatsAppLog } from '../types';
import { isRevenueStatus, isPendingStatus, isCompletedStatus, isConfirmedLikeStatus } from '../constants/appointmentStatus';
import { AnimatePresence } from 'motion/react';
import AppLayout from '../components/AppLayout';
import { ActivationChecklist } from '../components/ActivationChecklist';
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

type DashboardTab = "hoje" | "geral" | "insights" | "divulgacao";

export default function Dashboard() {
  const { user, profile } = useAuth();
  const { features, plan } = usePlanFeatures();
  
  const [activeTab, setActiveTab] = useState<DashboardTab>(() => {
    const saved = localStorage.getItem("nera_dashboard_tab");
    return saved === "hoje" || saved === "geral" || saved === "insights" || saved === "divulgacao" ? saved : "hoje";
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
    return displayedConfirmedToday.reduce((acc, curr) => acc + (curr.price || 0) + (curr.travelFee || 0), 0);
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
    growthMetrics
  } = useDashboardMetrics(appointments, analyticsEvents, totalClientsCountFromSummaries);
  const [inactiveClientsCount, setInactiveClientsCount] = useState(0);
  const [inactiveClients, setInactiveClients] = useState<any[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [whatsappLogs, setWhatsappLogs] = useState<WhatsAppLog[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const qCount = query(
      collection(db, 'client_summaries'),
      where('professionalId', '==', user.uid)
    );
    getCountFromServer(qCount).then(snap => {
      setTotalClientsCountFromSummaries(snap.data().count);
    }).catch(err => {
      console.error('Error fetching client summaries count:', err);
    });
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

    const qAnalytics = query(
      collection(db, 'analytics_events'),
      where('professionalId', '==', user.uid),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    getDocs(qAnalytics).then((snapshot) => {
      try {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as AnalyticsEvent));
        setAnalyticsEvents(docs);
      } catch (err) {
        console.error("Error processing getDocs callback:", err);
      }
    }).catch((error) => {
      console.error('[Dashboard] Fetch error on qAnalytics:', error);
    });
  }, [user]);






  const getContextualTip = () => {
    if (pendingCount > 0) return `Você tem ${pendingCount} reserva${pendingCount > 1 ? 's' : ''} aguardando confirmação.`;
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
setDailyRevenue(relevantToday.reduce((acc, curr) => acc + (curr.price || 0) + (curr.travelFee || 0), 0));
      } catch (err) {
        console.error("Error in onSnapshot callback:", err);
      }
    }, (error) => {
      console.error('[Dashboard] Subscription error on qToday:', error);
    });

    // Query: Unconfirmed for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

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
    const startDateStr = firstDayLastMonth.toISOString().split('T')[0];

    const thirtyDaysFromNow = new Date(todayNum);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const endDateStr = thirtyDaysFromNow.toISOString().split('T')[0];

    // Query: Historical and upcoming appointments to calculate metrics
    const qAll = query(
      collection(db, 'appointments'),
      where('professionalId', '==', user.uid),
      where('date', '>=', startDateStr),
      where('date', '<=', endDateStr),
      orderBy('date', 'desc')
    );

    getDocs(qAll).then((snapshot) => {
      try {
        const appointmentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
        setAppointments(appointmentsData);
        // Metrics calculation moved to hook
      } catch (err) {
        console.error("Error processing getDocs callback:", err);
      }
    }).catch((error) => { 
      console.error("Firestore getDocs error:", error); 
    }).finally(() => {
      setIsInitialLoading(false);
    });

    // Sync Profile Settings
    if (profile) {
      setWaitlistMode(profile.waitlistMode || 'manual');
      
      if (profile.referralCode) {
        const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
        setReferralLink(`${appUrl}/register?ref=${profile.referralCode}`);
      }
    }

    // Query: Waitlist
    const qWaitlist = query(
      collection(db, 'waitlist'),
      where('professionalId', '==', user.uid),
      where('status', 'in', ['waiting', 'invited']),
      orderBy('createdAt', 'desc')
    );

    const unsubWaitlist = onSnapshot(qWaitlist, (snapshot) => {
      try {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as WaitlistEntry));
setWaitlist(docs);
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
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const qInactive = query(
      collection(db, 'client_summaries'),
      where('professionalId', '==', user.uid),
      where('lastAppointmentDate', '<', thirtyDaysAgoStr),
      orderBy('lastAppointmentDate', 'desc'),
      limit(20)
    );

    getDocs(qInactive).then((snapshot) => {
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
      unsubToday();
      unsubUnconfirmed();
      unsubWaitlist();
    };
  }, [user, profile]);

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
      <div className="p-6 md:p-12 pb-32 max-w-2xl mx-auto w-full space-y-10">
        
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
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif text-brand-ink">
              Olá, {safeString(profile?.name).split(' ')[0]} ✨
            </h1>
            <div className="flex flex-col mt-1">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full",
                  plan === 'pro' || plan === 'essencial' 
                    ? "text-green-600 bg-green-50 border border-green-200" 
                    : "text-brand-stone"
                )}>
                  Plano {
                    plan === 'pro' ? 'Pro' : 
                    plan === 'essencial' ? 'Essencial' : 
                    'Gratuito'
                  }
                </span>
                {(plan === 'free') && (
                  <Link to="/planos" className="text-[9px] text-brand-terracotta border border-brand-terracotta/20 px-2 py-0.5 rounded-full hover:bg-brand-terracotta hover:text-white transition-all uppercase tracking-widest font-bold">
                    Upgrade
                  </Link>
                )}
              </div>
              <p className="text-[11px] text-brand-stone font-medium mt-1">
                Você recebeu {appointments.filter(a => {
                  if (!a.date) return false;
                  const d = safeParseLocalDate(a.date);
                  if (!d) return false;
                  const now = new Date();
                  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                }).length} agendamentos este mês ✨
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsQuickBlockOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-parchment text-brand-ink border border-brand-mist rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-brand-linen transition-all shadow-sm"
            >
              <Lock size={14} className="text-brand-terracotta" /> Bloquear Agenda
            </button>
            <button 
              onClick={() => setIsShareModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-linen text-brand-terracotta rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-brand-parchment transition-all"
            >
              <Share2 size={14} /> Link profissional
            </button>
          </div>
        </header>

        {/* DASHBOARD TABS */}
        <div className="flex bg-brand-linen p-1 rounded-full text-[9px] font-bold uppercase tracking-widest w-fit">
          <button 
            onClick={() => setActiveTab("hoje")}
            className={cn(
              "px-5 py-2 rounded-full transition-all flex items-center gap-2 relative",
              activeTab === "hoje" ? "bg-white shadow-sm text-brand-ink" : "text-brand-stone"
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
            onClick={() => setActiveTab("geral")}
            className={cn(
              "px-5 py-2 rounded-full transition-all flex items-center gap-2 relative",
              activeTab === "geral" ? "bg-white shadow-sm text-brand-ink" : "text-brand-stone"
            )}
          >
            Geral
            {inactiveClientsCount > 0 && (
              <span className="w-1.5 h-1.5 bg-brand-terracotta rounded-full" />
            )}
          </button>
          <button 
            onClick={() => setActiveTab("divulgacao")}
            className={cn(
              "px-5 py-2 rounded-full transition-all flex items-center gap-2",
              activeTab === "divulgacao" ? "bg-white shadow-sm text-brand-ink" : "text-brand-stone"
            )}
          >
            Divulgação
          </button>
          <button 
            onClick={() => setActiveTab("insights")}
            className={cn(
              "px-5 py-2 rounded-full transition-all flex items-center gap-2",
              activeTab === "insights" ? "bg-white shadow-sm text-brand-ink" : "text-brand-stone"
            )}
          >
            Insights
          </button>
        </div>

        {/* INSIGHTS CONTENT */}
        {activeTab === "insights" && (
          <div className="flex flex-col gap-8">
            {/* Componente Interno para Métricas Bloqueadas */}
            {(() => {
              const LockedMetric = ({ value, label, locked, icon: Icon }: { value: any, label: string, locked: boolean, icon?: any }) => (
                <div className="space-y-1">
                  <p className="text-[8px] font-bold uppercase tracking-widest text-brand-stone">{label}</p>
                  <div className="flex items-center gap-2">
                    {locked ? (
                      <div className="flex items-center gap-2 group relative cursor-help">
                        <p className="text-2xl font-serif text-brand-mist">---</p>
                        <div className="flex items-center gap-1">
                          <Lock size={12} className="text-brand-mist" />
                          <Link 
                            to="/planos" 
                            className="p-1 hover:bg-brand-linen rounded-full transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ChevronRight size={10} className="text-brand-terracotta" />
                          </Link>
                        </div>
                        <div className="absolute bottom-full left-0 mb-2 px-2 py-1 bg-brand-ink text-white text-[7px] font-bold uppercase tracking-widest rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-30">
                          Disponível no Plano Pro
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                         {Icon && <div className="w-4 h-4 rounded bg-brand-linen flex items-center justify-center"><Icon size={10} /></div>}
                         <p className="text-2xl font-serif text-brand-ink">{value}</p>
                      </div>
                    )}
                  </div>
                </div>
              );

              return (
                <>
                  {/* Header com Status do Plano */}
                  <section className="px-6 mt-4">
                    <div className="bg-brand-white p-6 rounded-[32px] border border-brand-mist shadow-sm">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-serif text-brand-ink italic">
                          {features.advancedDashboard 
                            ? "Performance completa dos últimos 30 dias."
                            : "Vendo quantas pessoas visitaram sua vitrine. 🔒 Acesse insights completos no Plano Pro."}
                        </p>
                        {!features.advancedDashboard && (
                          <Link to="/planos" className="text-[9px] font-bold uppercase tracking-widest text-brand-terracotta hover:underline">
                            Fazer Upgrade
                          </Link>
                        )}
                      </div>
                    </div>
                  </section>

                  {/* Growth Dashboard: KPIs de Conversão e Insights */}
                  {growthMetrics && (
                    <section className="bg-brand-white p-8 rounded-[40px] border border-brand-mist shadow-sm flex flex-col gap-10 relative overflow-hidden">
                      <div className="flex items-center justify-between border-b border-brand-linen pb-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-brand-linen text-brand-ink rounded-xl">
                            <TrendingUp size={20} />
                          </div>
                          <div>
                            <h3 className="text-[9px] font-bold uppercase tracking-[0.3em] text-brand-stone mb-1 flex items-center">
                              Growth Dashboard
                              <HelpTooltip content="Dados da sua vitrine: visitas, cliques e conversão em reservas." />
                            </h3>
                            <p className="text-sm font-serif text-brand-ink italic">Sua performance de conversão</p>
                          </div>
                        </div>
                        <div className="flex bg-brand-linen p-1 rounded-full text-[8px] font-bold uppercase tracking-widest">
                          <span className="px-3 py-1.5 bg-brand-white rounded-full shadow-sm text-brand-ink">30 Dias</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10">
                        <div className="space-y-1">
                          <p className="text-[8px] font-bold uppercase tracking-widest text-brand-stone">Visitas 30d</p>
                          <div className="flex items-baseline gap-2">
                            <p className="text-2xl font-serif text-brand-ink">{growthMetrics.visits30d}</p>
                            <span className="text-[8px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">+{growthMetrics.visits7d} na semana</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[8px] font-bold uppercase tracking-widest text-brand-stone">Cliques em Reservar</p>
                          <p className="text-2xl font-serif text-brand-ink">{growthMetrics.clicksBook}</p>
                        </div>
                        
                        <LockedMetric 
                          label="Taxa de Conversão" 
                          value={`${growthMetrics.convRate.toFixed(1)}%`} 
                          locked={!features.advancedDashboard} 
                        />
                        
                        <LockedMetric 
                          label="Origem Principal" 
                          value={growthMetrics.mainOrigin} 
                          locked={!features.advancedDashboard}
                          icon={growthMetrics.mainOrigin === 'Instagram' ? Instagram : Share2}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-brand-linen">
                        <div className="p-5 bg-brand-parchment/30 rounded-3xl border border-brand-mist/50">
                          <div className="flex items-center gap-2 mb-3 text-brand-stone">
                            {features.advancedDashboard ? <Sparkles size={14} /> : <Lock size={14} className="text-brand-mist" />}
                            <span className="text-[8px] font-bold uppercase tracking-widest">Serviço Campeão</span>
                          </div>
                          {features.advancedDashboard ? (
                            <p className="text-sm font-serif text-brand-ink leading-tight">{growthMetrics.topService}</p>
                          ) : (
                            <div className="space-y-1">
                              <p className="text-sm font-serif text-brand-mist">---</p>
                              <div className="flex items-center gap-1">
                                <p className="text-[7px] text-brand-stone uppercase tracking-widest font-medium">Plano Pro</p>
                                <Link to="/planos"><ChevronRight size={10} className="text-brand-terracotta" /></Link>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="p-5 bg-brand-parchment/30 rounded-3xl border border-brand-mist/50">
                          <div className="flex items-center gap-2 mb-3 text-brand-stone">
                            {features.advancedDashboard ? <Clock size={14} /> : <Lock size={14} className="text-brand-mist" />}
                            <span className="text-[8px] font-bold uppercase tracking-widest">Horário + Vendido</span>
                          </div>
                          {features.advancedDashboard ? (
                            <p className="text-sm font-serif text-brand-ink">{growthMetrics.bestTime}</p>
                          ) : (
                            <div className="space-y-1">
                              <p className="text-sm font-serif text-brand-mist">---</p>
                              <div className="flex items-center gap-1">
                                <p className="text-[7px] text-brand-stone uppercase tracking-widest font-medium">Plano Pro</p>
                                <Link to="/planos"><ChevronRight size={10} className="text-brand-terracotta" /></Link>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="p-5 bg-brand-parchment/30 rounded-3xl border border-brand-mist/50">
                          <div className="flex items-center gap-2 mb-3 text-brand-stone">
                            {features.advancedDashboard ? <Sun size={14} /> : <Lock size={14} className="text-brand-mist" />}
                            <span className="text-[8px] font-bold uppercase tracking-widest">Dia mais fraco</span>
                          </div>
                          {features.advancedDashboard ? (
                            <p className="text-sm font-serif text-brand-ink">{growthMetrics.weakestDay}</p>
                          ) : (
                            <div className="space-y-1">
                              <p className="text-sm font-serif text-brand-mist">---</p>
                              <div className="flex items-center gap-1">
                                <p className="text-[7px] text-brand-stone uppercase tracking-widest font-medium">Plano Pro</p>
                                <Link to="/planos"><ChevronRight size={10} className="text-brand-terracotta" /></Link>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* AI Insights */}
                      <AnimatePresence>
                        {!insightDismissed && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-brand-linen/40 p-6 rounded-[32px] border border-brand-mist/30 flex items-start gap-4 overflow-hidden relative"
                          >
                            {!features.advancedDashboard && (
                              <div className="absolute inset-0 z-10 bg-brand-white/80 backdrop-blur-[2px] flex flex-col items-center justify-center text-center p-4">
                                <Lock size={16} className="text-brand-terracotta mb-2" />
                                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-ink">Bloqueado</p>
                                <p className="text-[9px] text-brand-stone font-light">Growth Insights é exclusivo do Plano Pro</p>
                                <Link to="/planos" className="mt-2 text-[9px] font-bold uppercase tracking-widest text-brand-terracotta hover:underline">Fazer Upgrade</Link>
                              </div>
                            )}
                            <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-brand-terracotta shrink-0 shadow-sm border border-brand-mist/20">
                              <Zap size={20} />
                            </div>
                            <div className="flex-1 pr-8">
                              <h4 className="text-xs font-bold text-brand-ink uppercase tracking-widest mb-1">Dica de Performance</h4>
                              <p className="text-xs text-brand-stone font-light leading-relaxed italic">
                                {growthMetrics.growthInsight}
                              </p>
                            </div>
                            <button 
                              onClick={() => setInsightDismissed(true)}
                              className="absolute top-6 right-6 p-1 text-brand-stone hover:text-brand-ink"
                            >
                              <X size={14} />
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </section>
                  )}

                  {/* Serviços do Mês Ranking */}
                  <div className="px-6">
                    <section className="bg-brand-white p-8 rounded-[40px] border border-brand-mist shadow-sm relative overflow-hidden">
                      {!features.advancedDashboard && (
                        <div className="absolute inset-0 z-20 bg-brand-white/70 backdrop-blur-[2px] flex items-center justify-center p-8 text-center">
                          <div className="bg-brand-white/95 p-6 rounded-[32px] shadow-xl border border-brand-mist max-w-[220px]">
                            <div className="w-10 h-10 bg-brand-linen text-brand-terracotta rounded-2xl flex items-center justify-center mx-auto mb-3">
                              <Lock size={18} />
                            </div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-ink mb-1">Ranking de Serviços</p>
                            <p className="text-[9px] text-brand-stone font-light mb-4">Insights detalhados estão disponíveis apenas no Plano Pro</p>
                            <Link to="/planos">
                              <PremiumButton variant="terracotta" className="w-full !py-2 !text-[8px]">Ver Planos</PremiumButton>
                            </Link>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-brand-linen text-brand-ink rounded-xl">
                            <Sparkles size={20} />
                          </div>
                          <div>
                            <h3 className="text-[9px] font-bold uppercase tracking-[0.3em] text-brand-stone mb-1 flex items-center">
                              Serviços do mês
                              <HelpTooltip content="Ranking dos 5 serviços mais reservados e realizados no mês atual." />
                            </h3>
                            <p className="text-sm font-serif text-brand-ink italic">Sua performance por serviço</p>
                          </div>
                        </div>
                        <div className="bg-brand-parchment px-3 py-1 rounded-full border border-brand-mist/50">
                          <span className="text-[8px] font-bold uppercase tracking-widest text-brand-stone">
                            {new Date().toLocaleDateString('pt-BR', { month: 'long' })}
                          </span>
                        </div>
                      </div>

                      {servicesByMonth.length > 0 ? (
                        <div className="space-y-6">
                          {servicesByMonth.map((s, idx) => (
                            <div key={s.name} className="space-y-2">
                              <div className="flex justify-between items-end">
                                <div className="flex-1 min-w-0 pr-4">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="w-4 h-4 bg-brand-parchment rounded flex items-center justify-center text-[9px] font-bold text-brand-stone">{idx + 1}</span>
                                    <p className="text-[11px] font-bold text-brand-ink truncate">
                                      {s.name}
                                    </p>
                                  </div>
                                  <p className="text-[9px] text-brand-stone uppercase tracking-widest font-medium pl-6">
                                    {s.count} {s.count === 1 ? 'reserva' : 'reservas'} • {formatCurrency(s.revenue)}
                                  </p>
                                </div>
                              </div>
                              <div className="h-1.5 w-full bg-brand-linen rounded-full overflow-hidden ml-6">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(s.count / servicesByMonth[0].count) * 100}%` }}
                                  className="h-full bg-brand-terracotta rounded-full transition-all duration-1000"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-12 border-t border-brand-linen text-center flex flex-col items-center">
                          <div className="w-10 h-10 bg-brand-linen rounded-full flex items-center justify-center text-brand-terracotta mb-3 opacity-80">
                            <Star size={18} />
                          </div>
                          <p className="text-sm font-serif text-brand-ink">O pódio deste mês está livre.</p>
                          <p className="text-[10px] text-brand-stone font-light max-w-[240px] mx-auto mt-2 leading-relaxed">
                            Assim que os primeiros clientes agendarem, você verá aqui o ranking inteligente dos serviços que mais geram receita.
                          </p>
                        </div>
                      )}
                    </section>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {activeTab === "divulgacao" && profile && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <SharingPreviewSection profile={profile} />
          </motion.div>
        )}

        {/* HOJE SIMPLE VIEW */}
        {activeTab === "hoje" && (
          <div className="flex flex-col gap-8">
            <ActivationChecklist 
              profile={profile}
              appointments={appointments}
              services={services}
              onShareClick={() => setIsShareModalOpen(true)}
            />

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
                className="bg-brand-white p-6 rounded-[32px] border-2 border-brand-terracotta shadow-md flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 rounded-full bg-brand-terracotta animate-pulse" />
                  <p className="text-xs font-serif text-brand-ink">
                    Você tem {pendingCount} {pendingCount === 1 ? 'pedido pendente' : 'pedidos pendentes'} aguardando confirmação
                  </p>
                </div>
                <Link to="/pedidos" className="text-[10px] font-bold uppercase tracking-widest text-brand-terracotta hover:underline">
                  Ver pedidos
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
              <div className="bg-brand-white p-8 rounded-[40px] border border-brand-mist shadow-sm">
                {displayedConfirmedToday.length === 0 && (
                  <div className="mb-6 pb-6 border-b border-brand-linen">
                    <p className="text-sm font-serif text-brand-ink italic">Dia tranquilo até agora — vamos preencher?</p>
                    {daysSinceLastAppointment !== null && daysSinceLastAppointment > 0 && (
                      <p className="text-[9px] font-bold uppercase tracking-widest text-brand-stone mt-2">
                        Último agendamento há {daysSinceLastAppointment} {daysSinceLastAppointment === 1 ? 'dia' : 'dias'}
                      </p>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-8 divide-x divide-brand-linen">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand-stone mb-2">Faturamento Hoje</p>
                    <p className="text-3xl font-serif text-brand-ink">{formatCurrency(displayedDailyRevenue)}</p>
                  </div>
                  <div className="pl-8">
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand-stone mb-2">Agendamentos</p>
                    <p className="text-3xl font-serif text-brand-ink">{displayedConfirmedToday.length}</p>
                  </div>
                </div>
                
                <div className="mt-6 pt-6 border-t border-brand-linen flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-brand-linen text-brand-terracotta rounded-xl flex items-center justify-center shrink-0">
                      <DollarSign size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-serif text-brand-ink">Painel Financeiro</h4>
                      <p className="text-[10px] text-brand-stone font-light italic">Histórico e exportação CSV</p>
                    </div>
                  </div>
                  <Link to="/financeiro">
                    <button className="px-5 py-2 bg-brand-ink text-brand-white rounded-full text-[9px] font-bold uppercase tracking-widest hover:scale-105 transition-all">
                      Acessar
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
                        "bg-brand-white p-6 rounded-[32px] border border-brand-mist shadow-sm flex items-center justify-between group transition-all",
                        appt.status === 'completed' && "bg-brand-linen opacity-80"
                      )}
                    >
                      <div className="flex items-center gap-5">
                        <div className="text-center min-w-[50px]">
                          <p className="text-lg font-serif font-bold text-brand-ink leading-none">{appt.time}</p>
                        </div>
                        <div className="h-10 w-px bg-brand-linen" />
                        <div>
                          <h4 className="text-sm font-bold text-brand-ink">{appt.clientName}</h4>
                          <p className="text-xs text-brand-stone italic">{appt.serviceName}</p>
                          <span className={cn(
                            "text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mt-1 inline-block",
                            isCompletedStatus(appt.status) ? "text-brand-terracotta bg-white" : 
                            isConfirmedLikeStatus(appt.status) ? "text-green-600 bg-green-50" : "text-brand-stone bg-brand-linen"
                          )}>
                            {isCompletedStatus(appt.status) ? 'Concluído ✓' : 
                             isConfirmedLikeStatus(appt.status) ? 'Confirmado' : appt.status}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {isConfirmedLikeStatus(appt.status) && isPastTime(appt.time) && (
                          <button
                            onClick={() => handleComplete(appt)}
                            disabled={processingId === appt.id}
                            className="flex items-center gap-1.5 px-4 py-2 bg-brand-terracotta text-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-brand-sienna transition-all active:scale-95"
                          >
                            {processingId === appt.id ? "..." : "Finalizar"}
                            <CheckCircle2 size={14} />
                          </button>
                        )}
                        <Link to="/agenda" className="p-3 text-brand-stone hover:text-brand-terracotta">
                          <ChevronRight size={18} />
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

        {/* GERAL CONTENT (Resumo do Mês + Blocos Estratégicos) */}
        {activeTab === "geral" && (
          <div className="flex flex-col gap-8">
            {/* Financial Shortcut Card */}
            <section className="px-6 mt-4">
              <div className="bg-brand-ink text-brand-white p-8 rounded-[40px] shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-terracotta/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-brand-terracotta/20 transition-colors" />
                
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-brand-white/10 text-brand-linen rounded-2xl flex items-center justify-center shrink-0">
                      <DollarSign size={28} />
                    </div>
                    <div>
                      <h4 className="text-xl font-serif">Financeiro</h4>
                      <p className="text-xs text-white/60 font-light italic mt-1 leading-relaxed">
                        Ver receita, histórico mensal e exportar CSV.
                      </p>
                    </div>
                  </div>
                  
                  <Link to="/financeiro" className="md:w-auto w-full">
                    <button className="w-full px-8 py-4 bg-brand-terracotta text-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-lg flex items-center justify-center gap-2">
                      Abrir financeiro
                    </button>
                  </Link>
                </div>
              </div>
            </section>
            {/* Indicadores do Mês (Sem receita duplicada) */}
            <section className="px-6 mt-4">
              <div className="bg-brand-white p-6 rounded-[32px] border border-brand-mist shadow-sm">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-[8px] font-bold uppercase tracking-widest text-brand-stone mb-1">Agendamentos</p>
                    <p className="text-xl font-serif text-brand-ink">{monthlyStats.count || 0}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[8px] font-bold uppercase tracking-widest text-brand-stone mb-1">Clientes</p>
                    <p className="text-xl font-serif text-brand-ink">{monthlyStats.clientsCount || 0}</p>
                  </div>
                  <Link to="/avaliacoes" className="text-center hover:bg-brand-linen transition-colors rounded-xl py-1 block">
                    <p className="text-[8px] font-bold uppercase tracking-widest text-brand-stone mb-1 flex justify-center items-center gap-1 group">Avaliações <span className="opacity-0 group-hover:opacity-100 transition-opacity">&rarr;</span></p>
                    <p className="text-xl font-serif text-brand-ink">{profile?.totalReviews || 0}</p>
                  </Link>
                </div>
              </div>
            </section>

            {/* Próximas Ações */}
            <section className="px-6">
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setIsDashboardBlockOpen(true)}
                  className="p-5 bg-brand-white border border-brand-mist rounded-[32px] hover:bg-brand-linen transition-all group flex flex-col items-start gap-2 text-left"
                >
                  <Clock size={16} className="text-brand-terracotta group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-bold text-brand-ink uppercase tracking-widest">Bloquear horário</span>
                </button>
                <Link to="/clients" className="p-5 bg-brand-white border border-brand-mist rounded-[32px] hover:bg-brand-linen transition-all group flex flex-col gap-2">
                  <Users size={16} className="text-brand-terracotta group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-bold text-brand-ink uppercase tracking-widest">Novo cliente</span>
                </Link>
                <Link to="/services" className="p-5 bg-brand-white border border-brand-mist rounded-[32px] hover:bg-brand-linen transition-all group flex flex-col gap-2">
                  <Plus size={16} className="text-brand-terracotta group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-bold text-brand-ink uppercase tracking-widest">Novo serviço</span>
                </Link>
                <a 
                  href={buildWhatsappLink(profile?.whatsapp || '')} 
                  target="_blank" 
                  rel="noreferrer"
                  className="p-5 bg-brand-white border border-brand-mist rounded-[32px] hover:bg-brand-linen transition-all group flex flex-col gap-2"
                >
                  <MessageCircle size={16} className="text-brand-terracotta group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-bold text-brand-ink uppercase tracking-widest">WhatsApp</span>
                </a>
              </div>
            </section>

            {/* Faturamento Semanal */}
            <section className="px-6">
              <div className="flex flex-col gap-4">
                {user && (
                  <WeeklyRevenueSummary 
                    appointments={appointments || []} 
                    profile={profile}
                    userId={user.uid}
                    hideTodayFlow={true}
                  />
                )}
              </div>
            </section>

            {/* Status do Negócio (Compacto) */}
            <section className="px-6">
              <div className="bg-brand-white p-8 rounded-[40px] border border-brand-mist shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand-linen text-brand-ink rounded-xl">
                      <Zap size={20} />
                    </div>
                    <div>
                      <h3 className="text-[9px] font-bold uppercase tracking-[0.3em] text-brand-stone mb-1">
                        Status do negócio
                      </h3>
                      <p className="text-sm font-serif text-brand-ink italic">Fluxo e operação</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-6">
                  {/* Waitlist Status */}
                  {features.waitlist && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-brand-stone uppercase tracking-widest flex items-center">
                          Lista de Espera
                          <HelpTooltip content="Clientes que pediram vaga quando sua agenda estava cheia. Avise quando abrir um horário." />
                        </span>
                        {waitlist && waitlist.length > 0 ? (
                          <button onClick={() => setIsWaitlistModalOpen(true)} className="text-[9px] font-bold uppercase tracking-widest text-brand-terracotta hover:underline">Ver {waitlist.length}</button>
                        ) : (
                          <span className="text-[10px] text-brand-stone uppercase tracking-widest opacity-40">Vazia</span>
                        )}
                      </div>
                      {waitlist && waitlist.length > 0 && (
                        <div className="bg-brand-parchment/30 p-4 rounded-2xl border border-brand-mist/50">
                          <p className="text-[10px] text-brand-ink leading-tight font-medium">
                            {waitlist[0].clientName} aguarda por {waitlist[0].period === 'any' ? 'um horário' : waitlist[0].period}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Blocked Status */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between border-t border-brand-linen pt-6">
                      <span className="text-[10px] font-bold text-brand-stone uppercase tracking-widest">Bloqueios</span>
                      {blockedSchedules && blockedSchedules.length > 0 ? (
                        <button onClick={() => setIsDashboardBlockOpen(true)} className="text-[9px] font-bold uppercase tracking-widest text-brand-terracotta hover:underline">Gerenciar</button>
                      ) : (
                        <span className="text-[10px] text-brand-stone uppercase tracking-widest opacity-40">Nenhum</span>
                      )}
                    </div>
                    {blockedSchedules && blockedSchedules.length > 0 && (
                      <div className="bg-brand-parchment/30 p-4 rounded-2xl border border-brand-mist/50">
                        <p className="text-[10px] text-brand-ink leading-tight font-medium">
                          Indisponível {blockedSchedules[0].date === getTodayLocale() ? 'hoje' : safeFormatDateKey(blockedSchedules[0].date, 'Recorrente')} às {blockedSchedules[0].startTime}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Retention Status */}
                  <div className="flex flex-col gap-4 border-t border-brand-linen pt-6">
                    {(() => {
                      // Calculate the qualified insight
                      let insight = null;
                      
                      const qualifiedClient = inactiveClients.find(c => {
                        if ((c.confirmedAppointments || 0) < 3) return false;
                        if (!c.firstAppointmentDate || !c.lastAppointmentDate || !c.clientName) return false;
                        
                        const first = new Date(c.firstAppointmentDate);
                        const last = new Date(c.lastAppointmentDate);
                        if (isNaN(first.getTime()) || isNaN(last.getTime())) return false;
                        
                        const diffTime = Math.abs(last.getTime() - first.getTime());
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        if (diffDays <= 0) return false;
                        
                        const avgFreq = Math.round(diffDays / ((c.confirmedAppointments || 3) - 1));
                        return avgFreq >= 5 && avgFreq <= 90;
                      });

                      if (qualifiedClient) {
                        const first = new Date(qualifiedClient.firstAppointmentDate);
                        const last = new Date(qualifiedClient.lastAppointmentDate);
                        const diffTime = Math.abs(last.getTime() - first.getTime());
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        const avgFreq = Math.round(diffDays / ((qualifiedClient.confirmedAppointments || 3) - 1));
                        
                        const today = new Date();
                        const timeSinceLast = Math.abs(today.getTime() - last.getTime());
                        const daysSinceLast = Math.ceil(timeSinceLast / (1000 * 60 * 60 * 24));
                        
                        const firstName = safeString(qualifiedClient.clientName, 'Cliente').split(' ')[0];
                        const whatsappInfo = qualifiedClient.clientWhatsapp || qualifiedClient.clientPhone || '';
                        
                        insight = {
                          firstName,
                          avgFreq,
                          daysSinceLast,
                          whatsappInfo
                        };
                      }

                      if (insight) {
                        return (
                          <div className="bg-brand-parchment/30 rounded-3xl border border-brand-mist/50 p-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                              <Heart size={48} className="text-brand-terracotta" />
                            </div>
                            
                            <p className="text-[10px] font-bold text-brand-ink uppercase tracking-widest mb-4">Cuidado com a sua clientela</p>
                            
                            <blockquote className="text-sm font-serif text-brand-stone italic leading-relaxed mb-6">
                              "{insight.firstName} costumava voltar aproximadamente a cada {insight.avgFreq} dias. 
                              Já faz {insight.daysSinceLast} dias desde sua última visita. 
                              Talvez seja um ótimo momento para retomar esse contato."
                            </blockquote>

                            {insight.whatsappInfo && (
                              <button 
                                onClick={() => {
                                  // Abre explicitamente sem mensagem automática, apenas o número
                                  window.open(buildWhatsappLink(insight.whatsappInfo, ''), '_blank');
                                }}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-white border border-brand-mist text-brand-ink rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-brand-linen transition-colors shadow-sm"
                              >
                                <MessageCircle size={14} className="text-brand-terracotta" />
                                Abrir WhatsApp
                              </button>
                            )}
                          </div>
                        );
                      }

                      if (inactiveClientsCount > 0) {
                        return (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-[10px] font-bold text-brand-ink uppercase tracking-widest">Clientes há +30 dias sem voltar</p>
                                <p className="text-[11px] text-brand-stone italic">{inactiveClientsCount} {inactiveClientsCount === 1 ? 'pronta' : 'prontas'} para retorno</p>
                              </div>
                              <Link to="/clients" className="text-[9px] font-bold uppercase tracking-widest text-brand-terracotta hover:underline">Ver todas</Link>
                            </div>
                            
                            <div className="space-y-2">
                              {inactiveClients.slice(0, 2).map((client, idx) => (
                                <div key={idx} className="bg-brand-parchment/10 p-4 rounded-2xl border border-brand-mist flex items-center justify-between gap-4">
                                  <div className="flex-1">
                                    <p className="text-[11px] font-bold text-brand-ink">{client.clientName || client.name}</p>
                                    <p className="text-[9px] text-brand-stone italic">Não volta desde {safeDateLabel(client.lastDate || client.lastAppointmentDate)}</p>
                                  </div>
                                  {idx === 0 && (client.clientWhatsapp || client.whatsapp || client.clientPhone) && (
                                    <button 
                                      onClick={() => {
                                        window.open(buildWhatsappLink(client.clientWhatsapp || client.whatsapp || client.clientPhone || '', ''), '_blank');
                                      }}
                                      className="bg-brand-white border border-brand-mist text-brand-ink p-2.5 rounded-full hover:bg-brand-linen transition-colors shadow-sm"
                                      title="Abrir WhatsApp"
                                    >
                                      <MessageCircle size={14} className="text-brand-terracotta" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-brand-stone uppercase tracking-widest">Retenção: ok</span>
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                        </div>
                      );
                    })()}
                  </div>

                  {!(waitlist && waitlist.length > 0) && !(blockedSchedules && blockedSchedules.length > 0) && inactiveClientsCount === 0 && (
                    <div className="pt-6 border-t border-brand-linen text-center space-y-3">
                      <div className="w-10 h-10 bg-brand-linen rounded-full flex items-center justify-center text-brand-terracotta mx-auto mb-2 opacity-80">
                        <Check size={18} />
                      </div>
                      <p className="text-sm font-serif text-brand-ink">A operação rodando suavemente.</p>
                      <p className="text-[10px] text-brand-stone font-light px-4 leading-relaxed max-w-[250px] mx-auto">
                        Sem clientes para resgatar ou pendências. Quando a operação precisar da sua atenção, os alertas estratégicos aparecerão aqui.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* WhatsApp Section */}
            <section className="px-6">
              <div className="bg-brand-white p-8 rounded-[40px] border border-brand-mist shadow-sm relative overflow-hidden">
                {!features.whatsappNotifications && (
                  <div className="absolute inset-0 z-20 bg-brand-white/40 backdrop-blur-[2px] flex items-center justify-center p-8 text-center">
                    <div className="bg-brand-white p-8 rounded-[32px] shadow-2xl border border-brand-mist max-w-sm">
                      <div className="w-12 h-12 bg-brand-linen text-brand-terracotta rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Star size={24} />
                      </div>
                      <h4 className="text-xl font-serif text-brand-ink mb-2">WhatsApp Pro</h4>
                      <p className="text-[10px] text-brand-stone uppercase tracking-widest font-bold mb-6">Recurso Exclusivo</p>
                      <Link to="/planos">
                        <PremiumButton variant="terracotta" className="w-full">Fazer Upgrade</PremiumButton>
                      </Link>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#25D366]/10 text-[#25D366] rounded-xl relative">
                      <MessageCircle size={20} />
                      {profile?.whatsappNotificationsEnabled && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-[9px] font-bold uppercase tracking-[0.3em] text-brand-stone mb-1 flex items-center">
                        WhatsApp Inteligente
                        <HelpTooltip content="Automações de confirmação, lembrete e reativação de clientes pelo WhatsApp." />
                      </h3>
                      <p className="text-sm font-serif text-brand-ink italic">Automação de mensagens</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={cn(
                      "text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full",
                      profile?.whatsappNotificationsEnabled ? "bg-green-50 text-green-600 border border-green-100" : "bg-gray-50 text-gray-400 border border-gray-100"
                    )}>
                      {profile?.whatsappNotificationsEnabled ? '● Ativo' : '● Inativo'}
                    </span>
                    <Link 
                      to="/perfil" 
                      className="p-2 hover:bg-brand-mist rounded-full transition-colors"
                    >
                      <Settings size={16} className="text-brand-stone" />
                    </Link>
                  </div>
                </div>

                <div className="space-y-6">
                  <p className="text-xs text-brand-stone italic leading-relaxed">
                    O Nera confirma e lembra suas clientes automaticamente, reduzindo faltas e seu trabalho manual.
                  </p>

                  <div className="bg-brand-parchment/30 rounded-2xl border border-brand-mist/50 p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-brand-ink">
                        Enviados recentemente
                      </h4>
                      <Link to="/whatsapp-history" className="text-[9px] font-bold uppercase tracking-widest text-brand-terracotta hover:underline">
                        Ver histórico →
                      </Link>
                    </div>

                    <div className="space-y-3">
                      {whatsappLogs.length > 0 ? (
                        whatsappLogs.map((log) => (
                          <div key={log.id} className="flex items-center justify-between gap-3 bg-white/50 p-3 rounded-xl border border-brand-mist/30">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className={cn(
                                "w-1.5 h-1.5 rounded-full shrink-0",
                                log.status === 'sent' ? 'bg-green-500' : log.status === 'failed' ? 'bg-red-500' : 'bg-gray-300'
                              )} />
                              <div className="overflow-hidden">
                                <p className="text-[11px] font-bold text-brand-ink truncate">
                                  {log.clientName || 'Cliente'}
                                </p>
                                <p className="text-[9px] text-brand-stone truncate italic">
                                  {log.messagePreview || log.message.substring(0, 30)}
                                </p>
                              </div>
                            </div>
                            <div className="text-[9px] text-brand-stone font-medium text-right shrink-0">
                              {log.status === 'sent' ? 'Enviado' : log.status === 'failed' ? 'Falha' : 'Pendente'}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-8 text-center flex flex-col items-center border-t border-brand-linen">
                          <div className="w-8 h-8 bg-brand-linen rounded-full flex items-center justify-center text-brand-stone mb-2 opacity-60">
                            <MessageCircle size={14} />
                          </div>
                          <p className="text-xs font-serif text-brand-ink">Nenhuma mensagem disparada</p>
                          <p className="text-[10px] text-brand-stone font-light max-w-[200px] mx-auto mt-1 leading-relaxed">
                            Lembretes, confirmações e retornos automáticos aparecerão aqui quando a sua agenda começar a fluir.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {!profile?.whatsapp && (
                    <div className="text-center py-6 px-6 bg-brand-linen/30 rounded-3xl border border-dashed border-brand-terracotta/30">
                      <p className="text-[11px] text-brand-ink italic mb-3">Sincronize seu WhatsApp para ativar as automações.</p>
                      <Link to="/perfil">
                        <button className="text-[9px] font-bold uppercase tracking-widest bg-brand-terracotta text-white px-6 py-2.5 rounded-full hover:scale-105 transition-transform shadow-sm">
                          Conectar WhatsApp
                        </button>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </section>


          </div>
        )}

        {/* GERAL CONTENT (Temporarily Deactivated) */}
        {false && activeTab === "geral" && (
          <>
            <div className="flex flex-col gap-8">

        {/* HOJE CONTENT */}
            {/* 1. Hoje Financeiro (Simple Card) */}
            {user && (
              <WeeklyRevenueSummary 
                appointments={appointments}
                profile={profile}
                userId={user.uid}
                showOnlyToday={true}
              />
            )}

            {/* 2. Alerta Anti No-Show (Prioridade Máxima) */}
            <AnimatePresence>
              {unconfirmedTomorrow.length > 0 && (
                <motion.section 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-amber-50 p-6 rounded-[32px] border border-amber-200 border-dashed"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
                        <ShieldCheck size={18} />
                      </div>
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-amber-900 flex items-center">
                        Anti No-Show: Clientes de Amanhã
                        <HelpTooltip content="Clientes com horário próximo que ainda não confirmaram. Envie lembretes para reduzir faltas." />
                      </h3>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {unconfirmedTomorrow.slice(0, 2).map(app => (
                      <div key={app.id} className="bg-white/80 p-4 rounded-2xl flex items-center justify-between shadow-sm border border-amber-100">
                        <div>
                          <p className="text-[10px] font-bold text-amber-900 uppercase tracking-widest">{app.clientName}</p>
                          <p className="text-xs text-amber-700 italic">{app.time} — {app.serviceName}</p>
                        </div>
                        <a 
                          href={buildWhatsappLink(app.clientWhatsapp || '', `Olá ${safeString(app.clientName, 'Cliente').split(' ')[0]} ✨ Vi que ainda não confirmou sua presença para amanhã às ${app.time}. Confirmado?`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700"
                        >
                          <MessageCircle size={18} />
                        </a>
                      </div>
                    ))}
                    {unconfirmedTomorrow.length > 2 && (
                      <Link to="/agenda" className="block text-center text-[9px] font-bold uppercase text-amber-600">
                        + {unconfirmedTomorrow.length - 2} clientes pendentes
                      </Link>
                    )}
                  </div>
                </motion.section>
              )}
            </AnimatePresence>

            {/* 3. Agenda de Hoje Detalhada */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-serif text-brand-ink italic">Sua Agenda de Hoje</h3>
                <span className="text-[10px] text-brand-stone font-bold uppercase tracking-widest px-3 py-1 bg-brand-linen rounded-full">
                  {displayedConfirmedToday.length} Atendimentos
                </span>
              </div>

              <div className="space-y-4">
                {displayedConfirmedToday.length > 0 ? (
                  displayedConfirmedToday.map((appt) => (
                    <div 
                      key={appt.id} 
                      className={cn(
                        "bg-brand-white p-6 rounded-[32px] border border-brand-mist shadow-sm flex items-center justify-between group transition-all hover:border-brand-terracotta",
                        isCompletedStatus(appt.status) && "opacity-60 bg-brand-parchment/30"
                      )}
                    >
                      <div className="flex items-center gap-5">
                        <div className="text-center min-w-[50px]">
                          <p className="text-lg font-serif font-bold text-brand-ink leading-none">{appt.time}</p>
                          <p className="text-[8px] text-brand-stone uppercase font-bold mt-1">Check-in</p>
                        </div>
                        <div className="h-10 w-px bg-brand-linen" />
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-brand-ink">{appt.clientName}</h4>
                            {isCompletedStatus(appt.status) && <Check size={12} className="text-green-600" />}
                          </div>
                          <p className="text-xs text-brand-stone italic">{appt.serviceName}</p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-brand-terracotta">
                              {formatCurrency(appt.price || 0)}
                            </span>
                            {appt.duration && (
                              <span className="text-[9px] text-brand-stone font-medium capitalize">
                                • {appt.duration} min
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <a 
                          href={buildWhatsappLink(appt.clientWhatsapp || '', `Oi ${safeString(appt.clientName, 'Cliente').split(' ')[0]} ✨ tudo bem?`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3 text-brand-stone hover:text-[#25D366] hover:bg-green-50 rounded-2xl transition-all"
                        >
                          <MessageCircle size={18} />
                        </a>
                        <Link 
                          to="/agenda" 
                          className="p-3 text-brand-stone hover:text-brand-terracotta hover:bg-brand-linen rounded-2xl transition-all"
                        >
                          <ChevronRight size={18} />
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-brand-white p-12 rounded-[40px] border border-brand-mist border-dashed text-center">
                    <p className="text-brand-stone italic text-sm mb-6">Agenda livre para hoje. Que tal divulgar seu link agora?</p>
                    <button 
                      onClick={() => setIsShareModalOpen(true)}
                      className="px-8 py-4 bg-brand-ink text-brand-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-md"
                    >
                      Divulgar Vitrine Profissional
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* Quick Blocks Access */}
            <button 
              onClick={() => setIsQuickBlockOpen(true)}
              className="w-full p-6 bg-brand-parchment/50 border border-brand-mist border-dashed rounded-[32px] text-brand-stone hover:text-brand-ink flex items-center justify-center gap-2 transition-all"
            >
              <Lock size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Precisou dar uma saidinha? Bloqueie um horário</span>
            </button>
            
            <div className="h-4" /> {/* Spacer */}

            <WeeklyRevenueSummary 
              appointments={appointments}
              profile={profile}
              userId={user.uid}
            />
            
            {/* Reports Section */}
            <section className="bg-brand-white p-8 rounded-[40px] border border-brand-mist shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-brand-linen text-brand-terracotta rounded-2xl flex items-center justify-center shrink-0">
                  <List size={28} />
                </div>
                <div>
                  <h4 className="text-base font-serif text-brand-ink">Relatório Mensal de Performance</h4>
                  <p className="text-xs text-brand-stone font-light italic mt-1 leading-relaxed">
                    Analise seu faturamento, top serviços e fidelidade das clientes em um PDF elegante.
                  </p>
                </div>
              </div>
              
              <PremiumButton
                onClick={handleDownloadReport}
                loading={isReportLoading}
                variant="terracotta"
                feature="reports"
                className="md:w-auto w-full"
              >
                Baixar Relatório de {new Date().toLocaleDateString('pt-BR', { month: 'long' })}
              </PremiumButton>
            </section>

            <InstallPrompt />
            
            {/* 3. PEDIDOS PENDENTES (CONDICIONAL) */}
        <AnimatePresence>
          {pendingCount > 0 && (
            <motion.section 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-brand-white p-6 rounded-[32px] border-2 border-brand-terracotta shadow-md flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-2 h-2 rounded-full bg-brand-terracotta animate-pulse" />
                <p className="text-xs font-serif text-brand-ink">
                  {pendingCount} {pendingCount === 1 ? 'novo pedido' : 'novos pedidos'} aguardando confirmação
                </p>
              </div>
              <Link 
                to="/pedidos" 
                className="text-[10px] font-bold uppercase tracking-widest text-brand-terracotta hover:underline"
              >
                Ver pedidos
              </Link>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Anti No-Show: Clientes que não confirmaram para amanhã */}
        <AnimatePresence>
          {unconfirmedTomorrow.length > 0 && (
            <motion.section 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-amber-50 p-8 rounded-[40px] border border-amber-200 border-dashed shadow-sm flex flex-col gap-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
                    <ShieldCheck size={20} />
                  </div>
                  <h3 className="text-[9px] font-bold uppercase tracking-[0.3em] text-amber-900 flex items-center">
                    Alerta Anti No-Show
                    <HelpTooltip content="Clientes com horário próximo que ainda não confirmaram. Envie lembretes para reduzir faltas." />
                  </h3>
                </div>
                <span className="bg-amber-600 text-white text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">
                  Confirmar Amanhã
                </span>
              </div>
              
              <div className="space-y-3">
                <p className="text-sm text-amber-900 font-serif">
                  {unconfirmedTomorrow.length} cliente{unconfirmedTomorrow.length > 1 ? 's' : ''} ainda não confirmou presença para amanhã.
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {unconfirmedTomorrow.slice(0, 3).map(app => (
                    <div key={app.id} className="bg-white/80 p-4 rounded-2xl border border-amber-100 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-amber-900 uppercase tracking-widest">{app.clientName}</p>
                        <p className="text-xs text-amber-700 font-medium italic">{app.time} - {app.serviceName}</p>
                      </div>
                      <a 
                        href={buildWhatsappLink(app.clientWhatsapp || '', `Olá ${safeString(app.clientName, 'Cliente').split(' ')[0]} ✨ Vi que ainda não confirmou sua presença para amanhã às ${app.time}. Podemos contar com você?`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors shadow-sm"
                      >
                        <MessageCircle size={18} />
                      </a>
                    </div>
                  ))}
                  {unconfirmedTomorrow.length > 3 && (
                    <Link to="/agenda" className="text-center text-[8px] font-bold uppercase tracking-widest text-amber-600 mt-2 hover:underline">
                      + ver outros {unconfirmedTomorrow.length - 3} na agenda
                    </Link>
                  )}
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* 5. BLOQUEIOS ATIVOS (CONDICIONAL) */}
        <AnimatePresence>
          {blockedSchedules.length > 0 && (
            <motion.section 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-brand-parchment/30 p-8 rounded-[40px] border border-brand-mist shadow-sm flex flex-col gap-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-brand-stone/10 text-brand-stone rounded-xl">
                    <Lock size={20} />
                  </div>
                  <div>
                    <h3 className="text-[9px] font-bold uppercase tracking-[0.3em] text-brand-stone mb-1">
                      Bloqueios Ativos
                    </h3>
                    <p className="text-sm font-serif text-brand-ink italic">Sua agenda fechada</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsDashboardBlockOpen(true)}
                  className="text-[9px] font-bold uppercase tracking-widest text-brand-terracotta hover:underline"
                >
                  Gerenciar
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {blockedSchedules.slice(0, 4).map(block => (
                  <div key={block.id} className="bg-white/80 p-4 rounded-2xl border border-brand-mist flex items-center justify-between group hover:border-brand-terracotta transition-colors">
                    <div>
                      <p className="text-[10px] font-bold text-brand-ink uppercase tracking-widest leading-none mb-1">
                        {block.reason || 'Bloqueado'}
                      </p>
                      <p className="text-[10px] text-brand-stone font-medium italic">
                        {block.date === getTodayLocale() ? 'Hoje' : safeFormatDateKey(block.date, 'Recorrente')} às {block.startTime}
                      </p>
                    </div>
                    <button 
                      onClick={async () => {
                        try {
                          await deleteDoc(doc(db, 'blocked_schedules', block.id));
                          notify.success('Agenda liberada com sucesso.');
                        } catch {
                          notify.error('Erro ao liberar agenda.');
                        }
                      }}
                      className="p-2.5 text-brand-stone/40 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* 4. PRÓXIMOS AGENDAMENTOS */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-[10px] font-bold text-brand-stone uppercase tracking-[0.3em]">Próximos horários</h2>
            <div className="h-px flex-1 bg-brand-mist" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {confirmedAppointments.length > 0 ? (
              confirmedAppointments.slice(0, 4).map((appt) => (
                <div key={appt.id} className="bg-brand-white p-6 rounded-[32px] border border-brand-mist shadow-sm flex items-center justify-between group hover:border-brand-terracotta transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="text-center min-w-[45px]">
                      <p className="text-sm font-serif font-bold text-brand-ink leading-tight">{appt.time}</p>
                      <p className="text-[8px] text-brand-stone uppercase font-bold">{safeDateLabel(appt.date).split('/').slice(0, 2).join('/')}</p>
                    </div>
                    <div className="h-8 w-px bg-brand-linen" />
                    <div>
                      <h4 className="text-xs font-bold text-brand-ink">{appt.clientName}</h4>
                      <p className="text-[10px] text-brand-stone italic">{appt.serviceName}</p>
                    </div>
                  </div>
                  <Link to="/agenda" className="p-2 text-brand-stone hover:text-brand-terracotta transition-colors">
                    <ChevronRight size={16} />
                  </Link>
                </div>
              ))
            ) : (
              <div className="col-span-full py-12 text-center bg-brand-parchment/30 rounded-[32px] border border-brand-mist border-dashed">
                <p className="text-xs text-brand-stone italic font-serif">Nenhum agendamento confirmado nos próximos dias.</p>
              </div>
            )}
          </div>
        </section>

        {/* 5. AÇÕES RÁPIDAS (Grid 2x2) */}
        <section>
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => setIsDashboardBlockOpen(true)}
              className="p-5 bg-brand-white border border-brand-mist rounded-[32px] hover:bg-brand-linen transition-all group flex flex-col items-start gap-2 text-left"
            >
              <Clock size={16} className="text-brand-terracotta group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold text-brand-ink uppercase tracking-widest">Bloquear horário</span>
            </button>
            <Link to="/clients" className="p-5 bg-brand-white border border-brand-mist rounded-[32px] hover:bg-brand-linen transition-all group flex flex-col gap-2">
              <Users size={16} className="text-brand-terracotta group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold text-brand-ink uppercase tracking-widest">Novo cliente</span>
            </Link>
            <Link to="/services" className="p-5 bg-brand-white border border-brand-mist rounded-[32px] hover:bg-brand-linen transition-all group flex flex-col gap-2">
              <Plus size={16} className="text-brand-terracotta group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold text-brand-ink uppercase tracking-widest">Novo serviço</span>
            </Link>
            <a 
              href={buildWhatsappLink(profile?.whatsapp || '')} 
              target="_blank" 
              rel="noreferrer"
              className="p-5 bg-brand-white border border-brand-mist rounded-[32px] hover:bg-brand-linen transition-all group flex flex-col gap-2"
            >
              <MessageCircle size={16} className="text-brand-terracotta group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold text-brand-ink uppercase tracking-widest">WhatsApp</span>
            </a>
          </div>
        </section>

        {/* 6. FATURAMENTO */}
        <section className="bg-brand-parchment rounded-[40px] p-8 border border-brand-mist shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <span className="text-[10px] font-bold text-brand-stone uppercase tracking-widest block mb-2">Este mês</span>
              <h4 className="text-3xl font-serif text-brand-ink">{formatCurrency(monthlyRevenue)}</h4>
            </div>
            {monthlyRevenue > 0 && prevMonthlyRevenue > 0 && (
              <div className={cn(
                "px-3 py-1.5 rounded-full text-[10px] font-bold tracking-widest flex items-center gap-1",
                monthlyRevenue >= prevMonthlyRevenue ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              )}>
                <TrendingUp size={12} className={monthlyRevenue < prevMonthlyRevenue ? "rotate-180" : ""} />
                {Math.abs(Math.round(((monthlyRevenue - prevMonthlyRevenue) / prevMonthlyRevenue) * 100))}%
              </div>
            )}
          </div>
          <Link to="/financeiro" className="text-[10px] font-bold uppercase tracking-widest text-brand-terracotta hover:underline">
            Ver detalhes financeiros
          </Link>
        </section>

        {/* 7. CLIENTES */}
        <section className="bg-brand-white p-8 rounded-[40px] border border-brand-mist shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
            <div>
              <p className="text-[10px] text-brand-stone font-bold uppercase tracking-widest mb-1">{totalClientsCount} clientes cadastradas</p>
              <p className="text-sm font-serif text-brand-ink">{returningThisWeek} retornando esta semana</p>
            </div>
          </div>
        </section>

        {/* 8. INDICAÇÃO */}
        <section className="mb-12">
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-[10px] font-medium text-brand-stone uppercase tracking-[0.3em]">
              Indique o Nera
            </h2>
            <div className="h-px flex-1 bg-brand-mist" />
          </div>
          <div className="bg-brand-white border border-brand-mist rounded-[24px] p-8">
            <p className="text-sm font-light text-brand-stone mb-6 leading-relaxed">
              Indique uma colega profissional. Quando ela se cadastrar com seu link e usar por 15 dias, <strong className="text-brand-ink">você ganha 1 mês grátis</strong>.
            </p>
            <div className="flex items-center gap-3 bg-brand-parchment border border-brand-mist rounded-2xl p-4">
              <span className="text-[11px] text-brand-stone font-mono truncate flex-1">{referralLink}</span>
              <button
                onClick={() => { navigator.clipboard.writeText(referralLink); notify.success('Link copiado!'); }}
                className="flex items-center gap-2 px-5 py-2.5 bg-brand-ink text-brand-white rounded-2xl text-[9px] font-bold uppercase tracking-widest shrink-0 hover:bg-brand-espresso transition-all"
              >
                <Copy size={12} /> Copiar
              </button>
            </div>
            <p className="text-[10px] text-brand-stone/50 uppercase tracking-widest mt-4">
              Compartilhe no WhatsApp, Instagram ou diretamente com colegas
            </p>
          </div>
        </section>
      </div>
    </>
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
                        <span className="text-brand-ink font-bold text-lg">{formatCurrency((selectedRequest.price || 0) + (selectedRequest.travelFee || 0))}</span>
                        <div className="flex flex-col text-[10px] text-brand-stone opacity-80">
                          <span>Base: {formatCurrency(selectedRequest.price || 0)}</span>
                          {selectedRequest.travelFee > 0 && <span>Taxa Extra: {formatCurrency(selectedRequest.travelFee)}</span>}
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
        averageTicket={
          appointments.filter(a => isRevenueStatus(a.status)).length > 0 
            ? monthlyRevenue / appointments.filter(a => isRevenueStatus(a.status)).length 
            : 0
        }
      />

      {/* Floating Action Button for active appointment */}
      {ongoingAppt && (
        <div className="fixed bottom-24 right-6 md:hidden z-40">
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleComplete(ongoingAppt)}
            disabled={processingId === ongoingAppt.id}
            className="w-14 h-14 bg-brand-terracotta text-white rounded-full shadow-2xl flex items-center justify-center relative group"
          >
            <CheckCircle2 size={24} />
            <div className="absolute right-full mr-3 bg-brand-ink text-white text-[10px] font-bold uppercase tracking-widest py-2 px-4 rounded-xl whitespace-nowrap opacity-0 transition-opacity pointer-events-none">
              Finalizar {safeString(ongoingAppt.clientName, 'Cliente').split(' ')[0]}
            </div>
          </motion.button>
        </div>
      )}
      </PageErrorBoundary>
    </AppLayout>
  );
}

// Sub-component for Dashboard Block Flow (DEPRECATED - using unified modal above)
// removed DashboardBlockModal...
