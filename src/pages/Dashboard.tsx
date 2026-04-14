import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../AuthContext';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { 
  Calendar, Clock, Users, ExternalLink, Copy, Check, LogOut, 
  Settings, List, TrendingUp, MessageCircle, CheckCircle2, 
  Share2, ChevronRight, Plus, MapPin
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { formatCurrency } from '../lib/utils';
import MobileNav from '../components/MobileNav';

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
      setPendingCount(docs.filter((a: any) => a.status === 'pending').length);
    });

    return () => unsubscribe();
  }, [user]);

  const handleComplete = async (id: string) => {
    try {
      await updateDoc(doc(db, 'appointments', id), { status: 'confirmed' });
      toast.success('Atendimento concluído!');
    } catch (error) {
      toast.error('Erro ao atualizar status');
    }
  };

  const sendWhatsAppReminder = (appointment: any) => {
    const message = `Olá ${appointment.clientName}! Confirmado nosso horário hoje às ${appointment.time} para ${appointment.serviceName}? Aguardo você! ✨`;
    const url = `https://wa.me/${appointment.clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-brand-cream pb-24 md:pb-0 md:flex">
      {/* Desktop Sidebar (Hidden on Mobile) */}
      <aside className="hidden md:flex w-64 bg-white border-r border-brand-rose/10 p-6 flex-col">
        <div className="flex items-center gap-2 mb-12">
          <div className="w-8 h-8 bg-brand-rose rounded-lg flex items-center justify-center text-white">
            <Calendar size={18} />
          </div>
          <span className="text-xl font-serif italic font-bold">Marca Aí</span>
        </div>
        <nav className="flex-1 space-y-2">
          <Link to="/dashboard" className="flex items-center gap-3 px-4 py-3 bg-brand-rose-light text-brand-rose rounded-xl font-bold text-sm">
            <Calendar size={18} /> Dashboard
          </Link>
          <Link to="/agenda" className="flex items-center gap-3 px-4 py-3 text-brand-gray hover:bg-brand-cream rounded-xl font-bold text-sm transition-all">
            <Calendar size={18} /> Agenda
          </Link>
          <Link to="/clients" className="flex items-center gap-3 px-4 py-3 text-brand-gray hover:bg-brand-cream rounded-xl font-bold text-sm transition-all">
            <Users size={18} /> Clientes
          </Link>
          <Link to="/services" className="flex items-center gap-3 px-4 py-3 text-brand-gray hover:bg-brand-cream rounded-xl font-bold text-sm transition-all">
            <List size={18} /> Serviços
          </Link>
          <Link to="/profile" className="flex items-center gap-3 px-4 py-3 text-brand-gray hover:bg-brand-cream rounded-xl font-bold text-sm transition-all">
            <Settings size={18} /> Perfil
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-12 max-w-2xl mx-auto w-full">
        <header className="mb-12">
          <h1 className="text-4xl font-serif font-medium text-brand-dark mb-3">
            Olá, {profile?.name?.split(' ')[0]}
          </h1>
          <p className="text-brand-gray text-sm font-light leading-relaxed">
            Hoje você tem <span className="text-brand-dark font-bold">{appointments.length} atendimentos</span> e <span className="text-brand-dark font-bold">{formatCurrency(dailyRevenue)}</span> confirmados para receber.
          </p>
        </header>

        {/* Quick Actions Grid */}
        <section className="grid grid-cols-2 gap-4 mb-12">
          <button className="bg-white p-6 rounded-[2rem] border border-brand-dark/5 premium-shadow flex flex-col items-center gap-3 group hover:border-brand-rose/30 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-brand-rose-light text-brand-rose flex items-center justify-center group-hover:scale-110 transition-transform">
              <MessageCircle size={24} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-dark">Lembretes</span>
          </button>
          <Link to="/agenda" className="bg-white p-6 rounded-[2rem] border border-brand-dark/5 premium-shadow flex flex-col items-center gap-3 group hover:border-brand-rose/30 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-brand-cream text-brand-dark flex items-center justify-center group-hover:scale-110 transition-transform">
              <Calendar size={24} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-dark">Ver Agenda</span>
          </Link>
          <button className="bg-white p-6 rounded-[2rem] border border-brand-dark/5 premium-shadow flex flex-col items-center gap-3 group hover:border-brand-rose/30 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-brand-cream text-brand-dark flex items-center justify-center group-hover:scale-110 transition-transform">
              <Clock size={24} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-dark">Bloquear</span>
          </button>
          <button className="bg-white p-6 rounded-[2rem] border border-brand-dark/5 premium-shadow flex flex-col items-center gap-3 group hover:border-brand-rose/30 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-brand-cream text-brand-dark flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus size={24} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-dark">Reagendar</span>
          </button>
        </section>

        {/* Dopamine Earnings Card */}
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-brand-dark p-10 rounded-[3rem] text-white mb-12 relative overflow-hidden premium-shadow"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-rose/10 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="relative z-10">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.3em] mb-4">Ganhos do Dia</p>
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-serif font-bold">{formatCurrency(dailyRevenue)}</span>
              {pendingCount > 0 && (
                <span className="text-xs text-brand-rose font-bold uppercase tracking-widest">+{pendingCount} pendentes</span>
              )}
            </div>
            {travelRevenue > 0 && (
              <div className="mt-6 pt-6 border-t border-white/5">
                <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">
                  Incluindo {formatCurrency(travelRevenue)} em atendimento na região
                </p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Today's List */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xs font-bold text-brand-dark uppercase tracking-[0.2em]">Sua Agenda de Hoje</h2>
            <Link to="/agenda" className="text-[10px] font-bold text-brand-rose uppercase tracking-widest editorial-underline">Ver Completa</Link>
          </div>

          <div className="space-y-4">
            {appointments.length > 0 ? (
              appointments.map((appointment) => (
                <motion.div 
                  key={appointment.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-5 rounded-[2rem] border border-brand-dark/5 flex items-center justify-between hover:border-brand-rose/20 transition-all premium-shadow group"
                >
                  <div className="flex items-center gap-5">
                    <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center transition-colors ${appointment.status === 'confirmed' ? 'bg-green-50 text-green-600' : 'bg-brand-cream text-brand-dark group-hover:bg-brand-rose-light group-hover:text-brand-rose'}`}>
                      <span className="text-sm font-bold">{appointment.time}</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-brand-dark leading-tight mb-1">{appointment.clientName}</h4>
                      <div className="flex items-center gap-3">
                        <p className="text-[10px] text-brand-gray font-bold uppercase tracking-widest">{appointment.serviceName}</p>
                        {appointment.neighborhood && (
                          <div className="flex items-center gap-1 text-[9px] font-bold text-brand-rose uppercase tracking-widest">
                            <MapPin size={10} /> {appointment.neighborhood}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {appointment.status === 'pending' ? (
                      <>
                        <button 
                          onClick={() => sendWhatsAppReminder(appointment)}
                          title="Lembrar via WhatsApp"
                          className="p-3 hover:bg-green-50 rounded-xl text-green-600 transition-all"
                        >
                          <MessageCircle size={20} />
                        </button>
                        <button 
                          onClick={() => handleComplete(appointment.id)}
                          title="Marcar como Concluído"
                          className="p-3 hover:bg-brand-rose-light rounded-xl text-brand-rose transition-all"
                        >
                          <CheckCircle2 size={20} />
                        </button>
                      </>
                    ) : (
                      <div className="w-10 h-10 bg-green-50 text-green-500 rounded-xl flex items-center justify-center">
                        <Check size={20} />
                      </div>
                    )}
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="bg-white/50 border-2 border-dashed border-brand-dark/5 rounded-[2.5rem] p-16 text-center">
                <p className="text-brand-gray font-serif italic text-lg">Nenhum atendimento para hoje.</p>
              </div>
            )}
          </div>
        </section>

        {/* Quick Actions Footer (Mobile only) */}
        <div className="mt-12 grid grid-cols-2 gap-4 md:hidden">
          <button className="bg-white p-4 rounded-2xl border border-brand-rose/10 font-bold text-xs flex items-center justify-center gap-2">
            <Plus size={16} /> Novo Agendamento
          </button>
          <button className="bg-white p-4 rounded-2xl border border-brand-rose/10 font-bold text-xs flex items-center justify-center gap-2">
            <Share2 size={16} /> Link da Agenda
          </button>
        </div>
      </main>

      <MobileNav />
    </div>
  );
}
