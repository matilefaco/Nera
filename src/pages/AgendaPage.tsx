import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../AuthContext';
import { db, handleBookingError, createManualAppointment, updateAppointmentStatus, sanitizeAppointment } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, addDoc, serverTimestamp, setDoc, deleteDoc, getDocs, getDoc, limit } from 'firebase/firestore';
import { 
  Calendar, Clock, MessageCircle, 
  CheckCircle2, ChevronLeft, ChevronRight, Plus, MapPin,
  Users, List, Settings, Check, Sparkles, X, Lock, RefreshCw, Star,
  TrendingUp, Trash2, ArrowUpRight, Filter, MoreHorizontal, ArrowRight,
  CalendarCheck2, AlertCircle, Info, Share2, Search
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatCurrency, parseLocalDate, formatLocalDate, getTodayLocale, formatDateKey, buildWhatsappLink, cn, cleanWhatsapp } from '../lib/utils';
import { isPendingStatus, isCancelledStatus, isConfirmedLikeStatus, isCompletedStatus, isActiveSlotStatus, isInactiveStatus } from '../constants/appointmentStatus';
import { getAvailableSlots as getAvailableSlotsOld, getDayAvailability } from '../lib/bookingUtils';
import { getAvailableSlots, IntelligentFit } from '../utils/scheduleSuggestions';
import PremiumButton from '../components/PremiumButton';
import { notify } from '../lib/notify';
import { Appointment } from '../types';
import Logo from '../components/Logo';
import AppLayout from '../components/AppLayout';
import { AnimatePresence } from 'motion/react';

import WeekView from '../components/WeekView';
import DayView from '../components/DayView';
import MonthView from '../components/MonthView';

import BlockAvailabilityModal from '../components/BlockAvailabilityModal';
import WaitlistCentralModal from '../components/WaitlistCentralModal';
import { exportAppointmentsCsv } from '../lib/exportCsv';
import QuickBlockModal from '../components/QuickBlockModal';
import { FirstVisitTip } from '../components/FirstVisitTip';

import { useUpgradeTriggers } from '../hooks/useUpgradeTriggers';
import { usePlanFeatures } from '../hooks/usePlanFeatures';
import UpgradeModal from '../components/UpgradeModal';
import { PageErrorBoundary } from '../components/PageErrorBoundary';
import { AgendaSkeleton } from '../components/ui/AgendaSkeleton';

const blockedSchedulesCache = new Map<string, { data: any[], fetchedAt: number }>();

export default function AgendaPage() {
  const { user, profile } = useAuth();
  const { 
    isUpgradeModalOpen, 
    upgradeFeature, 
    usageCount, 
    closeUpgradeModal, 
    checkFeatureAccess,
    openUpgradeModal
  } = useUpgradeTriggers();
  const { features } = usePlanFeatures();

  const [view, setView] = useState<'month' | 'week' | 'day'>(() => {
    const saved = localStorage.getItem('nera_agenda_view') as any;
    if (saved) return saved;
    return window.innerWidth < 768 ? 'day' : 'week';
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const dateFromUrl = searchParams.get('date');
  const appointmentIdFromUrl = searchParams.get('appointment');

  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const [appointments, setAppointments] = useState<any[]>([]);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(dateFromUrl || getTodayLocale());
  const [allAppointments, setAllAppointments] = useState<any[]>([]);
  const [allBlockedSchedules, setAllBlockedSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(appointmentIdFromUrl);

  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [isQuickBlockOpen, setIsQuickBlockOpen] = useState(false);
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false);
  const [quickBlockTime, setQuickBlockTime] = useState('');
  
  const [blockedSchedules, setBlockedSchedules] = useState<any[]>([]);
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [showNavTip, setShowNavTip] = useState(() => {
    return localStorage.getItem('nera_agenda_nav_tip_dismissed') !== 'true';
  });

  const [blockStartTime, setBlockStartTime] = useState('09:00');
  const [blockEndTime, setBlockEndTime] = useState('18:00');

  // Sync date from URL if it changes
  useEffect(() => {
    if (dateFromUrl && dateFromUrl !== selectedDate) {
      setSelectedDate(dateFromUrl);
    }
  }, [dateFromUrl]);

  // Handle direct appointment link
  useEffect(() => {
    if (appointmentIdFromUrl && user) {
      const fetchAppt = async () => {
        try {
          const apptSnap = await getDoc(doc(db, 'appointments', appointmentIdFromUrl));
          if (apptSnap.exists()) {
            const data = apptSnap.data();
            if (data.date !== selectedDate) setSelectedDate(data.date);
            setHighlightedId(appointmentIdFromUrl);
          }
        } catch (err) {
          console.error("Error fetching linked appointment:", err);
        }
      };
      fetchAppt();
    }
  }, [appointmentIdFromUrl, user]);

  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [openSlots, setOpenSlots] = useState<string[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [notifyingWaitlist, setNotifyingWaitlist] = useState<string | null>(null);
  const [manualClient, setManualClient] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualService, setManualService] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [handledIds, setHandledIds] = useState<string[]>([]);
  const [manualDate, setManualDate] = useState(selectedDate);
  const [manualTime, setManualTime] = useState('');
  const [services, setServices] = useState<any[]>([]);
  // Intelligent Fit State
  const [isCreating, setIsCreating] = useState(false);
  const [blockToDelete, setBlockToDelete] = useState<any | null>(null);
  
  // Reserva Search
  const [searchCode, setSearchCode] = useState('');
  const [isSearchingCode, setIsSearchingCode] = useState(false);

  const handleCodeSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = searchCode.trim().toUpperCase();
    if (!code) return;

    setIsSearchingCode(true);

    try {
      // 1. Try finding by reservationCode (exact or parts)
      let q = query(
        collection(db, 'appointments'),
        where('professionalId', '==', user?.uid),
        where('reservationCode', '==', code)
      );
      
      let snap = await getDocs(q);

      // 2. Fallback: search by slug if code contains NR-
      if (snap.empty) {
        const slug = code.toLowerCase();
        q = query(
          collection(db, 'appointments'),
          where('professionalId', '==', user?.uid),
          where('manageSlug', '==', slug)
        );
        snap = await getDocs(q);
      }

      // 3. Fallback: search by token
      if (snap.empty) {
        q = query(
          collection(db, 'appointments'),
          where('professionalId', '==', user?.uid),
          where('token', '==', code.toLowerCase())
        );
        snap = await getDocs(q);
      }

      if (!snap.empty) {
        const appt = { id: snap.docs[0].id, ...snap.docs[0].data() };
        setSelectedAppointment(appt);
        setIsDetailsOpen(true);
        setSearchCode('');
      } else {
        notify.error('Nenhuma reserva encontrada com esse código.');
      }
    } catch (err) {
      console.error('[RESERVATION SEARCH] Error:', err);
      notify.error('Erro ao buscar reserva.');
    } finally {
      setIsSearchingCode(false);
    }
  };

  // Reset FAB when clicking elsewhere or changing state
  useEffect(() => {
    const handleScroll = () => setIsFabOpen(false);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'services'),
      where('professionalId', '==', user.uid),
      where('active', '==', true)
    );
    getDocs(q).then(snap => {
      setServices(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }).catch(err => {
      console.error("[AgendaPage] Failed to fetch services:", err);
    });
  }, [user]);

  // Use derived appointments instead of fetching daily
  useEffect(() => {
    // Derived Appointments
    const dailyAppointments = allAppointments.filter(a => a.date === selectedDate);
    
    // Derived audit & conflicts
    const audit: Record<string, Appointment[]> = {};
    dailyAppointments.forEach(a => {
      if (isConfirmedLikeStatus(a.status)) {
        if (!audit[a.time]) audit[a.time] = [];
        audit[a.time].push(a as any);
      }
    });
    setConflicts(Object.values(audit).filter(list => list.length > 1) as any);
    setAppointments(dailyAppointments as any);

    // Derived Blocks
    const dayOfWeek = parseLocalDate(selectedDate).getDay();
    const dailyBlocks = allBlockedSchedules.filter(b => {
      const isToday = b.date === selectedDate;
      const isRecurringToday = b.isRecurring && b.recurringDays?.includes(dayOfWeek);
      return isToday || isRecurringToday;
    });
    setBlockedSchedules(dailyBlocks as any);
  }, [allAppointments, allBlockedSchedules, selectedDate]);

  // Fetch all appointments for week/month view with a safe window
  useEffect(() => {
    if (!user) return;
    
    // We base the window on 'selectedDate' (which is YYYY-MM-DD)
    const baseDate = new Date(selectedDate + 'T12:00:00');
    
    // Calculate visibleStart: 30 days before baseDate
    const start = new Date(baseDate);
    start.setDate(start.getDate() - 30);
    const visibleStartStr = formatDateKey(start);
    
    // Calculate visibleEnd: 60 days after baseDate
    const end = new Date(baseDate);
    end.setDate(end.getDate() + 60);
    const visibleEndStr = formatDateKey(end);

    const q = query(
      collection(db, 'appointments'),
      where('professionalId', '==', user.uid),
      where('date', '>=', visibleStartStr),
      where('date', '<=', visibleEndStr)
    );

    const unsubAll = onSnapshot(q, (snapshot) => {
      try {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        // Sort in memory to avoid complex index requirements while keeping standard behavior
        docs.sort((a, b) => {
          if (a.date === b.date) {
            return (a.time || '').localeCompare(b.time || '');
          }
          return (a.date || '').localeCompare(b.date || '');
        });
        setAllAppointments(docs);
        setIsInitialLoading(false);
      } catch (err) {
        console.error("Error in onSnapshot callback:", err);
        setIsInitialLoading(false);
      }
    }, (error) => {
      console.error('[AgendaPage] Subscription error (allAppointments):', error);
      setIsInitialLoading(false);
      // Fallback: If missing index, try to gracefully fallback to manual filtering
      if (error.message.includes('index')) {
        console.warn('[AgendaPage] Firestore index required: appointments professionalId ASC, date ASC');
        // Em produção, não exibir tela vermelha. Manter o estado seguro vazio ou dados anteriores.
      }
    });

    return () => {
      unsubAll();
    };
  }, [user]);

  const fetchBlockedSchedules = async (forceRefetch = false) => {
    if (!user) return;
    const CACHE_TTL = 5 * 60 * 1000;
    const cached = blockedSchedulesCache.get(user.uid);
    const now = Date.now();

    if (!forceRefetch && cached && now - cached.fetchedAt < CACHE_TTL) {
      setAllBlockedSchedules(cached.data);
      return;
    }

    try {
      const blockedRef = collection(db, 'blocked_schedules');
      const qBlocked = query(blockedRef, where('professionalId', '==', user.uid));
      const snap = await getDocs(qBlocked);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      blockedSchedulesCache.set(user.uid, { data, fetchedAt: now });
      setAllBlockedSchedules(data);
    } catch (err) {
      console.error("Error fetching blocked schedules:", err);
    }
  };

  useEffect(() => {
    fetchBlockedSchedules();
  }, [user]);

  // Save view preference
  useEffect(() => {
    localStorage.setItem('nera_agenda_view', view);
  }, [view]);

  // Calculate Week Start (Monday)
  const weekStart = React.useMemo(() => {
    const d = parseLocalDate(selectedDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(d.setDate(diff));
    start.setHours(0, 0, 0, 0);
    return start;
  }, [selectedDate]);

  // Calculate Open Slots (Official Availability Rule)
  const availability = React.useMemo(() => {
    if (!profile?.workingHours || !selectedDate) return null;
    
    return getDayAvailability({
      selectedDate,
      serviceDuration: 60,
      workingHours: profile.workingHours,
      appointments,
      blockedSchedules
    });
  }, [selectedDate, appointments, blockedSchedules, profile]);

  useEffect(() => {
    if (availability) {
      setOpenSlots(availability.availableSlots);
    }
  }, [availability]);

  const changeDate = (days: number) => {
    const date = parseLocalDate(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(formatDateKey(date));
  };

  const setDateToToday = () => {
    setSelectedDate(getTodayLocale());
  };

  const minutesToTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const handleUnblockSchedule = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'blocked_schedules', id));
      
      const cached = blockedSchedulesCache.get(user.uid);
      if (cached) {
        const newData = cached.data.filter(b => b.id !== id);
        blockedSchedulesCache.set(user.uid, { ...cached, data: newData });
        setAllBlockedSchedules(newData);
      } else {
        setAllBlockedSchedules(prev => prev.filter(b => b.id !== id));
      }

      notify.success('Bloqueio removido.');
    } catch {
      notify.error('Não foi possível remover o bloqueio.');
    }
  };

  const handleBlockClick = (block: any) => {
    setBlockToDelete(block);
  };

  // Smart Suggestions
  const recommendedSlots = React.useMemo(() => {
    if (!manualService || !manualDate || !profile?.workingHours) return { bestSlot: null, otherSlots: [], intelligentFits: [] };
    const selectedSvc = services.find(s => s.id === manualService);
    const duration = Number(selectedSvc?.duration) || 60;
    
    // Use the custom helper for Phase 2 (Ranking)
    return getAvailableSlots({
      date: manualDate,
      serviceDuration: duration,
      appointments: allAppointments,
      blockedSchedules: allBlockedSchedules,
      workingHours: profile.workingHours
    });
  }, [manualService, manualDate, allAppointments, allBlockedSchedules, profile, services]);

  const handleApplyFit = (fit: IntelligentFit) => {
    if (fit.type === 'adjustment' && fit.adjustment) {
      notify.info(
        `Oportunidade Nera: Mova ${fit.adjustment.clientName} das ${fit.adjustment.originalTime} para as ${fit.adjustment.newTime}. Isso liberará as ${fit.time} para este novo atendimento.`,
        { duration: 8000 }
      );
    } else {
      setManualTime(fit.time);
      notify.success('Horário de encaixe selecionado!');
    }
  };

  const handleCreateManual = async () => {
    if (!user || !manualClient || !manualDate || !manualTime) {
      notify.error('Preencha nome da cliente, data e horário.');
      return;
    }
    setIsCreating(true);
    try {
      const selectedSvc = services.find(s => s.id === manualService);
      await createManualAppointment({
        professionalId: user.uid,
        clientName: manualClient.trim(),
        clientWhatsapp: cleanWhatsapp(manualPhone),
        serviceId: manualService || 'manual',
        serviceName: selectedSvc?.name || manualService || 'Atendimento Manual',
        duration: Number(selectedSvc?.duration) || 60,
        price: Number(manualPrice) || selectedSvc?.price || 0,
        travelFee: 0,
        totalPrice: Number(manualPrice) || selectedSvc?.price || 0,
        date: manualDate,
        time: manualTime,
        locationType: 'studio',
        notes: 'Agendamento criado manualmente'
      });
      notify.success(`Agendamento de ${manualClient} criado para ${manualTime}.`);
      setManualClient(''); setManualPhone(''); setManualService('');
      setManualPrice(''); setManualTime('');
      setIsManualModalOpen(false);
    } catch {
      notify.error('Não foi possível criar o agendamento.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleComplete = async (app: any) => {
    if (!user) return;
    setLoading(app.id);
    try {
      const idToken = await user.getIdToken();
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
        professionalId: user.uid,
        clientDisplayName: app.clientName,
        clientNeighborhood: app.neighborhood || '',
        token,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      
      notify.success('Experiência finalizada! Redirecionando para envio de convite de avaliação.');
      const reviewLink = `${window.location.origin}/review/${token}`;
      try {
        await navigator.clipboard.writeText(reviewLink);
        notify.success('Link de avaliação copiado para área de transferência!');
      } catch {
        // Ignorar erro do clipboard
      }
      
      const text = `Oi, ${app.clientName} 🤎\nObrigada pela visita de hoje.\nSe puder, deixe sua avaliação por aqui:\n${reviewLink}`;
      window.open(`https://wa.me/55${cleanWhatsapp(app.clientWhatsapp)}?text=${encodeURIComponent(text)}`, '_blank');
      setIsDetailsOpen(false);

    } catch (err) {
      handleBookingError(err);
    } finally {
      setLoading(null);
    }
  };

  const handleRespond = async (id: string, decision: 'confirmed' | 'cancelled_by_professional', appointment?: any) => {
    if (loading === id) return;
    
    if (!user?.uid) {
      notify.error("Sessão expirada. Entre novamente.");
      return;
    }
    
    setLoading(id);
    
    // Optimistic Update immediately
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
        notify.success('Reserva confirmada!');
      } else {
        if (appointment?.status === 'confirmed') {
          const res = await fetch(`/api/appointments/${id}/cancel-by-professional`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json"
            }
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Erro ao cancelar (${res.status})`);
          }
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
        }
        notify.success('Reserva marcada como indisponível.');
      }
    } catch (err: any) {
      // Revert optimistic update
      setOptimisticUpdates(prev => {
        const reset = { ...prev };
        delete reset[id];
        return reset;
      });
      console.error("[AGENDA FLOW ERROR]", err);
      notify.error(err, 'Não foi possível concluir. Tente novamente.');
    } finally {
      setLoading(null);
    }
  };

  const handleNotifyWaitlist = async (time: string) => {
    if (!user) return;
    setNotifyingWaitlist(time);
    try {
      notify.info(`Buscando clientes para as ${time}...`, {
        description: 'Notificando prioritários compatíveis.'
      });
    } finally {
      setTimeout(() => setNotifyingWaitlist(null), 1000);
    }
  };

  const [optimisticUpdates, setOptimisticUpdates] = useState<Record<string, string>>({});

  const displayedAppointments = React.useMemo(() => {
    return appointments.map(app => {
      if (optimisticUpdates[app.id]) {
        return { ...app, status: optimisticUpdates[app.id] as any };
      }
      return app;
    });
  }, [appointments, optimisticUpdates]);

  const confirmedAppts = displayedAppointments.filter(a => isConfirmedLikeStatus(a.status) || isCompletedStatus(a.status));
  const pendingRequests = displayedAppointments.filter(a => isPendingStatus(a.status));

  // Mapped Timeline items
  const timelineItems = React.useMemo(() => {
    const items: any[] = [];
    
    // Calculate slots with multiple confirmed/pending appointments
    const counts: Record<string, number> = {};
    displayedAppointments.forEach(a => {
      if (isActiveSlotStatus(a.status)) {
        counts[a.time] = (counts[a.time] || 0) + 1;
      }
    });

    // Add appointments
    displayedAppointments.forEach(app => {
      // Don't show cancelled or rejected here to keep timeline clean
      if (isInactiveStatus(app.status)) return;

      items.push({
        type: 'appointment',
        time: app.time,
        data: app,
        status: app.status,
        hasConflict: (counts[app.time] > 1 && isActiveSlotStatus(app.status)) || app.status === 'pending_conflict'
      });
    });

    // Add blocked schedules
    blockedSchedules.forEach(block => {
      items.push({
        type: 'block',
        time: block.startTime,
        endTime: block.endTime,
        data: block,
        reason: block.reason || 'Bloqueado'
      });
    });

    // Add free slots
    openSlots.forEach(slot => {
      // Filter out slots that already have an appointment or a block starting exactly at this time
      // Regra crítica: se houver QUALQUER appointment bloqueante, remove o slot livre.
      const hasStrictMeeting = displayedAppointments.some(a => a.time === slot && isActiveSlotStatus(a.status));
      const hasStrictBlock = blockedSchedules.some(b => b.startTime === slot);
      
      if (!hasStrictMeeting && !hasStrictBlock) {
        items.push({
          type: 'free',
          time: slot
        });
      }
    });

    return items.sort((a, b) => a.time.localeCompare(b.time));
  }, [displayedAppointments, blockedSchedules, openSlots]);

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const isSelectedDateToday = selectedDate === getTodayLocale();

  const handleNavigate = (direction: 'prev' | 'next') => {
    if (view === 'day') {
      changeDate(direction === 'next' ? 1 : -1);
    } else if (view === 'week') {
      const d = parseLocalDate(selectedDate);
      d.setDate(d.getDate() + (direction === 'next' ? 7 : -7));
      setSelectedDate(formatDateKey(d));
    } else if (view === 'month') {
      const d = parseLocalDate(selectedDate);
      d.setMonth(d.getMonth() + (direction === 'next' ? 1 : -1));
      setSelectedDate(formatDateKey(d));
    }
  };

  if (isInitialLoading) {
    return <AgendaSkeleton />;
  }

  return (
    <AppLayout activeRoute="agenda">
      <PageErrorBoundary 
        title="Não foi possível carregar sua agenda agora." 
        message="Sincronizar a agenda sofreu um breve desencontro. Recarregar costuma resolver."
      >
      <FirstVisitTip 
        pageKey="agenda"
        title="Sua agenda visual"
        description="Veja e gerencie todos os agendamentos em formato de calendário. Clique em qualquer horário para ver os detalhes."
      />
      <div className={cn(
        "p-5 md:p-12 w-full mx-auto transition-all",
        view === 'month' ? "max-w-4xl" : "max-w-7xl"
      )}>
        
        {/* 1. HEADER LIMPO */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 mt-2">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <h1 className="text-lg font-serif text-brand-ink leading-tight">
                {view === 'month' 
                  ? formatLocalDate(selectedDate, { month: 'long', year: 'numeric' })
                  : view === 'week' 
                    ? `Semana de ${formatLocalDate(formatDateKey(weekStart), { day: 'numeric', month: 'short' })}`
                    : formatLocalDate(selectedDate, { day: 'numeric', month: 'long' })
                }
              </h1>
              {view === 'day' && isSelectedDateToday && (
                <span className="text-[10px] text-brand-terracotta font-bold uppercase tracking-[0.2em] mt-0.5">Hoje</span>
              )}
            </div>

            {/* VIEW TOGGLE */}
            <div className="flex bg-brand-linen/50 p-1.5 rounded-2xl text-[9px] font-bold uppercase tracking-widest border border-brand-mist/20">
              <button 
                onClick={() => setView('day')}
                className={cn("flex-1 px-4 py-3 min-h-[44px] rounded-xl transition-all flex items-center justify-center", view === 'day' ? "bg-brand-ink text-white shadow-md" : "text-brand-stone hover:text-brand-ink")}
              >
                Dia
              </button>
              <button 
                onClick={() => setView('week')}
                className={cn("flex-1 px-4 py-3 min-h-[44px] rounded-xl transition-all flex items-center justify-center", view === 'week' ? "bg-brand-ink text-white shadow-md" : "text-brand-stone hover:text-brand-ink")}
              >
                Semana
              </button>
              <button 
                onClick={() => setView('month')}
                className={cn("flex-1 px-4 py-3 min-h-[44px] rounded-xl transition-all flex items-center justify-center", view === 'month' ? "bg-brand-ink text-white shadow-md" : "text-brand-stone hover:text-brand-ink")}
              >
                Mês
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => user && exportAppointmentsCsv(user.uid)}
              className="hidden md:flex px-4 py-3 min-h-[44px] bg-brand-white border border-brand-mist/50 rounded-xl text-[9px] font-bold uppercase tracking-widest text-brand-stone hover:text-brand-ink hover:bg-brand-parchment transition-all shadow-sm items-center justify-center mr-2"
              title="Exportar meus agendamentos (últimos 12 meses)"
            >
              Exportar CSV
            </button>
            <button 
              onClick={() => handleNavigate('prev')} 
              className="w-12 h-12 md:w-10 md:h-10 bg-brand-white border border-brand-mist/50 flex items-center justify-center rounded-2xl text-brand-stone hover:text-brand-ink hover:bg-brand-parchment transition-all shadow-sm shrink-0"
            >
              <ChevronLeft size={20} />
            </button>
            {!isSelectedDateToday && (
              <button 
                onClick={setDateToToday}
                className="px-6 py-3 min-h-[44px] bg-brand-linen/80 text-brand-terracotta rounded-full text-[9px] font-bold uppercase tracking-widest hover:bg-brand-parchment transition-all border border-brand-terracotta/10 flex items-center justify-center"
              >
                Hoje
              </button>
            )}
            <button 
              onClick={() => handleNavigate('next')} 
              className="w-12 h-12 md:w-10 md:h-10 bg-brand-white border border-brand-mist/50 flex items-center justify-center rounded-2xl text-brand-stone hover:text-brand-ink hover:bg-brand-parchment transition-all shadow-sm shrink-0"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </header>

        {/* 1.2 CONFLICT AUDIT ALERT */}
        {conflicts.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 bg-red-50 border-2 border-red-100 rounded-[32px] flex items-start gap-4 shadow-sm"
          >
            <AlertCircle className="text-red-600 shrink-0 mt-1" size={24} />
            <div>
              <h3 className="text-sm font-bold text-red-900 uppercase tracking-widest mb-1">Atenção: Conflito detectado</h3>
              <p className="text-xs text-red-700 leading-relaxed font-medium">
                Identificamos que existem {conflicts.length} horário(s) com mais de um serviço confirmado simultaneamente. 
                Isso pode ter ocorrido por falhas em versões anteriores. Por favor, revise os horários marcados em vermelho na timeline.
              </p>
            </div>
          </motion.div>
        )}

        {/* 1.5 FIND RESERVATION BAR (Discrete) */}
        <div className="bg-brand-linen/30 border border-brand-mist/30 rounded-[28px] p-2 mb-10 flex items-center gap-2 pr-4 pl-4 focus-within:ring-1 focus-within:ring-brand-terracotta/20 transition-all">
          <Search size={16} className="text-brand-stone ml-1" />
          <input
            type="text"
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value)}
            placeholder="Buscar reserva por código..."
            className="flex-1 bg-transparent py-2 text-[11px] font-bold text-brand-ink focus:outline-none placeholder:text-brand-stone/40 uppercase tracking-widest"
          />
          <button 
            onClick={handleCodeSearch}
            disabled={isSearchingCode || !searchCode.trim()}
            className="text-[9px] font-black uppercase tracking-widest text-brand-terracotta disabled:opacity-20"
          >
            {isSearchingCode ? <RefreshCw size={12} className="animate-spin" /> : 'Ir'}
          </button>
        </div>

        {/* 2. RESUMO RÁPIDO (3 KPIs) */}
        <div className="grid grid-cols-3 gap-3 mb-10">
          <div className="bg-brand-linen/40 p-4 rounded-3xl border border-brand-mist/50 text-center">
            <p className="text-[8px] font-bold text-brand-stone uppercase tracking-widest mb-1">Confirmados</p>
            <p className="text-xl font-serif text-brand-ink">{confirmedAppts.length}</p>
          </div>
          <div className="bg-brand-white p-4 rounded-3xl border border-brand-mist shadow-sm text-center relative overflow-hidden">
            <p className="text-[8px] font-bold text-brand-stone uppercase tracking-widest mb-1">Pedidos</p>
            <p className="text-xl font-serif text-brand-ink flex items-center justify-center gap-1.5">
              {pendingRequests.length}
              {pendingRequests.length > 0 && <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />}
            </p>
          </div>
          <div className="bg-brand-parchment p-4 rounded-3xl border border-brand-mist/30 text-center">
            <p className="text-[8px] font-bold text-brand-stone uppercase tracking-widest mb-1">Vagas</p>
            <p className="text-xl font-serif text-brand-ink">{openSlots.length}</p>
          </div>
        </div>

        {/* 3. TIMELINE DO DIA / WEEK VIEW / MONTH VIEW */}
        <div className="space-y-4 relative">
          {view === 'week' && (
            <WeekView 
              appointments={allAppointments}
              blockedSchedules={allBlockedSchedules}
              workingHours={profile?.workingHours as any}
              weekStart={weekStart}
              selectedDate={selectedDate}
              onSelectAppointment={(appt) => { setSelectedAppointment(appt); setIsDetailsOpen(true); }}
              onSelectSlot={(date, time) => {
                setManualDate(date);
                setManualTime(time);
                setIsManualModalOpen(true);
              }}
              onSelectDay={(date) => setSelectedDate(formatDateKey(date))}
              onBlockClick={handleBlockClick}
            />
          )}

          {view === 'day' && (
            <DayView 
              appointments={appointments}
              blockedSchedules={blockedSchedules}
              date={selectedDate}
              onSelectAppointment={(appt) => { setSelectedAppointment(appt); setIsDetailsOpen(true); }}
              onSelectSlot={(time) => {
                setManualTime(time);
                setIsManualModalOpen(true);
              }}
              onBlockClick={handleBlockClick}
            />
          )}

          {view === 'month' && (
            <MonthView 
              currentDate={selectedDate}
              appointments={allAppointments}
              blockedSchedules={allBlockedSchedules}
              onSelectDay={(date) => {
                setSelectedDate(date);
                setView('day');
              }}
            />
          )}
        </div>

        {/* 4. BLOCO DE INFOS ADICIONAIS (PROAÇÃO) */}
        <div className="mt-12 space-y-8">
          {pendingRequests.length > 0 && (
            <div className="bg-red-50/50 border border-red-100 p-6 rounded-[32px]">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[9px] font-bold uppercase tracking-widest text-red-600">Pedidos aguardando ({pendingRequests.length})</h4>
                <Link to="/agenda" className="text-[9px] font-bold uppercase tracking-widest text-brand-ink underline">Ver todos</Link>
              </div>
              <div className="flex flex-wrap gap-2">
                {pendingRequests.slice(0, 3).map(req => (
                  <div key={req.id} className="px-3 py-1.5 bg-white border border-red-100 rounded-full text-[10px] font-medium text-brand-ink shadow-sm">
                    {req.clientName.split(' ')[0]} · {req.time}
                  </div>
                ))}
              </div>
            </div>
          )}

          {openSlots.length > 0 && (
            <div className="bg-brand-linen p-6 rounded-[32px] border border-brand-terracotta/10">
              <div className="mb-4">
                <h4 className="text-[9px] font-bold uppercase tracking-widest text-brand-stone">{openSlots.length} horários livres hoje</h4>
                <div className="flex flex-wrap gap-x-2 gap-y-1 mt-2">
                  {openSlots.slice(0, 6).map((s, i) => (
                    <span key={i} className="text-xs text-brand-ink font-serif">{s}{i < Math.min(openSlots.length, 6) - 1 ? ' · ' : ''}</span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                   onClick={() => setIsFabOpen(true)}
                   className="flex-1 py-3 bg-brand-ink text-brand-white rounded-xl text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <Share2 size={12} /> Divulgar agenda
                </button>
                {features.waitlist && (
                  <button 
                     onClick={() => setIsWaitlistOpen(true)}
                     className="flex-1 py-3 bg-brand-white border border-brand-mist text-brand-stone rounded-xl text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    <Users size={12} /> Ver espera
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* UX INTELIGENTE FEEDBACK */}
        <div className="mt-12 text-center">
          {isSelectedDateToday && (
            confirmedAppts.length >= 5 ? (
              <p className="text-sm font-serif text-brand-stone italic">Agenda cheia hoje ✨ {confirmedAppts.length} atendimentos confirmados.</p>
            ) : (
              <p className="text-sm font-serif text-brand-stone italic">Hoje está leve. {openSlots.length} horários disponíveis.</p>
            )
          )}
        </div>
      </div>

      {/* 6. BOTÃO FLUTUANTE FIXO (FAB) */}
      <div className="fixed bottom-28 right-6 z-[100] md:bottom-12">
        <AnimatePresence>
          {isFabOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              className="absolute bottom-16 right-0 w-56 bg-brand-white border border-brand-mist p-3 rounded-[28px] shadow-2xl space-y-1"
            >
              <button onClick={() => { setIsBlockModalOpen(true); setIsFabOpen(false); }} className="w-full text-left px-5 py-4 min-h-[56px] hover:bg-brand-parchment rounded-2xl flex items-center gap-3 transition-colors group">
                <Lock size={16} className="text-brand-stone group-hover:text-brand-ink shrink-0" />
                <span className="text-[11px] font-medium text-brand-stone group-hover:text-brand-ink uppercase tracking-wider">Bloquear horário</span>
              </button>
              <button onClick={() => { setManualTime(''); setIsManualModalOpen(true); setIsFabOpen(false); }} className="w-full text-left px-5 py-4 min-h-[56px] hover:bg-brand-parchment rounded-2xl flex items-center gap-3 transition-colors group">
                <Sparkles size={16} className="text-brand-stone group-hover:text-brand-ink shrink-0" />
                <span className="text-[11px] font-medium text-brand-stone group-hover:text-brand-ink uppercase tracking-wider">Novo encaixe</span>
              </button>
              <button onClick={() => { setIsWaitlistOpen(true); setIsFabOpen(false); }} className="w-full text-left px-5 py-4 min-h-[56px] hover:bg-brand-parchment rounded-2xl flex items-center gap-3 transition-colors group">
                <Users size={16} className="text-brand-stone group-hover:text-brand-ink shrink-0" />
                <span className="text-[11px] font-medium text-brand-stone group-hover:text-brand-ink uppercase tracking-wider">Lista de Espera</span>
              </button>
              <button onClick={() => { setManualTime(''); setIsManualModalOpen(true); setIsFabOpen(false); }} className="w-full text-left px-5 py-4 min-h-[56px] hover:bg-brand-parchment rounded-2xl flex items-center gap-3 transition-colors group">
                <CalendarCheck2 size={16} className="text-brand-stone group-hover:text-brand-ink shrink-0" />
                <span className="text-[11px] font-medium text-brand-stone group-hover:text-brand-ink uppercase tracking-wider">Reserva manual</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <button 
          onClick={() => setIsFabOpen(!isFabOpen)}
          className={cn(
            "w-16 h-16 rounded-full bg-brand-ink text-brand-white shadow-2xl flex items-center justify-center transition-all active:scale-90",
            isFabOpen ? "rotate-45 bg-brand-terracotta" : ""
          )}
        >
          <Plus size={32} />
        </button>
      </div>

      {/* Rest of Modals */}
      <WaitlistCentralModal 
        open={isWaitlistOpen}
        onClose={() => setIsWaitlistOpen(false)}
        professionalId={user?.uid || ''}
        targetDate={selectedDate}
        targetTime={manualTime || undefined}
        onFit={(entry) => {
           setManualClient(entry.clientName);
           setManualPhone(entry.clientWhatsapp);
           setManualService(entry.serviceId);
           setManualDate(selectedDate);
           if (manualTime) setManualTime(manualTime);
           setIsWaitlistOpen(false);
           setIsManualModalOpen(true);
        }}
      />

      <QuickBlockModal 
        open={isQuickBlockOpen}
        onClose={() => { setIsQuickBlockOpen(false); fetchBlockedSchedules(true); }}
        date={selectedDate}
        time={quickBlockTime}
        professionalId={user?.uid || ''}
        onAdvanced={() => setIsBlockModalOpen(true)}
      />

      <BlockAvailabilityModal 
        open={isBlockModalOpen}
        onClose={() => { setIsBlockModalOpen(false); fetchBlockedSchedules(true); }}
        selectedDate={selectedDate}
        professionalId={user?.uid || ''}
        appointments={appointments}
        workingHours={profile?.workingHours as any}
        initialStartTime={blockStartTime}
        initialEndTime={blockEndTime}
      />

      <AnimatePresence>
        {isManualModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsManualModalOpen(false)}
              className="absolute inset-0 bg-brand-ink/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-brand-white rounded-[32px] p-8 shadow-2xl border border-brand-mist overflow-y-auto max-h-[90vh]"
            >
              <button onClick={() => setIsManualModalOpen(false)} className="absolute top-6 right-6 p-2 text-brand-stone hover:text-brand-ink transition-colors">
                <X size={20} />
              </button>

              <h3 className="text-2xl font-serif text-brand-ink mb-2">Novo Agendamento</h3>
              <p className="text-sm text-brand-stone font-light mb-8">
                Registre agendamentos recebidos manualmente.
              </p>

              <div className="space-y-5">
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone block mb-2">Cliente *</label>
                  <input
                    type="text"
                    value={manualClient}
                    onChange={(e) => setManualClient(e.target.value)}
                    placeholder="Nome da cliente"
                    className="w-full px-5 py-4 bg-brand-parchment border border-brand-mist rounded-2xl text-sm outline-none focus:border-brand-ink transition-all"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone block mb-2">WhatsApp (opcional)</label>
                  <input
                    type="tel"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="w-full px-5 py-4 bg-brand-parchment border border-brand-mist rounded-2xl text-sm outline-none focus:border-brand-ink transition-all"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone block mb-2">Serviço</label>
                  <select
                    value={manualService}
                    onChange={(e) => {
                      const svc = services.find(s => s.id === e.target.value);
                      setManualService(e.target.value);
                      if (svc) setManualPrice(svc.price.toString());
                    }}
                    className="w-full px-5 py-4 bg-brand-parchment border border-brand-mist rounded-2xl text-sm outline-none focus:border-brand-ink transition-all appearance-none"
                  >
                    <option value="">Selecione um serviço</option>
                    {services.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({formatCurrency(s.price)})</option>
                    ))}
                    <option value="outro">Outro (Manual)</option>
                  </select>
                </div>

                <div className="flex gap-4">
                  <div className="flex-[2] min-w-0">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone block mb-2">Data *</label>
                    <input
                      type="date"
                      value={manualDate}
                      onChange={(e) => setManualDate(e.target.value)}
                      className="w-full px-5 py-4 bg-brand-parchment border border-brand-mist rounded-2xl text-sm outline-none focus:border-brand-ink transition-all min-w-0"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone block mb-2">Horário *</label>
                    <input
                      type="time"
                      value={manualTime}
                      onChange={(e) => setManualTime(e.target.value)}
                      className="w-full px-4 py-4 bg-brand-parchment border border-brand-mist rounded-2xl text-sm outline-none focus:border-brand-ink transition-all min-w-0"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone block mb-2">Valor (R$)</label>
                  <input
                    type="number"
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-5 py-4 bg-brand-parchment border border-brand-mist rounded-2xl text-sm outline-none focus:border-brand-ink transition-all"
                  />
                </div>

                {manualService && manualDate && (
                  <div className="pt-2 space-y-5">
                    {(recommendedSlots.bestSlot || recommendedSlots.otherSlots.length > 0) ? (
                      <>
                        {recommendedSlots.bestSlot && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn(
                              "relative overflow-hidden p-5 rounded-[28px] border-2 transition-all",
                              manualTime === recommendedSlots.bestSlot.time 
                                ? "bg-brand-ink border-brand-ink text-white shadow-xl shadow-brand-ink/20" 
                                : "bg-brand-white border-brand-mist/30"
                            )}
                          >
                            <div className="flex justify-between items-start mb-4">
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "w-8 h-8 rounded-xl flex items-center justify-center",
                                  manualTime === recommendedSlots.bestSlot.time ? "bg-brand-parchment/20" : "bg-brand-linen/40"
                                )}>
                                  <Sparkles size={16} className={manualTime === recommendedSlots.bestSlot.time ? "text-brand-terracotta" : "text-brand-terracotta"} />
                                </div>
                                <div>
                                  <p className={cn(
                                    "text-[10px] font-bold uppercase tracking-[0.2em]",
                                    manualTime === recommendedSlots.bestSlot.time ? "text-brand-parchment" : "text-brand-stone"
                                  )}>Sugestão Nera</p>
                                  <h4 className="text-sm font-serif italic">Melhor Encaixe</h4>
                                </div>
                              </div>
                              {manualTime === recommendedSlots.bestSlot.time && (
                                <motion.span 
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="bg-brand-terracotta text-white text-[8px] font-bold px-2 py-1 rounded-full uppercase tracking-widest"
                                >
                                  Selecionado
                                </motion.span>
                              )}
                            </div>

                            <div className="flex items-center justify-between">
                              <span className={cn(
                                "text-3xl font-serif italic",
                                manualTime === recommendedSlots.bestSlot.time ? "text-white" : "text-brand-ink"
                              )}>
                                {recommendedSlots.bestSlot.time}
                              </span>
                              <button
                                onClick={() => setManualTime(recommendedSlots.bestSlot!.time)}
                                className={cn(
                                  "px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                                  manualTime === recommendedSlots.bestSlot.time 
                                    ? "bg-brand-parchment text-brand-ink" 
                                    : "bg-brand-ink text-white hover:bg-brand-stone"
                                )}
                              >
                                {manualTime === recommendedSlots.bestSlot.time ? 'Horário Pronto' : 'Usar este horário'}
                              </button>
                            </div>

                            {/* Background Decoration */}
                            <Star className="absolute -bottom-2 -right-2 w-16 h-16 text-brand-terracotta/5 pointer-events-none" />
                          </motion.div>
                        )}

                        {recommendedSlots.otherSlots.length > 0 && (
                          <div className="px-1">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-brand-stone mb-3 flex items-center gap-2">
                              Manter Agenda Cheia <ArrowRight size={10} /> Outras opções
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {recommendedSlots.otherSlots.map(slot => (
                                <button
                                  key={slot.time}
                                  onClick={() => setManualTime(slot.time)}
                                  className={cn(
                                    "px-4 py-3 rounded-2xl text-[11px] font-bold border transition-all",
                                    manualTime === slot.time 
                                      ? "bg-brand-ink text-white border-brand-ink" 
                                      : "bg-brand-linen/30 text-brand-ink border-brand-mist/20 hover:border-brand-terracotta/40"
                                  )}
                                >
                                  {slot.time}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* --- INTELLIGENT FITS SECTION --- */}
                        {(recommendedSlots.intelligentFits || []).filter(f => f.type === 'adjustment' || (f.type === 'direct' && f.time !== recommendedSlots.bestSlot?.time)).length > 0 && (
                          <div className="pt-4 border-t border-brand-mist/20">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-stone mb-4 flex items-center gap-2">
                              <Sparkles size={12} className="text-brand-terracotta" /> Oportunidades de Encaixe
                            </p>
                            <div className="space-y-3">
                              {(recommendedSlots.intelligentFits || []).filter(f => f.type === 'adjustment' || (f.type === 'direct' && f.time !== recommendedSlots.bestSlot?.time)).map((fit, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => handleApplyFit(fit)}
                                  className={cn(
                                    "w-full p-4 rounded-2xl border transition-all text-left flex flex-col gap-1",
                                    manualTime === fit.time 
                                      ? "bg-brand-ink border-brand-ink text-white" 
                                      : "bg-brand-linen/20 border-brand-mist/30 hover:border-brand-terracotta/40"
                                  )}
                                >
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold leading-none">{fit.time}</span>
                                    {fit.type === 'adjustment' ? (
                                      <span className={cn(
                                        "text-[8px] px-2 py-0.5 rounded-full uppercase tracking-widest font-bold",
                                        manualTime === fit.time ? "bg-brand-terracotta text-white" : "bg-brand-terracotta/10 text-brand-terracotta"
                                      )}>
                                        Ajuste Inteligente
                                      </span>
                                    ) : (
                                      <span className={cn(
                                        "text-[8px] px-2 py-0.5 rounded-full uppercase tracking-widest font-bold",
                                        manualTime === fit.time ? "bg-brand-parchment/20 text-brand-parchment" : "bg-brand-linen/40 text-brand-stone"
                                      )}>
                                        Encaixe Direto
                                      </span>
                                    )}
                                  </div>
                                  {fit.adjustment && (
                                    <p className={cn(
                                      "text-[9px] font-light italic",
                                      manualTime === fit.time ? "text-brand-parchment/70" : "text-brand-stone"
                                    )}>
                                      Move {fit.adjustment.clientName} para {fit.adjustment.newTime}
                                    </p>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="p-6 bg-brand-linen/20 rounded-[28px] border border-dashed border-brand-mist/50 flex flex-col items-center text-center gap-2">
                        <AlertCircle size={20} className="text-brand-stone/40" />
                        <p className="text-[10px] text-brand-stone font-light px-4">
                          Nenhum horário disponível para este serviço hoje. Tente outro dia ou ajuste seus horários.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={handleCreateManual}
                  disabled={!manualClient || !manualTime || isCreating}
                  className="w-full py-5 bg-brand-ink text-brand-white rounded-2xl text-[10px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isCreating ? 'Criando...' : 'Confirmar Agendamento'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDetailsOpen && selectedAppointment && (
          <div className="fixed inset-0 z-[250] flex items-end md:items-center justify-center p-0 md:p-6 overflow-hidden">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsDetailsOpen(false)}
              className="absolute inset-0 bg-brand-ink/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              className="relative w-full max-w-md bg-brand-white rounded-t-[40px] md:rounded-[40px] px-6 py-8 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] overflow-y-auto max-h-[90vh] pb-[calc(2rem+env(safe-area-inset-bottom))]"
            >
              <button 
                onClick={() => setIsDetailsOpen(false)}
                className="absolute top-6 right-6 p-3 bg-brand-linen rounded-full text-brand-stone hover:text-brand-ink transition-colors"
                title="Fechar"
              >
                <X size={20} />
              </button>

              <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-terracotta">Detalhes da Reserva</span>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest",
                      isConfirmedLikeStatus(selectedAppointment.status) ? "bg-green-100 text-green-700" :
                      isPendingStatus(selectedAppointment.status) ? "bg-orange-100 text-orange-700 animate-pulse" :
                      isCompletedStatus(selectedAppointment.status) ? "bg-brand-linen text-brand-ink" :
                      "bg-brand-mist/20 text-brand-stone"
                    )}>
                      {isConfirmedLikeStatus(selectedAppointment.status) ? 'Confirmado' :
                       isPendingStatus(selectedAppointment.status) && selectedAppointment.status !== 'pending_confirmation' ? 'Pendente' :
                       selectedAppointment.status === 'pending_confirmation' ? 'Aguardando Cliente' :
                       isCompletedStatus(selectedAppointment.status) ? 'Concluído' :
                       selectedAppointment.status}
                    </span>
                    {selectedAppointment.clientConfirmed24h && (
                      <span className="bg-brand-ink text-white px-3 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest flex items-center gap-1">
                        <Check size={10} /> Confirmado 24h
                      </span>
                    )}
                  </div>
                </div>
                <h3 className="text-3xl font-serif text-brand-ink">{selectedAppointment.clientName}</h3>
                <p className="text-sm text-brand-stone font-light italic">{selectedAppointment.serviceName}</p>
                {selectedAppointment.reservationCode && (
                  <div className="mt-4 inline-flex items-center gap-2 bg-brand-linen/60 px-3 py-1.5 rounded-full border border-brand-mist/30">
                    <span className="text-[8px] text-brand-stone uppercase tracking-widest font-bold">Código:</span>
                    <span className="text-[10px] font-mono font-bold text-brand-terracotta">{selectedAppointment.reservationCode}</span>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-brand-parchment rounded-[32px] border border-brand-mist space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-brand-white rounded-xl flex items-center justify-center text-brand-terracotta border border-brand-mist">
                      <Calendar size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-stone mb-0.5">Data</p>
                      <p className="text-lg font-serif text-brand-ink">{formatLocalDate(selectedAppointment.date, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-brand-white rounded-xl flex items-center justify-center text-brand-terracotta border border-brand-mist">
                      <Clock size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-stone mb-0.5">Horário</p>
                      <p className="text-lg font-serif text-brand-ink">{selectedAppointment.time} • {selectedAppointment.duration} min</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-brand-white rounded-xl flex items-center justify-center text-brand-terracotta border border-brand-mist">
                      <TrendingUp size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-stone mb-0.5">Valor Total</p>
                      <p className="text-lg font-serif text-brand-ink">{formatCurrency(selectedAppointment.totalPrice || selectedAppointment.price)}</p>
                    </div>
                  </div>

                  {selectedAppointment.clientEmail && (
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-brand-white rounded-xl flex items-center justify-center text-brand-terracotta border border-brand-mist">
                        <List size={20} />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-stone mb-0.5">E-mail</p>
                        <p className="text-sm text-brand-ink truncate">{selectedAppointment.clientEmail}</p>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-brand-mist/30">
                    <p className="text-[8px] uppercase font-bold text-brand-stone tracking-widest flex items-center gap-1 opacity-50">
                      <Clock size={10} /> Criado em {selectedAppointment.createdAt?.toDate ? formatLocalDate(formatDateKey(selectedAppointment.createdAt.toDate()), { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                    </p>
                  </div>
                </div>

                {selectedAppointment.locationType === 'home' && (
                  <div className="p-6 bg-brand-parchment rounded-[32px] border border-brand-mist">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-brand-white rounded-xl flex items-center justify-center text-brand-terracotta border border-brand-mist">
                        <MapPin size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-stone mb-0.5">Localização</p>
                        <p className="text-sm text-brand-ink leading-relaxed">
                          {typeof selectedAppointment.address === 'object' 
                            ? (
                                <>
                                  {selectedAppointment.address.street}, {selectedAppointment.address.number}{selectedAppointment.address.complement && ` - ${selectedAppointment.address.complement}`}<br/>
                                  {selectedAppointment.address.neighborhood} - {selectedAppointment.address.city}
                                  {selectedAppointment.address.reference && (
                                    <div className="text-[10px] text-brand-terracotta mt-1 leading-tight">Ref: {selectedAppointment.address.reference}</div>
                                  )}
                                  <button 
                                    onClick={() => {
                                      const addr = `${selectedAppointment.address.street}, ${selectedAppointment.address.number}, ${selectedAppointment.address.neighborhood}, ${selectedAppointment.address.city}`;
                                      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`, '_blank');
                                    }}
                                    className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-brand-terracotta hover:underline"
                                  >
                                    <MapPin size={12} /> Abrir no Maps
                                  </button>
                                </>
                              )
                            : (
                                <>
                                  {selectedAppointment.address || selectedAppointment.neighborhood || 'Endereço a combinar'}
                                  {(selectedAppointment.address || selectedAppointment.neighborhood) && (
                                    <button 
                                      onClick={() => {
                                        const addr = selectedAppointment.address || selectedAppointment.neighborhood;
                                        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`, '_blank');
                                      }}
                                      className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-brand-terracotta hover:underline"
                                    >
                                      <MapPin size={12} /> Abrir no Maps
                                    </button>
                                  )}
                                </>
                              )
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedAppointment.notes && (
                  <div className="p-6 bg-brand-linen/40 rounded-[32px] border border-brand-mist">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-stone mb-3">Observações</p>
                    <p className="text-sm text-brand-ink font-light italic leading-relaxed">"{selectedAppointment.notes}"</p>
                  </div>
                )}

                <div className="pt-4 flex flex-col gap-3">
                  {selectedAppointment.status === 'pending' && (
                    <PremiumButton 
                      variant="ink"
                      className="w-full py-5 flex items-center justify-center gap-2"
                      onClick={() => {
                        handleRespond(selectedAppointment.id, 'confirmed', selectedAppointment);
                        setIsDetailsOpen(false);
                      }}
                    >
                      <Check size={18} /> Confirmar Reserva
                    </PremiumButton>
                  )}

                  <PremiumButton 
                    variant={selectedAppointment.status === 'pending' ? 'linen' : 'ink'}
                    className="w-full py-5"
                    onClick={() => {
                        window.open(buildWhatsappLink(selectedAppointment.clientWhatsapp));
                    }}
                  >
                    Falar com Cliente
                  </PremiumButton>
                  
                  <button 
                    onClick={async () => {
                      const url = `${window.location.origin}/r/${selectedAppointment.token || selectedAppointment.manageSlug}`;
                      await navigator.clipboard.writeText(url);
                      notify.success('Link de gerenciamento copiado!');
                    }}
                    className="w-full py-4 text-[10px] font-bold uppercase tracking-widest text-brand-stone hover:bg-brand-linen rounded-2xl transition-all border border-brand-mist flex items-center justify-center gap-2"
                  >
                     Copiar Link da Cliente
                  </button>

                  {isConfirmedLikeStatus(selectedAppointment.status) && (
                    <PremiumButton 
                      variant="primary"
                      className="w-full py-4 mt-4"
                      onClick={() => handleComplete(selectedAppointment)}
                      disabled={loading === selectedAppointment.id}
                    >
                      {loading === selectedAppointment.id ? 'Finalizando...' : 'Finalizar Atendimento'}
                    </PremiumButton>
                  )}

                  {!isCompletedStatus(selectedAppointment.status) && (
                    <button 
                      onClick={() => {
                        handleRespond(selectedAppointment.id, 'cancelled_by_professional', selectedAppointment);
                        setIsDetailsOpen(false);
                      }}
                      className="w-full py-3 text-[10px] font-bold uppercase tracking-widest text-brand-rose hover:bg-brand-rose/5 rounded-xl transition-all mt-3"
                    >
                      {selectedAppointment.status === 'pending' ? 'Recusar Pedido' : 'Cancelar Atendimento'}
                    </button>
                  )}

                  {isConfirmedLikeStatus(selectedAppointment.status) && (() => {
                    const [h, m] = selectedAppointment.time.split(':').map(Number);
                    const apptDate = new Date(selectedAppointment.date + 'T00:00:00');
                    const apptTime = new Date(apptDate);
                    apptTime.setHours(h, m, 0, 0);
                    const isPast = apptTime < new Date();

                    return isPast && (
                      <button 
                        onClick={async () => {
                          setLoading(selectedAppointment.id);
                          try {
                            const updatePayload = {
                              noShow: true,
                              status: 'cancelled_by_professional' as const, // or maintain confirmed but with noShow flag
                              updatedAt: serverTimestamp()
                            };
                            const safeUpdate = sanitizeAppointment(updatePayload, true);
                            await updateDoc(doc(db, 'appointments', selectedAppointment.id), safeUpdate);
                            setAppointments(prev => prev.filter(a => a.id !== selectedAppointment.id));
                            notify.success('Cliente marcado como No-Show. Isso ficará registrado no histórico.');
                            setIsDetailsOpen(false);
                          } catch (err) {
                            notify.error('Erro ao marcar no-show.');
                          } finally {
                            setLoading(null);
                          }
                        }}
                        className="w-full py-3 text-[10px] font-bold uppercase tracking-widest text-amber-600 hover:bg-amber-50 rounded-xl transition-all border border-amber-100 mt-2"
                      >
                        Marcar Faltou (No-Show)
                      </button>
                    );
                  })()}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {blockToDelete && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 sm:p-0">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setBlockToDelete(null)}
              className="absolute inset-0 bg-brand-ink/40 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm bg-brand-white rounded-[32px] p-8 shadow-2xl overflow-hidden"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-12 h-12 bg-rose-50 text-brand-terracotta rounded-full flex items-center justify-center">
                  <Trash2 size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-serif text-brand-ink mb-2">
                    {blockToDelete.isRecurring ? 'Remover regra recorrente' : 'Desbloquear horário'}
                  </h3>
                  <p className="text-sm font-sans text-brand-stone">
                    {blockToDelete.isRecurring 
                      ? 'Esse bloqueio se repete automaticamente. Deseja remover a regra inteira?'
                      : 'Esse horário voltará a ficar disponível para agendamentos.'}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setBlockToDelete(null)}
                  className="flex-1 py-3.5 text-xs font-bold uppercase tracking-widest text-brand-stone hover:text-brand-ink bg-brand-linen hover:bg-brand-mist rounded-2xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    handleUnblockSchedule(blockToDelete.id);
                    setBlockToDelete(null);
                  }}
                  className="flex-1 py-3.5 text-xs font-bold uppercase tracking-widest text-white bg-brand-terracotta hover:bg-[#A94A3D] rounded-2xl transition-colors shadow-sm"
                >
                  {blockToDelete.isRecurring ? 'Remover regra' : 'Remover bloqueio'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

        <UpgradeModal 
        open={isUpgradeModalOpen} 
        onClose={closeUpgradeModal}
        feature={upgradeFeature}
        count={usageCount}
      />
      </PageErrorBoundary>
    </AppLayout>
  );
}
