import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, Clock, MapPin, MessageCircle, 
  X, Check, AlertCircle, ChevronLeft, 
  RotateCcw, Trash2, Heart, Share2,
  CalendarCheck, Info, Link as LinkIcon, Copy,
  Sparkles, ChevronRight
} from 'lucide-react';
import { 
  db, 
  confirmPresenceByClient, 
  cancelBookingByClient, 
  rescheduleBookingByClient,
  getAppointmentByToken
} from '../firebase';
import { doc, getDoc, collection, query, where, onSnapshot, getDocs, limit } from 'firebase/firestore';
import { Appointment, UserProfile, Service } from '../types';
import PremiumButton from '../components/PremiumButton';
import { formatCurrency, formatLocalDate, buildWhatsappLink, cn } from '../lib/utils';
import { getAvailableSlots } from '../lib/bookingUtils';
import { toast } from 'sonner';

export default function ManageBookingPage() {
  const { id, token } = useParams<{ id?: string, token?: string }>();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [professional, setProfessional] = useState<UserProfile | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  const [view, setView] = useState<'main' | 'reschedule' | 'cancel'>('main');
  const [cancelReason, setCancelReason] = useState('');
  
  // Reschedule state
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [dayAppointments, setDayAppointments] = useState<Appointment[]>([]);
  const [blockedSchedules, setBlockedSchedules] = useState<any[]>([]);
  const [errorOccurred, setErrorOccurred] = useState(false);
  const [reviewToken, setReviewToken] = useState<string | null>(null);

  const [diagnosticResults, setDiagnosticResults] = useState<any>(null);
  
  useEffect(() => {
    if (!id && !token) return;

    const fetchBooking = async () => {
      const lookupKey = token || id;
      if (!lookupKey) return;

      console.log(`[BOOKING_MANAGEMENT] Fetching via API for: ${lookupKey}`);
      try {
        const response = await fetch(`/api/reservation/${lookupKey}`);
        
        if (!response.ok) {
          console.error('[BOOKING_MANAGEMENT] API fetch failed');
          setDiagnosticResults({
            token: lookupKey,
            apiStatus: response.status,
            apiStatusText: response.statusText,
            searchTime: new Date().toLocaleTimeString()
          });
          setErrorOccurred(true);
          setLoading(false);
          return;
        }

        const result = await response.json();
        
        if (!result.found || !result.appointment) {
          console.error('[BOOKING_MANAGEMENT] API returned found: false');
          setErrorOccurred(true);
          setLoading(false);
          return;
        }

        const apptData = result.appointment;
        setAppointment(apptData);

        // Professional data is already included in the API response
        if (apptData.professional) {
          setProfessional(apptData.professional);
          console.log(`[BOOKING_MANAGEMENT] Professional from API: ${apptData.professional.name}`);
        } else {
          // Fallback fetch if professional not in API for some reason
          const proSnap = await getDoc(doc(db, 'users', apptData.professionalId));
          if (proSnap.exists()) {
            setProfessional(proSnap.data() as UserProfile);
          }
        }

        // Fetch review token if completed
        if (apptData.status === 'completed') {
          const q = query(collection(db, 'review_requests'), where('bookingId', '==', apptData.id));
          const snap = await getDocs(q);
          if (!snap.empty) {
            setReviewToken(snap.docs[0].data().token);
          }
        }

        setLoading(false);
      } catch (error) {
        console.error('[BOOKING_MANAGEMENT] API fetch error:', error);
        setErrorOccurred(true);
        setLoading(false);
      }
    };

    fetchBooking();
  }, [id, token]);

  // Subscription for slots validation during reschedule
  useEffect(() => {
    if (view !== 'reschedule' || !professional || !selectedDate) return;

    const qAppts = query(
      collection(db, 'appointments'),
      where('professionalId', '==', professional.uid),
      where('date', '==', selectedDate),
      where('status', 'in', ['pending', 'confirmed'])
    );

    const unsubAppts = onSnapshot(qAppts, (snap) => {
      setDayAppointments(snap.docs.map(d => d.data() as Appointment));
    });

    const blockedRef = collection(db, 'blocked_schedules');
    const dayOfWeek = selectedDate ? new Date(selectedDate + 'T12:00:00').getDay() : null;

    const unsubBlocked = onSnapshot(query(blockedRef, where('professionalId', '==', professional.uid)), (snap) => {
      const allBlocked = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      const dayBlocked = allBlocked.filter(b => {
        const isToday = b.date === selectedDate;
        const isRecurringToday = dayOfWeek !== null && b.isRecurring && b.recurringDays?.includes(dayOfWeek);
        return isToday || isRecurringToday;
      });
      setBlockedSchedules(dayBlocked);
    });

    return () => {
      unsubAppts();
      unsubBlocked();
    };
  }, [view, professional, selectedDate]);

  const availableSlots = useMemo(() => {
    if (!professional?.workingHours || !selectedDate || !appointment) return [];
    return getAvailableSlots({
      selectedDate,
      serviceDuration: appointment.duration || 60,
      workingHours: professional.workingHours,
      appointments: dayAppointments,
      blockedSchedules
    });
  }, [selectedDate, appointment, professional, dayAppointments, blockedSchedules]);

  const handleConfirmPresence = async () => {
    if (!appointment?.id) return;
    setActionLoading(true);
    try {
      await confirmPresenceByClient(appointment.id);
      toast.success('Presença confirmada! Nos vemos em breve. 💛');
    } catch (e) {
      toast.error('Erro ao confirmar presença');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (reason: string) => {
    if (!appointment?.id) return;
    setActionLoading(true);
    try {
      await cancelBookingByClient(appointment.id, reason);
      toast.success('Reserva cancelada.');
      setView('main');
    } catch (e) {
      toast.error('Erro ao cancelar');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!appointment?.id || !selectedDate || !selectedTime) return;
    setActionLoading(true);
    try {
      await rescheduleBookingByClient(appointment.id, selectedDate, selectedTime);
      toast.success('Horário alterado com sucesso!');
      setView('main');
    } catch (e: any) {
      if (e.message === 'Horário indisponível') {
        toast.error('Este horário acabou de ser preenchido. Escolha outro.');
      } else {
        toast.error('Erro ao remarcar');
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-brand-linen flex flex-col items-center justify-center p-8 space-y-4">
        <div className="w-12 h-12 border-t-2 border-brand-terracotta rounded-full animate-spin" />
        <p className="text-[10px] font-bold text-brand-stone uppercase tracking-widest">Carregando detalhes...</p>
      </div>
    );
  }

  if (!appointment || !professional) {
    return (
      <div className="min-h-[100dvh] bg-brand-linen flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 bg-brand-white rounded-3xl flex items-center justify-center text-brand-stone mb-6">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-2xl font-serif text-brand-ink mb-2">Ops! Reserva não encontrada</h2>
        <p className="text-sm text-brand-stone font-light italic mb-8">O link pode ter expirado ou a reserva foi removida.</p>
        
        {diagnosticResults && (
          <div className="w-full max-w-md bg-brand-linen/60 border border-brand-mist/50 p-6 rounded-[32px] mb-8 text-left space-y-4 overflow-hidden shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-stone border-b border-brand-mist pb-2">Diagnostic Data (Admin/Dev)</p>
            <p className="text-[9px] font-mono text-brand-stone break-all">Slug tried: <span className="text-brand-terracotta">{diagnosticResults.token}</span></p>
            <p className="text-[9px] font-mono text-brand-stone">API Status: <span className="text-brand-terracotta">{diagnosticResults.apiStatus} ({diagnosticResults.apiStatusText})</span></p>
            
            <p className="text-[9px] text-brand-stone/60 italic pt-2 leading-relaxed">
              * O link foi consultado via backend /api/reservation/:slug. Se retornou 404, o manageSlug não está indexado ou o documento na coleção 'reservation_links' ainda não foi criado.
            </p>
          </div>
        )}

        <button onClick={() => navigate('/')} className="px-8 py-4 bg-brand-ink text-brand-white rounded-full text-[10px] font-bold uppercase tracking-widest">Ir para o Início</button>
      </div>
    );
  }

  const isCancelled = ['cancelled', 'cancelled_by_professional', 'cancelled_by_client', 'expired', 'rejected'].includes(appointment.status);
  const isCompleted = appointment.status === 'completed';
  const isPending = appointment.status === 'pending';
  const isConfirmed = appointment.status === 'confirmed' || appointment.status === 'accepted';
  const isPast = new Date(appointment.date) < new Date(new Date().toISOString().split('T')[0]);

  const handleCalendarAdd = () => {
    if (!appointment || !professional) return;
    const [year, month, day] = appointment.date.split('-').map(Number);
    const [hours, minutes] = appointment.time.split(':').map(Number);
    const start = new Date(year, month - 1, day, hours, minutes);
    const end = new Date(start.getTime() + (Number(appointment.duration) || 60) * 60000); 
    const formatTemplate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'; 
    const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('Reserva Nera: ' + appointment.serviceName)}&dates=${formatTemplate(start)}/${formatTemplate(end)}&details=${encodeURIComponent('Agendamento realizado via Nera.')}&location=${encodeURIComponent(professional.city || '')}`; 
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-[100dvh] bg-brand-linen selection:bg-brand-rose/20 selection:text-brand-rose pb-20">
      {/* Header */}
      <header className="bg-brand-white p-6 border-b border-brand-mist sticky top-0 z-50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-brand-linen overflow-hidden border border-brand-mist shadow-sm">
             {professional.avatar ? (
               <img src={professional.avatar} alt={professional.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
             ) : (
               <div className="w-full h-full flex items-center justify-center text-brand-stone uppercase font-bold text-xs">{professional.name[0]}</div>
             )}
          </div>
          <div>
            <h1 className="text-sm font-serif text-brand-ink leading-tight">{professional.name}</h1>
            <p className="text-[8px] text-brand-terracotta uppercase tracking-widest font-bold">Gestão de Reserva</p>
          </div>
        </div>
        <button onClick={() => navigate(`/p/${professional.slug}`)} className="text-brand-stone hover:text-brand-ink transition-colors">
          <X size={20} />
        </button>
      </header>

      <main className="p-6 max-w-lg mx-auto space-y-6">
        <AnimatePresence mode="wait">
          {view === 'main' && (
            <motion.div 
              key="main"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Status Banner */}
              <div className={cn(
                "p-8 rounded-[40px] flex flex-col items-center text-center shadow-xl border relative overflow-hidden",
                isCancelled ? "bg-red-50 border-red-100" : 
                isCompleted ? "bg-brand-white border-brand-terracotta/20" :
                isConfirmed ? "bg-green-50 border-green-100" :
                "bg-brand-white border-brand-mist"
              )}>
                {/* Background Sparkle for success */}
                {isConfirmed && <div className="absolute inset-0 bg-gradient-to-br from-green-100/50 to-transparent pointer-events-none" />}
                
                <div className={cn(
                  "w-20 h-20 rounded-3xl flex items-center justify-center mb-6 relative z-10",
                  isCancelled ? "bg-red-100 text-red-600" : 
                  isCompleted ? "bg-brand-linen text-brand-terracotta" :
                  isConfirmed ? "bg-green-100 text-green-600 shadow-lg shadow-green-200/50" :
                  "bg-brand-linen text-brand-stone"
                )}>
                  {isCancelled ? <X size={40} /> : isCompleted ? <Sparkles size={40} /> : isConfirmed ? <Check size={40} /> : <Clock size={40} className="animate-pulse" />}
                </div>

                <div className="relative z-10">
                  <h3 className={cn(
                    "text-2xl font-serif mb-2",
                    isCancelled ? "text-red-700" : isCompleted ? "text-brand-terracotta" : isConfirmed ? "text-green-700" : "text-brand-ink"
                  )}>
                    {isCancelled ? 'Reserva não ativa' : 
                     isCompleted ? 'Atendimento concluído' :
                     isConfirmed ? 'Reserva confirmada' : 'Pedido recebido'}
                  </h3>
                  {isPending && (
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-stone/60 mb-2">
                      Aguardando confirmação
                    </p>
                  )}
                  {appointment.reservationCode && (
                    <div className="inline-flex items-center gap-2 bg-brand-linen/60 px-3 py-1 rounded-full border border-brand-mist/30">
                      <span className="text-[8px] text-brand-stone uppercase tracking-widest font-bold">Reserva:</span>
                      <span className="text-[9px] font-mono font-bold text-brand-terracotta">{appointment.reservationCode}</span>
                    </div>
                  )}
                </div>

                {isPending && (
                  <div className="space-y-4 w-full">
                    <div className="p-6 bg-brand-linen/40 rounded-3xl border border-brand-mist/50">
                      <p className="text-sm text-brand-ink font-serif mb-2">Pedido recebido</p>
                      <p className="text-xs text-brand-stone font-light leading-relaxed italic">
                        A profissional ainda vai confirmar seu horário. Você receberá um aviso quando houver resposta.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-3">
                      <a 
                        href={buildWhatsappLink(professional.whatsapp, `Olá ${professional.name.split(' ')[0]}! Acabei de fazer um pedido de reserva no valor de ${formatCurrency(appointment.totalPrice || appointment.price)} para o dia ${appointment.date.split('-').reverse().join('/')} às ${appointment.time}. Código: ${appointment.reservationCode || '-'}. Pode me confirmar se está tudo ok?`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-5 bg-brand-linen text-brand-ink border border-brand-mist rounded-full text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-brand-mist transition-all flex items-center justify-center gap-2"
                      >
                        <MessageCircle size={18} /> Falar com a profissional
                      </a>
                      
                      <button 
                        onClick={() => setView('cancel')}
                        className="w-full py-5 bg-brand-white text-brand-stone border border-brand-mist rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm hover:text-red-600 hover:border-red-600 transition-all flex items-center justify-center gap-2"
                      >
                        <Trash2 size={16} /> Cancelar Pedido
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Hierarchy - Primary Actions based on State */}
              <div className="grid grid-cols-1 gap-4">
                {/* 1. UPCOMING ACTIONS (Not completed, not cancelled) */}
                {!isCompleted && !isCancelled && !isPast && (
                  <>
                    {/* Add to Calendar (Priority secondary for confirmed) */}
                    {isConfirmed && (
                      <button 
                        onClick={handleCalendarAdd}
                        className="w-full py-5 bg-brand-white text-brand-ink border border-brand-mist rounded-[28px] text-[10px] font-bold uppercase tracking-[0.2em] shadow-sm hover:border-brand-ink transition-all flex items-center justify-center gap-2 group"
                      >
                        <Calendar size={18} className="text-brand-terracotta group-hover:scale-110 transition-transform" /> Adicionar ao Calendário
                      </button>
                    )}

                    {/* Presence Confirmation (Featured if applicable) */}
                    {isConfirmed && !appointment.clientConfirmedAt && (
                      <button 
                        onClick={handleConfirmPresence}
                        disabled={actionLoading}
                        className="w-full py-6 bg-brand-ink text-brand-white rounded-full text-[11px] font-extrabold uppercase tracking-[0.25em] shadow-2xl hover:bg-brand-espresso transition-all flex items-center justify-center gap-3 active:scale-95"
                      >
                        {actionLoading ? 'Processando...' : <><CalendarCheck size={20} /> Confirmar Minha Presença</>}
                      </button>
                    )}

                    {/* Manage Actions */}
                    {!isPending && (
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <button 
                          onClick={() => setView('reschedule')}
                          className="py-4 bg-brand-white text-brand-ink border border-brand-mist rounded-full text-[9px] font-bold uppercase tracking-widest shadow-sm hover:border-brand-ink transition-all flex items-center justify-center gap-2"
                        >
                          <Clock size={14} /> Remarcar
                        </button>
                        <button 
                          onClick={() => setView('cancel')}
                          className="py-4 bg-brand-white text-brand-stone border border-brand-mist rounded-full text-[9px] font-bold uppercase tracking-widest shadow-sm hover:text-red-600 hover:border-red-600 transition-all flex items-center justify-center gap-2"
                        >
                          <Trash2 size={14} /> Cancelar Reserva
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* 2. COMPLETED ACTIONS */}
                {isCompleted && (
                  <div className="space-y-4">
                    {reviewToken && (
                      <button 
                        onClick={() => navigate(`/review/${reviewToken}`)}
                        className="w-full py-7 bg-brand-ink text-brand-white rounded-full text-[11px] font-extrabold uppercase tracking-[0.25em] shadow-2xl hover:bg-brand-espresso transition-all flex items-center justify-center gap-3 animate-bounce-slow"
                      >
                        <Sparkles size={24} className="fill-brand-terracotta text-brand-terracotta" /> Avaliar Atendimento 💛
                      </button>
                    )}
                    
                    <PremiumButton 
                      variant="linen"
                      className="w-full py-6"
                      onClick={() => navigate(`/p/${professional.slug}`)}
                    >
                      Agendar Novamente <ChevronRight size={18} />
                    </PremiumButton>
                  </div>
                )}

                {/* 3. CANCELLED / EXPIRED STATE */}
                {(isCancelled || (isPast && !isCompleted)) && (
                   <div className="space-y-6">
                      <div className="bg-amber-50 border border-amber-100 rounded-[40px] p-10 text-center">
                        <RotateCcw size={40} className="mx-auto text-amber-500 mb-6 opacity-40" />
                        <h4 className="text-xl font-serif text-amber-900 mb-2">Essa reserva não está mais ativa</h4>
                        <p className="text-[10px] text-amber-700 uppercase tracking-widest font-bold">O horário foi liberado ou expirou</p>
                      </div>
                      
                      <PremiumButton 
                        variant="terracotta"
                        className="w-full py-7 !text-[11px] !tracking-[0.2em]"
                        onClick={() => navigate(`/p/${professional.slug}`)}
                      >
                        Fazer nova reserva <CalendarCheck size={20} />
                      </PremiumButton>
                   </div>
                )}

                {/* ALWAYS VISIBLE UNTIL CANCELLED: Talk to Pro (Only for confirmed/completed) */}
                {!isCancelled && !isPending && (
                  <a 
                    href={buildWhatsappLink(professional.whatsapp, `Olá ${professional.name.split(' ')[0]}! Gostaria de falar sobre minha reserva do dia ${appointment.date.split('-').reverse().join('/')} às ${appointment.time}.`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-5 bg-brand-linen text-brand-ink border border-brand-mist rounded-full text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-brand-mist transition-all flex items-center justify-center gap-2 mt-4"
                  >
                    <MessageCircle size={18} /> Falar com a profissional
                  </a>
                )}
              </div>

              {/* Reservation Summary Card */}
              <div className="bg-brand-white rounded-[40px] p-10 shadow-2xl border border-brand-mist overflow-hidden relative">
                <div className="flex flex-col mb-8 relative z-10">
                  <span className="text-[10px] text-brand-terracotta uppercase tracking-[0.3em] font-bold mb-2">Detalhes do Agendamento</span>
                  <h4 className="text-3xl font-serif text-brand-ink">{appointment.serviceName}</h4>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-brand-linen/30 rounded-3xl p-5 border border-brand-mist/30 flex items-center gap-4">
                    <Calendar size={18} className="text-brand-terracotta opacity-60" />
                    <div>
                      <span className="text-[9px] text-brand-stone uppercase tracking-widest block font-bold mb-0.5">Data</span>
                      <span className="text-sm font-bold text-brand-ink">{appointment.date.split('-').reverse().join('/')}</span>
                    </div>
                  </div>
                  <div className="bg-brand-linen/30 rounded-3xl p-5 border border-brand-mist/30 flex items-center gap-4">
                    <Clock size={18} className="text-brand-terracotta opacity-60" />
                    <div>
                      <span className="text-[9px] text-brand-stone uppercase tracking-widest block font-bold mb-0.5">Horário</span>
                      <span className="text-sm font-bold text-brand-ink">{appointment.time}</span>
                    </div>
                  </div>
                </div>

                {appointment.locationType === 'home' && appointment.address && (
                  <div className="bg-brand-linen/30 rounded-3xl p-6 mb-8 flex items-start gap-4 border border-brand-mist/30">
                    <MapPin size={20} className="text-brand-terracotta shrink-0 mt-1" />
                    <div>
                      <span className="text-[9px] text-brand-stone uppercase tracking-widest font-bold block mb-1">Endereço do Atendimento</span>
                      <p className="text-xs text-brand-ink leading-relaxed font-medium">
                        {typeof appointment.address === 'object' 
                          ? `${appointment.address.street}, ${appointment.address.number}${appointment.address.complement ? ` - ${appointment.address.complement}` : ''}`
                          : appointment.address}
                        {(typeof appointment.address === 'object' ? appointment.address.neighborhood : appointment.neighborhood) && (
                          <span className="block mt-1 opacity-50 text-[10px]">
                            {typeof appointment.address === 'object' ? appointment.address.neighborhood : appointment.neighborhood}
                            {typeof appointment.address === 'object' && appointment.address.city && `, ${appointment.address.city}`}
                          </span>
                        )}
                        {typeof appointment.address === 'object' && appointment.address.reference && (
                          <span className="block mt-2 text-[10px] text-brand-stone italic font-normal">
                             Ref: {appointment.address.reference}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {appointment.locationType === 'studio' && professional.studioAddress && (
                  <div className="bg-brand-linen/30 rounded-[32px] p-6 mb-8 border border-brand-mist/30 space-y-6">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-brand-white rounded-2xl flex items-center justify-center text-brand-terracotta shadow-sm shrink-0">
                        <MapPin size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[9px] text-brand-stone uppercase tracking-widest font-bold block mb-1">Local do Atendimento (Estúdio)</span>
                        <p className="text-xs text-brand-ink leading-relaxed font-medium">
                          {professional.studioAddress.street}, {professional.studioAddress.number}
                          {professional.studioAddress.complement && ` - ${professional.studioAddress.complement}`}
                          <span className="block opacity-60 text-[10px] mt-0.5">
                            {professional.studioAddress.neighborhood}, {professional.studioAddress.city}
                          </span>
                        </p>
                        
                        {professional.studioAddress.reference && (
                          <div className="mt-2 text-[10px] text-brand-stone italic flex items-center gap-1.5">
                            <Info size={12} className="text-brand-terracotta/40" />
                            Ref: {professional.studioAddress.reference}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button 
                        onClick={() => {
                          if (professional.studioAddress?.googleMapsLink) {
                            window.open(professional.studioAddress.googleMapsLink, '_blank');
                          } else {
                            const addr = `${professional.studioAddress?.street}, ${professional.studioAddress?.number}, ${professional.studioAddress?.neighborhood}, ${professional.studioAddress?.city}`;
                            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`, '_blank');
                          }
                        }}
                        className="flex items-center justify-center gap-2 py-3.5 bg-brand-white border border-brand-mist rounded-xl text-[10px] font-bold uppercase tracking-widest text-brand-ink hover:border-brand-ink transition-all shadow-sm"
                      >
                        <MapPin size={14} className="text-brand-terracotta" /> Abrir no Maps
                      </button>
                      <button 
                        onClick={() => {
                          const addr = `${professional.studioAddress?.street}, ${professional.studioAddress?.number}, ${professional.studioAddress?.complement ? `${professional.studioAddress.complement}, ` : ''}${professional.studioAddress?.neighborhood}, ${professional.studioAddress?.city}`;
                          navigator.clipboard.writeText(addr);
                          toast.success('Endereço copiado!');
                        }}
                        className="flex items-center justify-center gap-2 py-3.5 bg-brand-white border border-brand-mist rounded-xl text-[10px] font-bold uppercase tracking-widest text-brand-ink hover:border-brand-ink transition-all shadow-sm"
                      >
                        <Copy size={14} className="text-brand-stone" /> Copiar Endereço
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="border-t border-brand-mist pt-6 flex justify-between items-center">
                  <span className="text-[10px] text-brand-stone uppercase tracking-[0.2em] font-bold">Valor Total</span>
                  <span className="text-2xl font-serif text-brand-terracotta">{formatCurrency(appointment.totalPrice || appointment.price)}</span>
                </div>

                {appointment.rescheduledAt && (
                  <div className="mt-6 p-4 bg-amber-50 rounded-2xl flex items-center gap-3 border border-amber-100">
                    <RotateCcw size={16} className="text-amber-600" />
                    <p className="text-[10px] text-amber-700 leading-tight">
                      Esta reserva foi reagendada. O horário anterior era {appointment.previousDate?.split('-').reverse().join('/')} às {appointment.previousTime}.
                    </p>
                  </div>
                )}
              </div>

              {/* Secondary Actions Section */}
              <div className="space-y-6 pt-4">
                {/* Permanent Link Section (Secondary) */}
                <div className="bg-brand-white rounded-[32px] p-6 border border-brand-mist/60 shadow-sm opacity-80 hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-2 mb-3">
                    <LinkIcon size={14} className="text-brand-stone" />
                    <p className="text-[9px] font-bold text-brand-stone uppercase tracking-widest">Link de Acesso Permanente</p>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-brand-linen rounded-xl border border-brand-mist/30">
                    <div className="flex-1 truncate text-[9px] text-brand-stone font-mono">
                      {window.location.origin}/r/{appointment.token}
                    </div>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/r/${appointment.token}`);
                        toast.success('Link copiado!');
                      }}
                      className="p-2 hover:bg-brand-white rounded-lg text-brand-stone transition-colors"
                    >
                      <Copy size={12} />
                    </button>
                   </div>
                </div>

                {/* Indication Section (Tertiary or Post-Service) */}
                <div className={cn(
                  "border border-brand-mist border-dashed rounded-[40px] p-10 text-center transition-all",
                  isCompleted ? "bg-brand-white shadow-xl scale-100" : "bg-brand-white/40 scale-95 opacity-60"
                )}>
                  <div className="w-14 h-14 bg-brand-white rounded-2xl flex items-center justify-center mx-auto mb-6 text-brand-terracotta shadow-sm">
                    <Heart size={28} className="fill-brand-terracotta/10" />
                  </div>
                  <h4 className="text-xl font-serif text-brand-ink mb-2">
                    {isCompleted ? 'Gostou do atendimento?' : 'Indique o Nera'}
                  </h4>
                  <p className="text-[9px] text-brand-stone uppercase tracking-widest mb-8 leading-relaxed">
                    {isCompleted 
                      ? 'Ajude a profissional a crescer compartilhando com suas amigas!' 
                      : 'Descobriu a praticidade de agendar online? Compartilhe com alguém.'}
                  </p>
                  <button 
                    onClick={() => {
                      const url = window.location.origin + '/p/' + professional.slug;
                      const text = `Te recomendo a ${professional.name} ✨`;
                      if (navigator.share) {
                        navigator.share({ title: professional.name, text, url });
                      } else {
                        navigator.clipboard.writeText(`${text} : ${url}`);
                        toast.success('Link copiado!');
                      }
                    }}
                    className={cn(
                      "w-full py-4 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all",
                      isCompleted ? "bg-brand-ink text-brand-white hover:bg-brand-espresso" : "bg-brand-linen text-brand-ink hover:border-brand-stone border border-brand-mist"
                    )}
                  >
                    Compartilhar Perfil
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'reschedule' && (
            <motion.div 
              key="reschedule"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <button 
                onClick={() => setView('main')}
                className="flex items-center gap-2 text-brand-stone hover:text-brand-ink transition-colors pb-2"
              >
                <ChevronLeft size={16} /> <span className="text-[10px] font-bold uppercase tracking-widest">Voltar</span>
              </button>

              <div className="bg-brand-white rounded-[40px] p-8 shadow-xl border border-brand-mist">
                <h3 className="text-2xl font-serif text-brand-ink mb-4">Novo Horário</h3>
                <p className="text-sm text-brand-stone font-light italic mb-8 leading-relaxed">
                  Escolha um novo dia e horário para seu atendimento de {appointment.serviceName}.
                </p>

                <div className="space-y-8">
                  {/* Date selection - Using native for brevity, could be custom */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-brand-stone ml-1">Escolha a data</label>
                    <input 
                      type="date" 
                      min={new Date().toISOString().split('T')[0]}
                      value={selectedDate}
                      onChange={(e) => { setSelectedDate(e.target.value); setSelectedTime(''); }}
                      className="w-full px-6 py-4 bg-brand-linen rounded-[24px] outline-none border border-brand-mist focus:border-brand-ink transition-all text-sm font-medium"
                    />
                  </div>

                  {selectedDate && (
                    <div className="space-y-4">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-brand-stone ml-1">Horários disponíveis</label>
                      {availableSlots.length > 0 ? (
                        <div className="grid grid-cols-3 gap-3">
                          {availableSlots.map((time) => (
                            <button
                              key={time}
                              onClick={() => setSelectedTime(time)}
                              className={cn(
                                "py-4 rounded-2xl text-[11px] font-bold tracking-widest transition-all border",
                                selectedTime === time 
                                  ? "bg-brand-ink text-brand-white border-brand-ink shadow-lg shadow-brand-ink/10" 
                                  : "bg-brand-linen text-brand-stone border-transparent hover:border-brand-ink/30"
                              )}
                            >
                              {time}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="p-6 bg-brand-linen/50 rounded-3xl text-center border border-dashed border-brand-mist">
                          <p className="text-[10px] text-brand-stone uppercase tracking-widest">Nenhum horário livre neste dia</p>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedTime && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="pt-6">
                       <button 
                        onClick={handleReschedule}
                        disabled={actionLoading}
                        className="w-full py-5 bg-brand-ink text-brand-white rounded-full text-[10px] font-bold uppercase tracking-[0.2em] shadow-xl hover:bg-brand-espresso transition-all flex items-center justify-center gap-2"
                      >
                         {actionLoading ? 'Alterando...' : <><CalendarCheck size={16} /> Confirmar Reagendamento</>}
                      </button>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {view === 'cancel' && (
            <motion.div 
              key="cancel"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="space-y-6"
            >
              <div className="bg-brand-white rounded-[40px] p-8 shadow-2xl border border-red-100 text-center">
                <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-8 border border-red-100">
                  <Trash2 size={28} />
                </div>
                <h3 className="text-2xl font-serif text-brand-ink mb-3 text-balance">Deseja realmente cancelar?</h3>
                <p className="text-sm text-brand-stone font-light italic mb-10 leading-relaxed px-4">
                  Ao cancelar, seu horário será liberado imediatamente para outras clientes. Esta ação não pode ser desfeita.
                </p>

                <div className="space-y-4">
                  <div className="text-left space-y-2">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-2">Motivo (Opcional)</label>
                    <textarea 
                      placeholder="Ex: Imprevisto de trabalho, motivo pessoal..."
                      className="w-full px-6 py-5 bg-brand-linen rounded-[24px] outline-none border border-brand-mist focus:border-red-200 transition-all text-xs h-24 resize-none"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                    />
                  </div>
                  
                  <button 
                    onClick={() => handleCancel(cancelReason)}
                    disabled={actionLoading}
                    className="w-full py-5 bg-red-600 text-brand-white rounded-full text-[10px] font-bold uppercase tracking-[0.2em] shadow-xl shadow-red-600/10 hover:bg-red-700 transition-all"
                  >
                    {actionLoading ? 'Cancelando...' : 'Confirmar Cancelamento'}
                  </button>
                  <button 
                    onClick={() => setView('main')}
                    className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-stone hover:text-brand-ink transition-colors py-2"
                  >
                    Desistir de cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Info */}
      <footer className="px-8 pb-12 text-center">
         <div className="flex items-center justify-center gap-2 mb-4">
           <Info size={12} className="text-brand-stone" />
           <p className="text-[10px] text-brand-stone font-medium uppercase tracking-[0.15em]">Gestão Segura via Nera</p>
         </div>
         <p className="text-[9px] text-brand-stone/50 font-light italic leading-relaxed">
           Suas informações estão protegidas. A profissional será notificada instantaneamente sobre qualquer alteração.
         </p>
      </footer>
    </div>
  );
}
