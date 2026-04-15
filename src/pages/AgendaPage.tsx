import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { 
  Calendar, Clock, MessageCircle, 
  CheckCircle2, ChevronLeft, ChevronRight, Plus, MapPin,
  Users, List, Settings, Check, Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../lib/utils';
import { toast } from 'sonner';
import Logo from '../components/Logo';
import MobileNav from '../components/MobileNav';

export default function AgendaPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'appointments'),
      where('professionalId', '==', user.uid),
      where('date', '==', selectedDate),
      orderBy('time', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAppointments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
  }, [user, selectedDate]);

  const changeDate = (days: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const handleComplete = async (app: any) => {
    if (!user) return;
    setLoading(app.id);
    try {
      // 1. Update appointment status
      await updateDoc(doc(db, 'appointments', app.id), {
        status: 'completed'
      });

      // 2. Create review request
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

      toast.success('Atendimento concluído! Link de avaliação gerado.');
      
      // Copy link to clipboard for the professional to send
      const reviewLink = `${window.location.origin}/review/${token}`;
      await navigator.clipboard.writeText(reviewLink);
      toast.info('Link de avaliação copiado para a área de transferência.');

    } catch (err) {
      console.error('Error completing appointment:', err);
      toast.error('Erro ao concluir atendimento.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-brand-parchment pb-24 md:pb-0 md:flex">
      {/* Desktop Sidebar (Hidden on Mobile) */}
      <aside className="hidden md:flex w-64 bg-brand-white border-r border-brand-mist p-8 flex-col">
        <div className="mb-12">
          <Logo />
        </div>
        <nav className="flex-1 space-y-2">
          <Link to="/dashboard" className="flex items-center gap-3 px-4 py-3 text-brand-stone hover:bg-brand-parchment rounded-xl font-medium text-sm transition-all">
            <Calendar size={18} /> Dashboard
          </Link>
          <Link to="/agenda" className="flex items-center gap-3 px-4 py-3 bg-brand-linen text-brand-ink rounded-xl font-medium text-sm transition-all">
            <Calendar size={18} /> Agenda
          </Link>
          <Link to="/clients" className="flex items-center gap-3 px-4 py-3 text-brand-stone hover:bg-brand-parchment rounded-xl font-medium text-sm transition-all">
            <Users size={18} /> Clientes
          </Link>
          <Link to="/services" className="flex items-center gap-3 px-4 py-3 text-brand-stone hover:bg-brand-parchment rounded-xl font-medium text-sm transition-all">
            <List size={18} /> Serviços
          </Link>
          <Link to="/profile" className="flex items-center gap-3 px-4 py-3 text-brand-stone hover:bg-brand-parchment rounded-xl font-medium text-sm transition-all">
            <Settings size={18} /> Perfil
          </Link>
        </nav>
      </aside>

      <main className="flex-1 p-6 md:p-12 max-w-2xl mx-auto w-full">
        <header className="mb-12 flex items-center justify-between">
          <h1 className="text-4xl font-serif font-normal text-brand-ink">Agenda</h1>
          <button className="w-14 h-14 bg-brand-ink text-brand-white rounded-2xl flex items-center justify-center shadow-xl hover:bg-brand-espresso transition-all">
            <Plus size={24} />
          </button>
        </header>

        {/* Date Selector */}
        <div className="bg-brand-white p-8 rounded-[40px] border border-brand-mist shadow-sm flex items-center justify-between mb-12">
          <button onClick={() => changeDate(-1)} className="p-3 hover:bg-brand-parchment rounded-2xl text-brand-mist hover:text-brand-ink transition-all border border-transparent hover:border-brand-mist">
            <ChevronLeft size={24} />
          </button>
          <div className="text-center">
            <p className="text-[10px] font-medium text-brand-terracotta uppercase tracking-[0.3em] mb-2">
              {new Date(selectedDate).toLocaleDateString('pt-BR', { weekday: 'long' })}
            </p>
            <p className="text-2xl font-serif font-normal text-brand-ink">
              {new Date(selectedDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
            </p>
          </div>
          <button onClick={() => changeDate(1)} className="p-3 hover:bg-brand-parchment rounded-2xl text-brand-mist hover:text-brand-ink transition-all border border-transparent hover:border-brand-mist">
            <ChevronRight size={24} />
          </button>
        </div>

        {/* Appointments List */}
        <div className="space-y-4">
          {appointments.length > 0 ? (
            appointments.map((app) => (
              <motion.div 
                key={app.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-brand-white p-6 rounded-[32px] border border-brand-mist flex items-center justify-between hover:border-brand-stone transition-all shadow-sm group"
              >
                <div className="flex items-center gap-6">
                  <div className={cn(
                    "w-16 h-16 rounded-[20px] flex items-center justify-center font-medium text-lg border transition-colors",
                    app.status === 'completed' ? "bg-brand-linen border-brand-terracotta/20 text-brand-terracotta" : "bg-brand-parchment border-brand-mist text-brand-ink group-hover:bg-brand-linen"
                  )}>
                    {app.status === 'completed' ? <Check size={24} /> : app.time}
                  </div>
                  <div>
                    <h4 className="font-serif text-xl text-brand-ink mb-1">{app.clientName}</h4>
                    <div className="flex items-center gap-4">
                      <p className="text-[10px] text-brand-stone font-medium uppercase tracking-widest">{app.serviceName}</p>
                      {app.neighborhood && (
                        <div className="flex items-center gap-1.5 text-[9px] font-medium text-brand-terracotta uppercase tracking-widest">
                          <MapPin size={10} /> {app.neighborhood}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <button className="p-4 hover:bg-brand-linen rounded-2xl text-brand-ink transition-all border border-transparent hover:border-brand-mist" title="Enviar WhatsApp">
                    <MessageCircle size={22} />
                  </button>
                  {app.status !== 'completed' && (
                    <button 
                      onClick={() => handleComplete(app)}
                      disabled={loading === app.id}
                      className="p-4 hover:bg-brand-linen rounded-2xl text-brand-terracotta transition-all border border-transparent hover:border-brand-mist disabled:opacity-50" 
                      title="Concluir"
                    >
                      {loading === app.id ? (
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                          <Sparkles size={22} />
                        </motion.div>
                      ) : (
                        <CheckCircle2 size={22} />
                      )}
                    </button>
                  )}
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-24 bg-brand-white/50 rounded-[40px] border border-dashed border-brand-mist">
              <Calendar size={40} className="text-brand-mist mx-auto mb-6" />
              <p className="text-brand-stone font-serif italic text-lg font-light">Nenhum agendamento para este dia.</p>
            </div>
          )}
        </div>
      </main>

      <MobileNav />
    </div>
  );
}

const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');
