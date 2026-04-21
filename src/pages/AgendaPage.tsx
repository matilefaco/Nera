import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../AuthContext';
import { db, updateAppointmentStatus, handleBookingError } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, addDoc, serverTimestamp, setDoc, deleteDoc, getDocs, getDoc } from 'firebase/firestore';
import { 
  Calendar, Clock, MessageCircle, 
  CheckCircle2, ChevronLeft, ChevronRight, Plus, MapPin,
  Users, List, Settings, Check, Sparkles, X, Lock, RefreshCw
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatCurrency, parseLocalDate, formatLocalDate, getTodayLocale, formatDateKey, buildWhatsappLink, cn, cleanWhatsapp } from '../lib/utils';
import { toast } from 'sonner';
import Logo from '../components/Logo';
import AppLayout from '../components/AppLayout';
import { AnimatePresence } from 'motion/react';

import BlockAvailabilityModal from '../components/BlockAvailabilityModal';

export default function AgendaPage() {
  const { user, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const dateFromUrl = searchParams.get('date');
  const appointmentIdFromUrl = searchParams.get('appointment');

  const [appointments, setAppointments] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(dateFromUrl || getTodayLocale());
  const [loading, setLoading] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(appointmentIdFromUrl);

  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [blockedSchedules, setBlockedSchedules] = useState<any[]>([]);

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
  const [manualClient, setManualClient] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualService, setManualService] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [manualDate, setManualDate] = useState(selectedDate);
  const [manualTime, setManualTime] = useState('');
  const [services, setServices] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);

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
      orderBy('time', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAppointments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const blockedRef = collection(db, 'blocked_schedules');
    const dayOfWeek = parseLocalDate(selectedDate).getDay();

    const unsubBlocked = onSnapshot(query(blockedRef, where('professionalId', '==', user.uid)), (snap) => {
      const allBlocked = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      // Filtrar para hoje (data fixa OU recorrente no dia certo)
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

  const changeDate = (days: number) => {
    const date = parseLocalDate(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(formatDateKey(date));
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
      await addDoc(collection(db, 'appointments'), {
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
        status: 'confirmed',
        notes: 'Agendamento criado manualmente',
        createdAt: new Date().toISOString()
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
      // 1. Update appointment status
      await updateAppointmentStatus(app.id, 'completed');

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

      toast.success('Experiência finalizada! Link de feedback pronto para envio.');
      
      // Copy link to clipboard for the professional to send
      const reviewLink = `${window.location.origin}/review/${token}`;
      try {
        await navigator.clipboard.writeText(reviewLink);
        toast.success('Link de avaliação copiado!', {
          description: 'Cole no WhatsApp da cliente.'
        });
      } catch {
        // Fallback para dispositivos sem Clipboard API
        toast.success('Avaliação registrada!', {
          description: `Link: ${reviewLink}`,
          duration: 8000
        });
      }

    } catch (err) {
      handleBookingError(err);
    } finally {
      setLoading(null);
    }
  };

  return (
    <AppLayout activeRoute="agenda">
      <main className="flex-1 p-6 md:p-12 max-w-2xl mx-auto w-full">
        <header className="mb-12 flex items-center justify-between">
          <h1 className="text-4xl font-serif font-normal text-brand-ink">Agenda</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setIsBlockModalOpen(true)}
              className="px-5 py-3 border border-brand-mist bg-brand-white text-brand-stone rounded-2xl text-[10px] font-medium uppercase tracking-widest hover:bg-brand-linen transition-all flex items-center gap-2"
              title="Bloquear horário"
            >
              <Lock size={16} /> Bloquear
            </button>
            <button
              onClick={() => { setManualDate(selectedDate); setIsManualModalOpen(true); }}
              className="w-14 h-14 bg-brand-ink text-brand-white rounded-2xl flex items-center justify-center shadow-xl hover:bg-brand-espresso transition-all"
              title="Novo agendamento manual"
            >
              <Plus size={24} />
            </button>
          </div>
        </header>

        {/* Date Selector */}
        <div className="bg-brand-white p-8 rounded-[40px] border border-brand-mist shadow-sm flex items-center justify-between mb-12">
          <button onClick={() => changeDate(-1)} className="p-3 hover:bg-brand-parchment rounded-2xl text-brand-mist hover:text-brand-ink transition-all border border-transparent hover:border-brand-mist">
            <ChevronLeft size={24} />
          </button>
          <div className="text-center">
            <p className="text-[10px] font-medium text-brand-terracotta uppercase tracking-[0.3em] mb-2">
              {formatLocalDate(selectedDate, { weekday: 'long' })}
            </p>
            <p className="text-2xl font-serif font-normal text-brand-ink">
              {formatLocalDate(selectedDate, { day: '2-digit', month: 'long' })}
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
                id={`appt-${app.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ 
                  opacity: 1, 
                  y: 0,
                  scale: highlightedId === app.id ? 1.02 : 1,
                }}
                className={cn(
                  "p-6 rounded-[32px] border flex items-center justify-between transition-all shadow-sm group",
                  highlightedId === app.id 
                    ? "bg-brand-linen border-brand-terracotta ring-4 ring-brand-terracotta/5 shadow-xl" 
                    : "bg-brand-white border-brand-mist hover:border-brand-stone"
                )}
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
                  <a 
                    href={buildWhatsappLink(app.clientWhatsapp)}
                    target="_blank"
                    className="p-4 hover:bg-brand-linen rounded-2xl text-brand-ink transition-all border border-transparent hover:border-brand-mist" 
                    title="Enviar WhatsApp"
                  >
                    <MessageCircle size={22} />
                  </a>
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
          ) : blockedSchedules.length === 0 ? (
            <div className="text-center py-24 bg-brand-white/50 rounded-[40px] border border-dashed border-brand-mist">
              <Calendar size={40} className="text-brand-mist mx-auto mb-6" />
              <p className="text-brand-stone font-serif italic text-lg font-light">Sua agenda está livre para este dia.</p>
            </div>
          ) : null}

          {blockedSchedules.map((schedule) => (
            <div key={schedule.id} className="bg-brand-linen/60 border border-brand-mist p-6 rounded-[32px] flex items-center justify-between group overflow-hidden relative">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-brand-stone/20 group-hover:bg-brand-terracotta transition-colors" />
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-[20px] bg-brand-white border border-brand-mist flex flex-col items-center justify-center">
                  <span className="text-[10px] font-bold text-brand-stone uppercase tracking-widest">{schedule.startTime}</span>
                  <div className="w-4 h-0.5 bg-brand-mist my-1" />
                  <span className="text-[10px] font-bold text-brand-stone uppercase tracking-widest">{schedule.endTime}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-serif text-lg text-brand-ink">Horário Bloqueado</p>
                    {schedule.isRecurring && (
                      <RefreshCw size={12} className="text-brand-terracotta animate-spin-slow" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-brand-stone uppercase tracking-widest font-medium opacity-60">
                      {schedule.reason || 'Indisponível'}
                    </span>
                    {schedule.customReason && (
                      <span className="text-[10px] text-brand-stone font-light italic">
                         • {schedule.customReason}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleUnblockSchedule(schedule.id)}
                className="w-10 h-10 flex items-center justify-center bg-brand-white text-brand-stone rounded-full hover:bg-brand-terracotta hover:text-brand-white transition-all border border-brand-mist shadow-sm"
                title="Remover bloqueio"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      </main>

      <BlockAvailabilityModal 
        open={isBlockModalOpen}
        onClose={() => setIsBlockModalOpen(false)}
        selectedDate={selectedDate}
        professionalId={user?.uid || ''}
        appointments={appointments}
        workingHours={profile?.workingHours || {}}
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone block mb-2">Data *</label>
                    <input
                      type="date"
                      value={manualDate}
                      onChange={(e) => setManualDate(e.target.value)}
                      className="w-full px-5 py-4 bg-brand-parchment border border-brand-mist rounded-2xl text-sm outline-none focus:border-brand-ink transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone block mb-2">Horário *</label>
                    <input
                      type="time"
                      value={manualTime}
                      onChange={(e) => setManualTime(e.target.value)}
                      className="w-full px-5 py-4 bg-brand-parchment border border-brand-mist rounded-2xl text-sm outline-none focus:border-brand-ink transition-all"
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

      </AppLayout>
  );
}
