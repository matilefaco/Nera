import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Clock, Calendar as CalendarIcon, Check, 
  ArrowLeft, ArrowRight, ShieldCheck, Zap, 
  MapPin, Home, Building2, MessageCircle, 
  Share2, Heart, Sparkles, LogOut
} from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, createBookingRequest, handleBookingError } from '../firebase';
import { UserProfile, Service, ServiceArea, Appointment } from '../types';
import { formatCurrency, cn, buildWhatsappLink, cleanWhatsapp, formatWhatsappDisplay } from '../lib/utils';
import { getAvailableSlots } from '../lib/bookingUtils';
import { toast } from 'sonner';
import PremiumButton from './PremiumButton';

interface BookingModalProps {
  profile: UserProfile;
  services: Service[];
  onClose: () => void;
  open: boolean;
  initialService?: Service | null;
}

export default function BookingModal({ profile, services, onClose, open, initialService }: BookingModalProps) {
  const [step, setStep] = useState(2);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedArea, setSelectedArea] = useState<ServiceArea | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [bookingAttempted, setBookingAttempted] = useState(false);
  const [bookingMode, setBookingMode] = useState<'studio' | 'home' | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [dayAppointments, setDayAppointments] = useState<Appointment[]>([]);
  const [manualBlockedSlots, setManualBlockedSlots] = useState<string[]>([]);
  const [showRestoreDraft, setShowRestoreDraft] = useState(false);

  const isHomeService = bookingMode === 'home';

  // 1. MODAL OPEN/CLOSE SYNC & RESET
  useEffect(() => {
    if (open) {
      // Always honor the initialService prop when opening
      // If it's null, we allow the "Restore Draft" logic to take over later if no service is selected
      if (initialService) {
        setSelectedService(initialService);
        setShowRestoreDraft(false); // Hide the restore prompt if a specific service was chosen
      } else if (!selectedService) {
        // Only reset if we don't have a selection already (to avoid flickering if re-rendering)
        setSelectedService(null);
      }
      
      // For any opening, ensure we start from the beginning unless a restore happens later
      if (step === 5) setStep(2); // If they reached success and re-opened, reset step

      // Pre-select booking mode if not hybrid for fresh openings
      if (profile?.serviceMode && profile.serviceMode !== 'hybrid' && !bookingMode) {
        setBookingMode(profile.serviceMode === 'studio' ? 'studio' : 'home');
      }
    } else {
      // 2. Proactive reset when closed (after animation)
      const timer = setTimeout(() => {
        setStep(2);
        setSelectedService(null);
        setSelectedDate('');
        setSelectedTime('');
        setSelectedArea(null);
        setBookingAttempted(false);
        setBookingMode(profile?.serviceMode && profile.serviceMode !== 'hybrid' 
          ? (profile.serviceMode === 'studio' ? 'studio' : 'home') 
          : null);
        setBookingLoading(false);
        setBookingSuccess(false);
        setClientName('');
        setClientPhone('');
        setClientEmail('');
        setClientAddress('');
      }, 400); // Wait for exit animations
      return () => clearTimeout(timer);
    }
  }, [open, initialService, profile?.serviceMode]);

  // Persistence Logic: Saving draft to localStorage
  useEffect(() => {
    if (!profile?.uid || !open) return;

    const draft = {
      professionalId: profile.uid,
      serviceId: selectedService?.id,
      mode: bookingMode,
      date: selectedDate,
      time: selectedTime,
      clientName,
      clientPhone,
      clientEmail,
      selectedAreaId: selectedArea?.name
    };
    
    if (selectedService || selectedDate || clientName || clientPhone) {
      localStorage.setItem('booking_draft', JSON.stringify(draft));
    }
  }, [selectedService, bookingMode, selectedDate, selectedTime, clientName, clientPhone, clientEmail, selectedArea, profile?.uid, open]);

  // Persistence Logic: Checking for existing draft
  useEffect(() => {
    const savedDraft = localStorage.getItem('booking_draft');
    if (savedDraft && profile?.uid && open && step === 2 && !selectedService) {
      try {
        const parsed = JSON.parse(savedDraft);
        if (parsed.professionalId === profile.uid) {
          if (parsed.clientPhone) setClientPhone(parsed.clientPhone);
          setShowRestoreDraft(true);
        }
      } catch (e) {
        localStorage.removeItem('booking_draft');
      }
    }
  }, [profile?.uid, open, step, selectedService]);

  const handleRestoreDraft = () => {
    const savedDraft = localStorage.getItem('booking_draft');
    if (!savedDraft) return;

    try {
      const draft = JSON.parse(savedDraft);
      if (draft.serviceId) {
        const service = services.find(s => s.id === draft.serviceId);
        if (service) setSelectedService(service);
      }
      if (draft.mode) setBookingMode(draft.mode);
      if (draft.date) setSelectedDate(draft.date);
      if (draft.time) setSelectedTime(draft.time);
      if (draft.clientName) setClientName(draft.clientName);
      if (draft.clientPhone) setClientPhone(draft.clientPhone);
      if (draft.clientEmail) setClientEmail(draft.clientEmail);
      if (draft.selectedAreaId && profile?.serviceAreas) {
        const area = profile.serviceAreas.find((a: ServiceArea) => a.name === draft.selectedAreaId);
        if (area) setSelectedArea(area);
      }
      if (draft.clientName || draft.clientPhone) setStep(4);
      else if (draft.date && draft.time) setStep(4);
      else if (draft.date) setStep(3);
      else setStep(2);
      setShowRestoreDraft(false);
    } catch (e) {
      localStorage.removeItem('booking_draft');
    }
  };

  const handleClearDraft = () => {
    localStorage.removeItem('booking_draft');
    setSelectedService(null);
    setSelectedDate('');
    setSelectedTime('');
    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setClientAddress('');
    setSelectedArea(null);
    setBookingMode(null);
    setStep(2);
    setShowRestoreDraft(false);
  };

  const availableSlots = useMemo(() => {
    if (!profile?.workingHours || !selectedDate) return [];
    return getAvailableSlots({
      selectedDate,
      serviceDuration: Number(selectedService?.duration) || 60,
      workingHours: profile.workingHours,
      appointments: dayAppointments,
      manualBlockedSlots
    });
  }, [selectedDate, selectedService, profile, dayAppointments, manualBlockedSlots]);

  // Urgency logic based on real availability
  const urgencyInfo = useMemo(() => {
    if (!selectedDate || !availableSlots.length) return null;
    
    const count = availableSlots.length;
    
    if (count >= 1 && count <= 3) {
      return {
        message: "Últimos horários disponíveis",
        isUrgent: true
      };
    }
    
    if (count >= 4 && count <= 8) {
      return {
        message: "Agenda com boa procura",
        isUrgent: false
      };
    }
    
    return null;
  }, [selectedDate, availableSlots]);

  useEffect(() => {
    if (selectedDate && profile?.uid && open) {
      const slotsRef = collection(db, 'blocked_slots');
      const slotsQ = query(slotsRef, where('professionalId', '==', profile.uid), where('date', '==', selectedDate));
      const unsubscribeSlots = onSnapshot(slotsQ, (snapshot) => {
        setManualBlockedSlots(snapshot.docs.map(doc => doc.data().time));
      });
      const apptsRef = collection(db, 'appointments');
      const apptsQ = query(apptsRef, where('professionalId', '==', profile.uid), where('date', '==', selectedDate), where('status', 'in', ['confirmed', 'completed']));
      const unsubscribeAppts = onSnapshot(apptsQ, (snapshot) => {
        setDayAppointments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Appointment)));
      });
      return () => {
        unsubscribeSlots();
        unsubscribeAppts();
      };
    }
  }, [selectedDate, profile?.uid, open]);

  const calculateTotalPrice = () => {
    if (!selectedService) return 0;
    const basePrice = Number(selectedService.price) || 0;
    return basePrice + (selectedArea?.fee || 0);
  };

  const handleBooking = async () => {
    setBookingAttempted(true);
    if (!profile || !selectedService) return;
    if (!clientName.trim() || !clientPhone.trim() || (isHomeService && !clientAddress.trim())) {
      toast.error('Por favor, preencha os campos destacados.');
      return;
    }

    if (clientEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(clientEmail.trim())) {
        toast.error('O e-mail informado parece não ser válido.');
        return;
      }
    }
    setBookingLoading(true);
    try {
      const totalPrice = calculateTotalPrice();
      await createBookingRequest({
        professionalId: profile.uid,
        professionalName: profile.name,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        duration: selectedService.duration,
        price: selectedService.price,
        travelFee: selectedArea?.fee || 0,
        totalPrice: totalPrice,
        locationType: isHomeService ? 'home' : 'studio',
        neighborhood: selectedArea?.name || '',
        address: clientAddress.trim(),
        clientName: clientName.trim(),
        clientWhatsapp: clientPhone.replace(/\D/g, ''),
        clientEmail: clientEmail.trim().toLowerCase(),
        date: selectedDate,
        time: selectedTime,
      });
      setBookingSuccess(true);
      localStorage.removeItem('booking_draft');
      setTimeout(() => {
        setStep(5);
      }, 800);
    } catch (error: any) {
      handleBookingError(error);
    } finally {
      setBookingLoading(false);
    }
  };

  if (!open && step !== 5) return null;

  return (
    <>
      <AnimatePresence>
        {showRestoreDraft && step === 2 && (
          <div className="fixed inset-0 bg-brand-ink/60 backdrop-blur-md z-[600] flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-brand-white w-full max-w-md rounded-[40px] p-10 text-center shadow-2xl border border-brand-mist">
              <div className="w-16 h-16 bg-brand-linen text-brand-terracotta rounded-full flex items-center justify-center mx-auto mb-8">
                <Clock size={32} />
              </div>
              <h3 className="text-2xl font-serif text-brand-ink mb-3">Seu horário ainda pode estar disponível.</h3>
              <p className="text-sm text-brand-stone font-light mb-10 leading-relaxed">Continue sua reserva de onde parou.</p>
              <div className="flex flex-col gap-4">
                <PremiumButton variant="terracotta" className="w-full py-6" onClick={handleRestoreDraft}>Continuar Reserva</PremiumButton>
                <button onClick={handleClearDraft} className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-stone hover:text-brand-ink transition-colors py-2">Começar novamente</button>
                {clientPhone && (
                  <div className="mt-6 pt-6 border-t border-brand-mist">
                    <p className="text-[10px] text-brand-stone uppercase tracking-widest mb-4">Precisa de ajuda?</p>
                    <a href={buildWhatsappLink(profile.whatsapp, 'Olá! Estava iniciando um agendamento e gostaria de tirar uma dúvida.')} target="_blank" className="flex items-center justify-center gap-2 text-brand-ink font-medium text-xs hover:text-brand-terracotta transition-colors">
                      <MessageCircle size={16} /> Fale direto com a profissional
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && step >= 2 && step <= 4 && (
          <div className="fixed inset-0 bg-brand-ink/40 backdrop-blur-sm z-[200] flex items-end md:items-center justify-center p-0 md:p-6">
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="bg-brand-white w-full max-w-2xl rounded-t-[40px] md:rounded-[40px] p-8 md:p-12 shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar">
              <button onClick={onClose} className="absolute right-8 top-8 text-brand-stone hover:text-brand-ink transition-colors">
                <X size={24} />
              </button>
              <div className="flex gap-2 mb-8">
                {[2, 3, 4].map((s) => (
                   <div key={s} className={cn("h-1 flex-1 rounded-full transition-all duration-500", step >= s ? "bg-brand-terracotta" : "bg-brand-mist")} />
                ))}
              </div>

              {step === 2 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                  <h3 className="text-2xl font-serif text-brand-ink mb-2">Sua Experiência</h3>
                  <p className="text-xs text-brand-stone font-light mb-10">Selecione o serviço e onde deseja ser atendida.</p>
                  <div className="space-y-8">
                    {profile.serviceMode === 'hybrid' && (
                      <div className="space-y-4">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">Onde prefere o atendimento?</label>
                        <div className="grid grid-cols-2 gap-4">
                          <button onClick={() => setBookingMode('studio')} className={cn("flex items-center gap-4 p-5 rounded-2xl border transition-all", bookingMode === 'studio' ? "bg-brand-ink text-brand-white border-brand-ink" : "bg-brand-white border-brand-mist text-brand-stone hover:border-brand-ink")}>
                            <Building2 size={20} className={bookingMode === 'studio' ? "text-brand-terracotta" : "text-brand-mist"} />
                            <span className="text-xs font-medium uppercase tracking-widest">No Estúdio</span>
                          </button>
                          <button onClick={() => setBookingMode('home')} className={cn("flex items-center gap-4 p-5 rounded-2xl border transition-all", bookingMode === 'home' ? "bg-brand-ink text-brand-white border-brand-ink" : "bg-brand-white border-brand-mist text-brand-stone hover:border-brand-ink")}>
                            <Home size={20} className={bookingMode === 'home' ? "text-brand-terracotta" : "text-brand-mist"} />
                            <span className="text-xs font-medium uppercase tracking-widest">Em Casa</span>
                          </button>
                        </div>
                      </div>
                    )}
                    {isHomeService && profile.serviceAreaType === 'custom' && (
                      <div className="space-y-4">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">Em qual bairro você está?</label>
                        <div className="flex flex-wrap gap-2">
                          {profile.serviceAreas?.map((area) => (
                            <button key={area.name} onClick={() => setSelectedArea(area)} className={cn("px-6 py-3 rounded-full border text-[10px] font-bold uppercase tracking-widest transition-all", selectedArea?.name === area.name ? "bg-brand-ink text-brand-white border-brand-ink" : "bg-brand-white border-brand-mist text-brand-stone hover:border-brand-ink")}>
                              {area.name} {area.fee > 0 && `(+${formatCurrency(area.fee)})`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="space-y-4">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">Qual experiência deseja viver hoje?</label>
                      <div className="space-y-3">
                        {services.map((service) => (
                          <button key={service.id} onClick={() => { setSelectedService(service); }} className={cn("w-full p-6 text-left rounded-[24px] border transition-all flex justify-between items-center group relative overflow-hidden", selectedService?.id === service.id ? "bg-brand-ink border-brand-ink text-brand-white" : "bg-brand-parchment border-brand-mist hover:border-brand-ink")}>
                            <div className="flex-1 relative z-10">
                              <h4 className={cn("font-serif text-lg", selectedService?.id === service.id ? "text-brand-white" : "text-brand-ink")}>{service.name}</h4>
                              <span className="text-[10px] uppercase tracking-widest opacity-60">{service.duration} min</span>
                            </div>
                            <div className="text-xl font-serif text-brand-terracotta relative z-10">{formatCurrency(service.price)}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="hidden md:block">
                      <PremiumButton className="w-full mt-8" variant="terracotta" disabled={!selectedService || (isHomeService && profile.serviceAreaType === 'custom' && !selectedArea)} onClick={() => setStep(3)}>
                        Continuar <ArrowRight size={18} className="ml-1" />
                      </PremiumButton>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                  <div className="flex items-center gap-4 mb-2">
                    <button onClick={() => setStep(2)} className="text-brand-stone hover:text-brand-ink"><ArrowLeft size={20} /></button>
                    <h3 className="text-2xl font-serif text-brand-ink">Selecione o melhor dia para você</h3>
                  </div>
                  <p className="text-xs text-brand-stone font-light mb-10 ml-9">Escolha a data ideal para sua experiência.</p>
                  <div className="flex overflow-x-auto gap-3 pb-4 mb-10 no-scrollbar -mx-2 px-2">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(offset => {
                      const date = new Date();
                      date.setDate(date.getDate() + offset);
                      const dateStr = date.toISOString().split('T')[0];
                      const isSelected = selectedDate === dateStr;
                      const dayOfWeek = date.getDay();
                      const isWorkingDay = profile?.workingHours?.workingDays?.includes(dayOfWeek);
                      return (
                        <button key={offset} onClick={() => { if (!isWorkingDay) { toast.info('A profissional não atende neste dia'); return; } setSelectedDate(dateStr); }} className={cn("min-w-[70px] aspect-[4/5] rounded-2xl flex flex-col items-center justify-center transition-all border shrink-0", isSelected ? "bg-brand-ink text-brand-white border-brand-ink premium-shadow scale-105" : isWorkingDay ? "bg-brand-parchment border-brand-mist hover:border-brand-ink" : "bg-brand-mist/10 border-transparent text-brand-stone/40 cursor-not-allowed")}>
                          <span className={cn("text-[8px] font-bold uppercase tracking-widest mb-1", isWorkingDay ? "opacity-40" : "opacity-20")}>{date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</span>
                          <span className={cn("text-lg font-serif", !isWorkingDay && "opacity-40")}>{date.getDate()}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="space-y-4 mb-24 md:mb-12">
                    <div className="flex items-center justify-between ml-1 mb-1">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone">Horários disponíveis</label>
                      {urgencyInfo && (
                        <motion.div 
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={cn(
                            "flex items-center gap-2 text-[8px] font-bold uppercase tracking-[0.15em]",
                            urgencyInfo.isUrgent ? "text-brand-terracotta" : "text-brand-stone/60"
                          )}
                        >
                          {urgencyInfo.isUrgent && <div className="w-1 h-1 rounded-full bg-current animate-pulse" />}
                          {urgencyInfo.message}
                        </motion.div>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {selectedDate ? (
                        availableSlots.length > 0 ? (
                          availableSlots.map(time => (
                            <button key={time} onClick={() => setSelectedTime(time)} className={cn("py-5 rounded-2xl border transition-all text-sm font-medium flex items-center justify-center gap-2", selectedTime === time ? "bg-brand-ink text-brand-white border-brand-ink" : "bg-brand-white border-brand-mist hover:border-brand-ink text-brand-ink")}>
                              <Clock size={14} className={selectedTime === time ? "text-brand-terracotta" : "text-brand-mist"} />
                              {time}
                            </button>
                          ))
                        ) : (
                          <div className="col-span-3 py-16 text-center bg-brand-linen/30 rounded-3xl border border-dashed border-brand-mist">
                            <p className="text-sm text-brand-terracotta font-bold uppercase tracking-widest mb-2">Alta procura nos próximos dias</p>
                            <p className="text-xs text-brand-stone font-light italic">Tente outra data ou solicite um encaixe via WhatsApp</p>
                          </div>
                        )
                      ) : (
                        <div className="col-span-3 py-16 text-center bg-brand-parchment/50 rounded-3xl border border-dashed border-brand-mist">
                          <p className="text-sm text-brand-stone font-light italic">Selecione uma data acima</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <PremiumButton variant="terracotta" className="w-full" disabled={!selectedDate || !selectedTime} onClick={() => setStep(4)}>Confirmar este horário <ArrowRight size={18} className="ml-1" /></PremiumButton>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="flex items-center gap-4 mb-2">
                    <button onClick={() => setStep(3)} className="text-brand-stone hover:text-brand-ink"><ArrowLeft size={20} /></button>
                    <h3 className="text-2xl font-serif text-brand-ink">Só falta confirmar seus dados</h3>
                  </div>
                  <p className="text-xs text-brand-stone font-light mb-10 ml-9">Quase lá! Revise as informações da sua reserva.</p>
                  <div className="bg-brand-ink text-brand-white rounded-[32px] p-8 mb-8 space-y-6 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-terracotta/20 rounded-full -mr-16 -mt-16 blur-3xl opacity-50" />
                    <div className="flex justify-between items-start pb-6 border-b border-brand-white/10 relative z-10">
                      <div className="flex-1">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-brand-blush/40 block mb-2">{selectedService?.name}</span>
                        <div className="flex items-center gap-4 text-xs font-light text-brand-blush/80">
                          <span className="flex items-center gap-1.5"><CalendarIcon size={12} /> {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                          <span className="flex items-center gap-1.5"><Clock size={12} /> {selectedTime}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-brand-blush/40 block mb-2">Total</span>
                        <h4 className="text-2xl font-serif text-brand-terracotta leading-none">{formatCurrency(calculateTotalPrice())}</h4>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4 mb-8">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">Seu Nome <span className="text-brand-terracotta">*</span></label>
                      <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nome completo" className={cn("w-full px-6 py-5 bg-brand-parchment border rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all text-sm", !clientName && bookingAttempted ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist")} />
                      {!clientName && bookingAttempted && <p className="text-[9px] text-brand-terracotta font-bold uppercase tracking-wider ml-2 mt-1">Este campo é obrigatório</p>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">WhatsApp <span className="text-brand-terracotta">*</span></label>
                        <input type="tel" value={formatWhatsappDisplay(clientPhone)} onChange={(e) => setClientPhone(cleanWhatsapp(e.target.value))} placeholder="(85) 99999-9999" className={cn("w-full px-6 py-5 bg-brand-parchment border rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all text-sm", !clientPhone && bookingAttempted ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist")} />
                        {!clientPhone && bookingAttempted && <p className="text-[9px] text-brand-terracotta font-bold uppercase tracking-wider ml-2 mt-1">Este campo é obrigatório</p>}
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">E-mail <span className="opacity-40">(Opcional)</span></label>
                        <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="Agilize sua reserva (opcional)" className={cn("w-full px-6 py-5 bg-brand-parchment border rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all text-sm border-brand-mist")} />
                        <p className="text-[8px] text-brand-stone/60 font-medium uppercase tracking-wider ml-2 mt-1">Usaremos seu WhatsApp para a confirmação.</p>
                      </div>
                    </div>
                    {isHomeService && (
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">Endereço de Atendimento <span className="text-brand-terracotta">*</span></label>
                        <textarea value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} placeholder="Rua, número, bairro e qualquer ponto de referência" className={cn("w-full px-6 py-5 bg-brand-parchment border rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all text-sm resize-none h-28", !clientAddress && bookingAttempted ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist")} />
                        {!clientAddress && bookingAttempted && <p className="text-[9px] text-brand-terracotta font-bold uppercase tracking-wider ml-2 mt-1">Este campo é obrigatório</p>}
                      </div>
                    )}
                  </div>
                  <div className="hidden md:block">
                    <PremiumButton variant="terracotta" className="w-full py-7" disabled={!clientName || !clientPhone || !clientEmail || (isHomeService && !clientAddress)} onClick={handleBooking} loading={bookingLoading} loadingText="Finalizando solicitação...">Confirmar reserva <Check size={18} className="ml-1" /></PremiumButton>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && step >= 2 && step <= 4 && (
          <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="fixed bottom-0 left-0 right-0 z-[250] md:hidden p-6 bg-gradient-to-t from-brand-white via-brand-white to-transparent pt-12">
            <PremiumButton variant="terracotta" className="w-full py-7" disabled={(step === 2 && (!selectedService || (isHomeService && profile?.serviceAreaType === 'custom' && !selectedArea))) || (step === 3 && (!selectedDate || !selectedTime)) || (step === 4 && (!clientName || !clientPhone || !clientEmail || (isHomeService && !clientAddress)))} loading={step === 4 && bookingLoading} onClick={() => { if (step === 2) setStep(3); else if (step === 3) setStep(4); else if (step === 4) handleBooking(); }}>
              {step === 2 && (selectedService ? `Reservar ${selectedService.name.split(' ')[0]}` : 'Escolher Experiência')}
              {step === 3 && (selectedTime ? `Confirmar para ${selectedTime}` : 'Escolher Horário')}
              {step === 4 && 'Confirmar reserva'}
              <ArrowRight size={18} className="ml-1" />
            </PremiumButton>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {step === 5 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-brand-white z-[300] flex flex-col items-center justify-center p-8 text-center">
            <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", damping: 15 }} className="w-24 h-24 bg-brand-linen text-brand-terracotta rounded-full flex items-center justify-center mb-8"><Check size={48} /></motion.div>
            <h2 className="text-3xl md:text-4xl font-serif text-brand-ink mb-3 leading-tight">{profile?.name.split(' ')[0]} recebeu sua reserva</h2>
            <p className="body-text text-brand-stone mb-10 max-w-xs mx-auto">Você receberá a confirmação por WhatsApp em breve.</p>
            {selectedService && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-brand-parchment rounded-3xl border border-brand-mist p-8 w-full max-w-sm mb-12 text-left shadow-sm">
                <span className="text-[9px] font-bold uppercase tracking-widest text-brand-stone block mb-4 border-b border-brand-mist/50 pb-2">Resumo da solicitação</span>
                <div className="space-y-4">
                  <div><span className="text-[10px] text-brand-stone uppercase tracking-wide block mb-1">Serviço</span><span className="font-serif text-brand-ink">{selectedService.name}</span></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><span className="text-[10px] text-brand-stone uppercase tracking-wide block mb-1">Data</span><span className="text-sm font-medium text-brand-ink">{new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</span></div>
                    <div><span className="text-[10px] text-brand-stone uppercase tracking-wide block mb-1">Horário</span><span className="text-sm font-medium text-brand-ink">{selectedTime}</span></div>
                  </div>
                </div>
              </motion.div>
            )}
            <div className="w-full max-w-sm space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PremiumButton variant="secondary" className="w-full py-4 !text-[9px]" onClick={() => { const start = new Date(selectedDate + 'T' + selectedTime); const end = new Date(start.getTime() + (Number(selectedService?.duration) || 60) * 60000); const formatTemplate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'; const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('Reserva: ' + selectedService?.name)}&dates=${formatTemplate(start)}/${formatTemplate(end)}&details=${encodeURIComponent('Agendamento realizado via Nera.')}&location=${encodeURIComponent(profile?.city || '')}`; window.open(url, '_blank'); }}>
                  <CalendarIcon size={14} /> Adicionar calendário
                </PremiumButton>
                <a href={buildWhatsappLink(profile?.whatsapp || '', 'Olá! Acabei de solicitar um horário para ' + selectedService?.name + ' pelo Nera e gostaria de confirmar os detalhes.')} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 px-6 py-4 bg-brand-linen text-brand-ink rounded-full text-[9px] font-medium uppercase tracking-widest hover:bg-brand-mist transition-all border border-brand-mist"><MessageCircle size={14} /> Falar com a profissional</a>
              </div>
              <div className="bg-brand-linen/30 border border-brand-mist rounded-[32px] p-8 mt-12 text-center">
                <div className="w-12 h-12 bg-brand-white rounded-2xl flex items-center justify-center mx-auto mb-4 text-brand-terracotta shadow-sm"><Heart size={24} className="fill-brand-terracotta/10" /></div>
                <h4 className="text-lg font-serif text-brand-ink mb-2">Gostou da experiência? Indique uma amiga.</h4>
                <p className="text-[10px] text-brand-stone uppercase tracking-widest mb-6">Compartilhe sua descoberta com quem você ama</p>
                <PremiumButton variant="primary" className="w-full py-5 !text-[10px]" onClick={() => { const url = window.location.origin + '/p/' + (profile?.slug || ''); const text = `Te recomendo essa profissional ✨`; const fullText = `${text} Reserve online aqui: ${url}`; if (navigator.share) { navigator.share({ title: profile?.name, text: text, url: url }).catch(() => { navigator.clipboard.writeText(fullText); toast.success('Link de indicação copiado!'); }); } else { navigator.clipboard.writeText(fullText); toast.success('Link de indicação copiado!'); } }}>Compartilhar perfil <Share2 size={14} className="ml-1" /></PremiumButton>
              </div>
              <button onClick={() => { setStep(2); setSelectedService(null); setSelectedDate(''); setSelectedTime(''); setBookingSuccess(false); onClose(); }} className="mt-8 text-[10px] font-bold text-brand-stone uppercase tracking-widest hover:text-brand-ink transition-colors">Voltar para o perfil</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
