import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../AuthContext';
import { db, auth, updateAppointmentStatus, handleBookingError } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc } from 'firebase/firestore';
import { 
  Calendar, Clock, Users, LogOut, 
  Settings, List, MessageCircle, CheckCircle2, 
  Share2, Plus, MapPin, Check, TrendingUp, Heart,
  ChevronRight, Sparkles, Home, X, Instagram, Copy
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { formatCurrency, getTodayLocale, buildWhatsappLink, cn } from '../lib/utils';
import Logo from '../components/Logo';
import { Appointment } from '../types';
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
  const [inactiveClients, setInactiveClients] = useState<any[]>([]);
  const [recentCompletedClients, setRecentCompletedClients] = useState<any[]>([]);
  const [weekSummary, setWeekSummary] = useState<{date: string, count: number, revenue: number}[]>([]);

  const getContextualTip = () => {
    if (pendingCount > 0) return `Você tem ${pendingCount} reserva${pendingCount > 1 ? 's' : ''} aguardando confirmação.`;
    if (confirmedToday.length === 0) return 'Nenhum atendimento confirmado hoje. Que tal compartilhar sua vitrine?';
    if (inactiveClients.length > 0) return `${inactiveClients[0].name} não agenda há mais de 30 dias — hora de um recado?`;
    if (recentCompletedClients.length > 0) return `Envie o link de avaliação para ${recentCompletedClients[0].name}!`;
    return 'Atualize seu portfólio esta semana para atrair novas clientes.';
  };

  const dailyTip = getContextualTip();

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
      const today = getTodayLocale();
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
    });

    return () => {
      unsubToday();
      unsubPending();
      unsubNext();
      unsubAll();
    };
  }, [user]);

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
                  to="/agenda" 
                  className="bg-white text-brand-terracotta px-4 py-2 rounded-full text-[9px] font-bold uppercase tracking-widest hover:bg-brand-linen transition-all"
                >
                  Ver Todos
                </Link>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-3">
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

        {/* 1. OPERATIONAL SUMMARY BAR */}
        <section className="flex flex-wrap gap-4 mb-12">
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
                      <h3 className="text-xl font-serif text-brand-ink mb-1">{request.clientName}</h3>
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
                <h2 className="text-[10px] font-medium text-brand-stone uppercase tracking-[0.3em]">Próxima Experiência</h2>
                <div className="h-px flex-1 bg-brand-mist" />
              </div>
              
              {nextAppointment ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-brand-ink p-10 rounded-[40px] text-brand-white relative overflow-hidden shadow-2xl group"
                >
                  <div className="absolute top-0 right-0 w-64 h-64 bg-brand-terracotta/20 rounded-full -mr-32 -mt-32 blur-3xl" />
                  <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="flex items-center gap-8">
                      <div className="w-24 h-24 rounded-[32px] bg-brand-white/10 flex flex-col items-center justify-center border border-white/10 backdrop-blur-md">
                        <span className="text-[9px] uppercase tracking-[0.2em] text-brand-terracotta font-bold mb-1">
                          {nextAppointment.date === getTodayLocale() ? 'Agenda de Hoje' : nextAppointment.date.split('-').reverse().slice(0, 2).join('/')}
                        </span>
                        <span className="text-3xl font-serif">{nextAppointment.time}</span>
                      </div>
                      <div>
                        <h3 className="text-3xl font-serif mb-2">{nextAppointment.clientName}</h3>
                        <div className="flex flex-wrap items-center gap-4 opacity-70">
                          <span className="text-[10px] uppercase tracking-widest font-medium border border-white/20 px-2 py-0.5 rounded">{nextAppointment.serviceName}</span>
                          <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest leading-none">
                            <MapPin size={10} className="text-brand-terracotta"/> 
                            <span className="truncate max-w-[120px]">
                              {nextAppointment.locationType === 'home' ? (nextAppointment.neighborhood || 'Domicílio') : 'Estúdio'}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <a 
                        href={buildWhatsappLink(nextAppointment.clientWhatsapp)}
                        target="_blank"
                        className="p-4 bg-brand-white/10 rounded-2xl hover:bg-brand-white/20 transition-all border border-white/5"
                      >
                        <MessageCircle size={20} />
                      </a>
                      <button 
                        onClick={() => { setSelectedRequest(nextAppointment); setIsModalOpen(true); }}
                        className="px-8 py-4 bg-brand-terracotta text-brand-white rounded-2xl text-[10px] font-medium uppercase tracking-widest hover:bg-brand-sienna transition-all shadow-lg"
                      >
                        Ver Detalhes
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="bg-brand-white border border-brand-mist border-dashed p-12 rounded-[40px] text-center">
                  <p className="text-brand-stone font-serif italic text-lg">Sua agenda está leve hoje.</p>
                  <Link to="/agenda" className="text-[10px] font-medium uppercase tracking-widest text-brand-terracotta mt-4 inline-block hover:underline">Abrir Agenda Completa</Link>
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
                          <p className="font-medium text-brand-ink mb-1">{appt.clientName}</p>
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
    </AppLayout>
  );
}
