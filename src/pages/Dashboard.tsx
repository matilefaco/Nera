import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../AuthContext';
import { db, auth, updateAppointmentStatus, handleBookingError, inviteFromWaitlist } from '../firebase';
import { 
  collection, query, where, onSnapshot, orderBy, doc, updateDoc, 
  addDoc, deleteDoc, serverTimestamp, limit 
} from 'firebase/firestore';
import { 
  Calendar, Clock, Users, LogOut, 
  Settings, List, MessageCircle, CheckCircle2, 
  Share2, Plus, MapPin, Check, TrendingUp, Heart,
  ChevronRight, Sparkles, Home, X, Instagram, Copy, Inbox,
  AlertCircle, ShieldCheck, Lock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { formatCurrency, getTodayLocale, buildWhatsappLink, generateWaitlistInviteMessage, cn, formatDateKey } from '../lib/utils';
import { getClientScore } from '../lib/clientUtils';
import Logo from '../components/Logo';
import { Appointment, WaitlistEntry } from '../types';
import { AnimatePresence } from 'motion/react';
import AppLayout from '../components/AppLayout';

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [confirmedToday, setConfirmedToday] = useState<Appointment[]>([]);
  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);
  const [dailyRevenue, setDailyRevenue] = useState(0);
  const [potentialRevenue, setPotentialRevenue] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState<Appointment[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<Appointment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const [isConfirmRejectOpen, setIsConfirmRejectOpen] = useState(false);
  const [requestToReject, setRequestToReject] = useState<Appointment | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isWaitlistModalOpen, setIsWaitlistModalOpen] = useState(false);
  const [inactiveClients, setInactiveClients] = useState<any[]>([]);
  const [recentCompletedClients, setRecentCompletedClients] = useState<any[]>([]);
  const [weekSummary, setWeekSummary] = useState<{date: string, count: number, revenue: number}[]>([]);
  const [recentChanges, setRecentChanges] = useState<Appointment[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [waitlistStats, setWaitlistStats] = useState<any>({ recoveredSlots: 0, savedRevenue: 0 });
  const [waitlistMode, setWaitlistMode] = useState<'auto' | 'manual'>('manual');
  const [isUnavailableToday, setIsUnavailableToday] = useState(false);
  const [todayBlockId, setTodayBlockId] = useState<string | null>(null);
  const [recoveryOpportunities, setRecoveryOpportunities] = useState<any[]>([]);
  const [agendaHealth, setAgendaHealth] = useState({
    confirmedTomorrow: 0,
    pendingClientConfirmation: 0,
    openSlotsToday: 0,
    attendanceRate: 100
  });

  const getContextualTip = () => {
    if (pendingCount > 0) return `Você tem ${pendingCount} reserva${pendingCount > 1 ? 's' : ''} aguardando confirmação.`;
    if (confirmedToday.length === 0) return 'Nenhum atendimento confirmado hoje. Que tal compartilhar sua vitrine?';
    if (inactiveClients.length > 0) return `${inactiveClients[0].name} não agenda há mais de 30 dias — hora de um recado?`;
    if (recentCompletedClients.length > 0) return `Envie o link de avaliação para ${recentCompletedClients[0].name}!`;
    return 'Atualize seu portfólio esta semana para atrair novas clientes.';
  };

  const dailyTip = getContextualTip();

  const recoveryOps = useMemo(() => {
    if (recentChanges.length === 0 || waitlist.length === 0) return [];
    
    // Filter only cancellations within recentChanges
    const cancellations = recentChanges.filter(c => c.status === 'cancelled');
    
    const ops: any[] = [];
    cancellations.forEach(appt => {
      const hour = parseInt(appt.time.split(':')[0]);
      const period = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'night';
      
      const luckyCandidates = waitlist.filter(w => 
        w.requestedDate === appt.date && 
        (w.period === 'any' || w.period === period || w.preferredTime === appt.time)
      );

      if (luckyCandidates.length > 0) {
        ops.push({
          appointment: appt,
          candidates: luckyCandidates
        });
      }
    });

    return ops;
  }, [recentChanges, waitlist]);

  useEffect(() => {
    if (!user) return;

    const today = getTodayLocale();
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    // Query: All appointments for today (for the agenda list)
    const qToday = query(
      collection(db, 'appointments'),
      where('professionalId', '==', user.uid),
      where('date', '==', today),
      orderBy('time', 'asc')
    );

    // Query: All pending appointments (even for future dates)
    const qPending = query(
      collection(db, 'appointments'),
      where('professionalId', '==', user.uid),
      where('status', '==', 'pending'),
      orderBy('date', 'asc'),
      orderBy('time', 'asc')
    );

    // Query: Next confirmed appointment (including future dates)
    const qNext = query(
      collection(db, 'appointments'),
      where('professionalId', '==', user.uid),
      where('status', '==', 'confirmed'),
      where('date', '>=', today),
      orderBy('date', 'asc'),
      orderBy('time', 'asc')
    );

    const unsubToday = onSnapshot(qToday, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Appointment));
      setAppointments(docs);
      
      const confirmed = docs.filter(a => a.status === 'confirmed');
      setConfirmedToday(confirmed);
      
      const confirmedRev = confirmed.reduce((acc, curr) => acc + (curr.price || 0) + (curr.travelFee || 0), 0);
      setDailyRevenue(confirmedRev);
    });

    const unsubPending = onSnapshot(qPending, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Appointment));
      setPendingCount(docs.length);
      setPendingRequests(docs);
      
      const potential = docs.reduce((acc, curr) => acc + (curr.price || 0) + (curr.travelFee || 0), 0);
      setPotentialRevenue(potential);
    });

    const unsubNext = onSnapshot(qNext, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Appointment));
      // Filter out past appointments for today
      const future = docs.filter(a => a.date > today || (a.date === today && a.time >= currentTime));
      setNextAppointment(future[0] || null);
    });

    // Query: All appointments to calculate inactivity
    const qAll = query(
      collection(db, 'appointments'),
      where('professionalId', '==', user.uid)
    );

    const unsubAll = onSnapshot(qAll, (snapshot) => {
      const appointments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      
      const clientMap = new Map();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const todayStr = getTodayLocale();

      appointments.forEach((app) => {
        const key = app.clientWhatsapp?.replace(/\D/g, '') || app.clientEmail || app.clientName;
        if (!clientMap.has(key)) {
          clientMap.set(key, { name: app.clientName, phone: app.clientWhatsapp, lastDate: app.date, hasFuture: false });
        }
        const c = clientMap.get(key);
        if (app.date > c.lastDate) c.lastDate = app.date;
        if (app.date >= todayStr && (app.status === 'confirmed' || app.status === 'pending')) {
          c.hasFuture = true;
        }
      });

      const inactive = Array.from(clientMap.values()).filter(c => {
        const lastDate = new Date(c.lastDate + 'T12:00:00');
        return lastDate < thirtyDaysAgo && !c.hasFuture;
      }).sort((a, b) => b.lastDate.localeCompare(a.lastDate)).slice(0, 3);

      setInactiveClients(inactive);

      // Referral candidates: Completed today
      const completedToday = appointments.filter(app => 
        app.status === 'completed' && app.date === todayStr
      ).map(app => ({
        name: app.clientName,
        phone: app.clientWhatsapp,
        service: app.serviceName
      }));
      setRecentCompletedClients(completedToday.slice(0, 3));

      // Gerar resumo dos próximos 7 dias
      const summary = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        const dayAppts = appointments.filter(a => a.date === dateStr && a.status === 'confirmed');
        summary.push({
          date: dateStr,
          count: dayAppts.length,
          revenue: dayAppts.reduce((acc, a) => acc + (a.price || 0) + (a.travelFee || 0), 0)
        });
      }
      setWeekSummary(summary);

      // --- CALCULATE AGENDA HEALTH ---
      const tomorrowDate = new Date();
      tomorrowDate.setDate(tomorrowDate.getDate() + 1);
      const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

      const confirmedTomorrowAppts = appointments.filter(a => 
        a.date === tomorrowStr && a.status === 'confirmed'
      );

      const pendingPresenceAppts = appointments.filter(a => 
        a.status === 'confirmed' && 
        !a.clientConfirmedAt &&
        a.date >= todayStr
      );

      const completedAll = appointments.filter(a => a.status === 'completed').length;
      const cancelledNoShow = appointments.filter(a => 
        a.status === 'cancelled' && 
        a.cancellationReason?.toLowerCase().includes('no-show')
      ).length;
      const attendanceRateCalc = completedAll > 0 
        ? Math.round((completedAll / (completedAll + cancelledNoShow)) * 100) 
        : 100;

      setAgendaHealth({
        confirmedTomorrow: confirmedTomorrowAppts.length,
        pendingClientConfirmation: pendingPresenceAppts.length,
        openSlotsToday: 0, // Calculado separadamente se necessário
        attendanceRate: Math.min(100, attendanceRateCalc)
      });
    });

    // Query: Recent changes by clients
    const qChanges = query(
      collection(db, 'appointments'),
      where('professionalId', '==', user.uid),
      where('lastChangeBy', '==', 'client'),
      orderBy('updatedAt', 'desc')
    );

    const unsubChanges = onSnapshot(qChanges, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Appointment));
      setRecentChanges(docs.slice(0, 5)); // Show last 5 changes
    });

    // Sync Profile Settings
    if (profile) {
      setWaitlistMode(profile.waitlistMode || 'manual');
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

    // Check availability for today (Indisponível hoje toggle)
    const blockedRef = collection(db, 'blocked_schedules');
    const unsubTodayBlock = onSnapshot(
      query(blockedRef, where('professionalId', '==', user.uid), where('date', '==', today), where('type', '==', 'full_day')),
      (snap) => {
        setIsUnavailableToday(!snap.empty);
        setTodayBlockId(!snap.empty ? snap.docs[0].id : null);
      }
    );

    // Query: Waitlist Stats
    const qStats = query(
      collection(db, 'waitlist_stats'),
      where('professionalId', '==', user.uid)
    );

    const unsubStats = onSnapshot(qStats, (snapshot) => {
      if (!snapshot.empty) {
        setWaitlistStats(snapshot.docs[0].data());
      }
    });

    // Internal notification listener for waitlist alerts
    const unsubInvitedAlert = onSnapshot(query(qWaitlist, where('status', '==', 'invited')), (snap) => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const data = change.doc.data();
          toast.info(`Convite enviado para ${data.clientName}! ✨ Vaga sendo preenchida.`, { 
            icon: <Sparkles size={16} className="text-brand-terracotta" />,
            duration: 5000 
          });
        }
      });
    });

    return () => {
      unsubToday();
      unsubPending();
      unsubNext();
      unsubAll();
      unsubChanges();
      unsubWaitlist();
      unsubStats();
      unsubTodayBlock();
      unsubInvitedAlert();
    };
  }, [user, profile]);

  // 5. Pendências urgentes:
  const urgentTasks = useMemo(() => {
    const tasks = [];
    const today = getTodayLocale();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatDateKey(tomorrow);
    
    // - clientes sem confirmar (Hoje e amanhã)
    const unconfirmed = appointments.filter(a => 
      a.status === 'confirmed' && 
      !a.clientConfirmedAt && 
      (a.date === today || a.date === tomorrowStr)
    );
    if (unconfirmed.length > 0) {
      tasks.push({ 
        id: 'unconfirmed', 
        type: 'attention', 
        label: `${unconfirmed.length} cliente${unconfirmed.length > 1 ? 's' : ''} sem confirmar presença`,
        icon: <Clock size={14} />,
        color: 'text-amber-600',
        link: '/agenda'
      });
    }

    // - novo pedido (pendentes)
    if (pendingCount > 0) {
      tasks.push({
        id: 'new-requests',
        type: 'new',
        label: `${pendingCount} novo${pendingCount > 1 ? 's' : ''} pedido${pendingCount > 1 ? 's' : ''} pendente${pendingCount > 1 ? 's' : ''}`,
        icon: <Inbox size={14} />,
        color: 'text-brand-terracotta',
        link: '/pedidos'
      });
    }

    // - cancelamentos recentes (últimas 24h)
    const now = new Date();
    const cancelledRecent = appointments.filter(a => {
      if (a.status !== 'cancelled' || a.lastChangeBy !== 'client') return false;
      const updatedAt = a.updatedAt ? new Date(
        typeof a.updatedAt === 'string' ? a.updatedAt : (a.updatedAt as any).toDate?.() || a.updatedAt
      ) : null;
      return updatedAt && (now.getTime() - updatedAt.getTime() < 24 * 60 * 60 * 1000);
    });

    if (cancelledRecent.length > 0) {
      tasks.push({
        id: 'recent-cancellations',
        type: 'cancelled',
        label: `${cancelledRecent.length} cancelamento${cancelledRecent.length > 1 ? 's' : ''} recente${cancelledRecent.length > 1 ? 's' : ''}`,
        icon: <AlertCircle size={14} />,
        color: 'text-red-500',
        link: '/agenda'
      });
    }

    return tasks;
  }, [appointments, pendingCount]);

  const freeSlotsToday = useMemo(() => {
    if (!profile?.workingHours) return 0;
    const startHour = parseInt(profile.workingHours.startTime.split(':')[0]);
    const endHour = parseInt(profile.workingHours.endTime.split(':')[0]);
    
    const today = getTodayLocale();
    const currentHour = new Date().getHours();
    
    // Consider slots from max(startHour, now) to endHour
    const possibleStart = Math.max(startHour, currentHour);
    if (possibleStart >= endHour) return 0;
    
    const occupiedSlots = new Set(appointments.filter(a => a.date === today && a.status !== 'cancelled').map(a => parseInt(a.time.split(':')[0])));
    
    let free = 0;
    for (let h = possibleStart; h < endHour; h++) {
      if (!occupiedSlots.has(h)) free++;
    }
    return free;
  }, [profile, appointments]);

  const remainingApptsTodayCount = useMemo(() => {
    const today = getTodayLocale();
    const nowHour = new Date().getHours();
    const nowMin = new Date().getMinutes();
    const currentTimeStr = `${String(nowHour).padStart(2, '0')}:${String(nowMin).padStart(2, '0')}`;
    
    return confirmedToday.filter(a => a.time >= currentTimeStr).length;
  }, [confirmedToday]);

  const handleRespond = async (id: string, decision: 'confirmed' | 'cancelled') => {
    setProcessingId(id);
    try {
      await updateAppointmentStatus(id, decision);
      
      if (decision === 'confirmed') {
        setConfirmedId(id);
        toast.success('Reserva confirmada com sucesso!');
        // Allow some time for the success state to be visible before it's removed by snapshot
        await new Promise(resolve => setTimeout(resolve, 800));
      } else {
        toast.success('Reserva marcada como indisponível.');
        setIsConfirmRejectOpen(false);
        setRequestToReject(null);
      }
      
      // If closing details modal
      if (selectedRequest?.id === id) {
        setIsModalOpen(false);
      }
    } catch (error: any) {
      handleBookingError(error);
    } finally {
      setProcessingId(null);
      setConfirmedId(null);
    }
  };

  const handleToggleUnavailableToday = async () => {
    if (!user || !profile) return;
    
    setProcessingId('today-toggle');
    try {
      if (isUnavailableToday && todayBlockId) {
        await deleteDoc(doc(db, 'blocked_schedules', todayBlockId));
        toast.success('Agenda liberada para hoje!');
      } else {
        await addDoc(collection(db, 'blocked_schedules'), {
          professionalId: user.uid,
          date: getTodayLocale(),
          startTime: profile.workingHours?.startTime || '09:00',
          endTime: profile.workingHours?.endTime || '18:00',
          reason: 'pessoal',
          type: 'full_day',
          isRecurring: false,
          createdAt: serverTimestamp()
        });
        toast.success('Você está indisponível para novos agendamentos hoje.');
      }
    } catch (e) {
      toast.error('Erro ao atualizar disponibilidade.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleInviteFirst = async (op: any) => {
    const candidate = op.candidates[0];
    setProcessingId(`invite-${candidate.id}`);
    try {
      await inviteFromWaitlist(candidate.id, op.appointment.time);
      toast.success(`Convite enviado para ${candidate.clientName}!`);
    } catch (e) {
      toast.error('Erro ao enviar convite.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleStayBlocked = async (op: any) => {
    if (!user) return;
    setProcessingId(`block-${op.appointment.id}`);
    try {
      await addDoc(collection(db, 'blocked_schedules'), {
        professionalId: user.uid,
        date: op.appointment.date,
        startTime: op.appointment.time,
        endTime: op.appointment.time,
        type: 'manual',
        reason: 'Manter bloqueado (Recuperação)',
        createdAt: serverTimestamp()
      });
      toast.success('Horário bloqueado manualmente.');
    } catch (e) {
      toast.error('Erro ao bloquear horário.');
    } finally {
      setProcessingId(null);
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

  return (
    <AppLayout activeRoute="dashboard">
      {/* Main Content */}
      <main className="flex-1 p-6 md:p-16 max-w-5xl mx-auto w-full">
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            <span className="text-[10px] font-medium text-brand-terracotta uppercase tracking-[0.3em] mb-4 block">Central de Trabalho</span>
            <h1 className="text-[42px] md:text-[56px] font-serif font-normal text-brand-ink leading-tight">
              Olá, {profile?.name?.split(' ')[0]}
            </h1>
            <p className="text-brand-stone text-xs md:text-sm font-light italic mt-2">Tudo organizado para você focar no atendimento.</p>
          </div>
          
          <AnimatePresence>
            {pendingCount > 0 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-brand-terracotta text-brand-white px-6 py-4 rounded-3xl shadow-lg flex items-center gap-4 border-4 border-brand-white"
              >
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest leading-none">
                  {pendingCount} {pendingCount === 1 ? 'novo agendamento aguardando confirmação' : 'novos agendamentos aguardando confirmação'}
                </span>
                <Link 
                  to="/pedidos" 
                  className="bg-white text-brand-terracotta px-4 py-2 rounded-full text-[9px] font-bold uppercase tracking-widest hover:bg-brand-linen transition-all"
                >
                  Ver Todos
                </Link>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-3">
              <button 
                onClick={handleToggleUnavailableToday}
                disabled={processingId === 'today-toggle'}
                className={cn(
                  "flex items-center gap-3 px-6 py-4 rounded-full text-[10px] font-medium uppercase tracking-widest transition-all shadow-sm border",
                  isUnavailableToday 
                    ? "bg-brand-linen border-brand-terracotta text-brand-terracotta" 
                    : "bg-brand-white border-brand-mist text-brand-stone hover:bg-brand-parchment"
                )}
              >
                {isUnavailableToday ? <AlertCircle size={14} /> : <Lock size={14} />}
                {isUnavailableToday ? 'Indisponível hoje' : 'Disponível hoje'}
              </button>
              <button 
                onClick={() => setIsShareModalOpen(true)}
                className="flex items-center gap-3 px-6 py-4 bg-brand-white border border-brand-mist rounded-full text-[10px] font-medium uppercase tracking-widest hover:bg-brand-linen transition-all shadow-sm group"
              >
                <Share2 size={14} className="text-brand-terracotta group-hover:scale-110 transition-transform" />
                Compartilhar Vitrine
              </button>
              <Link 
                to="/agenda"
                className="px-6 py-4 bg-brand-ink text-brand-white rounded-full text-[10px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all shadow-lg flex items-center gap-2"
              >
                <Plus size={14} /> Novo
              </Link>
            </div>
        </header>

        {/* AT-A-GLANCE: SEU DIA */}
        <section className="mb-12">
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-[10px] font-bold text-brand-stone uppercase tracking-[0.3em]">Seu Dia</h2>
            <div className="h-px flex-1 bg-brand-mist" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 lg:gap-6">
            {/* NEXT BIG CARD */}
            <div className="md:col-span-2 bg-brand-ink rounded-[40px] p-8 text-white relative overflow-hidden group shadow-xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-terracotta/20 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-brand-terracotta/30 transition-colors" />
              
              <div className="relative z-10 flex flex-col h-full justify-between gap-6">
                <div>
                  <span className="text-[10px] font-bold text-brand-terracotta uppercase tracking-widest block mb-4">Próximo Atendimento</span>
                  {nextAppointment && nextAppointment.date === getTodayLocale() ? (
                    <div>
                      <h3 className="text-3xl font-serif mb-2">{nextAppointment.clientName}</h3>
                      <div className="flex items-center gap-4 opacity-70">
                        <span className="flex items-center gap-2 text-[10px] uppercase tracking-widest">
                          <Clock size={12} className="text-brand-terracotta" />
                          {nextAppointment.time}
                        </span>
                        <span className="flex items-center gap-2 text-[10px] uppercase tracking-widest">
                          <MapPin size={12} className="text-brand-terracotta" />
                          {nextAppointment.locationType === 'home' ? (nextAppointment.neighborhood || 'Domicílio') : 'Estúdio'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-4">
                      <p className="text-lg font-serif italic text-brand-linen opacity-60">Nenhum atendimento imediato.</p>
                      <p className="text-[10px] uppercase tracking-widest mt-2">{confirmedToday.length === 0 ? 'Que tal um café?' : 'Aproveite o intervalo.'}</p>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between border-t border-white/10 pt-6">
                  <div className="flex -space-x-2">
                    {confirmedToday.slice(0, 3).map((a, i) => (
                      <div key={a.id} className="w-8 h-8 rounded-full bg-brand-terracotta border-2 border-brand-ink flex items-center justify-center text-[10px] font-bold">
                        {a.clientName.charAt(0)}
                      </div>
                    ))}
                    {confirmedToday.length > 3 && (
                      <div className="w-8 h-8 rounded-full bg-brand-stone/40 border-2 border-brand-ink flex items-center justify-center text-[10px] font-bold">
                        +{confirmedToday.length - 3}
                      </div>
                    )}
                  </div>
                  <Link to="/agenda" className="text-[10px] font-bold uppercase tracking-widest text-brand-terracotta flex items-center gap-2 group-hover:translate-x-1 transition-transform">
                    {remainingApptsTodayCount} restantes hoje <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            </div>

            {/* REVENUE & SLOTS GAUGE */}
            <div className="space-y-4 lg:space-y-6">
              <div className="bg-brand-white rounded-[40px] p-8 border border-brand-mist shadow-sm h-full group hover:bg-brand-linen transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-brand-stone uppercase tracking-widest">Ganhos de Hoje</span>
                  <div className="p-2 bg-green-50 text-green-600 rounded-xl">
                    <TrendingUp size={16} />
                  </div>
                </div>
                <div className="mt-4">
                  <h4 className="text-2xl font-serif text-brand-ink">{formatCurrency(dailyRevenue)}</h4>
                  <p className="text-[10px] text-brand-stone mt-1">{confirmedToday.length} atendimentos previstos</p>
                </div>
              </div>
              <div className="bg-brand-white rounded-[40px] p-8 border border-brand-mist shadow-sm h-full group hover:bg-brand-white transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-brand-stone uppercase tracking-widest">Vagas Livres</span>
                  <div className="p-2 bg-brand-linen text-brand-terracotta rounded-xl">
                    <Sparkles size={16} />
                  </div>
                </div>
                <div className="mt-4">
                  <h4 className={cn("text-2xl font-serif", freeSlotsToday > 0 ? "text-brand-ink" : "text-brand-stone opacity-40")}>
                    {freeSlotsToday} {freeSlotsToday === 1 ? 'horário' : 'horários'}
                  </h4>
                  <p className="text-[10px] text-brand-stone mt-1">disponíveis para hoje</p>
                </div>
              </div>
            </div>

            {/* PENDENCIES URGENTES */}
            <div className="bg-brand-rose/5 rounded-[40px] p-8 border border-brand-terracotta/10 shadow-sm flex flex-col h-full overflow-hidden">
               <div className="flex items-center gap-2 mb-6">
                 <div className="w-2 h-2 rounded-full bg-brand-terracotta animate-pulse" />
                 <span className="text-[10px] font-bold text-brand-ink uppercase tracking-widest">Pendências Urgentes</span>
               </div>
               
               <div className="flex-1 space-y-4">
                 {urgentTasks.length > 0 ? (
                   urgentTasks.map(task => (
                    <Link 
                      key={task.id}
                      to={task.link}
                      className="flex items-start gap-4 p-4 bg-white/50 rounded-2xl border border-brand-terracotta/5 hover:bg-white transition-colors group"
                    >
                      <div className={cn("w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0", task.color)}>
                        {task.icon}
                      </div>
                      <div className="flex-1">
                        <p className="text-[11px] font-medium text-brand-ink leading-tight">{task.label}</p>
                        <span className="text-[9px] text-brand-terracotta uppercase font-bold tracking-tighter group-hover:underline">Resolver →</span>
                      </div>
                    </Link>
                   ))
                 ) : (
                   <div className="h-full flex flex-col items-center justify-center text-center py-6 opacity-40">
                     <CheckCircle2 size={32} className="text-brand-stone mb-2" />
                     <p className="text-[11px] font-medium text-brand-stone">Zero pendências</p>
                   </div>
                 )}
               </div>
            </div>
          </div>
        </section>

        {/* 1. OPERATIONAL SUMMARY BAR */}
        <section className="flex flex-wrap gap-4 mb-12">
          {recentChanges.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="w-full bg-amber-50 border border-amber-100 p-4 rounded-[28px] mb-4 flex items-center gap-4 shadow-sm"
            >
              <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center shrink-0">
                <AlertCircle size={20} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-0.5">Mudanças recentes na agenda</p>
                <p className="text-[11px] text-amber-700 opacity-80 italic">"{recentChanges[0].changeMessage}"</p>
              </div>
              <button 
                 onClick={() => {
                   // Clear changes alerts by updating local state or marking as seen (here just hiding for now)
                   setRecentChanges([]);
                 }}
                 className="text-amber-400 hover:text-amber-700 transition-colors"
               >
                 <X size={18} />
               </button>
            </motion.div>
          )}
          
          {/* REAL MONETIZATION: RECOVERY OPPORTUNITIES */}
          <AnimatePresence>
            {recoveryOps.map((op, idx) => (
              <motion.div 
                key={`recovery-${op.appointment.id}-${idx}`}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full bg-brand-linen border-2 border-brand-terracotta p-6 rounded-[32px] mb-8 shadow-xl flex flex-col md:flex-row items-center gap-6 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-terracotta/5 rounded-full blur-3xl -mr-16 -mt-16" />
                
                <div className="w-14 h-14 bg-brand-white text-brand-terracotta rounded-full flex items-center justify-center shrink-0 shadow-sm border border-brand-mist">
                  <TrendingUp size={28} />
                </div>
                
                <div className="flex-1 text-center md:text-left">
                  <span className="text-[9px] font-bold text-brand-terracotta uppercase tracking-[0.2em] mb-1 block">Oportunidade de Monetização</span>
                  <p className="text-sm font-serif text-brand-ink mb-1">
                    Horário de <span className="font-bold">{op.appointment.time}</span> ({op.appointment.date.split('-').reverse().join('/')}) ficou livre.
                  </p>
                  <p className="text-[11px] text-brand-stone italic">
                    Há {op.candidates.length} interessada{op.candidates.length > 1 ? 's' : ''} esperando uma vaga.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button 
                    onClick={() => handleInviteFirst(op)}
                    disabled={processingId === `invite-${op.candidates[0].id}`}
                    className="bg-brand-ink text-brand-white px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-brand-espresso transition-all shadow-md disabled:opacity-50"
                  >
                    {processingId === `invite-${op.candidates[0].id}` ? 'Enviando...' : `Chamar ${op.candidates[0].clientName.split(' ')[0]}`}
                  </button>
                  <button 
                    onClick={() => {
                      // Just remove the alert locally
                      setRecentChanges(prev => prev.filter(c => c.id !== op.appointment.id));
                      toast.success('Horário liberado para o público.');
                    }}
                    className="bg-brand-white border border-brand-mist text-brand-ink px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-brand-linen transition-all shadow-sm"
                  >
                    Liberar Público
                  </button>
                  <button 
                    onClick={() => handleStayBlocked(op)}
                    disabled={processingId === `block-${op.appointment.id}`}
                    className="bg-brand-white border border-brand-mist text-brand-stone px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-brand-rose/10 hover:text-brand-terracotta transition-all shadow-sm disabled:opacity-50"
                  >
                    Manter Bloqueado
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* SAÚDE DA AGENDA - PREMIUM SECTION */}
          <div className="w-full flex flex-col md:flex-row gap-6 mb-8">
             <div className="flex-1 bg-brand-white p-8 rounded-[40px] border border-brand-mist shadow-sm relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-24 h-24 bg-brand-linen rounded-full -mr-8 -mt-8 blur-2xl group-hover:bg-brand-rose/10 transition-colors" />
               <div className="relative z-10 flex items-center gap-6">
                 <div className="w-14 h-14 bg-brand-linen text-brand-ink rounded-[20px] flex items-center justify-center shadow-inner">
                   <TrendingUp size={28} />
                 </div>
                 <div>
                   <h2 className="text-[10px] font-bold text-brand-stone uppercase tracking-[0.3em] mb-1">Saúde da Agenda</h2>
                   <p className="text-[11px] text-brand-ink/60 font-light italic">Seus indicadores anti-no-show</p>
                 </div>
               </div>
               
               <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8">
                 <div className="space-y-1">
                   <span className="text-[8px] font-bold text-brand-stone uppercase tracking-widest block">Amanhã</span>
                   <div className="flex items-baseline gap-2">
                     <span className="text-xl font-serif text-brand-ink">{agendaHealth.confirmedTomorrow}</span>
                     <span className="text-[9px] text-brand-stone uppercase">confirmadas</span>
                   </div>
                 </div>
                 <div className="space-y-1">
                   <span className="text-[8px] font-bold text-brand-stone uppercase tracking-widest block">Pendentes</span>
                   <div className="flex items-baseline gap-2">
                     <span className={cn("text-xl font-serif", agendaHealth.pendingClientConfirmation > 0 ? "text-brand-terracotta" : "text-brand-ink")}>
                       {agendaHealth.pendingClientConfirmation}
                     </span>
                     <span className="text-[9px] text-brand-stone uppercase">respostas</span>
                   </div>
                 </div>
                 <div className="space-y-1">
                   <span className="text-[8px] font-bold text-brand-stone uppercase tracking-widest block">Vagas livres</span>
                   <div className="flex items-baseline gap-2">
                     <span className="text-xl font-serif text-brand-ink">{agendaHealth.openSlotsToday}</span>
                     <span className="text-[9px] text-brand-stone uppercase">hoje</span>
                   </div>
                 </div>
                 <div className="space-y-1">
                   <span className="text-[8px] font-bold text-brand-stone uppercase tracking-widest block">Taxa Presença</span>
                   <div className="flex items-baseline gap-2">
                     <span className="text-xl font-serif text-brand-ink">{agendaHealth.attendanceRate}%</span>
                     <div className={cn(
                       "w-1.5 h-1.5 rounded-full",
                       agendaHealth.attendanceRate > 90 ? "bg-green-500" : agendaHealth.attendanceRate > 70 ? "bg-amber-500" : "bg-red-500"
                     )} />
                   </div>
                 </div>
               </div>
             </div>
          </div>

          <div className="bg-brand-white border border-brand-mist px-5 py-3 rounded-2xl flex items-center gap-3 shadow-sm">
            <div className={`w-2 h-2 rounded-full ${pendingCount > 0 ? 'bg-brand-terracotta animate-pulse' : 'bg-brand-mist'}`} />
            <span className="text-[10px] font-medium uppercase tracking-widest text-brand-stone">
              {pendingCount} Aguardando
            </span>
          </div>
          <div className="bg-brand-white border border-brand-mist px-5 py-3 rounded-2xl flex items-center gap-3 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-brand-stone">
              {confirmedToday.length} Reservas hoje
            </span>
          </div>
          <div className="bg-brand-linen border border-brand-mist px-5 py-3 rounded-2xl flex items-center gap-3 shadow-sm">
            <TrendingUp size={14} className="text-brand-terracotta" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-brand-ink">
              {formatCurrency(dailyRevenue)} Total hoje
            </span>
          </div>
          <div className="bg-brand-linen border border-brand-mist px-5 py-3 rounded-2xl flex items-center gap-3 shadow-sm">
            <TrendingUp size={14} className="text-brand-stone" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-brand-stone">
              {formatCurrency(potentialRevenue)} em análise
            </span>
          </div>
        </section>

        {/* Esta Semana Section */}
        {weekSummary.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-4 mb-6">
              <h2 className="text-[10px] font-medium text-brand-stone uppercase tracking-[0.3em]">Esta Semana</h2>
              <div className="h-px flex-1 bg-brand-mist" />
            </div>
            <div className="grid grid-cols-7 gap-2">
              {weekSummary.map((day, i) => {
                const d = new Date(day.date + 'T12:00:00');
                const isToday = day.date === getTodayLocale();
                return (
                  <Link
                    key={day.date}
                    to={`/agenda?date=${day.date}`}
                    className={cn(
                      "flex flex-col items-center p-3 rounded-2xl border transition-all hover:scale-105",
                      isToday
                        ? "bg-brand-ink text-brand-white border-brand-ink shadow-lg"
                        : day.count > 0
                          ? "bg-brand-white border-brand-terracotta/30 text-brand-ink shadow-sm"
                          : "bg-brand-white border-brand-mist text-brand-stone"
                    )}
                  >
                    <span className="text-[8px] font-bold uppercase tracking-widest mb-1 opacity-60">
                      {d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
                    </span>
                    <span className="text-lg font-serif leading-none mb-2">{d.getDate()}</span>
                    {day.count > 0 ? (
                      <div className="flex flex-col items-center">
                        <div className={`w-1.5 h-1.5 rounded-full mb-1 ${isToday ? 'bg-brand-terracotta' : 'bg-brand-terracotta'}`} />
                        <span className="text-[8px] font-bold">{day.count}</span>
                      </div>
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-mist" />
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* 2. PENDING REQUESTS (PRIORITY 1) */}
        {pendingRequests.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center gap-4 mb-8">
              <h2 className="text-[10px] font-medium text-brand-stone uppercase tracking-[0.3em]">Novas Reservas</h2>
              <div className="h-px flex-1 bg-brand-terracotta/20" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AnimatePresence mode="popLayout">
                {pendingRequests.map((request) => (
                  <motion.div 
                    key={request.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                    className="bg-brand-white p-6 rounded-[32px] border-2 border-brand-terracotta shadow-xl relative overflow-hidden group"
                  >
                    {/* Success Overlay */}
                    <AnimatePresence>
                      {confirmedId === request.id && (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="absolute inset-0 z-20 bg-brand-ink flex flex-col items-center justify-center text-brand-white"
                        >
                          <motion.div 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', damping: 12 }}
                            className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-3"
                          >
                            <Check size={32} className="text-brand-terracotta" />
                          </motion.div>
                          <p className="text-[10px] font-medium uppercase tracking-[0.2em]">Confirmado</p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="flex justify-between items-start mb-6">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-xl font-serif text-brand-ink">{request.clientName}</h3>
                        {(() => {
                          const score = getClientScore(appointments, request.clientWhatsapp);
                          if (!score) return null;
                          const config = {
                            reliable: { label: 'Cliente Fiel', className: 'bg-green-50 text-green-700 border-green-200' },
                            attention: { label: 'Atenção', className: 'bg-amber-50 text-amber-700 border-amber-200' },
                            risk: { label: 'Histórico de Faltas', className: 'bg-red-50 text-red-600 border-red-200' }
                          };
                          const c = config[score];
                          return (
                            <span className={`text-[8px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border ${c.className}`}>
                              {c.label}
                            </span>
                          );
                        })()}
                      </div>
                      <p className="text-[10px] text-brand-terracotta uppercase tracking-widest font-bold tracking-tighter bg-brand-terracotta/5 px-2 py-0.5 rounded inline-block">
                        {request.serviceName}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-brand-ink">{formatCurrency((request.price || 0) + (request.travelFee || 0))}</p>
                      <p className="text-[8px] text-brand-stone uppercase tracking-widest">Total</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-brand-parchment rounded-2xl">
                    <div className="flex items-center gap-3 text-brand-ink">
                      <Calendar size={14} className="text-brand-terracotta" />
                      <span className="text-xs font-medium">{request.date.split('-').reverse().join('/')}</span>
                    </div>
                    <div className="flex items-center gap-3 text-brand-ink">
                      <Clock size={14} className="text-brand-terracotta" />
                      <span className="text-xs font-medium">{request.time}</span>
                    </div>
                    <div className="col-span-2 flex items-center gap-3 text-brand-ink mt-1">
                      <MapPin size={14} className="text-brand-terracotta" />
                      <span className="text-xs font-medium truncate">
                        {request.locationType === 'home' ? (request.neighborhood || 'Domicílio') : 'No Estúdio'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleRespond(request.id, 'confirmed')}
                      disabled={processingId === request.id}
                      className="flex-1 py-4 bg-brand-ink text-brand-white rounded-xl text-[10px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all shadow-lg text-center flex items-center justify-center gap-2"
                    >
                      {processingId === request.id ? (
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                          <Sparkles size={14} />
                        </motion.div>
                      ) : 'Confirmar reserva'}
                    </button>
                    <button 
                      onClick={() => { setSelectedRequest(request); setIsModalOpen(true); }}
                      disabled={processingId === request.id}
                      className="px-5 py-4 bg-brand-white text-brand-ink border border-brand-mist rounded-xl text-[10px] font-medium uppercase tracking-widest hover:bg-brand-linen transition-all disabled:opacity-50"
                    >
                      Consultar
                    </button>
                  </div>
                </motion.div>
              ))}
              </AnimatePresence>
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* LEFT COLUMN: NEXT & AGENDA */}
          <div className="lg:col-span-2 space-y-16">
            
            {/* 3. NEXT APPOINTMENT (PRIORITY 2) */}
            <section>
              <div className="flex items-center gap-4 mb-8">
                <h2 className="text-[10px] font-medium text-brand-stone uppercase tracking-[0.3em]">Agenda de Hoje</h2>
                <div className="h-px flex-1 bg-brand-mist" />
              </div>
              
              {confirmedToday.length > 0 ? (
                <div className="space-y-4">
                  {/* Reuse existing list or logic here, but with requested empty state if empty */}
                  {confirmedToday.map(appt => (
                    <div 
                      key={appt.id}
                      className="bg-white p-6 rounded-[32px] border border-brand-mist flex items-center justify-between group hover:border-brand-terracotta transition-colors shadow-sm"
                    >
                      <div className="flex items-center gap-6">
                        <div className="text-center shrink-0">
                          <span className="text-xl font-serif text-brand-ink block">{appt.time}</span>
                          <span className="text-[8px] font-bold text-brand-stone uppercase tracking-widest">Início</span>
                        </div>
                        <div className="h-10 w-px bg-brand-mist" />
                        <div>
                          <h4 className="text-xl font-serif text-brand-ink leading-none mb-1">{appt.clientName}</h4>
                          <p className="text-[10px] text-brand-terracotta font-bold uppercase tracking-tighter">{appt.serviceName}</p>
                        </div>
                      </div>
                      <Link 
                        to="/agenda" 
                        className="w-10 h-10 rounded-full bg-brand-linen flex items-center justify-center text-brand-ink hover:bg-brand-ink hover:text-white transition-all shadow-sm"
                      >
                        <ChevronRight size={20} />
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-brand-white border border-brand-mist border-dashed p-12 rounded-[40px] text-center shadow-inner">
                  <div className="w-16 h-16 bg-brand-linen rounded-full flex items-center justify-center mx-auto mb-4 text-brand-terracotta">
                    <Heart size={28} />
                  </div>
                  <h3 className="text-xl font-serif text-brand-ink mb-2">Hoje está leve.</h3>
                  <p className="text-xs text-brand-stone font-light italic max-w-xs mx-auto">Excelente dia para focar em você ou abrir horários extras para suas clientes fiéis.</p>
                  <Link to="/agenda" className="text-[10px] font-bold uppercase tracking-widest text-brand-terracotta mt-6 inline-block hover:underline border-b border-brand-terracotta pb-0.5">Abrir Agenda Completa</Link>
                </div>
              )}
            </section>

            {/* 4. TODAY'S AGENDA (PRIORITY 3) */}
            <section>
              <div className="flex items-center gap-4 mb-8">
                <h2 className="text-[10px] font-medium text-brand-stone uppercase tracking-[0.3em]">Agenda de Hoje</h2>
                <div className="h-px flex-1 bg-brand-mist" />
              </div>
              
              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                {confirmedToday.length > 0 ? (
                  confirmedToday.map((appt) => (
                    <motion.div 
                      key={appt.id}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                      className="bg-brand-white p-6 rounded-[28px] border border-brand-mist flex items-center justify-between shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
                    >
                      {/* Completion Overlay */}
                      <AnimatePresence>
                        {confirmedId === appt.id && (
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="absolute inset-0 z-20 bg-brand-ink/90 backdrop-blur-sm flex items-center justify-center text-brand-white"
                          >
                            <div className="flex items-center gap-3">
                              <Check size={18} className="text-brand-terracotta" />
                              <span className="text-[10px] font-medium uppercase tracking-[0.2em]">Concluído</span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="flex items-center gap-6">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-serif text-lg ${appt.id === nextAppointment?.id ? 'bg-brand-terracotta text-brand-white' : 'bg-brand-parchment text-brand-ink'}`}>
                          {appt.time}
                        </div>
                        <div>
                           <div className="flex items-center gap-2 mb-1">
                             <p className="font-medium text-brand-ink">{appt.clientName}</p>
                             {(() => {
                                 const score = getClientScore(appointments, appt.clientWhatsapp);
                                 if (!score) return null;
                                 return (
                                   <div className={cn(
                                     "px-2 py-0.5 rounded-full text-[7px] font-bold uppercase tracking-widest",
                                     score === 'reliable' ? "bg-green-100 text-green-700" :
                                     score === 'attention' ? "bg-amber-100 text-amber-700" :
                                     "bg-red-100 text-red-700"
                                   )}>
                                     {score === 'reliable' ? 'Confiável' :
                                      score === 'attention' ? 'Atenção' : 'Risco'}
                                   </div>
                                 );
                               })()}
                             {(appt.date === getTodayLocale() || appt.date === (new Date(Date.now() + 86400000).toISOString().split('T')[0])) && !appt.clientConfirmedAt && (
                               <div className="px-2 py-0.5 bg-amber-500 text-white rounded-full text-[7px] font-bold uppercase tracking-widest animate-pulse">
                                 Pendente de Confirmação
                               </div>
                             )}
                           </div>
                           <p className="text-[10px] text-brand-stone uppercase tracking-widest tracking-tighter">{appt.serviceName}</p>
                         </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleComplete(appt.id)}
                          disabled={processingId === appt.id}
                          className="w-10 h-10 flex items-center justify-center bg-brand-linen text-brand-stone rounded-full hover:bg-brand-ink hover:text-brand-white transition-all disabled:opacity-50"
                        >
                          {processingId === appt.id ? (
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                              <Sparkles size={16} />
                            </motion.div>
                          ) : <Check size={18} />}
                        </button>
                        <button 
                          onClick={() => { setSelectedRequest(appt); setIsModalOpen(true); }}
                          disabled={processingId === appt.id}
                          className="w-10 h-10 flex items-center justify-center bg-brand-linen text-brand-stone rounded-full hover:bg-brand-ink hover:text-brand-white transition-all"
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-brand-white p-12 rounded-[40px] border border-brand-mist shadow-sm text-center flex flex-col items-center gap-8"
                  >
                    <div className="w-20 h-20 bg-brand-linen text-brand-terracotta rounded-full flex items-center justify-center">
                      <Sparkles size={32} />
                    </div>
                    <div>
                      <h3 className="text-2xl md:text-3xl font-serif text-brand-ink mb-3">
                        Momentos de tranquilidade hoje, {profile?.name?.split(' ')[0]}.
                      </h3>
                      <p className="text-brand-stone font-light italic text-lg">
                        Compartilhe sua marca para despertar novos desejos.
                      </p>
                    </div>
                    <button 
                      onClick={() => {
                        const url = window.location.origin + '/p/' + profile?.slug;
                        navigator.clipboard.writeText(url);
                        toast.success('Link copiado.');
                      }}
                      className="flex items-center gap-4 px-10 py-5 bg-brand-ink text-brand-white rounded-full text-[11px] font-medium uppercase tracking-[0.2em] hover:bg-brand-espresso transition-all shadow-xl group"
                    >
                      <Share2 size={18} className="group-hover:scale-110 transition-transform" /> 
                      Copiar link do meu espaço
                    </button>
                  </motion.div>
                )}
                </AnimatePresence>
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN: PERFORMANCE & ACTIONS */}
          <div className="space-y-8">
            {/* REVENUE SECTION */}
            <section className="bg-brand-white p-8 rounded-[40px] border border-brand-mist shadow-sm">
              <h3 className="text-[10px] font-medium text-brand-stone uppercase tracking-[0.3em] mb-8">Faturamento</h3>
              
              <div className="mb-8">
                <p className="text-[10px] text-brand-stone uppercase tracking-widest mb-1">Confirmado</p>
                <p className="text-4xl font-serif text-brand-ink">{formatCurrency(dailyRevenue)}</p>
              </div>

              <div className="space-y-4 pt-8 border-t border-brand-mist">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-brand-stone uppercase tracking-widest">Potencial a Confirmar</span>
                  <span className="text-sm font-medium text-brand-terracotta">+{formatCurrency(potentialRevenue)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-brand-stone uppercase tracking-widest">Atendimentos</span>
                  <span className="text-sm font-medium text-brand-ink">{confirmedToday.length}</span>
                </div>
              </div>

              <Link to="/clients" className="mt-8 flex items-center justify-between text-[10px] font-medium uppercase tracking-widest text-brand-terracotta hover:gap-2 transition-all">
                Minha Carteira de Clientes <ChevronRight size={14} />
              </Link>
            </section>

            {/* 7. RECENT CLIENTS (REFERRAL) */}
            {recentCompletedClients.length > 0 && (
              <section className="bg-brand-white p-8 rounded-[40px] border border-brand-mist shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-brand-linen rounded-full -mr-8 -mt-8 blur-2xl" />
                
                <h3 className="text-[10px] font-bold text-brand-ink uppercase tracking-[0.3em] mb-8 flex items-center gap-2 relative z-10">
                  <Heart size={12} className="text-brand-terracotta" /> Expandir seu Nome
                </h3>
                
                <div className="space-y-6 relative z-10">
                  <p className="text-[10px] text-brand-stone uppercase tracking-widest mb-2 font-medium">Pedir indicação para clientes de hoje</p>
                  
                  <div className="space-y-4">
                    {recentCompletedClients.map((client, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-brand-parchment/50 rounded-2xl border border-brand-mist/30">
                        <div>
                          <p className="text-xs font-semibold text-brand-ink mb-0.5">{client.name}</p>
                          <p className="text-[9px] text-brand-stone uppercase tracking-widest">
                            {client.service}
                          </p>
                        </div>
                        <button 
                          onClick={() => {
                            const url = `${window.location.origin}/p/${profile?.slug}`;
                            const message = `Oi ${client.name.split(' ')[0]}! Gostou da experiência de hoje? ✨ Ficaria muito feliz se pudesse me indicar para uma amiga. Você pode compartilhar meu perfil por aqui: ${url}`;
                            window.open(buildWhatsappLink(client.phone, message), '_blank');
                          }}
                          className="px-4 py-2 flex items-center gap-2 bg-brand-white text-brand-ink border border-brand-mist rounded-xl text-[9px] font-bold uppercase tracking-widest hover:border-brand-terracotta transition-all shadow-sm"
                        >
                          <Share2 size={12} /> Pedir
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* 6. INACTIVE CLIENTS (RECOVERY) */}
            {inactiveClients.length > 0 && (
              <section className="bg-brand-parchment p-8 rounded-[40px] border border-brand-mist shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-brand-terracotta/5 rounded-full -mr-8 -mt-8 blur-2xl" />
                
                <h3 className="text-[10px] font-bold text-brand-terracotta uppercase tracking-[0.3em] mb-8 flex items-center gap-2 relative z-10">
                  <TrendingUp size={12} /> Trazer Receita Escondida
                </h3>
                
                <div className="space-y-6 relative z-10">
                  <p className="text-[10px] text-brand-stone uppercase tracking-widest mb-2 font-medium">Relacionamentos para reativar</p>
                  
                  <div className="space-y-4">
                    {inactiveClients.map((client, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-brand-white rounded-2xl border border-brand-mist/50">
                        <div>
                          <p className="text-xs font-semibold text-brand-ink mb-0.5">{client.name}</p>
                          <p className="text-[9px] text-brand-stone uppercase tracking-widest">
                            Última vez em {new Date(client.lastDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          </p>
                        </div>
                        <button 
                          onClick={() => {
                            const message = "Oi! Abri novos horários essa semana e lembrei de você ✨";
                            window.open(buildWhatsappLink(client.phone, message), '_blank');
                          }}
                          className="w-10 h-10 flex items-center justify-center bg-brand-linen text-brand-terracotta rounded-xl hover:bg-brand-terracotta hover:text-brand-white transition-all shadow-sm"
                          title="Enviar mensagem"
                        >
                          <MessageCircle size={18} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <Link to="/clients" className="block text-center p-4 border border-dashed border-brand-mist rounded-2xl text-[10px] font-medium uppercase tracking-[0.2em] text-brand-stone hover:text-brand-ink transition-all">
                    Ver todos os relacionamentos
                  </Link>
                </div>
              </section>
            )}

            {/* QUICK ACTIONS */}
            <section className="bg-brand-linen p-8 rounded-[40px] border border-brand-mist">
              <h3 className="text-[10px] font-medium text-brand-stone uppercase tracking-[0.3em] mb-6">Operacional</h3>
              <div className="grid grid-cols-1 gap-3">
                <Link
                  to="/pedidos"
                  className="flex items-center gap-3 p-4 bg-brand-white rounded-2xl text-[10px] font-medium uppercase tracking-widest text-brand-ink hover:translate-x-1 transition-all"
                >
                  <Inbox size={14} className="text-brand-terracotta" /> Ver Solicitações
                </Link>
                <Link
                  to="/agenda"
                  className="flex items-center gap-3 p-4 bg-brand-white rounded-2xl text-[10px] font-medium uppercase tracking-widest text-brand-ink hover:translate-x-1 transition-all"
                >
                  <Calendar size={14} className="text-brand-terracotta" /> Bloquear Horário
                </Link>
                <button 
                  onClick={() => toast.info('Os lembretes automáticos em massa são uma função da Versão Pro.')}
                  className="flex items-center gap-3 p-4 bg-brand-white rounded-2xl text-[10px] font-medium uppercase tracking-widest text-brand-ink hover:translate-x-1 transition-all"
                >
                  <MessageCircle size={14} className="text-brand-terracotta" /> Lembretes em Massa
                </button>
                <Link to="/services" className="flex items-center gap-3 p-4 bg-brand-white rounded-2xl text-[10px] font-medium uppercase tracking-widest text-brand-ink hover:translate-x-1 transition-all">
                  <Settings size={14} className="text-brand-terracotta" /> Gerenciar Experiências
                </Link>
              </div>
            </section>

            {/* DAILY TIP */}
            <motion.section 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-brand-ink/5 p-8 rounded-[40px] border border-brand-terracotta/10 relative overflow-hidden"
            >
              <Sparkles size={40} className="absolute -right-4 -bottom-4 text-brand-terracotta/10 -rotate-12" />
              <div className="relative z-10">
                <h3 className="text-[10px] font-medium text-brand-terracotta uppercase tracking-[0.3em] mb-4">Dica do Dia</h3>
                <p className="text-xs text-brand-ink font-serif italic leading-relaxed">
                  {dailyTip}
                </p>
              </div>
            </motion.section>
          </div>
        </div>
      </main>

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
                      <p className="text-[10px] text-brand-stone font-medium uppercase tracking-widest">Enviar para minhas contatos</p>
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
                          ? (selectedRequest.address || `Bairro: ${selectedRequest.neighborhood}`) 
                          : profile?.studioAddress 
                            ? `${profile.studioAddress.street}, ${profile.studioAddress.number}${profile.studioAddress.complement ? ` - ${profile.studioAddress.complement}` : ''}, ${profile.studioAddress.neighborhood}`
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
                    onClick={() => handleRespond(selectedRequest.id, 'confirmed')}
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
                  onClick={() => handleRespond(requestToReject.id, 'cancelled')}
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
              <div className="grid grid-cols-2 gap-4 mb-10">
                <div className="p-6 bg-brand-parchment rounded-[28px] border border-brand-mist/50">
                  <p className="text-[9px] text-brand-stone uppercase tracking-widest mb-2">Vagas Recuperadas</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-serif text-brand-ink">{waitlistStats.recoveredSlots || 0}</span>
                    <Sparkles size={16} className="text-brand-terracotta" />
                  </div>
                </div>
                <div className="p-6 bg-brand-parchment rounded-[28px] border border-brand-mist/50">
                  <p className="text-[9px] text-brand-stone uppercase tracking-widest mb-2">Receita Salva</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-serif text-brand-terracotta">{formatCurrency(waitlistStats.savedRevenue || 0)}</span>
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
    </AppLayout>
  );
}
