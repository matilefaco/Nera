import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../AuthContext';
import { db, auth, confirmAppointmentAtomic, declineAppointmentAtomic, handleBookingError, inviteFromWaitlist, updateAppointmentStatus } from '../firebase';
import { 
  collection, query, where, onSnapshot, orderBy, doc, updateDoc, 
  addDoc, deleteDoc, serverTimestamp, limit 
} from 'firebase/firestore';
import { 
  Calendar, Clock, Users, LogOut, 
  Settings, List, MessageCircle, CheckCircle2, 
  Share2, Plus, MapPin, Check, TrendingUp, Heart,
  ChevronRight, Sparkles, Home, X, Instagram, Copy, Inbox,
  AlertCircle, ShieldCheck, Lock, Sun, Moon, Zap, Star, Camera, Smartphone
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  formatCurrency, getTodayLocale, buildWhatsappLink, 
  generateWaitlistInviteMessage, cn, formatDateKey, parseLocalDate 
} from '../lib/utils';
import { getClientScore } from '../lib/clientUtils';
import Logo from '../components/Logo';
import { Appointment, WaitlistEntry, BlockedSchedule, AnalyticsEvent, Service } from '../types';
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
import { usePushNotifications } from '../hooks/usePushNotifications';
import { getAvailableSlots, getDayAvailability } from '../lib/bookingUtils';
import { FirstVisitTip } from '../components/FirstVisitTip';

import { usePlanFeatures } from '../hooks/usePlanFeatures';
import { useUpgradeTriggers } from '../hooks/useUpgradeTriggers';

const isDev = import.meta.env.DEV;
const devLog = (...args: any[]) => isDev && console.log(...args);

type DashboardTab = "hoje" | "geral" | "insights" | "divulgacao";

export default function Dashboard() {
  const { user, profile } = useAuth();
  const { features } = usePlanFeatures();
  
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
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState<Appointment[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<Appointment | null>(null);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [prevMonthlyRevenue, setPrevMonthlyRevenue] = useState(0);
  const [returningThisWeek, setReturningThisWeek] = useState(0);
  const [totalClientsCount, setTotalClientsCount] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const [isConfirmRejectOpen, setIsConfirmRejectOpen] = useState(false);
  const [requestToReject, setRequestToReject] = useState<Appointment | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isWaitlistModalOpen, setIsWaitlistModalOpen] = useState(false);
  const [isDashboardBlockOpen, setIsDashboardBlockOpen] = useState(false);
  const [isQuickBlockOpen, setIsQuickBlockOpen] = useState(false);
  const [insightDismissed, setInsightDismissed] = useState(false);
  const [blockTipDismissed, setBlockTipDismissed] = useState(() => {
    return localStorage.getItem("nera_block_tip_dismissed") === "true";
  });
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [unconfirmedTomorrow, setUnconfirmedTomorrow] = useState<Appointment[]>([]);
  const [waitlistMode, setWaitlistMode] = useState<'auto' | 'manual'>('manual');
  const [blockedSchedules, setBlockedSchedules] = useState<BlockedSchedule[]>([]);
  const [referralLink, setReferralLink] = useState('');
  const [analyticsEvents, setAnalyticsEvents] = useState<AnalyticsEvent[]>([]);
  const [inactiveClientsCount, setInactiveClientsCount] = useState(0);
  const [inactiveClients, setInactiveClients] = useState<any[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  // Triggers handled by hook

  useEffect(() => {
    if (!user) return;

    const qAnalytics = query(
      collection(db, 'analytics_events'),
      where('professionalId', '==', user.uid),
      orderBy('timestamp', 'desc'),
      limit(1000)
    );

    const unsubAnalytics = onSnapshot(qAnalytics, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as AnalyticsEvent));
      setAnalyticsEvents(docs);
    });

    return () => unsubAnalytics();
  }, [user]);

  const growthMetrics = useMemo(() => {
    if (analyticsEvents.length === 0 && appointments.length === 0) return null;

    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const visits30d = analyticsEvents.filter(e => e.type === 'visit' && e.timestamp?.toDate() > thirtyDaysAgo).length;
    const visits7d = analyticsEvents.filter(e => e.type === 'visit' && e.timestamp?.toDate() > sevenDaysAgo).length;
    const clicksBook = analyticsEvents.filter(e => e.type === 'click_book' && e.timestamp?.toDate() > thirtyDaysAgo).length;
    
    // 3. MÉTRICAS DE CRESCIMENTO: contando apenas status válidos (confirmados, concluídos ou aceitos) conforme solicitado
    const appointments30d = appointments.filter(a => 
      new Date(a.date) > thirtyDaysAgo && 
      ['confirmed', 'completed', 'accepted'].includes(a.status)
    ).length;
    
    // Conversion rate: appointments / visits
    const convRate = visits30d > 0 ? (appointments30d / visits30d) * 100 : 0;

    // Origin
    const origins = analyticsEvents.reduce((acc: any, curr) => {
      acc[curr.origin] = (acc[curr.origin] || 0) + 1;
      return acc;
    }, {});
    const mainOrigin = Object.entries(origins).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || 'Direto';

    // Best service
  const services = appointments.reduce((acc: any, curr) => {
      acc[curr.serviceName] = (acc[curr.serviceName] || 0) + 1;
      return acc;
    }, {});
    const topService = Object.entries(services).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || '-';

    // Best time
    const times = appointments.reduce((acc: any, curr) => {
      const hour = curr.time.split(':')[0] + ':00';
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {});
    const bestTime = Object.entries(times).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || '-';

    // Weakest day
    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const dayCounts = appointments.reduce((acc: any, curr) => {
      const day = new Date(curr.date).getDay();
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }); // Skip Sunday if needed, but here 1-6 are common
    
    const weakestDayIndex = Object.entries(dayCounts).sort((a: any, b: any) => a[1] - b[1])[0]?.[0];
    const weakestDay = weakestDayIndex ? dayNames[parseInt(weakestDayIndex)] : '-';

    return {
      visits7d,
      visits30d,
      clicksBook,
      convRate,
      topService,
      bestTime,
      weakestDay,
      mainOrigin: mainOrigin === 'instagram' ? 'Instagram' : mainOrigin === 'direct' ? 'Direto' : 'Outros'
    };
  }, [analyticsEvents, appointments]);

  const confirmedAppointments = useMemo(() => 
    appointments.filter(a => a.status === 'confirmed'),
    [appointments]
  );

  const monthlyStats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const monthlyApps = appointments.filter(a => {
      if (!a.date) return false;
      const d = new Date(a.date + 'T12:00:00');
      return d.getMonth() === currentMonth && 
             d.getFullYear() === currentYear && 
             (a.status === 'confirmed' || a.status === 'completed');
    });

    const clients = new Set(monthlyApps.map(a => 
      a.clientWhatsapp?.replace(/\D/g, '') || a.clientEmail || a.clientName
    ));

    return {
      count: monthlyApps.length,
      clientsCount: clients.size
    };
  }, [appointments]);

  const daysSinceLastAppointment = useMemo(() => {
    const completedOrConfirmed = appointments
      .filter(a => (a.status === 'confirmed' || a.status === 'completed') && a.date)
      .sort((a, b) => b.date.localeCompare(a.date));

    if (completedOrConfirmed.length === 0) return null;

    const lastDate = new Date(completedOrConfirmed[0].date + 'T12:00:00');
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    
    const diffTime = today.getTime() - lastDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays >= 0 ? diffDays : null;
  }, [appointments]);

  const getContextualTip = () => {
    if (pendingCount > 0) return `Você tem ${pendingCount} reserva${pendingCount > 1 ? 's' : ''} aguardando confirmação.`;
    if (confirmedToday.length === 0) return 'Nenhuma reserva hoje. Que tal compartilhar seu link nos Stories para atrair clientes?';
    
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

    // Query: All pending appointments
    const qPending = query(
      collection(db, 'appointments'),
      where('professionalId', '==', user.uid),
      where('status', '==', 'pending'),
      orderBy('date', 'asc'),
      orderBy('time', 'asc')
    );

    const unsubToday = onSnapshot(qToday, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Appointment));
      // 1. RECEITA DIÁRIA: Incluindo tanto confirmados quanto já concluídos no faturamento e na lista de hoje
      const relevantToday = docs.filter(a => a.status === 'confirmed' || a.status === 'completed');
      setConfirmedToday(relevantToday);
      setDailyRevenue(relevantToday.reduce((acc, curr) => acc + (curr.price || 0) + (curr.travelFee || 0), 0));
    });

    const unsubPending = onSnapshot(qPending, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Appointment));
      setPendingCount(docs.length);
      setPendingRequests(docs);
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
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Appointment));
      setUnconfirmedTomorrow(docs);
    });

    // Query: All appointments to calculate metrics
    const qAll = query(
      collection(db, 'appointments'),
      where('professionalId', '==', user.uid),
      orderBy('date', 'desc'),
      limit(500)
    );

    const unsubAll = onSnapshot(qAll, (snapshot) => {
      const appointmentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      setAppointments(appointmentsData);
      
      const clientMap = new Map();
      const todayStr = getTodayLocale();

      appointmentsData.forEach((app) => {
        const key = app.clientWhatsapp?.replace(/\D/g, '') || app.clientEmail || app.clientName;
        if (!clientMap.has(key)) {
          clientMap.set(key, { lastDate: app.date });
        }
        const c = clientMap.get(key);
        if (app.date > c.lastDate) c.lastDate = app.date;
      });

      setTotalClientsCount(clientMap.size);

      // Faturamento Mensal & Retenção
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

      let mRevenue = 0;
      let pRevenue = 0;
      let retWeek = 0;

      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const nextWeekStr = nextWeek.toISOString().split('T')[0];

      appointmentsData.forEach(app => {
        if (app.status !== 'confirmed' && app.status !== 'completed') return;
        
        const appDate = new Date(app.date + 'T12:00:00');
        const appMonth = appDate.getMonth();
        const appYear = appDate.getFullYear();

        if (appMonth === currentMonth && appYear === currentYear) {
          mRevenue += (app.price || 0) + (app.travelFee || 0);
        } else if (appMonth === prevMonth && appYear === prevMonthYear) {
          pRevenue += (app.price || 0) + (app.travelFee || 0);
        }

        if (app.date >= todayStr && app.date <= nextWeekStr && app.status === 'confirmed') {
          retWeek++;
        }
      });

      setMonthlyRevenue(mRevenue);
      setPrevMonthlyRevenue(pRevenue);
      setReturningThisWeek(retWeek);
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
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as WaitlistEntry));
      setWaitlist(docs);
    });

    // Query: Blocked Schedules
    const blockedRef = collection(db, 'blocked_schedules');
    const dayOfWeek = parseLocalDate(today).getDay();
    const qBlocked = query(blockedRef, where('professionalId', '==', user.uid));
    
    const unsubBlocked = onSnapshot(qBlocked, (snap) => {
      const allBlocked = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      const todayBlocked = allBlocked.filter(b => {
        const isToday = b.date === today;
        const isRecurringToday = b.isRecurring && b.recurringDays?.includes(dayOfWeek);
        return isToday || isRecurringToday;
      });
      setBlockedSchedules(todayBlocked);
    });

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

    const unsubInactive = onSnapshot(qInactive, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInactiveClientsCount(docs.length);
      setInactiveClients(docs);
    });

    // Query: All services
    const qServices = query(
      collection(db, 'services'),
      where('professionalId', '==', user.uid)
    );

    const unsubServices = onSnapshot(qServices, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Service));
      setServices(docs);
    });

    return () => {
      unsubToday();
      unsubPending();
      unsubUnconfirmed();
      unsubAll();
      unsubWaitlist();
      unsubBlocked();
      unsubInactive();
      unsubServices();
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
    setProcessingId(id);
    devLog(`[CONFIRM APPOINTMENT] initiating handleRespond for ${id} in Dashboard`);
    
    if (appointment) {
      devLog(`[CONFIRM PRECHECK]`, {
        appointmentId: id,
        professionalId: appointment.professionalId,
        serviceId: appointment.serviceId,
        date: appointment.date || appointment.appointmentDate || appointment.selectedDate || appointment.scheduledDate,
        time: appointment.time || appointment.appointmentTime || appointment.selectedTime || appointment.startTime,
        status: appointment.status,
        clientName: appointment.clientName
      });
    }

    try {
      if (decision === 'confirmed') {
        if (!user?.uid) {
          // Relativamente crítico pois impede operação, mas logger padrão é console.error
          console.error("[DASHBOARD CONFIRM] No user UID available");
          toast.error("Sessão expirada. Entre novamente.");
          setTimeout(() => window.location.href = '/login', 2000);
          return;
        }
        await confirmAppointmentAtomic(id, user.uid);
        setConfirmedId(id);
        devLog(`[CONFIRM FLOW] SUCCESS: Booking ${id} confirmed.`);
        toast.success(`Reserva confirmada! ID: ${id}`);
        // Allow some time for the success state to be visible before it's removed by snapshot
        await new Promise(resolve => setTimeout(resolve, 800));
      } else {
        await declineAppointmentAtomic(id, user?.uid || '');
        toast.success('Reserva marcada como indisponível.');
        setIsConfirmRejectOpen(false);
        setRequestToReject(null);
      }
      
      if (selectedRequest?.id === id) {
        setIsModalOpen(false);
      }
    } catch (error: any) {
      // Critical error capture - keeping console.error but remove debug raw stack if desired, 
      // but the prompt says maintain console.error for critical ops catch.
      console.error(`[CONFIRM ERROR]`, error.message);
      handleBookingError(error);
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
      toast.success(`Lista de espera: modo ${newMode === 'auto' ? 'Automático' : 'Manual'} ativado`);
    } catch (e) {
      toast.error('Erro ao atualizar configuração.');
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
      toast.success('Convite enviado!');
    } catch (e) {
      toast.error('Erro ao enviar convite.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleComplete = async (id: string) => {
    setProcessingId(id);
    try {
      await updateAppointmentStatus(id, 'completed'); 
      setConfirmedId(id); // Re-using state for completion visual
      toast.success('Experiência concluída e registrada.');
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
    console.log("[PUSH UI] Notification supported:", "Notification" in window);
    console.log("[PUSH UI] ServiceWorker supported:", "serviceWorker" in navigator);
    console.log("[PUSH UI] PushManager supported:", "PushManager" in window);
    if ("Notification" in window) {
      console.log("[PUSH UI] permission:", Notification.permission);
    }
  }, []);

  const handleEnablePushNotifications = async () => {
    try {
      console.log("[PUSH BUTTON] clicked");
      setIsPushLoading(true);
      
      const success = await requestPermission();

      console.log("[PUSH BUTTON] requestPermission finished. Success:", success);

      if (success) {
        toast.success('Notificações ativadas com sucesso!');
      } else if (Notification.permission === 'denied') {
        toast.error('Notificações bloqueadas no navegador. Ative as permissões nas configurações do site.');
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
      
      const response = await fetch(`/api/reports/monthly?month=${currentMonthISO}&professionalId=${user.uid}`, {
        headers: {
          'x-professional-id': user.uid
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
      toast.success('Relatório gerado com sucesso!');
    } catch (error: any) {
      console.error("[REPORT ERROR]", error);
      toast.error(error.message || 'Erro ao baixar relatório. Tente novamente.');
    } finally {
      setIsReportLoading(false);
    }
  };

  return (
    <AppLayout activeRoute="dashboard">
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
              Olá, {profile?.name?.split(' ')[0]} ✨
            </h1>
            <div className="flex flex-col mt-1">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full",
                  profile?.plan === 'pro' || profile?.plan === 'essencial' 
                    ? "text-green-600 bg-green-50 border border-green-200" 
                    : "text-brand-stone"
                )}>
                  Plano {
                    profile?.plan === 'pro' ? 'Pro' : 
                    profile?.plan === 'essencial' ? 'Essencial' : 
                    'Gratuito'
                  }
                </span>
                {(profile?.plan === 'free' || !profile?.plan) && (
                  <Link to="/planos" className="text-[9px] text-brand-terracotta border border-brand-terracotta/20 px-2 py-0.5 rounded-full hover:bg-brand-terracotta hover:text-white transition-all uppercase tracking-widest font-bold">
                    Upgrade
                  </Link>
                )}
              </div>
              <p className="text-[11px] text-brand-stone font-medium mt-1">
                Você recebeu {appointments.filter(a => {
                  const d = new Date(a.date + 'T12:00:00');
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
              "px-5 py-2 rounded-full transition-all flex items-center gap-2",
              activeTab === "hoje" ? "bg-white shadow-sm text-brand-ink" : "text-brand-stone"
            )}
          >
            Hoje
          </button>
          <button 
            onClick={() => setActiveTab("geral")}
            className={cn(
              "px-5 py-2 rounded-full transition-all flex items-center gap-2 relative",
              activeTab === "geral" ? "bg-white shadow-sm text-brand-ink" : "text-brand-stone"
            )}
          >
            Geral
            {pendingCount > 0 ? (
              <span className="flex items-center justify-center min-w-[14px] h-[14px] px-1 bg-red-500 text-white rounded-full text-[8px] font-bold animate-pulse">
                {pendingCount}
              </span>
            ) : inactiveClientsCount > 0 && (
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
            {/* Header com Status do Plano */}
            <section className="px-6 mt-4">
              <div className="bg-brand-white p-6 rounded-[32px] border border-brand-mist shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-serif text-brand-ink italic">
                    {features.advancedDashboard 
                      ? "Performance completa dos últimos 30 dias."
                      : "Você já pode acompanhar visitas e cliques. 🔒 Insights completos estão no Plano Pro."}
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
                      <h3 className="text-[9px] font-bold uppercase tracking-[0.3em] text-brand-stone mb-1">
                        Growth Dashboard
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
                  <div className="space-y-1">
                    <p className="text-[8px] font-bold uppercase tracking-widest text-brand-stone">Taxa de Conversão</p>
                    <div className="flex items-center gap-2">
                        {features.advancedDashboard ? (
                          <>
                            <p className="text-2xl font-serif text-brand-ink">{growthMetrics.convRate.toFixed(1)}%</p>
                            <div className="w-1.5 h-1.5 rounded-full bg-brand-terracotta animate-pulse" />
                          </>
                        ) : (
                          <>
                            <p className="text-2xl font-serif text-brand-mist">---</p>
                            <Lock size={12} className="text-brand-mist" />
                          </>
                        )}
                      </div>
                      {!features.advancedDashboard && (
                        <p className="text-[7px] text-brand-stone font-medium uppercase tracking-widest">Disponível no plano Pro</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-[8px] font-bold uppercase tracking-widest text-brand-stone">Origem Principal</p>
                      <div className="flex items-center gap-2">
                        {features.advancedDashboard ? (
                          <>
                            <div className="w-4 h-4 rounded bg-brand-linen flex items-center justify-center">
                              {growthMetrics.mainOrigin === 'Instagram' ? <Instagram size={10} /> : <Share2 size={10} />}
                            </div>
                            <p className="text-2xl font-serif text-brand-ink">{growthMetrics.mainOrigin}</p>
                          </>
                        ) : (
                          <>
                            <p className="text-2xl font-serif text-brand-mist">---</p>
                            <Lock size={12} className="text-brand-mist" />
                          </>
                        )}
                      </div>
                      {!features.advancedDashboard && (
                        <p className="text-[7px] text-brand-stone font-medium uppercase tracking-widest">Disponível no plano Pro</p>
                      )}
                    </div>
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
                          <p className="text-[7px] text-brand-stone uppercase tracking-widest font-medium">Disponível no plano Pro</p>
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
                          <p className="text-[7px] text-brand-stone uppercase tracking-widest font-medium">Disponível no plano Pro</p>
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
                          <p className="text-[7px] text-brand-stone uppercase tracking-widest font-medium">Disponível no plano Pro</p>
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

            {/* Resumo Financeiro Hoje */}
            <div className="bg-brand-white p-8 rounded-[40px] border border-brand-mist shadow-sm">
              {confirmedToday.length === 0 && (
                <div className="mb-6 pb-6 border-b border-brand-linen">
                  <p className="text-sm font-serif text-brand-ink italic">Dia tranquilo até agora — vamos preencher?</p>
                  {daysSinceLastAppointment !== null && (
                    <p className="text-[9px] font-bold uppercase tracking-widest text-brand-stone mt-2">
                      Último agendamento há {daysSinceLastAppointment} {daysSinceLastAppointment === 1 ? 'dia' : 'dias'}
                    </p>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-8 divide-x divide-brand-linen">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand-stone mb-2">Faturamento Hoje</p>
                  <p className="text-3xl font-serif text-brand-ink">{formatCurrency(dailyRevenue)}</p>
                </div>
                <div className="pl-8">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand-stone mb-2">Agendamentos</p>
                  <p className="text-3xl font-serif text-brand-ink">{confirmedToday.length}</p>
                </div>
              </div>
            </div>

            {/* Timeline de Hoje */}
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold text-brand-stone uppercase tracking-[0.3em]">Agenda de Hoje</h3>
              </div>

              {confirmedToday.length > 0 ? (
                <div className="space-y-4">
                  {confirmedToday.map((appt) => (
                    <div 
                      key={appt.id} 
                      className={cn(
                        "bg-brand-white p-6 rounded-[32px] border border-brand-mist shadow-sm flex items-center justify-between group",
                        appt.status === 'concluido' && "opacity-50"
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
                            ['confirmed', 'accepted'].includes(appt.status) ? "text-green-600 bg-green-50" : "text-brand-stone bg-brand-linen"
                          )}>
                            {['confirmed', 'accepted'].includes(appt.status) ? 'Confirmado' : appt.status}
                          </span>
                        </div>
                      </div>
                      <Link to="/agenda" className="p-3 text-brand-stone hover:text-brand-terracotta">
                        <ChevronRight size={18} />
                      </Link>
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
                  <div className="text-center">
                    <p className="text-[8px] font-bold uppercase tracking-widest text-brand-stone mb-1">Avaliações</p>
                    <p className="text-xl font-serif text-brand-ink">{profile?.totalReviews || 0}</p>
                  </div>
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
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-brand-stone uppercase tracking-widest">Lista de Espera</span>
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
                          Indisponível {blockedSchedules[0].date === getTodayLocale() ? 'hoje' : formatDateKey(parseLocalDate(blockedSchedules[0].date))} às {blockedSchedules[0].startTime}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Retention Status */}
                  <div className="flex flex-col gap-4 border-t border-brand-linen pt-6">
                    {inactiveClientsCount > 0 ? (
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
                                <p className="text-[9px] text-brand-stone italic">Não volta desde {client.lastDate?.split('-').reverse().join('/')}</p>
                              </div>
                              {idx === 0 && (client.clientWhatsapp || client.whatsapp) && (
                                <button 
                                  onClick={() => {
                                    const firstName = (client.clientName || client.name).split(' ')[0];
                                    const msg = `Oi ${firstName} ✨ Saudades! Notamos que faz um tempinho que você não vem nos visitar. Que tal garantir um horário agora?`;
                                    window.open(buildWhatsappLink(client.clientWhatsapp || client.whatsapp || '', msg), '_blank');
                                  }}
                                  className="bg-[#25D366] text-white p-2 rounded-lg hover:scale-105 transition-transform"
                                  title="Enviar mensagem"
                                >
                                  <MessageCircle size={14} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-2">
                          <Link 
                            to="/clients" 
                            className="flex-1 py-3 bg-brand-linen text-brand-ink rounded-xl text-[9px] font-bold uppercase tracking-widest text-center hover:bg-brand-mist transition-colors"
                          >
                            Ver clientes
                          </Link>
                          {inactiveClients.length > 0 && (inactiveClients[0].clientWhatsapp || inactiveClients[0].whatsapp) && (
                            <button 
                              onClick={() => {
                                const client = inactiveClients[0];
                                const firstName = (client.clientName || client.name).split(' ')[0];
                                const msg = `Oi ${firstName} ✨ Saudades! Notamos que faz um tempinho que você não vem nos visitar. Que tal garantir um horário agora?`;
                                window.open(buildWhatsappLink(client.clientWhatsapp || client.whatsapp || '', msg), '_blank');
                              }}
                              className="flex-1 py-3 bg-brand-ink text-brand-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-brand-espresso transition-colors"
                            >
                              Enviar mensagem
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-brand-stone uppercase tracking-widest">Retenção: ok</span>
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                      </div>
                    )}
                  </div>

                  {!(waitlist && waitlist.length > 0) && !(blockedSchedules && blockedSchedules.length > 0) && inactiveClientsCount === 0 && (
                    <div className="pt-4 text-center">
                      <p className="text-sm font-serif text-brand-stone italic">Tudo em dia por aqui.</p>
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
                    <div className="p-2 bg-[#25D366]/10 text-[#25D366] rounded-xl">
                      <MessageCircle size={20} />
                    </div>
                    <div>
                      <h3 className="text-[9px] font-bold uppercase tracking-[0.3em] text-brand-stone mb-1">
                        WhatsApp Inteligente
                      </h3>
                      <p className="text-sm font-serif text-brand-ink italic">Automação de mensagens</p>
                    </div>
                  </div>
                  <Link 
                    to="/perfil" 
                    className="text-[9px] font-bold uppercase tracking-widest text-brand-terracotta hover:underline"
                  >
                    Configurar
                  </Link>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-brand-parchment/30 rounded-2xl border border-brand-mist/50">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        profile?.whatsapp ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-brand-stone/30"
                      )} />
                      <span className="text-[10px] font-bold text-brand-ink uppercase tracking-widest">
                        {profile?.whatsapp ? 'WhatsApp Conectado' : 'WhatsApp não configurado'}
                      </span>
                    </div>
                    <span className="text-[10px] text-brand-stone italic font-medium">
                      {profile?.whatsapp || '---'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-brand-white border border-brand-mist rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Zap size={14} className={profile?.whatsappNotificationsEnabled ? "text-[#25D366]" : "text-brand-stone/30"} />
                        <span className="text-[10px] font-bold text-brand-ink uppercase tracking-widest">Confirmações</span>
                      </div>
                      <span className={cn(
                        "text-[8px] font-bold uppercase px-2 py-0.5 rounded-full",
                        profile?.whatsappNotificationsEnabled ? "bg-green-50 text-green-600" : "bg-brand-parchment text-brand-stone"
                      )}>
                        {profile?.whatsappNotificationsEnabled ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    <div className="p-4 bg-brand-white border border-brand-mist rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Clock size={14} className={profile?.whatsappNotificationsEnabled ? "text-[#25D366]" : "text-brand-stone/30"} />
                        <span className="text-[10px] font-bold text-brand-ink uppercase tracking-widest">Lembretes</span>
                      </div>
                      <span className={cn(
                        "text-[8px] font-bold uppercase px-2 py-0.5 rounded-full",
                        profile?.whatsappNotificationsEnabled ? "bg-green-50 text-green-600" : "bg-brand-parchment text-brand-stone"
                      )}>
                        {profile?.whatsappNotificationsEnabled ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>

                  {!profile?.whatsapp && (
                    <div className="text-center py-4 px-6 bg-brand-linen/30 rounded-2xl border border-dashed border-brand-terracotta/30">
                      <p className="text-[10px] text-brand-ink italic mb-3">Conecte o WhatsApp para automatizar confirmações e lembretes.</p>
                      <Link to="/perfil">
                        <button className="text-[9px] font-bold uppercase tracking-widest bg-brand-terracotta text-white px-4 py-2 rounded-full hover:scale-105 transition-transform">
                          Configurar WhatsApp
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
          <ActivationChecklist 
            profile={profile}
            appointments={appointments}
            services={services}
            onShareClick={() => setIsShareModalOpen(true)}
          />

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
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-amber-900">
                        Anti No-Show: Clientes de Amanhã
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
                          href={buildWhatsappLink(app.clientWhatsapp || '', `Olá ${app.clientName.split(' ')[0]} ✨ Vi que ainda não confirmou sua presença para amanhã às ${app.time}. Confirmado?`)}
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
                  {confirmedToday.length} Atendimentos
                </span>
              </div>

              <div className="space-y-4">
                {confirmedToday.length > 0 ? (
                  confirmedToday.map((appt) => (
                    <div 
                      key={appt.id} 
                      className={cn(
                        "bg-brand-white p-6 rounded-[32px] border border-brand-mist shadow-sm flex items-center justify-between group transition-all hover:border-brand-terracotta",
                        appt.status === 'concluido' && "opacity-60 bg-brand-parchment/30"
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
                            {appt.status === 'concluido' && <Check size={12} className="text-green-600" />}
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
                          href={buildWhatsappLink(appt.clientWhatsapp || '', `Oi ${appt.clientName.split(' ')[0]} ✨ tudo bem?`)}
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

          {!isSupported ? (
              <div className="bg-brand-white p-8 rounded-[40px] border border-brand-mist shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-brand-linen text-brand-ink rounded-2xl flex items-center justify-center shrink-0">
                    <Smartphone size={28} />
                  </div>
                  <div className="max-w-md">
                    <h4 className="text-base font-serif text-brand-ink">Notificações disponíveis no app instalado</h4>
                    <p className="text-xs text-brand-stone font-light italic mt-1 leading-relaxed">
                      Para receber alertas de novas reservas no iPhone, abra o Nera pelo Safari, toque em Compartilhar e adicione à Tela de Início. Depois, entre pelo ícone instalado e ative as notificações.
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => toast.info('Siga as instruções acima para ativar!')}
                  className="px-8 py-4 bg-brand-linen text-brand-ink rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-brand-mist transition-colors shrink-0"
                >
                  Entendi
                </button>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-brand-white p-8 rounded-[40px] border border-brand-mist shadow-sm flex flex-col md:flex-row items-center justify-between gap-6"
              >
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-brand-linen text-brand-ink rounded-2xl flex items-center justify-center shrink-0">
                    <Zap size={28} />
                  </div>
                  <div>
                    <h4 className="text-base font-serif text-brand-ink">Receba novas reservas em tempo real</h4>
                    <p className="text-xs text-brand-stone font-light italic mt-1">
                      Ative as notificações para ser avisada assim que uma cliente fizer uma reserva.
                    </p>
                  </div>
                </div>
                
                {isSubscribed ? (
                  <div className="flex items-center gap-2 px-6 py-3 bg-green-50 text-green-600 rounded-full text-[10px] font-bold uppercase tracking-widest border border-green-100">
                    <Check size={14} /> Notificações ativadas
                  </div>
                ) : permission === 'denied' ? (
                  <div className="flex items-center gap-2 px-6 py-3 bg-red-50 text-red-600 rounded-full text-[10px] font-bold uppercase tracking-widest border border-red-100">
                    <X size={14} /> Notificações bloqueadas no navegador
                  </div>
                ) : (
                  <button
                    onClick={handleEnablePushNotifications}
                    disabled={isPushLoading}
                    className="px-8 py-4 bg-brand-ink text-brand-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-transform shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isPushLoading && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    {isPushLoading ? 'Ativando...' : 'Ativar notificações'}
                  </button>
                )}
              </motion.div>
            )}

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
                  <h3 className="text-[9px] font-bold uppercase tracking-[0.3em] text-amber-900">
                    Alerta Anti No-Show
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
                        href={buildWhatsappLink(app.clientWhatsapp || '', `Olá ${app.clientName.split(' ')[0]} ✨ Vi que ainda não confirmou sua presença para amanhã às ${app.time}. Podemos contar com você?`)}
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
                        {block.date === getTodayLocale() ? 'Hoje' : formatDateKey(parseLocalDate(block.date))} às {block.startTime}
                      </p>
                    </div>
                    <button 
                      onClick={async () => {
                        try {
                          await deleteDoc(doc(db, 'blocked_schedules', block.id));
                          toast.success('Agenda liberada com sucesso.');
                        } catch {
                          toast.error('Erro ao liberar agenda.');
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
                      <p className="text-[8px] text-brand-stone uppercase font-bold">{appt.date.split('-').slice(1).reverse().join('/')}</p>
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
          <Link to="/clients" className="text-[10px] font-bold uppercase tracking-widest text-brand-terracotta hover:underline">
            Ver detalhes
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
              Indique uma colega profissional. Quando ela se cadastrar com seu link e usar por 30 dias, <strong className="text-brand-ink">você ganha 1 mês grátis</strong>.
            </p>
            <div className="flex items-center gap-3 bg-brand-parchment border border-brand-mist rounded-2xl p-4">
              <span className="text-[11px] text-brand-stone font-mono truncate flex-1">{referralLink}</span>
              <button
                onClick={() => { navigator.clipboard.writeText(referralLink); toast.success('Link copiado!'); }}
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
                    const url = `https://nera.app/p/${profile?.slug}`;
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
                    const url = `https://nera.app/p/${profile?.slug}`;
                    navigator.clipboard.writeText(url);
                    toast.success('Link copiado. Abra o Instagram e cole nos seus Stories!');
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
                    const url = `https://nera.app/p/${profile?.slug}`;
                    navigator.clipboard.writeText(url);
                    toast.success('Link copiado para a área de transferência.');
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
                  "Acabei de abrir novos horários ✨ Reserve online comigo: nera.app/p/{profile?.slug}"
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
                      <p className="text-brand-ink font-light">{selectedRequest.date.split('-').reverse().join('/')}</p>
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
                    
                    <PremiumButton 
                      feature="waitlist"
                      onClick={() => setIsWaitlistModalOpen(true)}
                      className="p-5 bg-brand-linen rounded-[24px] border border-brand-mist flex flex-col items-start gap-2 hover:bg-brand-white transition-all group"
                    >
                      <p className="text-[10px] text-brand-terracotta uppercase tracking-widest font-bold">Vaga Presa?</p>
                      <div className="flex items-center gap-2">
                         <Users size={14} className="text-brand-terracotta group-hover:scale-110 transition-transform" />
                         <span className="text-[10px] text-brand-ink uppercase tracking-widest">Avisar Lista de Espera</span>
                      </div>
                    </PremiumButton>
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
                          <span>{entry.requestedDate.split('-').reverse().join('/')}</span>
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
        workingHours={profile?.workingHours || {}}
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
        averageTicket={appointments.length > 0 ? monthlyRevenue / appointments.length : 0}
      />
    </AppLayout>
  );
}

// Sub-component for Dashboard Block Flow (DEPRECATED - using unified modal above)
// removed DashboardBlockModal...
