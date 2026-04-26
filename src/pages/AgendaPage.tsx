import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../AuthContext';
import { db, confirmAppointmentAtomic, declineAppointmentAtomic, cancelConfirmedAppointmentAtomic, handleBookingError, createManualAppointment, updateAppointmentStatus } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, addDoc, serverTimestamp, setDoc, deleteDoc, getDocs, getDoc, limit } from 'firebase/firestore';
import { 
  Calendar, Clock, MessageCircle, 
  CheckCircle2, ChevronLeft, ChevronRight, Plus, MapPin,
  Users, List, Settings, Check, Sparkles, X, Lock, RefreshCw,
  TrendingUp, Trash2, ArrowUpRight, Filter, MoreHorizontal,
  CalendarCheck2, AlertCircle, Info, Share2, Search
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatCurrency, parseLocalDate, formatLocalDate, getTodayLocale, formatDateKey, buildWhatsappLink, cn, cleanWhatsapp } from '../lib/utils';
import { getAvailableSlots, getDayAvailability } from '../lib/bookingUtils';
import PremiumButton from '../components/PremiumButton';
import { toast } from 'sonner';
import { Appointment } from '../types';
import Logo from '../components/Logo';
import AppLayout from '../components/AppLayout';
import { AnimatePresence } from 'motion/react';

import BlockAvailabilityModal from '../components/BlockAvailabilityModal';
import WaitlistCentralModal from '../components/WaitlistCentralModal';
import QuickBlockModal from '../components/QuickBlockModal';

import { useUpgradeTriggers } from '../hooks/useUpgradeTriggers';
import UpgradeModal from '../components/UpgradeModal';

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

  const [searchParams] = useSearchParams();
  const dateFromUrl = searchParams.get('date');
  const appointmentIdFromUrl = searchParams.get('appointment');

  const [appointments, setAppointments] = useState<any[]>([]);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(dateFromUrl || getTodayLocale());
  const [loading, setLoading] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(appointmentIdFromUrl);

  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [isQuickBlockOpen, setIsQuickBlockOpen] = useState(false);
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false);
  const [quickBlockTime, setQuickBlockTime] = useState('');
  
  const [blockedSchedules, setBlockedSchedules] = useState<any[]>([]);
  const [isFabOpen, setIsFabOpen] = useState(false);

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
  const [manualDate, setManualDate] = useState(selectedDate);
  const [manualTime, setManualTime] = useState('');
  const [services, setServices] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  
  // Reserva Search
  const [searchCode, setSearchCode] = useState('');
  const [isSearchingCode, setIsSearchingCode] = useState(false);

  const handleCodeSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = searchCode.trim().toUpperCase();
    if (!code) return;

    setIsSearchingCode(true);
    console.log(`[RESERVATION SEARCH] code: ${code}, professionalId: ${user?.uid}`);

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
        console.log(`[RESERVATION SEARCH] found: true, appointmentId: ${appt.id}`);
        setSelectedAppointment(appt);
        setIsDetailsOpen(true);
        setSearchCode('');
      } else {
        console.log(`[RESERVATION SEARCH] found: false`);
        toast.error('Nenhuma reserva encontrada com esse código.');
      }
    } catch (err) {
      console.error('[RESERVATION SEARCH] Error:', err);
      toast.error('Erro ao buscar reserva.');
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
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'appointments'),
      where('professionalId', '==', user.uid),
      where('date', '==', selectedDate),
      orderBy('time', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Appointment));
      setAppointments(docs);
      
      // Audit for conflicts
      const audit: Record<string, Appointment[]> = {};
      docs.forEach(a => {
        if (['confirmed', 'accepted'].includes(a.status)) {
          if (!audit[a.time]) audit[a.time] = [];
          audit[a.time].push(a);
        }
      });
      const foundConflicts = Object.values(audit).filter(list => list.length > 1);
      setConflicts(foundConflicts);
    });

    const blockedRef = collection(db, 'blocked_schedules');
    const dayOfWeek = parseLocalDate(selectedDate).getDay();

    const unsubBlocked = onSnapshot(query(blockedRef, where('professionalId', '==', user.uid)), (snap) => {
      const allBlocked = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      const dayBlocked = allBlocked.filter(b => {
        const isToday = b.date === selectedDate;
        const isRecurringToday = b.isRecurring && b.recurringDays?.includes(dayOfWeek);
        return isToday || isRecurringToday;
      });

      setBlockedSchedules(dayBlocked);
    });

    return () => {
      unsubscribe();
      unsubBlocked();
    };
  }, [user, selectedDate]);

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
      toast.success('Bloqueio removido.');
    } catch {
      toast.error('Não foi possível remover o bloqueio.');
    }
  };

  const handleCreateManual = async () => {
    if (!user || !manualClient || !manualDate || !manualTime) {
      toast.error('Preencha nome da cliente, data e horário.');
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
        duration: selectedSvc?.duration || 60,
        price: Number(manualPrice) || selectedSvc?.price || 0,
        travelFee: 0,
        totalPrice: Number(manualPrice) || selectedSvc?.price || 0,
        date: manualDate,
        time: manualTime,
        locationType: 'studio',
        notes: 'Agendamento criado manualmente'
      });
      toast.success(`Agendamento de ${manualClient} criado para ${manualTime}.`);
      setManualClient(''); setManualPhone(''); setManualService('');
      setManualPrice(''); setManualTime('');
      setIsManualModalOpen(false);
    } catch {
      toast.error('Não foi possível criar o agendamento.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleComplete = async (app: any) => {
    if (!user) return;
    setLoading(app.id);
    try {
      await updateAppointmentStatus(app.id, 'completed');
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      await addDoc(collection(db, 'review_requests'), {
        bookingId: app.id,
        professionalId: user.uid,
        clientDisplayName: app.clientName,
        clientNeighborhood: app.neighborhood || '',
        token,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      toast.success('Experiência finalizada! Link de feedback pronto para envio.');
      const reviewLink = `${window.location.origin}/review/${token}`;
      try {
        await navigator.clipboard.writeText(reviewLink);
        toast.success('Link de avaliação copiado!');
      } catch {
        toast.success('Avaliação registrada!');
      }
    } catch (err) {
      handleBookingError(err);
    } finally {
      setLoading(null);
    }
  };

  const handleRespond = async (id: string, decision: 'confirmed' | 'cancelled_by_professional', appointment?: any) => {
    setLoading(id);
    console.log(`[CONFIRM APPOINTMENT] initiating handleRespond for ${id} in AgendaPage`);
    
    try {
      if (decision === 'confirmed') {
        if (!user?.uid) {
          console.error("[AGENDA CONFIRM] No user UID available");
          toast.error("Sessão expirada. Entre novamente.");
          return;
        }
        await confirmAppointmentAtomic(id, user.uid);
        toast.success('Reserva confirmada!');
      } else {
        if (appointment?.status === 'confirmed') {
          await cancelConfirmedAppointmentAtomic(id, user?.uid || '');
        } else {
          await declineAppointmentAtomic(id, user?.uid || '');
        }
        toast.success('Reserva cancelada.');
      }
    } catch (err: any) {
      handleBookingError(err);
    } finally {
      setLoading(null);
    }
  };

  const handleNotifyWaitlist = async (time: string) => {
    if (!user) return;
    setNotifyingWaitlist(time);
    try {
      toast.info(`Buscando clientes para as ${time}...`, {
        description: 'Notificando prioritários compatíveis.'
      });
    } finally {
      setTimeout(() => setNotifyingWaitlist(null), 1000);
    }
  };

  const confirmedAppts = appointments.filter(a => ['confirmed', 'completed'].includes(a.status));
  const pendingRequests = appointments.filter(a => a.status === 'pending');

  // Mapped Timeline items
  const timelineItems = React.useMemo(() => {
    const items: any[] = [];
    const blockingStatuses = ['confirmed', 'accepted', 'completed', 'pending_conflict', 'pending', 'pending_confirmation'];
    
    // Calculate slots with multiple confirmed/pending appointments
    const counts: Record<string, number> = {};
    appointments.forEach(a => {
      if (blockingStatuses.includes(a.status)) {
        counts[a.time] = (counts[a.time] || 0) + 1;
      }
    });

    // Add appointments
    appointments.forEach(app => {
      // Don't show cancelled or rejected here to keep timeline clean
      if (['cancelled_by_client', 'cancelled_by_professional', 'rejected', 'expired'].includes(app.status)) return;

      items.push({
        type: 'appointment',
        time: app.time,
        data: app,
        status: app.status,
        hasConflict: (counts[app.time] > 1 && blockingStatuses.includes(app.status)) || app.status === 'pending_conflict'
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
      const hasStrictMeeting = appointments.some(a => a.time === slot && blockingStatuses.includes(a.status));
      const hasStrictBlock = blockedSchedules.some(b => b.startTime === slot);
      
      if (!hasStrictMeeting && !hasStrictBlock) {
        items.push({
          type: 'free',
          time: slot
        });
      }
    });

    return items.sort((a, b) => a.time.localeCompare(b.time));
  }, [appointments, blockedSchedules, openSlots]);

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const isSelectedDateToday = selectedDate === getTodayLocale();

  return (
    <AppLayout activeRoute="agenda">
      <div className="p-5 md:p-12 max-w-2xl mx-auto w-full">
        
        {/* 1. HEADER LIMPO */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-serif text-brand-ink">
              {isSelectedDateToday ? 'Hoje' : formatLocalDate(selectedDate, { weekday: 'short' })} · {formatLocalDate(selectedDate, { day: 'numeric', month: 'long' })}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => changeDate(-1)} 
              className="p-2 hover:bg-brand-linen rounded-full text-brand-stone transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <button 
              onClick={setDateToToday}
              className="px-3 py-1.5 bg-brand-linen text-brand-terracotta rounded-full text-[9px] font-bold uppercase tracking-widest hover:bg-brand-parchment transition-all"
            >
              Hoje
            </button>
            <button 
              onClick={() => changeDate(1)} 
              className="p-2 hover:bg-brand-linen rounded-full text-brand-stone transition-colors"
            >
              <ChevronRight size={18} />
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

        {/* 1.5 FIND RESERVATION CARD */}
        <div className="bg-brand-linen/30 border border-brand-mist/50 rounded-[32px] p-6 mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-brand-white rounded-2xl flex items-center justify-center text-brand-terracotta shadow-sm">
              <Search size={20} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-brand-ink uppercase tracking-widest">Encontrar reserva</h3>
              <p className="text-[10px] text-brand-stone font-light italic">Digite o código informado pela cliente.</p>
            </div>
          </div>
          
          <form onSubmit={handleCodeSearch} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                placeholder="Ex: NR-2026..."
                className="w-full bg-brand-white border border-brand-mist rounded-2xl py-3.5 px-5 text-xs font-bold text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-terracotta/30 transition-all placeholder:text-brand-stone/40 font-mono uppercase"
              />
            </div>
            <button 
              type="submit"
              disabled={isSearchingCode || !searchCode.trim()}
              className="px-6 bg-brand-ink text-brand-white rounded-2xl text-[9px] font-bold uppercase tracking-widest hover:bg-brand-stone transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isSearchingCode ? <RefreshCw size={12} className="animate-spin" /> : 'Buscar'}
            </button>
          </form>
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

        {/* 3. TIMELINE DO DIA */}
        <div className="space-y-4">
          <div className="flex flex-col gap-4 mb-2 px-1">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-brand-mist" />
              <h3 className="text-[9px] font-bold uppercase tracking-widest text-brand-stone">Timeline do dia</h3>
            </div>
            
            {/* Legenda visual */}
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-stone opacity-40" />
                <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-brand-stone/60">Livre</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-brand-stone/60">Pedido</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-ink" />
                <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-brand-stone/60">Confirmado</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-stone/20" />
                <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-brand-stone/60">Bloqueado</span>
              </div>
            </div>
          </div>

          <div className="bg-brand-white rounded-[32px] border border-brand-mist overflow-hidden divide-y divide-brand-parchment shadow-sm">
            {timelineItems.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm font-serif text-brand-stone italic">Nenhuma atividade registrada.</p>
                <div className="mt-4 flex justify-center">
                  <PremiumButton onClick={() => setDateToToday()} variant="linen" className="text-[10px] py-4 px-8">Ir para hoje</PremiumButton>
                </div>
              </div>
            ) : (
              timelineItems.map((item, idx) => {
                const [h, m] = item.time.split(':').map(Number);
                const itemMinutes = h * 60 + m;
                const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
                const isCurrent = isSelectedDateToday && Math.abs(itemMinutes - nowMinutes) < 15;

                if (item.type === 'appointment') {
                  const app = item.data;
                  const isPending = app.status === 'pending';
                  
                  return (
                    <div key={`appt-${app.id}`} className={cn(
                      "p-5 flex items-center justify-between gap-4 transition-all group relative",
                      isPending ? "bg-red-50/30" : "hover:bg-brand-parchment/30",
                      isCurrent && "border-l-4 border-brand-terracotta bg-brand-linen/10"
                    )}>
                      {isCurrent && (
                        <div className="absolute top-0 right-4 -translate-y-1/2">
                          <span className="bg-brand-terracotta text-white text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest shadow-sm">
                            Agora
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-medium text-brand-stone w-10 shrink-0">{item.time}</span>
                        <div className="min-w-0">
                          <h4 className="text-sm font-medium text-brand-ink truncate">{app.clientName}</h4>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-brand-stone font-medium uppercase tracking-widest truncate max-w-[120px]">
                              {app.serviceName}
                            </span>
                            {isPending ? (
                              <span className="text-[8px] font-bold text-red-500 uppercase tracking-widest flex items-center gap-1">
                                <AlertCircle size={8} /> Pedido novo
                              </span>
                            ) : app.status === 'pending_conflict' ? (
                              <span className="text-[8px] font-bold text-red-600 uppercase tracking-widest flex items-center gap-1">
                                <AlertCircle size={8} /> Conflito detectado
                              </span>
                            ) : (
                              <>
                                {app.status === 'completed' ? (
                                  <span className="text-[8px] font-bold text-brand-terracotta uppercase tracking-widest flex items-center gap-1">
                                    Concluído
                                  </span>
                                ) : (
                                  <span className={cn(
                                    "text-[8px] font-bold uppercase tracking-widest",
                                    "text-brand-stone opacity-60"
                                  )}>
                                    Confirmado
                                  </span>
                                )}
                                {item.hasConflict && (
                                  <span className="text-[8px] font-bold text-white bg-red-600 px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse">
                                    Conflito de horário
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0">
                        {isPending ? (
                          <>
                            <button 
                              onClick={() => handleRespond(app.id, 'confirmed', app)}
                              className="px-3 py-1.5 bg-brand-ink text-brand-white rounded-lg text-[8px] font-bold uppercase tracking-widest hover:bg-brand-espresso"
                            >
                              Confirmar
                            </button>
                            <button 
                              onClick={() => handleRespond(app.id, 'cancelled_by_professional', app)}
                              className="p-1.5 bg-brand-parchment text-brand-stone rounded-lg hover:bg-red-50 hover:text-red-500"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={() => { setSelectedAppointment(app); setIsDetailsOpen(true); }}
                            className="p-2 text-brand-stone hover:text-brand-ink transition-colors"
                          >
                            <Info size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }

                if (item.type === 'block') {
                  const block = item.data;
                  const isBreak = block.reason === 'descanso' || block.reason?.toLowerCase().includes('intervalo') || block.reason?.toLowerCase().includes('pausa');
                  
                  return (
                    <div key={`block-${block.id}`} className="p-5 flex items-center justify-between gap-4 bg-brand-parchment/20">
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-medium text-brand-stone w-10 shrink-0">{item.time}</span>
                        <div>
                          <p className="text-sm font-bold text-brand-ink italic">{isBreak ? 'Pausa' : 'Bloqueado'}</p>
                          <p className="text-[9px] text-brand-stone/60 uppercase tracking-widest">{block.reason || 'Compromisso'}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleUnblockSchedule(block.id)}
                        className="p-2 text-brand-stone opacity-40 hover:opacity-100 hover:text-brand-terracotta transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                }

                if (item.type === 'free') {
                  const now = new Date();
                  const [h, m] = item.time.split(':').map(Number);
                  const isPast = isSelectedDateToday && (h * 60 + m < now.getHours() * 60 + now.getMinutes());

                  return (
                    <div key={`free-${item.time}`} className={cn(
                      "p-5 flex items-center justify-between gap-4 transition-colors relative",
                      isPast ? "bg-brand-parchment/10 grayscale opacity-40" : "hover:bg-green-50/30",
                      isCurrent && !isPast && "border-l-4 border-brand-terracotta bg-brand-linen/10"
                    )}>
                      {isCurrent && !isPast && (
                         <div className="absolute top-0 right-4 -translate-y-1/2">
                           <span className="bg-brand-terracotta text-white text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest shadow-sm">
                             Agora
                           </span>
                         </div>
                      )}
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-medium text-brand-stone w-10 shrink-0">{item.time}</span>
                        <div>
                          <p className="text-sm font-medium text-brand-stone">Livre</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 md:gap-3">
                        {!isPast && (
                          <div className="flex items-center gap-1">
                            {/* LOCK: Quick Block */}
                            <button 
                              onClick={() => { 
                                  setQuickBlockTime(item.time);
                                  setIsQuickBlockOpen(true);
                              }}
                              className="p-2 text-brand-stone/40 hover:text-brand-terracotta transition-all"
                              title="Bloqueio rápido"
                            >
                              <Lock size={14} />
                            </button>

                            {/* WAITLIST: Demand check */}
                            <button 
                              onClick={() => {
                                if (checkFeatureAccess('waitlist')) {
                                  setManualTime(item.time); // Pre-fill for 'onFit'
                                  setIsWaitlistOpen(true);
                                }
                              }}
                              className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-brand-stone hover:text-brand-ink transition-colors"
                            >
                              Espera
                            </button>
                          </div>
                        )}
                        
                        {/* FILL: Manual entry */}
                        <button 
                          onClick={() => { 
                            if (usageCount >= 15 && profile?.plan === 'free') {
                              openUpgradeModal('unlimitedBookings');
                              return;
                            }
                            setManualTime(item.time); 
                            setManualDate(selectedDate); 
                            setIsManualModalOpen(true); 
                          }}
                          className="px-4 py-1.5 border border-brand-mist bg-brand-white text-brand-stone rounded-lg text-[9px] font-bold uppercase tracking-widest hover:border-brand-ink hover:text-brand-ink"
                        >
                          Preencher
                        </button>
                      </div>
                    </div>
                  );
                }

                return null;
              })
            )}
          </div>
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
                <button 
                   onClick={() => {
                     if (checkFeatureAccess('waitlist')) {
                       setIsWaitlistOpen(true);
                     }
                   }}
                   className="flex-1 py-3 bg-brand-white border border-brand-mist text-brand-stone rounded-xl text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <Users size={12} /> Ver espera
                </button>
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
      <div className="fixed bottom-24 right-6 z-[100] md:bottom-12">
        <AnimatePresence>
          {isFabOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              className="absolute bottom-16 right-0 w-56 bg-brand-white border border-brand-mist p-3 rounded-[28px] shadow-2xl space-y-1"
            >
              <button onClick={() => { setIsBlockModalOpen(true); setIsFabOpen(false); }} className="w-full text-left px-5 py-4 hover:bg-brand-parchment rounded-2xl flex items-center gap-3 transition-colors group">
                <Lock size={16} className="text-brand-stone group-hover:text-brand-ink" />
                <span className="text-[11px] font-medium text-brand-stone group-hover:text-brand-ink uppercase tracking-wider">Bloquear horário</span>
              </button>
              <button onClick={() => { setManualTime(''); setIsManualModalOpen(true); setIsFabOpen(false); }} className="w-full text-left px-5 py-4 hover:bg-brand-parchment rounded-2xl flex items-center gap-3 transition-colors group">
                <Sparkles size={16} className="text-brand-stone group-hover:text-brand-ink" />
                <span className="text-[11px] font-medium text-brand-stone group-hover:text-brand-ink uppercase tracking-wider">Novo encaixe</span>
              </button>
              <button onClick={() => { setIsWaitlistOpen(true); setIsFabOpen(false); }} className="w-full text-left px-5 py-4 hover:bg-brand-parchment rounded-2xl flex items-center gap-3 transition-colors group">
                <Users size={16} className="text-brand-stone group-hover:text-brand-ink" />
                <span className="text-[11px] font-medium text-brand-stone group-hover:text-brand-ink uppercase tracking-wider">Lista de Espera</span>
              </button>
              <button onClick={() => { setManualTime(''); setIsManualModalOpen(true); setIsFabOpen(false); }} className="w-full text-left px-5 py-4 hover:bg-brand-parchment rounded-2xl flex items-center gap-3 transition-colors group">
                <CalendarCheck2 size={16} className="text-brand-stone group-hover:text-brand-ink" />
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
        onClose={() => setIsQuickBlockOpen(false)}
        date={selectedDate}
        time={quickBlockTime}
        professionalId={user?.uid || ''}
        onAdvanced={() => setIsBlockModalOpen(true)}
      />

      <BlockAvailabilityModal 
        open={isBlockModalOpen}
        onClose={() => setIsBlockModalOpen(false)}
        selectedDate={selectedDate}
        professionalId={user?.uid || ''}
        appointments={appointments}
        workingHours={profile?.workingHours || {}}
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
              className="relative w-full max-w-md bg-brand-white rounded-t-[40px] md:rounded-[40px] p-8 md:p-10 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <button 
                onClick={() => setIsDetailsOpen(false)}
                className="absolute top-8 right-8 text-brand-stone hover:text-brand-ink"
              >
                <X size={24} />
              </button>

              <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-terracotta">Detalhes da Reserva</span>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest",
                      selectedAppointment.status === 'confirmed' ? "bg-green-100 text-green-700" :
                      selectedAppointment.status === 'pending' ? "bg-orange-100 text-orange-700 animate-pulse" :
                      selectedAppointment.status === 'completed' ? "bg-brand-linen text-brand-ink" :
                      "bg-brand-mist/20 text-brand-stone"
                    )}>
                      {selectedAppointment.status === 'confirmed' ? 'Confirmado' :
                       selectedAppointment.status === 'pending' ? 'Pendente' :
                       selectedAppointment.status === 'pending_confirmation' ? 'Aguardando Cliente' :
                       selectedAppointment.status === 'completed' ? 'Concluído' :
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
                      toast.success('Link de gerenciamento copiado!');
                    }}
                    className="w-full py-4 text-[10px] font-bold uppercase tracking-widest text-brand-stone hover:bg-brand-linen rounded-2xl transition-all border border-brand-mist flex items-center justify-center gap-2"
                  >
                     Copiar Link da Cliente
                  </button>

                  {selectedAppointment.status !== 'completed' && (
                    <button 
                      onClick={() => {
                        handleRespond(selectedAppointment.id, 'cancelled_by_professional', selectedAppointment);
                        setIsDetailsOpen(false);
                      }}
                      className="w-full py-3 text-[10px] font-bold uppercase tracking-widest text-brand-rose hover:bg-brand-rose/5 rounded-xl transition-all"
                    >
                      {selectedAppointment.status === 'pending' ? 'Recusar Pedido' : 'Cancelar Atendimento'}
                    </button>
                  )}

                  {selectedAppointment.status === 'confirmed' && (() => {
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
                            await updateDoc(doc(db, 'appointments', selectedAppointment.id), {
                              noShow: true,
                              status: 'cancelled_by_professional', // or maintain confirmed but with noShow flag
                              updatedAt: serverTimestamp()
                            });
                            toast.success('Cliente marcado como No-Show. Isso ficará registrado no histórico.');
                            setIsDetailsOpen(false);
                          } catch (err) {
                            toast.error('Erro ao marcar no-show.');
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

        <UpgradeModal 
        open={isUpgradeModalOpen} 
        onClose={closeUpgradeModal}
        feature={upgradeFeature}
        count={usageCount}
      />
    </AppLayout>
  );
}
