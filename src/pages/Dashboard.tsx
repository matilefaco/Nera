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
  AlertCircle, ShieldCheck, Lock, Sun, Moon, Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  formatCurrency, getTodayLocale, buildWhatsappLink, 
  generateWaitlistInviteMessage, cn, formatDateKey, parseLocalDate 
} from '../lib/utils';
import { getClientScore } from '../lib/clientUtils';
import Logo from '../components/Logo';
import { Appointment, WaitlistEntry, BlockedSchedule } from '../types';
import { AnimatePresence } from 'motion/react';
import AppLayout from '../components/AppLayout';
import BlockAvailabilityModal from '../components/BlockAvailabilityModal';
import { getAvailableSlots, getDayAvailability } from '../lib/bookingUtils';

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
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
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [waitlistMode, setWaitlistMode] = useState<'auto' | 'manual'>('manual');
  const [blockedSchedules, setBlockedSchedules] = useState<BlockedSchedule[]>([]);

  const getContextualTip = () => {
    if (pendingCount > 0) return `Você tem ${pendingCount} reserva${pendingCount > 1 ? 's' : ''} aguardando confirmação.`;
    if (confirmedToday.length === 0) return 'Nenhum atendimento confirmado hoje. Que tal compartilhar seu perfil?';
    return 'Mantenha seu perfil atualizado para atrair novas clientes.';
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
      setConfirmedToday(docs.filter(a => a.status === 'confirmed'));
      setDailyRevenue(docs.filter(a => a.status === 'confirmed').reduce((acc, curr) => acc + (curr.price || 0) + (curr.travelFee || 0), 0));
    });

    const unsubPending = onSnapshot(qPending, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Appointment));
      setPendingCount(docs.length);
      setPendingRequests(docs);
    });

    // Query: All appointments to calculate metrics
    const qAll = query(
      collection(db, 'appointments'),
      where('professionalId', '==', user.uid)
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

    return () => {
      unsubToday();
      unsubPending();
      unsubAll();
      unsubWaitlist();
      unsubBlocked();
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
    console.log(`[CONFIRM APPOINTMENT] initiating handleRespond for ${id} in Dashboard`);
    
    if (appointment) {
      console.log(`[CONFIRM PRECHECK]`, {
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
        if (!user?.uid) throw new Error("auth-error");
        await confirmAppointmentAtomic(id, user.uid);
        setConfirmedId(id);
        console.log(`[CONFIRM FLOW] SUCCESS: Booking ${id} confirmed.`);
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
      console.error(`[CONFIRM ERROR RAW]`, {
        message: error.message,
        appointmentId: id,
        stack: error.stack
      });
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

  return (
    <AppLayout activeRoute="dashboard">
      <div className="p-6 md:p-12 max-w-2xl mx-auto w-full space-y-10">
        
        {/* 1. HEADER LIMPO */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif text-brand-ink">
              Olá, {profile?.name?.split(' ')[0]} ✨
            </h1>
            <p className="text-[10px] text-brand-stone uppercase tracking-widest mt-1">Seu negócio de hoje.</p>
          </div>
          <button 
            onClick={() => setIsShareModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-linen text-brand-terracotta rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-brand-parchment transition-all"
          >
            <Share2 size={14} /> Link profissional
          </button>
        </header>

        {/* 2. RESUMO DO DIA (CARD PRINCIPAL) */}
        <section className="bg-brand-ink rounded-[40px] p-8 text-white shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-terracotta/20 rounded-full blur-3xl -mr-16 -mt-16" />
          
          <div className="relative z-10 space-y-6">
            <span className="text-[10px] font-bold text-brand-terracotta uppercase tracking-[0.3em] block">Hoje</span>
            
            <div className="space-y-2">
              <p className="text-2xl font-serif">{confirmedToday.length} agendamentos</p>
              <p className="text-2xl font-serif">{formatCurrency(dailyRevenue)} confirmados</p>
              <p className={cn("text-2xl font-serif", freeSlotsToday > 0 ? "text-white" : "text-white/40")}>
                {freeSlotsToday} {freeSlotsToday === 1 ? 'horário livre restante' : 'horários livres restantes'}
              </p>
            </div>

            <Link 
              to="/agenda" 
              className="w-full py-4 bg-brand-terracotta text-white rounded-full text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-brand-sienna transition-all shadow-lg mt-4"
            >
              Ver agenda
            </Link>
          </div>
        </section>

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

        {/* 4. PRÓXIMOS AGENDAMENTOS */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-[10px] font-bold text-brand-stone uppercase tracking-[0.3em]">Próximos horários</h2>
            <div className="h-px flex-1 bg-brand-mist" />
          </div>

          <div className="space-y-3">
            {confirmedToday.length > 0 ? (
              <>
                {confirmedToday.slice(0, 3).map((appt) => (
                  <div key={appt.id} className="bg-brand-white p-5 rounded-[28px] border border-brand-mist flex items-center justify-between group shadow-sm">
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-serif font-bold text-brand-ink">{appt.time}</span>
                      <span className="text-sm text-brand-stone">{appt.clientName}</span>
                    </div>
                    <Link to="/agenda" className="text-brand-mist group-hover:text-brand-terracotta transition-colors">
                      <ChevronRight size={18} />
                    </Link>
                  </div>
                ))}
                {confirmedToday.length > 3 && (
                  <Link to="/agenda" className="block text-center text-[10px] font-bold uppercase tracking-widest text-brand-terracotta mt-4">
                    Agenda completa ({confirmedToday.length})
                  </Link>
                )}
              </>
            ) : (
              <div className="text-center py-6">
                <p className="text-brand-stone text-xs italic mb-4">Nenhum agendamento hoje.</p>
                <button 
                  onClick={() => setIsShareModalOpen(true)}
                  className="px-6 py-3 bg-brand-linen text-brand-terracotta rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-brand-parchment transition-all border border-brand-mist"
                >
                  Divulgar meu link
                </button>
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
              <Clock size={18} className="text-brand-terracotta group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold text-brand-ink uppercase tracking-widest">Bloquear horário</span>
            </button>
            <Link to="/clients" className="p-5 bg-brand-white border border-brand-mist rounded-[32px] hover:bg-brand-linen transition-all group flex flex-col gap-2">
              <Users size={18} className="text-brand-terracotta group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold text-brand-ink uppercase tracking-widest">Novo cliente</span>
            </Link>
            <Link to="/services" className="p-5 bg-brand-white border border-brand-mist rounded-[32px] hover:bg-brand-linen transition-all group flex flex-col gap-2">
              <Plus size={18} className="text-brand-terracotta group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold text-brand-ink uppercase tracking-widest">Novo serviço</span>
            </Link>
            <a 
              href={buildWhatsappLink(profile?.whatsapp || '')} 
              target="_blank" 
              rel="noreferrer"
              className="p-5 bg-brand-white border border-brand-mist rounded-[32px] hover:bg-brand-linen transition-all group flex flex-col gap-2"
            >
              <MessageCircle size={18} className="text-brand-terracotta group-hover:scale-110 transition-transform" />
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
              <div className="grid grid-cols-1 gap-4 mb-10">
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

    </AppLayout>
  );
}

// Sub-component for Dashboard Block Flow (DEPRECATED - using unified modal above)
// removed DashboardBlockModal...
