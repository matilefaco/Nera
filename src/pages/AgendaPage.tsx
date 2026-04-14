import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { 
  Calendar, Clock, MessageCircle, 
  CheckCircle2, ChevronLeft, ChevronRight, Plus, MapPin
} from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import MobileNav from '../components/MobileNav';
import { toast } from 'sonner';

export default function AgendaPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

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

  return (
    <div className="min-h-screen bg-brand-cream pb-24 md:pb-0 md:flex">
      <main className="flex-1 p-6 md:p-12 max-w-2xl mx-auto w-full">
        <header className="mb-12 flex items-center justify-between">
          <h1 className="text-3xl font-serif font-medium text-brand-dark">Agenda</h1>
          <button className="w-14 h-14 bg-brand-dark text-white rounded-2xl flex items-center justify-center premium-shadow hover:bg-brand-dark/90 transition-all">
            <Plus size={24} />
          </button>
        </header>

        {/* Date Selector */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-brand-dark/5 premium-shadow flex items-center justify-between mb-12">
          <button onClick={() => changeDate(-1)} className="p-3 hover:bg-brand-cream rounded-2xl text-brand-dark/40 hover:text-brand-dark transition-all">
            <ChevronLeft size={24} />
          </button>
          <div className="text-center">
            <p className="text-[10px] font-bold text-brand-rose uppercase tracking-[0.3em] mb-2">
              {new Date(selectedDate).toLocaleDateString('pt-BR', { weekday: 'long' })}
            </p>
            <p className="text-2xl font-serif font-bold text-brand-dark">
              {new Date(selectedDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
            </p>
          </div>
          <button onClick={() => changeDate(1)} className="p-3 hover:bg-brand-cream rounded-2xl text-brand-dark/40 hover:text-brand-dark transition-all">
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
                className="bg-white p-6 rounded-[2.5rem] border border-brand-dark/5 flex items-center justify-between hover:border-brand-rose/20 transition-all premium-shadow group"
              >
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-brand-cream flex items-center justify-center text-brand-dark font-bold text-xl group-hover:bg-brand-rose-light group-hover:text-brand-rose transition-colors">
                    {app.time}
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-brand-dark mb-1">{app.clientName}</h4>
                    <div className="flex items-center gap-3">
                      <p className="text-[10px] text-brand-gray font-bold uppercase tracking-widest">{app.serviceName}</p>
                      {app.neighborhood && (
                        <div className="flex items-center gap-1 text-[9px] font-bold text-brand-rose uppercase tracking-widest">
                          <MapPin size={10} /> {app.neighborhood}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button className="p-3 hover:bg-green-50 rounded-2xl text-green-600 transition-all" title="Enviar WhatsApp">
                    <MessageCircle size={22} />
                  </button>
                  <button className="p-3 hover:bg-brand-rose-light rounded-2xl text-brand-rose transition-all" title="Concluir">
                    <CheckCircle2 size={22} />
                  </button>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-24 bg-white/50 rounded-[3rem] border-2 border-dashed border-brand-dark/5">
              <Calendar size={40} className="text-brand-dark/10 mx-auto mb-4" />
              <p className="text-brand-gray font-serif italic text-lg">Nenhum agendamento para este dia.</p>
            </div>
          )}
        </div>
      </main>

      <MobileNav />
    </div>
  );
}
