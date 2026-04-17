import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../AuthContext';
import { db, auth, updateAppointmentStatus, handleBookingError } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc } from 'firebase/firestore';
import { 
  Calendar, Clock, Users, LogOut, 
  Settings, List, MessageCircle, CheckCircle2, 
  Share2, Plus, MapPin, Check, TrendingUp,
  ChevronRight, Sparkles, Home
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { formatCurrency, getTodayLocale } from '../lib/utils';
import MobileNav from '../components/MobileNav';
import Logo from '../components/Logo';
import { Appointment } from '../types';
import { AnimatePresence } from 'motion/react';

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
  const [dailyTip, setDailyTip] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const tips = [
    "Dica: Peça para suas clientes avaliarem o serviço no Nera para subir no ranking!",
    "Lembrete: Atualize seu portfólio semanalmente com suas melhores fotos.",
    "Pro: Confirme a taxa de deslocamento logo após aprovar o agendamento.",
    "Dica: Personalize sua bio com seus principais diferenciais.",
    "Lembrete: Verifique seus materiais de biossegurança para os atendimentos de amanhã."
  ];

  useEffect(() => {
    setDailyTip(tips[Math.floor(Math.random() * tips.length)]);
  }, []);

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

    return () => {
      unsubToday();
      unsubPending();
      unsubNext();
    };
  }, [user]);

  const handleRespond = async (id: string, decision: 'confirmed' | 'cancelled') => {
    setProcessingId(id);
    try {
      await updateAppointmentStatus(id, decision);
      toast.success(decision === 'confirmed' ? 'Agendamento confirmado!' : 'Agendamento recusado.');
      
      // If closing details modal
      if (selectedRequest?.id === id) {
        setIsModalOpen(false);
      }
    } catch (error: any) {
      handleBookingError(error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleComplete = async (id: string) => {
    setProcessingId(id);
    try {
      await updateAppointmentStatus(id, 'completed'); 
      toast.success('Atendimento concluído e arquivado!');
    } catch (error) {
      handleBookingError(error);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-brand-parchment pb-24 md:pb-0 md:flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-72 bg-brand-white border-r border-brand-mist p-8 flex-col sticky top-0 h-screen">
        <div className="mb-12">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1">
          <Link to="/dashboard" className="flex items-center gap-3 px-4 py-3 bg-brand-linen text-brand-ink rounded-2xl text-[11px] font-medium uppercase tracking-widest transition-all">
            <TrendingUp size={18} className="text-brand-terracotta" /> Dashboard
          </Link>
          <Link to="/agenda" className="flex items-center gap-3 px-4 py-3 text-brand-stone hover:bg-brand-parchment rounded-2xl text-[11px] font-medium uppercase tracking-widest transition-all group">
            <Calendar size={18} className="group-hover:text-brand-terracotta transition-colors" /> Agenda
          </Link>
          <Link to="/clients" className="flex items-center gap-3 px-4 py-3 text-brand-stone hover:bg-brand-parchment rounded-2xl text-[11px] font-medium uppercase tracking-widest transition-all group">
            <Users size={18} className="group-hover:text-brand-terracotta transition-colors" /> Clientes
          </Link>
          <Link to="/services" className="flex items-center gap-3 px-4 py-3 text-brand-stone hover:bg-brand-parchment rounded-2xl text-[11px] font-medium uppercase tracking-widest transition-all group">
            <List size={18} className="group-hover:text-brand-terracotta transition-colors" /> Serviços
          </Link>
          <Link to="/profile" className="flex items-center gap-3 px-4 py-3 text-brand-stone hover:bg-brand-parchment rounded-2xl text-[11px] font-medium uppercase tracking-widest transition-all group">
            <Settings size={18} className="group-hover:text-brand-terracotta transition-colors" /> Perfil
          </Link>
        </nav>
        
        <div className="mt-auto pt-8 border-t border-brand-mist">
          <button 
            onClick={() => auth.signOut()}
            className="flex items-center gap-3 px-4 py-3 text-brand-stone hover:text-brand-terracotta transition-all text-[11px] font-medium uppercase tracking-widest w-full"
          >
            <LogOut size={18} /> Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-16 max-w-5xl mx-auto w-full">
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            <span className="text-[10px] font-medium text-brand-terracotta uppercase tracking-[0.3em] mb-4 block">Central de Trabalho</span>
            <h1 className="text-[42px] md:text-[56px] font-serif font-normal text-brand-ink leading-tight">
              Olá, {profile?.name?.split(' ')[0]}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                const url = `https://nera.app/p/${profile?.slug}`;
                navigator.clipboard.writeText(url);
                toast.success('Link da vitrine copiado!');
              }}
              className="flex items-center gap-3 px-6 py-4 bg-brand-white border border-brand-mist rounded-full text-[10px] font-medium uppercase tracking-widest hover:bg-brand-linen transition-all shadow-sm group"
            >
              <Share2 size={14} className="text-brand-terracotta group-hover:scale-110 transition-transform" />
              Minha Vitrine
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
              {pendingCount} Pendentes
            </span>
          </div>
          <div className="bg-brand-white border border-brand-mist px-5 py-3 rounded-2xl flex items-center gap-3 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-brand-stone">
              {confirmedToday.length} Confirmados hoje
            </span>
          </div>
          <div className="bg-brand-linen border border-brand-mist px-5 py-3 rounded-2xl flex items-center gap-3 shadow-sm">
            <TrendingUp size={14} className="text-brand-terracotta" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-brand-ink">
              {formatCurrency(dailyRevenue)} Total hoje
            </span>
          </div>
        </section>

        {/* 2. PENDING REQUESTS (PRIORITY 1) */}
        {pendingRequests.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center gap-4 mb-8">
              <h2 className="text-[10px] font-medium text-brand-stone uppercase tracking-[0.3em]">Novas Solicitações</h2>
              <div className="h-px flex-1 bg-brand-terracotta/20" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {pendingRequests.map((request) => (
                <motion.div 
                  key={request.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-brand-white p-6 rounded-[32px] border-2 border-brand-terracotta shadow-xl relative overflow-hidden group"
                >
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
                      className="flex-1 py-4 bg-brand-ink text-brand-white rounded-xl text-[10px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all shadow-lg text-center"
                    >
                      Confirmar
                    </button>
                    <button 
                      onClick={() => { setSelectedRequest(request); setIsModalOpen(true); }}
                      className="px-5 py-4 bg-brand-white text-brand-ink border border-brand-mist rounded-xl text-[10px] font-medium uppercase tracking-widest hover:bg-brand-linen transition-all"
                    >
                      Detalhes
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* LEFT COLUMN: NEXT & AGENDA */}
          <div className="lg:col-span-2 space-y-16">
            
            {/* 3. NEXT APPOINTMENT (PRIORITY 2) */}
            <section>
              <div className="flex items-center gap-4 mb-8">
                <h2 className="text-[10px] font-medium text-brand-stone uppercase tracking-[0.3em]">Próximo Atendimento</h2>
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
                          {nextAppointment.date === getTodayLocale() ? 'Hoje' : nextAppointment.date.split('-').reverse().slice(0, 2).join('/')}
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
                        href={`https://wa.me/${nextAppointment.clientWhatsapp.replace(/\D/g, '')}`}
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
                  <p className="text-brand-stone font-serif italic text-lg">Sem atendimentos confirmados para agora.</p>
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
                {confirmedToday.length > 0 ? (
                  confirmedToday.map((appt) => (
                    <div 
                      key={appt.id}
                      className="bg-brand-white p-6 rounded-[28px] border border-brand-mist flex items-center justify-between shadow-sm hover:shadow-md transition-all group"
                    >
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
                          className="w-10 h-10 flex items-center justify-center bg-brand-linen text-brand-stone rounded-full hover:bg-brand-ink hover:text-brand-white transition-all"
                        >
                          <Check size={18} />
                        </button>
                        <button 
                          onClick={() => { setSelectedRequest(appt); setIsModalOpen(true); }}
                          className="w-10 h-10 flex items-center justify-center bg-brand-linen text-brand-stone rounded-full hover:bg-brand-ink hover:text-brand-white transition-all"
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 bg-brand-parchment/50 border border-brand-mist border-dashed rounded-[32px] text-center">
                    <Sparkles className="mx-auto text-brand-mist mb-3" size={24} />
                    <p className="text-brand-stone text-xs uppercase tracking-widest">Nenhum atendimento confirmado hoje</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN: PERFORMANCE & ACTIONS */}
          <div className="space-y-8">
            {/* 5. REVENUE (PRIORITY 4) */}
            <section className="bg-brand-white p-8 rounded-[40px] border border-brand-mist shadow-sm">
              <h3 className="text-[10px] font-medium text-brand-stone uppercase tracking-[0.3em] mb-8">Performance Hoje</h3>
              
              <div className="mb-8">
                <p className="text-[10px] text-brand-stone uppercase tracking-widest mb-1">Receita Confirmada</p>
                <p className="text-4xl font-serif text-brand-ink">{formatCurrency(dailyRevenue)}</p>
              </div>

              <div className="space-y-4 pt-8 border-t border-brand-mist">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-brand-stone uppercase tracking-widest">Potencial Pendente</span>
                  <span className="text-sm font-medium text-brand-terracotta">+{formatCurrency(potentialRevenue)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-brand-stone uppercase tracking-widest">Atendimentos</span>
                  <span className="text-sm font-medium text-brand-ink">{confirmedToday.length}</span>
                </div>
              </div>

              <Link to="/clients" className="mt-8 flex items-center justify-between text-[10px] font-medium uppercase tracking-widest text-brand-terracotta hover:gap-2 transition-all">
                Ver Carteira de Clientes <ChevronRight size={14} />
              </Link>
            </section>

            {/* QUICK ACTIONS */}
            <section className="bg-brand-linen p-8 rounded-[40px] border border-brand-mist">
              <h3 className="text-[10px] font-medium text-brand-stone uppercase tracking-[0.3em] mb-6">Operacional</h3>
              <div className="grid grid-cols-1 gap-3">
                <button className="flex items-center gap-3 p-4 bg-brand-white rounded-2xl text-[10px] font-medium uppercase tracking-widest text-brand-ink hover:translate-x-1 transition-all">
                  <Calendar size={14} className="text-brand-terracotta" /> Bloquear Horário
                </button>
                <button className="flex items-center gap-3 p-4 bg-brand-white rounded-2xl text-[10px] font-medium uppercase tracking-widest text-brand-ink hover:translate-x-1 transition-all">
                  <MessageCircle size={14} className="text-brand-terracotta" /> Lembretes em Massa
                </button>
                <Link to="/services" className="flex items-center gap-3 p-4 bg-brand-white rounded-2xl text-[10px] font-medium uppercase tracking-widest text-brand-ink hover:translate-x-1 transition-all">
                  <Settings size={14} className="text-brand-terracotta" /> Configurar Serviços
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

      <MobileNav />

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
                        href={`https://wa.me/${selectedRequest.clientWhatsapp.replace(/\D/g, '')}`}
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
                    {processingId === selectedRequest.id ? 'Processando...' : 'Confirmar Agendamento'}
                  </button>
                  <button 
                    onClick={() => handleRespond(selectedRequest.id, 'cancelled')}
                    disabled={!!processingId}
                    className="flex-1 py-6 bg-brand-white border border-brand-mist text-brand-stone rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-linen transition-all disabled:opacity-50"
                  >
                    Recusar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
