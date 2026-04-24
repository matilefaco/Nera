import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { 
  X, Clock, Calendar as CalendarIcon, Check, 
  ArrowLeft, ArrowRight, ShieldCheck, Zap, 
  MapPin, Home, Building2, MessageCircle, 
  Share2, Heart, Sparkles, LogOut, Settings
} from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, createBookingRequest, handleBookingError, markWaitlistAsBooked } from '../firebase';
import { UserProfile, Service, ServiceArea, Appointment, BlockedSchedule, WaitlistEntry } from '../types';
import { formatCurrency, cn, buildWhatsappLink, cleanWhatsapp, formatWhatsappDisplay, generateBookingConfirmationMessage } from '../lib/utils';
import { getAvailableSlots, canBookSlot } from '../lib/bookingUtils';
import { toast } from 'sonner';
import PremiumButton from './PremiumButton';
import WaitlistModal from './WaitlistModal';

interface BookingModalProps {
  profile: UserProfile;
  services: Service[];
  onClose: () => void;
  open: boolean;
  initialService?: Service | null;
  waitlistEntry?: WaitlistEntry | null;
}

export default function BookingModal({ profile, services, onClose, open, initialService, waitlistEntry }: BookingModalProps) {
  const [step, setStep] = useState(2);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedArea, setSelectedArea] = useState<ServiceArea | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressComplement, setAddressComplement] = useState('');
  const [addressNeighborhood, setAddressNeighborhood] = useState('');
  const [addressCity, setAddressCity] = useState(profile?.city || '');
  const [addressReference, setAddressReference] = useState('');
  
  const [bookingAttempted, setBookingAttempted] = useState(false);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [successDraft, setSuccessDraft] = useState<any>(null);
  const [bookingMode, setBookingMode] = useState<'studio' | 'home' | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [appointmentToken, setAppointmentToken] = useState<string | null>(null);
  const [reservationCode, setReservationCode] = useState<string | null>(null);
  const [dayAppointments, setDayAppointments] = useState<Appointment[]>([]);
  const [blockedSchedules, setBlockedSchedules] = useState<any[]>([]);
  const [showRestoreDraft, setShowRestoreDraft] = useState(false);
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false);

  const isHomeService = bookingMode === 'home';

  // 1. MODAL OPEN/CLOSE SYNC & RESET
  useEffect(() => {
    if (open) {
      if (profile?.city && !addressCity) {
        setAddressCity(profile.city);
      }
      
      // If it's null, we allow the "Restore Draft" logic to take over later if no service is selected
      if (initialService) {
        setSelectedService(initialService);
        setShowRestoreDraft(false); 
      } else if (waitlistEntry) {
        const service = services.find(s => s.id === waitlistEntry.serviceId);
        if (service) setSelectedService(service);
        setSelectedDate(waitlistEntry.requestedDate);
        if (waitlistEntry.preferredTime) setSelectedTime(waitlistEntry.preferredTime);
        if (waitlistEntry.assignedTime) setSelectedTime(waitlistEntry.assignedTime);
        setClientName(waitlistEntry.clientName);
        setClientPhone(waitlistEntry.clientWhatsapp);
        setShowRestoreDraft(false);
        setStep(4); // Pre-filled, let's go straight to confirmation
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
      const draft = {
        professionalId: profile.uid,
        serviceId: selectedService?.id,
        mode: bookingMode,
        date: selectedDate,
        time: selectedTime,
        clientName,
        clientPhone,
        clientEmail,
        selectedAreaId: selectedArea?.name,
        address: {
          street: addressStreet,
          number: addressNumber,
          complement: addressComplement,
          neighborhood: addressNeighborhood || selectedArea?.name,
          city: addressCity || profile?.city,
          reference: addressReference
        }
      };
      localStorage.setItem('booking_draft', JSON.stringify(draft));
    }
  }, [selectedService, bookingMode, selectedDate, selectedTime, clientName, clientPhone, clientEmail, selectedArea, profile?.uid, open, addressStreet, addressNumber, addressComplement, addressNeighborhood, addressCity, addressReference]);

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
      
      // Basic profile check to ensure we don't restore drafts from other professionals
      if (draft.professionalId !== profile.uid) {
        localStorage.removeItem('booking_draft');
        return;
      }

      if (draft.serviceId) {
        const service = services.find(s => s.id === draft.serviceId);
        if (service) setSelectedService(service);
      }
      if (draft.mode) setBookingMode(draft.mode);
      if (draft.date) {
        const today = new Date().toISOString().split('T')[0];
        if (draft.date < today) {
          // Date is in the past, don't restore date/time but keep the rest
          setSelectedDate('');
          setSelectedTime('');
        } else {
          setSelectedDate(draft.date);
          if (draft.time) setSelectedTime(draft.time);
        }
      }
      if (draft.clientName) setClientName(draft.clientName);
      if (draft.clientPhone) setClientPhone(draft.clientPhone);
      if (draft.clientEmail) setClientEmail(draft.clientEmail);
      if (draft.address) {
        if (draft.address.street) setAddressStreet(draft.address.street);
        if (draft.address.number) setAddressNumber(draft.address.number);
        if (draft.address.complement) setAddressComplement(draft.address.complement);
        if (draft.address.neighborhood) setAddressNeighborhood(draft.address.neighborhood);
        if (draft.address.city) setAddressCity(draft.address.city);
        if (draft.address.reference) setAddressReference(draft.address.reference);
      }
      if (draft.selectedAreaId && profile?.serviceAreas) {
        const area = profile.serviceAreas.find((a: ServiceArea) => a.name === draft.selectedAreaId);
        if (area) setSelectedArea(area);
      }
      
      // Determine initial step after restore
      if (draft.clientName || draft.clientPhone) {
        setStep(4);
      } else if (draft.date && draft.time) {
        setStep(4);
      } else if (draft.date) {
        setStep(3);
      } else {
        setStep(2);
      }
      
      setShowRestoreDraft(false);
      
      // Set a flag to trigger re-validation once slots are loaded
      setWasRestored(true);
    } catch (e) {
      localStorage.removeItem('booking_draft');
    }
  };

  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  const availableSlots = useMemo(() => {
    if (!profile?.workingHours || !selectedDate) return [];
    return getAvailableSlots({
      selectedDate,
      serviceDuration: Number(selectedService?.duration) || 60,
      workingHours: profile.workingHours,
      appointments: dayAppointments,
      blockedSchedules
    });
  }, [selectedDate, selectedService, profile, dayAppointments, blockedSchedules]);

  const [wasRestored, setWasRestored] = useState(false);

  // Re-validation logic for restored slots
  useEffect(() => {
    // Only validate if we have a full target to check against AND we finished loading
    if (wasRestored && selectedDate && selectedTime && !isLoadingSlots && dayAppointments.length >= 0) {
      const isStillAvailable = availableSlots.includes(selectedTime);
      
      if (!isStillAvailable) {
        setSelectedDate('');
        setSelectedTime('');
        setStep(3);
        toast.error('Este horário não está mais disponível.', {
          description: 'A profissional pode ter recebido outra reserva ou alterado a agenda. Por favor, escolha um novo horário.'
        });
      }
      setWasRestored(false);
    }
  }, [wasRestored, selectedDate, selectedTime, availableSlots, dayAppointments, isLoadingSlots]);

  const handleClearDraft = () => {
    localStorage.removeItem('booking_draft');
    setSelectedService(null);
    setSelectedDate('');
    setSelectedTime('');
    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setClientAddress('');
    setAddressStreet('');
    setAddressNumber('');
    setAddressComplement('');
    setAddressNeighborhood('');
    setAddressCity(profile?.city || '');
    setAddressReference('');
    setSelectedArea(null);
    setBookingMode(null);
    setStep(2);
    setShowRestoreDraft(false);
  };

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
    if (!selectedDate || !profile?.uid || !open) return;

    setIsLoadingSlots(true);

    // Listener de bloqueios novos (blocked_schedules)
    const blockedRef = collection(db, 'blocked_schedules');
    const dayOfWeek = new Date(selectedDate + 'T12:00:00').getDay();

    const unsubBlocked = onSnapshot(
      query(blockedRef, where('professionalId', '==', profile.uid)),
      (snap) => {
        const allBlocked = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        // Filtrar bloqueios aplicáveis para esta data
        const dayBlocked = allBlocked.filter(b => {
          const isToday = b.date === selectedDate;
          const isRecurring = b.isRecurring && b.recurringDays?.includes(dayOfWeek);
          return isToday || isRecurring;
        });
        setBlockedSchedules(dayBlocked);
      }
    );

    // Listener de agendamentos para excluir slots ocupados
    const apptsRef = collection(db, 'appointments');
    const apptsQ = query(
      apptsRef, 
      where('professionalId', '==', profile.uid), 
      where('date', '==', selectedDate), 
      where('status', 'in', ['pending', 'confirmed', 'completed'])
    );
    
    const unsubAppts = onSnapshot(apptsQ, (snapshot) => {
      setDayAppointments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Appointment)));
      setIsLoadingSlots(false);
    });

    return () => {
      unsubBlocked();
      unsubAppts();
    };
  }, [selectedDate, profile?.uid, open]);

  const calculateTotalPrice = () => {
    if (!selectedService) return 0;
    const basePrice = Number(selectedService.price) || 0;
    return basePrice + (selectedArea?.fee || 0);
  };

  const handleBooking = async () => {
    setBookingAttempted(true);
    if (!profile || !selectedService) return;
    
    // Core validations
    const isBaseValid = clientName.trim().length >= 2 && clientPhone.trim() && clientEmail.trim();
    let isAddressValid = true;
    
    if (isHomeService) {
      isAddressValid = !!(addressStreet.trim() && addressNumber.trim() && (addressNeighborhood.trim() || selectedArea?.name) && (addressCity.trim() || profile?.city));
    }

    if (!isBaseValid || !isAddressValid) {
      toast.error('Por favor, preencha todos os campos obrigatórios corretamente.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clientEmail.trim())) {
      toast.error('O e-mail informado parece não ser válido.');
      return;
    }

    setBookingLoading(true);
    try {
      // Final availability check before submitting
      const availabilityCheck = canBookSlot({
        date: selectedDate,
        time: selectedTime,
        workingHours: profile.workingHours,
        appointments: dayAppointments,
        blockedSchedules,
        serviceDuration: Number(selectedService.duration) || 60
      });

      if (!availabilityCheck.canBook) {
        toast.error('Este horário não está mais disponível.', {
          description: availabilityCheck.reason || 'Por favor, escolha outro horário.'
        });
        setStep(3);
        setBookingLoading(false);
        return;
      }

      const totalPrice = calculateTotalPrice();
      
      const structuredAddress = isHomeService ? {
        street: addressStreet.trim(),
        number: addressNumber.trim(),
        complement: addressComplement.trim(),
        neighborhood: addressNeighborhood.trim() || selectedArea?.name || '',
        city: addressCity.trim() || profile?.city || '',
        reference: addressReference.trim()
      } : undefined;

      const { bookingId, token, reservationCode: resCode } = await createBookingRequest({
        professionalId: profile.uid,
        professionalName: profile.name,
        professionalWhatsapp: profile.whatsapp,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        duration: selectedService.duration,
        price: selectedService.price,
        travelFee: selectedArea?.fee || 0,
        totalPrice: totalPrice,
        locationType: isHomeService ? 'home' : 'studio',
        neighborhood: (isHomeService ? (addressNeighborhood.trim() || selectedArea?.name) : profile.neighborhood) || '',
        address: structuredAddress,
        clientName: clientName.trim(),
        clientWhatsapp: clientPhone.replace(/\D/g, ''),
        clientEmail: clientEmail.trim().toLowerCase(),
        date: selectedDate,
        time: selectedTime,
      });

      // LOGS OBRIGATÓRIOS DO USUÁRIO
      console.log(`[RESERVATION CREATE] appointmentId: ${bookingId}`);
      console.log(`[RESERVATION CREATE] token: ${token}`);
      console.log(`[RESERVATION CREATE] reservationCode: ${resCode}`);
      console.log(`[RESERVATION CREATE] manageUrl: ${window.location.origin}/r/${token}`);

      setAppointmentId(bookingId);
      setAppointmentToken(token);
      setReservationCode(resCode || null);
      setBookingSuccess(true);

      // --- SEND PENDING NOTIFICATION TO CLIENT ---
      if (clientEmail.trim()) {
        fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'BOOKING_PENDING_CLIENT',
            payload: {
              clientEmail: clientEmail.trim().toLowerCase(),
              clientName: clientName.trim(),
              professionalName: profile.name,
              professionalWhatsapp: profile.whatsapp,
              serviceName: selectedService.name,
              date: selectedDate,
              time: selectedTime,
              price: formatCurrency(totalPrice),
              reservationCode: resCode,
              manageUrl: `${window.location.origin}/r/${token}`
            }
          })
        })
        .then(res => res.json())
        .then(data => console.log('[EMAIL_PENDING] Result:', data))
        .catch(err => console.error('[EMAIL_PENDING_ERROR] Notification failed:', err));
      }
      
      // If booking from waitlist, mark it as booked
      if (waitlistEntry?.id) {
        await markWaitlistAsBooked(waitlistEntry.id);
      }

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
          <div className="fixed inset-0 bg-brand-ink/40 backdrop-blur-sm z-[200] flex items-end md:items-center justify-center p-0 md:p-6 overflow-hidden">
            <motion.div 
              initial={{ y: "100%" }} 
              animate={{ y: 0 }} 
              exit={{ y: "100%" }} 
              transition={{ type: "spring", damping: 25, stiffness: 200 }} 
              className="bg-brand-white w-full max-w-2xl rounded-t-[40px] md:rounded-[40px] p-8 md:p-12 shadow-2xl relative max-h-[95dvh] md:max-h-[90vh] overflow-y-auto no-scrollbar pb-32 md:pb-12"
            >
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
                  <h3 className="text-2xl font-serif text-brand-ink mb-2">Escolha o serviço</h3>
                  <p className="text-xs text-brand-stone font-light mb-8">Selecione o serviço e onde você prefere o atendimento.</p>
                  
                  {/* Location Context Header */}
                  <div className="bg-brand-linen/40 border border-brand-mist/50 rounded-3xl p-5 mb-10 flex items-start gap-4">
                    <div className="w-10 h-10 bg-brand-white rounded-2xl flex items-center justify-center text-brand-terracotta shadow-sm shrink-0">
                      {bookingMode === 'home' || profile.serviceMode === 'home' ? <Home size={18} /> : <MapPin size={18} />}
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-ink">
                        {profile.city}
                        {bookingMode === 'home' ? ' • Em Domicílio' : ' • No Estúdio'}
                      </p>
                      {bookingMode === 'home' && (
                        <p className="text-[10px] text-brand-stone leading-relaxed">
                          {profile.serviceAreaType === 'city_wide' 
                            ? 'Atendimento disponível em toda a cidade.'
                            : profile.serviceAreas && profile.serviceAreas.length > 0 
                              ? `Atende nos bairros: ${profile.serviceAreas.slice(0, 4).map(a => a.name).join(', ')}${profile.serviceAreas.length > 4 ? ' e outros.' : '.'}`
                              : 'Consulte a disponibilidade para seu bairro.'}
                        </p>
                      )}
                      {bookingMode === 'studio' && (
                        <div className="space-y-1">
                          <p className="text-[10px] text-brand-ink font-bold flex items-center gap-1.5 uppercase tracking-widest">
                            <Building2 size={10} className="text-brand-terracotta" />
                            Atendimento no estúdio
                          </p>
                          <p className="text-[10px] text-brand-stone leading-relaxed uppercase tracking-widest">
                            {profile.studioAddress ? (
                              <>
                                <span className="block">{profile.studioAddress.street}, {profile.studioAddress.number}</span>
                                <span className="block">{profile.studioAddress.neighborhood}, {profile.studioAddress.city}</span>
                              </>
                            ) : (
                              <>{profile.studioAddress?.neighborhood || profile.neighborhood || profile.city}</>
                            )}
                            {profile.studioAddress?.reference && (
                              <span className="block opacity-60 text-[9px] lowercase italic first-letter:uppercase">
                                • Próximo {profile.studioAddress.reference.toLowerCase().startsWith('à') || profile.studioAddress.reference.toLowerCase().startsWith('a ') ? '' : 'à '}{profile.studioAddress.reference}
                              </span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-8">
                    {profile.serviceMode === 'hybrid' && (
                      <div className="space-y-4">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">Onde prefere o atendimento?</label>
                        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-4">
                          <button onClick={() => setBookingMode('studio')} className={cn("flex items-center gap-4 p-5 rounded-2xl border transition-all min-w-0", bookingMode === 'studio' ? "bg-brand-ink text-brand-white border-brand-ink" : "bg-brand-white border-brand-mist text-brand-stone hover:border-brand-ink")}>
                            <Building2 size={20} className={bookingMode === 'studio' ? "text-brand-terracotta" : "text-brand-mist"} />
                            <span className="text-xs font-medium uppercase tracking-widest truncate">No Estúdio</span>
                          </button>
                          <button onClick={() => setBookingMode('home')} className={cn("flex items-center gap-4 p-5 rounded-2xl border transition-all min-w-0", bookingMode === 'home' ? "bg-brand-ink text-brand-white border-brand-ink" : "bg-brand-white border-brand-mist text-brand-stone hover:border-brand-ink")}>
                            <Home size={20} className={bookingMode === 'home' ? "text-brand-terracotta" : "text-brand-mist"} />
                            <span className="text-xs font-medium uppercase tracking-widest truncate">Em Casa</span>
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
                      <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">Para qual serviço deseja agendar?</label>
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
                      <h3 className="text-2xl font-serif text-brand-ink">Escolha a data e horário</h3>
                    </div>
                    {/* DEBUG INFO - MODO DESENVOLVIMENTO */}
                    <div className="ml-9 mb-4">
                      <p className="text-[10px] text-brand-terracotta/60 font-mono">
                        DEBUG slots reais do dia: {availableSlots.length} | Data: {selectedDate}
                      </p>
                    </div>
                    <p className="text-xs text-brand-stone font-light mb-10 ml-9">Selecione o melhor momento para você.</p>
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
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      {selectedDate ? (
                        availableSlots.length > 0 ? (
                          availableSlots.map(time => (
                            <button key={time} onClick={() => setSelectedTime(time)} className={cn("py-3.5 rounded-xl border transition-all text-[11px] font-bold flex items-center justify-center gap-1.5", selectedTime === time ? "bg-brand-ink text-brand-white border-brand-ink" : "bg-brand-white border-brand-mist hover:border-brand-ink text-brand-stone")}>
                              <Clock size={12} className={selectedTime === time ? "text-brand-terracotta" : "text-brand-mist/40"} />
                              {time}
                            </button>
                          ))
                        ) : (
                          <div className="col-span-3 py-16 text-center bg-brand-linen/30 rounded-3xl border border-dashed border-brand-mist px-6">
                            <p className="text-sm text-brand-terracotta font-bold uppercase tracking-widest mb-2">Alta procura neste dia</p>
                            <p className="text-xs text-brand-stone font-light mb-8">Todos os horários estão reservados. Quer ser avisado de desistências?</p>
                            <button 
                              onClick={() => setIsWaitlistOpen(true)}
                              className="flex items-center gap-3 bg-brand-ink text-brand-white px-7 py-4 rounded-full text-[10px] font-bold uppercase tracking-[0.18em] shadow-xl hover:bg-brand-terracotta transition-all mx-auto active:scale-95"
                            >
                              <Zap size={14} className="fill-brand-terracotta text-brand-terracotta" />
                              Entrar na lista prioritária
                            </button>
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
                    <h3 className="text-2xl font-serif text-brand-ink">Confirme seus dados</h3>
                  </div>
                  <p className="text-xs text-brand-stone font-light mb-10 ml-9">Revise as informações para solicitar seu agendamento.</p>
                  <div className="bg-brand-ink text-brand-white rounded-[40px] p-8 mb-10 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-terracotta/10 rounded-full -mr-32 -mt-32 blur-3xl opacity-40 group-hover:opacity-60 transition-opacity" />
                    <div className="flex flex-col relative z-10">
                      <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-terracotta mb-4">Resumo do Agendamento</span>
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <h4 className="text-2xl font-serif text-brand-linen">{selectedService?.name}</h4>
                          <div className="flex items-center gap-4 text-xs font-light text-brand-linen/60">
                            <span className="flex items-center gap-2">
                              <CalendarIcon size={14} className="text-brand-terracotta/60" /> 
                              {selectedDate ? (
                                (() => {
                                  const [year, month, day] = selectedDate.split('-').map(Number);
                                  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                                })()
                              ) : '--/--'}
                            </span>
                            <span className="w-px h-3 bg-brand-white/10" />
                            <span className="flex items-center gap-2"><Clock size={14} className="text-brand-terracotta/60" /> {selectedTime || '--:--'}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[8px] font-bold uppercase tracking-widest text-brand-linen/40 block mb-1">Total</span>
                          <span className="text-2xl font-serif text-brand-terracotta">{formatCurrency(calculateTotalPrice())}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                    <div className="space-y-4 mb-8">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">Seu Nome <span className="text-brand-terracotta">*</span></label>
                        <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nome completo" className={cn("w-full px-5 py-3.5 bg-brand-parchment border rounded-[18px] outline-none focus:ring-1 focus:ring-brand-ink transition-all text-xs", clientName.trim().length < 2 && bookingAttempted ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist")} />
                        {clientName.trim().length < 2 && bookingAttempted && <p className="text-[9px] text-brand-terracotta font-bold uppercase tracking-wider ml-2 mt-1">Digite seu nome completo</p>}
                      </div>
                      <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3 md:gap-4">
                        <div className="space-y-1.5 min-w-0">
                          <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">WhatsApp <span className="text-brand-terracotta">*</span></label>
                          <input type="tel" value={formatWhatsappDisplay(clientPhone)} onChange={(e) => setClientPhone(cleanWhatsapp(e.target.value))} placeholder="(85) 99999-9999" className={cn("w-full px-5 py-3.5 bg-brand-parchment border rounded-[18px] outline-none focus:ring-1 focus:ring-brand-ink transition-all text-xs min-w-0", !clientPhone && bookingAttempted ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist")} />
                          {!clientPhone && bookingAttempted && <p className="text-[9px] text-brand-terracotta font-bold uppercase tracking-wider ml-2 mt-1">WhatsApp obrigatório</p>}
                        </div>
                        <div className="space-y-1.5 min-w-0">
                          <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1 truncate">E-mail <span className="text-brand-terracotta">*</span></label>
                          <input 
                            type="email" 
                            inputMode="email"
                            autoComplete="email"
                            value={clientEmail} 
                            onChange={(e) => setClientEmail(e.target.value)} 
                            placeholder="Ex: seu@email.com" 
                            className={cn("w-full px-5 py-3.5 bg-brand-parchment border rounded-[18px] outline-none focus:ring-1 focus:ring-brand-ink transition-all text-xs min-w-0", !clientEmail && bookingAttempted ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist")} 
                          />
                          {!clientEmail && bookingAttempted && <p className="text-[9px] text-brand-terracotta font-bold uppercase tracking-wider ml-2 mt-1">E-mail obrigatório</p>}
                        </div>
                      </div>
                      
                      {isHomeService && (
                        <div className="space-y-6 pt-4 mt-4 border-t border-brand-mist/30">
                          <div className="flex items-center gap-2 mb-2">
                             <Home size={14} className="text-brand-terracotta" />
                             <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-ink">Endereço do Atendimento</span>
                          </div>
                          
                          <div className="grid grid-cols-4 gap-4">
                            <div className="col-span-3 space-y-1.5">
                              <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">Rua <span className="text-brand-terracotta">*</span></label>
                              <input 
                                type="text" placeholder="Nome da rua" 
                                value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)}
                                className={cn("w-full px-4 py-3 bg-brand-parchment border rounded-xl text-xs outline-none focus:ring-1 focus:ring-brand-ink transition-all", !addressStreet && bookingAttempted ? "border-brand-terracotta" : "border-brand-mist")}
                              />
                            </div>
                            <div className="col-span-1 space-y-1.5">
                              <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">Nº <span className="text-brand-terracotta">*</span></label>
                              <input 
                                type="text" placeholder="123" 
                                value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)}
                                className={cn("w-full px-2 py-3 bg-brand-parchment border rounded-xl text-xs text-center outline-none focus:ring-1 focus:ring-brand-ink transition-all", !addressNumber && bookingAttempted ? "border-brand-terracotta" : "border-brand-mist")}
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">Complemento</label>
                            <input 
                              type="text" placeholder="Apto, Bloco, etc." 
                              value={addressComplement} onChange={(e) => setAddressComplement(e.target.value)}
                              className="w-full px-4 py-3 bg-brand-parchment border border-brand-mist rounded-xl text-xs outline-none focus:ring-1 focus:ring-brand-ink transition-all"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">Bairro <span className="text-brand-terracotta">*</span></label>
                              <input 
                                type="text" placeholder="Sua vizinhança" 
                                value={addressNeighborhood || (selectedArea?.name || '')} onChange={(e) => setAddressNeighborhood(e.target.value)}
                                className={cn("w-full px-4 py-3 bg-brand-parchment border rounded-xl text-xs outline-none focus:ring-1 focus:ring-brand-ink transition-all", !addressNeighborhood && !selectedArea?.name && bookingAttempted ? "border-brand-terracotta" : "border-brand-mist")}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">Cidade <span className="text-brand-terracotta">*</span></label>
                              <input 
                                type="text" placeholder="Cidade" 
                                value={addressCity || (profile?.city || '')} onChange={(e) => setAddressCity(e.target.value)}
                                className={cn("w-full px-4 py-3 bg-brand-parchment border rounded-xl text-xs outline-none focus:ring-1 focus:ring-brand-ink transition-all", !addressCity && !profile?.city && bookingAttempted ? "border-brand-terracotta" : "border-brand-mist")}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">Ponto de Referência</label>
                              <input 
                                type="text" placeholder="Perto de onde?" 
                                value={addressReference} onChange={(e) => setAddressReference(e.target.value)}
                                className="w-full px-4 py-3 bg-brand-parchment border border-brand-mist rounded-xl text-xs outline-none focus:ring-1 focus:ring-brand-ink transition-all"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <p className="text-[9px] text-brand-stone/70 font-medium uppercase tracking-wider ml-2 mt-4 leading-relaxed italic">
                        Você receberá a confirmação e atualizações do agendamento por e-mail.
                      </p>
                    </div>
<div className="hidden md:block">
  <PremiumButton variant="terracotta" className="w-full py-7" disabled={!clientName.trim() || clientName.trim().length < 2 || !clientPhone || !clientEmail || (isHomeService && (!addressStreet.trim() || !addressNumber.trim()))} onClick={handleBooking} loading={bookingLoading} loadingText="Enviando pedido...">Confirmar agendamento <Check size={18} className="ml-1" /></PremiumButton>
</div>
                </motion.div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && step >= 2 && step <= 4 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            exit={{ y: 100, opacity: 0 }} 
            className="fixed bottom-0 left-0 right-0 z-[250] md:hidden p-6 bg-gradient-to-t from-brand-white via-brand-white to-transparent pt-16 pointer-events-none"
          >
            <div className="pointer-events-auto">
              <PremiumButton variant="terracotta" className="w-full py-7" disabled={(step === 2 && (!selectedService || (isHomeService && profile?.serviceAreaType === 'custom' && !selectedArea))) || (step === 3 && (!selectedDate || !selectedTime)) || (step === 4 && (!clientName.trim() || clientName.trim().length < 2 || !clientPhone || !clientEmail || (isHomeService && (!addressStreet.trim() || !addressNumber.trim()))))} loading={step === 4 && bookingLoading} onClick={() => { if (step === 2) setStep(3); else if (step === 3) setStep(4); else if (step === 4) handleBooking(); }}>
                {step === 2 && (selectedService ? `Agendar ${selectedService.name.split(' ')[0]}` : 'Escolher serviço')}
                {step === 3 && (selectedTime ? `Confirmar para ${selectedTime}` : 'Escolher horário')}
                {step === 4 && 'Confirmar agendamento'}
                <ArrowRight size={18} className="ml-1" />
              </PremiumButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {step === 5 && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="fixed inset-0 bg-brand-white z-[300] flex flex-col items-center p-8 text-center overflow-y-auto no-scrollbar pt-16 pb-32 md:justify-center md:pt-8 md:pb-8"
          >
            <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", damping: 15 }} className="w-24 h-24 bg-brand-linen text-brand-terracotta rounded-full flex items-center justify-center mb-8 shrink-0"><Check size={48} /></motion.div>
            <h2 className="text-3xl md:text-4xl font-serif text-brand-ink mb-3 leading-tight">{profile?.name.split(' ')[0]} recebeu seu pedido</h2>
            <p className="body-text text-brand-stone mb-10 max-w-xs mx-auto">
              Você receberá a confirmação e atualizações do agendamento por e-mail.
              <span className="block mt-2 text-[10px] text-brand-stone italic">
                Verifique sua caixa de entrada e spam ✨
              </span>
            </p>
            {selectedService && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-brand-parchment rounded-3xl border border-brand-mist p-8 w-full max-w-md mb-12 text-left shadow-sm">
                <div className="flex justify-between items-center mb-6 border-b border-brand-mist/50 pb-4">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-brand-stone block">Resumo da solicitação</span>
                  {reservationCode && (
                    <div className="text-right">
                      <span className="text-[7px] text-brand-stone uppercase tracking-widest block mb-0.5">Código</span>
                      <span className="text-[10px] font-mono font-bold text-brand-terracotta">{reservationCode}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] text-brand-stone uppercase tracking-wide block mb-1">Serviço</span>
                    <span className="font-serif text-brand-ink">{selectedService.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] text-brand-stone uppercase tracking-wide block mb-1">Data</span>
                      <span className="text-sm font-medium text-brand-ink">
                        {selectedDate ? (
                          (() => {
                            const [year, month, day] = selectedDate.split('-').map(Number);
                            return new Date(year, month - 1, day).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
                          })()
                        ) : '---'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-brand-stone uppercase tracking-wide block mb-1">Horário</span>
                      <span className="text-sm font-medium text-brand-ink">{selectedTime}</span>
                    </div>
                  </div>
                  
                  {/* Link de Gerenciamento - Temporário conforme pedido */}
                  {appointmentToken && (
                    <div className="mt-4 pt-4 border-t border-brand-mist/30">
                      <span className="text-[7px] text-brand-stone uppercase tracking-widest block mb-1">Link de Gerenciamento</span>
                      <p className="text-[8px] font-mono text-brand-ink/60 break-all">{window.location.origin}/r/{appointmentToken}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
            <div className="w-full max-w-sm space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PremiumButton 
                  variant="secondary" 
                  className="w-full py-4 !text-[9px]" 
                  onClick={() => { 
                    if (!selectedDate || !selectedTime) return;
                    const [year, month, day] = selectedDate.split('-').map(Number);
                    const [hours, minutes] = selectedTime.split(':').map(Number);
                    const start = new Date(year, month - 1, day, hours, minutes);
                    const end = new Date(start.getTime() + (Number(selectedService?.duration) || 60) * 60000); 
                    const formatTemplate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'; 
                    const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('Reserva: ' + selectedService?.name)}&dates=${formatTemplate(start)}/${formatTemplate(end)}&details=${encodeURIComponent('Agendamento realizado via Nera.')}&location=${encodeURIComponent(profile?.city || '')}`; 
                    window.open(url, '_blank'); 
                  }}
                >
                  <CalendarIcon size={14} /> Adicionar calendário
                </PremiumButton>
                
                {appointmentToken && (
                  <div className="space-y-3">
                    <button 
                      onClick={() => { window.location.href = `/r/${appointmentToken}`; }}
                      className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-brand-ink text-brand-white rounded-full text-[9px] font-bold uppercase tracking-widest hover:bg-brand-espresso transition-all border border-brand-ink shadow-lg shadow-brand-ink/10"
                    >
                      <Settings size={14} className="animate-spin-slow" /> Gerenciar reserva
                    </button>
                  </div>
                )}

                <a 
                  href={buildWhatsappLink(
                    profile?.whatsapp || '', 
                    generateBookingConfirmationMessage(
                      selectedService?.name || '',
                      selectedDate,
                      selectedTime
                    )
                  )} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center justify-center gap-2 px-6 py-4 bg-brand-linen text-brand-ink rounded-full text-[9px] font-medium uppercase tracking-widest hover:bg-brand-mist transition-all border border-brand-mist sm:col-span-2"
                >
                  <MessageCircle size={14} /> Falar com a profissional
                </a>
              </div>
              <div className="bg-brand-linen/30 border border-brand-mist rounded-[32px] p-6 md:p-8 mt-8 md:mt-12 text-center w-full">
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
       <WaitlistModal 
        profile={profile} 
        services={services} 
        open={isWaitlistOpen} 
        onClose={() => setIsWaitlistOpen(false)} 
        initialDate={selectedDate}
        initialService={selectedService}
      />
    </>
  );
}
