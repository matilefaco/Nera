import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../AuthContext';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc } from 'firebase/firestore';
import { 
  Calendar, Clock, Users, LogOut, 
  Settings, List, MessageCircle, CheckCircle2, 
  Share2, Plus, MapPin, Check, TrendingUp,
  ChevronRight, Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { formatCurrency } from '../lib/utils';
import MobileNav from '../components/MobileNav';
import Logo from '../components/Logo';

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [dailyRevenue, setDailyRevenue] = useState(0);
  const [travelRevenue, setTravelRevenue] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    const q = query(
      collection(db, 'appointments'),
      where('professionalId', '==', user.uid),
      where('date', '==', today),
      orderBy('time', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setAppointments(docs);
      
      const todayRev = docs
        .filter((a: any) => a.status !== 'cancelled')
        .reduce((acc: number, curr: any) => acc + (curr.price || 0) + (curr.travelFee || 0), 0);
      const travelRev = docs
        .filter((a: any) => a.status !== 'cancelled')
        .reduce((acc: number, curr: any) => acc + (curr.travelFee || 0), 0);
      setDailyRevenue(todayRev);
      setTravelRevenue(travelRev);
      setPendingCount(docs.filter((a: any) => a.status === 'pending_confirmation').length);
    });

    return () => unsubscribe();
  }, [user]);

  const handleComplete = async (id: string) => {
    try {
      await updateDoc(doc(db, 'appointments', id), { status: 'completed' });
      toast.success('Atendimento concluído!');
    } catch (error) {
      toast.error('Erro ao atualizar status');
    }
  };

  const sendWhatsAppReminder = (appointment: any) => {
    const message = `Olá ${appointment.clientName}! Confirmado nosso horário hoje às ${appointment.time} para ${appointment.serviceName}? Aguardo você! ✨`;
    const url = `https://wa.me/${appointment.clientWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
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
        <header className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            <span className="text-[10px] font-medium text-brand-terracotta uppercase tracking-[0.3em] mb-4 block">Bem-vinda de volta</span>
            <h1 className="text-[42px] md:text-[56px] font-serif font-normal text-brand-ink leading-tight">
              Olá, {profile?.name?.split(' ')[0]}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                const url = `${window.location.origin}/p/${profile?.slug}`;
                navigator.clipboard.writeText(url);
                toast.success('Link da vitrine copiado!');
              }}
              className="flex items-center gap-3 px-6 py-4 bg-brand-white border border-brand-mist rounded-full text-[10px] font-medium uppercase tracking-widest hover:bg-brand-linen transition-all shadow-sm group"
            >
              <Share2 size={14} className="text-brand-terracotta group-hover:scale-110 transition-transform" />
              Sua Vitrine
            </button>
            <Link 
              to="/agenda"
              className="flex items-center gap-3 px-6 py-4 bg-brand-ink text-brand-white rounded-full text-[10px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all shadow-lg"
            >
              <Plus size={14} />
              Novo Agendamento
            </Link>
          </div>
        </header>

        {/* Stats Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {/* Earnings Card */}
          <motion.div 
            initial={{ scale: 0.98, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="md:col-span-2 bg-brand-ink p-10 md:p-12 rounded-[40px] text-brand-white relative overflow-hidden shadow-2xl group"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-terracotta/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-brand-terracotta/20 transition-all duration-700" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <p className="text-[10px] font-medium text-brand-mist uppercase tracking-[0.3em]">Receita Estimada (Hoje)</p>
                <TrendingUp size={16} className="text-brand-terracotta" />
              </div>
              <div className="flex items-baseline gap-4 mb-8">
                <span className="text-5xl md:text-7xl font-serif font-normal">{formatCurrency(dailyRevenue)}</span>
                {pendingCount > 0 && (
                  <span className="text-[10px] text-brand-terracotta font-medium uppercase tracking-widest px-4 py-1.5 bg-brand-terracotta/10 rounded-full border border-brand-terracotta/20">
                    {pendingCount} Pendentes
                  </span>
                )}
              </div>
              <div className="pt-8 border-t border-brand-white/10 flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-terracotta" />
                  <p className="text-[10px] text-brand-mist font-light uppercase tracking-widest">
                    {appointments.length} Atendimentos confirmados
                  </p>
                </div>
                {travelRevenue > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-sienna" />
                    <p className="text-[10px] text-brand-mist font-light uppercase tracking-widest">
                      {formatCurrency(travelRevenue)} em taxas de deslocamento
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Quick Stats Card */}
          <div className="bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-[10px] font-medium text-brand-stone uppercase tracking-[0.3em] mb-8">Próximo Cliente</p>
              {appointments.find(a => a.status === 'pending_confirmation') ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-brand-linen flex items-center justify-center text-brand-ink font-serif text-lg">
                      {appointments.find(a => a.status === 'pending_confirmation')?.time}
                    </div>
                    <div>
                      <p className="font-medium text-brand-ink">{appointments.find(a => a.status === 'pending_confirmation')?.clientName}</p>
                      <p className="text-[10px] text-brand-stone uppercase tracking-widest">{appointments.find(a => a.status === 'pending_confirmation')?.serviceName}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-brand-stone italic font-serif text-lg">Nenhuma solicitação pendente</p>
              )}
            </div>
            <Link to="/agenda" className="mt-8 flex items-center justify-between text-[10px] font-medium uppercase tracking-widest text-brand-terracotta group">
              Ver agenda completa
              <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Today's List */}
          <section className="lg:col-span-2">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-[10px] font-medium text-brand-stone uppercase tracking-[0.3em]">Atendimentos de Hoje</h2>
              <div className="h-px flex-1 bg-brand-mist mx-6" />
            </div>

            <div className="space-y-4">
              {appointments.length > 0 ? (
                appointments.map((appointment) => (
                  <motion.div 
                    key={appointment.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-brand-white p-8 rounded-[32px] border border-brand-mist flex items-center justify-between hover:border-brand-stone transition-all shadow-sm group"
                  >
                    <div className="flex items-center gap-8">
                      <div className={`w-20 h-20 rounded-[24px] flex flex-col items-center justify-center transition-colors ${appointment.status === 'confirmed' ? 'bg-green-50 text-green-600' : 'bg-brand-parchment text-brand-ink group-hover:bg-brand-linen'}`}>
                        <span className="text-xl font-serif font-normal">{appointment.time}</span>
                      </div>
                      <div>
                        <h4 className="font-medium text-xl text-brand-ink mb-2">{appointment.clientName}</h4>
                        <div className="flex flex-wrap items-center gap-6">
                          <div className="flex items-center gap-2 text-[10px] text-brand-stone font-medium uppercase tracking-widest">
                            <Clock size={14} className="text-brand-terracotta" />
                            {appointment.serviceName}
                          </div>
                          {appointment.neighborhood && (
                            <div className="flex items-center gap-2 text-[10px] font-medium text-brand-stone uppercase tracking-widest">
                              <MapPin size={14} className="text-brand-terracotta" />
                              {appointment.neighborhood}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {appointment.status === 'pending_confirmation' ? (
                        <Link 
                          to={`/booking-request/${appointment.id}/respond`}
                          className="px-6 py-3 bg-brand-terracotta text-brand-white rounded-full text-[10px] font-medium uppercase tracking-widest hover:bg-brand-sienna transition-all shadow-md"
                        >
                          Responder
                        </Link>
                      ) : appointment.status === 'confirmed' ? (
                        <>
                          <button 
                            onClick={() => sendWhatsAppReminder(appointment)}
                            className="w-12 h-12 flex items-center justify-center bg-brand-linen text-brand-ink rounded-full hover:bg-green-50 hover:text-green-600 transition-all"
                            title="Enviar lembrete"
                          >
                            <MessageCircle size={20} />
                          </button>
                          <button 
                            onClick={() => handleComplete(appointment.id)}
                            className="w-12 h-12 flex items-center justify-center bg-brand-ink text-brand-white rounded-full hover:bg-brand-espresso transition-all shadow-md"
                            title="Concluir atendimento"
                          >
                            <Check size={20} />
                          </button>
                        </>
                      ) : (
                        <div className="w-12 h-12 bg-green-50 text-green-500 rounded-full flex items-center justify-center">
                          <CheckCircle2 size={24} />
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="bg-brand-white/50 border border-dashed border-brand-mist rounded-[40px] p-24 text-center">
                  <Sparkles size={32} className="text-brand-mist mx-auto mb-6" />
                  <p className="text-brand-stone font-serif italic text-xl font-light">Nenhum atendimento agendado para hoje.</p>
                </div>
              )}
            </div>
          </section>

          {/* Quick Actions Sidebar */}
          <section className="space-y-8">
            <div className="bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-sm">
              <h3 className="text-[10px] font-medium text-brand-stone uppercase tracking-[0.3em] mb-10">Ações Rápidas</h3>
              <div className="grid grid-cols-1 gap-4">
                <button className="flex items-center gap-4 p-5 bg-brand-parchment rounded-2xl hover:bg-brand-linen transition-all group">
                  <div className="w-10 h-10 rounded-xl bg-brand-white flex items-center justify-center text-brand-terracotta shadow-sm group-hover:scale-110 transition-transform">
                    <MessageCircle size={18} />
                  </div>
                  <span className="text-[11px] font-medium uppercase tracking-widest text-brand-ink">Lembretes em Massa</span>
                </button>
                <button className="flex items-center gap-4 p-5 bg-brand-parchment rounded-2xl hover:bg-brand-linen transition-all group">
                  <div className="w-10 h-10 rounded-xl bg-brand-white flex items-center justify-center text-brand-terracotta shadow-sm group-hover:scale-110 transition-transform">
                    <Clock size={18} />
                  </div>
                  <span className="text-[11px] font-medium uppercase tracking-widest text-brand-ink">Bloquear Horário</span>
                </button>
                <button className="flex items-center gap-4 p-5 bg-brand-parchment rounded-2xl hover:bg-brand-linen transition-all group">
                  <div className="w-10 h-10 rounded-xl bg-brand-white flex items-center justify-center text-brand-terracotta shadow-sm group-hover:scale-110 transition-transform">
                    <TrendingUp size={18} />
                  </div>
                  <span className="text-[11px] font-medium uppercase tracking-widest text-brand-ink">Relatório Mensal</span>
                </button>
              </div>
            </div>

            <div className="bg-brand-terracotta p-10 rounded-[40px] text-brand-white relative overflow-hidden">
              <div className="relative z-10">
                <h4 className="text-xl font-serif font-normal mb-4">Dica do dia</h4>
                <p className="text-brand-white/70 text-sm font-light leading-relaxed">
                  "Sua vitrine é sua marca pessoal. Mantenha seu portfólio sempre atualizado para atrair clientes premium."
                </p>
              </div>
              <Sparkles size={64} className="absolute -bottom-4 -right-4 text-brand-white/10 rotate-12" />
            </div>
          </section>
        </div>
      </main>

      <MobileNav />
    </div>
  );
}
