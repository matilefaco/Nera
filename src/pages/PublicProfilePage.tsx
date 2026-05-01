import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  MapPin, 
  MessageCircle,
  Scissors,
  Star,
  Info,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { DateTime } from 'luxon';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration?: number;
}

interface Professional {
  id: string;
  slug: string;
  name: string;
  avatar?: string;
  bio?: string;
  headline?: string;
  specialty?: string;
  services: Service[];
  studioAddress?: {
    city?: string;
    neighborhood?: string;
    street?: string;
    number?: string;
  };
}

enum BookingStep {
  SERVICES = 1,
  DATE_TIME = 2,
  CLIENT_INFO = 3,
  REVIEW = 4
}

export const PublicProfilePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [step, setStep] = useState<BookingStep>(BookingStep.SERVICES);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [clientInfo, setClientInfo] = useState({
    name: '',
    phone: '',
    email: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        const response = await fetch(`/api/public/profile/${slug}`);
        if (!response.ok) throw new Error('Profissional não encontrado');
        const data = await response.json();
        setProfessional(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    if (slug) loadProfile();
  }, [slug]);

  const handleBookingSubmit = async () => {
    if (!professional || !selectedService || !selectedDate || !selectedTime) return;

    setSubmitting(true);
    const payload = {
      professionalId: professional.id,
      serviceId: selectedService.id,
      date: selectedDate,
      time: selectedTime,
      client: {
        name: clientInfo.name,
        phone: clientInfo.phone,
        email: clientInfo.email
      }
    };

    console.log("BOOKING PAYLOAD:", payload);

    try {
      const response = await fetch('/api/public/create-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      if (response.ok && result.success) {
        setSuccess(true);
      } else {
        alert('Erro: ' + (result.error || 'Ocorreu um problema ao agendar.'));
      }
    } catch (err: any) {
      console.error("Booking Error:", err);
      alert('Erro de conexão ao processar agendamento.');
    } finally {
      setSubmitting(false);
    }
  };

  const nextStep = () => {
    if (step === BookingStep.SERVICES && !selectedService) return;
    if (step === BookingStep.DATE_TIME && (!selectedDate || !selectedTime)) return;
    if (step === BookingStep.CLIENT_INFO && (!clientInfo.name || !clientInfo.phone)) return;
    setStep(s => s + 1);
  };

  const prevStep = () => setStep(s => s - 1);

  // Generate some slots for display (mock logic)
  const timeSlots = useMemo(() => [
    '09:00', '09:30', '10:00', '11:00', '14:00', '15:00', '15:30', '16:00', '17:00'
  ], []);

  const dates = useMemo(() => {
    const list = [];
    for (let i = 0; i < 7; i++) {
        list.push(DateTime.now().plus({ days: i }));
    }
    return list;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FBFBF9]">
        <div className="w-12 h-12 border-4 border-[#1A1A1A] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !professional) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FBFBF9] p-4 text-center">
        <div>
          <h1 className="text-2xl font-serif mb-2">Ops! {error || 'Profissional não encontrado'}</h1>
          <p className="text-gray-500 mb-6">Pode ser que o link esteja incorreto ou o perfil não exista mais.</p>
          <a href="/" className="px-6 py-2 bg-[#1A1A1A] text-white rounded-full">Voltar para Início</a>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#FBFBF9] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl text-center border border-gray-100"
        >
          <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check size={40} />
          </div>
          <h1 className="text-3xl font-serif mb-4">Agendado com Sucesso!</h1>
          <p className="text-gray-600 mb-8 leading-relaxed">
            Seu agendamento foi confirmado. Você receberá um lembrete em breve pelo WhatsApp.
          </p>
          <div className="bg-gray-50 rounded-2xl p-4 mb-8 text-left space-y-2">
            <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">Resumo</p>
            <p className="font-semibold text-gray-800">{selectedService?.name}</p>
            <p className="text-gray-600">
              {DateTime.fromISO(selectedDate!).setLocale('pt-BR').toFormat('dd \'de\' MMMM')} às {selectedTime}
            </p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-4 bg-[#1A1A1A] text-white rounded-2xl font-medium"
          >
            Fazer outro agendamento
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBFBF9] pb-24 lg:pb-0">
      {/* Premium Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 backdrop-blur-md bg-white/80">
        <div className="max-w-screen-xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 border border-gray-100">
              {professional.avatar ? (
                <img src={professional.avatar} alt={professional.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                  <User size={18} />
                </div>
              )}
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 leading-tight">{professional.name}</h2>
              <p className="text-xs text-gray-500 font-medium tracking-wide uppercase">{professional.specialty || 'Profissional Nera'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <button className="p-2 text-gray-400 hover:text-gray-900 transition-colors">
                <Info size={20} />
             </button>
          </div>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto lg:grid lg:grid-cols-12 lg:gap-8 px-4 py-8 lg:py-12">
        
        {/* Profile Info - Fixed on Desktop */}
        <div className="lg:col-span-4 mb-8 lg:mb-0">
          <div className="lg:sticky lg:top-28">
            <div className="mb-6">
              <h1 className="text-4xl lg:text-5xl font-serif text-[#1A1A1A] leading-tight mb-4">
                {professional.headline || `Conheça ${professional.name}`}
              </h1>
              <p className="text-lg text-gray-600 leading-relaxed max-w-sm">
                {professional.bio || 'Especialista dedicada em oferecer o melhor atendimento e resultados impecáveis.'}
              </p>
            </div>

            <div className="space-y-4 pt-6 border-t border-gray-100">
              <div className="flex items-start gap-3 text-gray-600">
                <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0 border border-gray-50">
                  <MapPin size={16} />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {professional.studioAddress?.neighborhood || professional.studioAddress?.city || 'Localização sob consulta'}
                  </p>
                  <p className="text-sm opacity-70">
                    {professional.studioAddress?.street} {professional.studioAddress?.number}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-gray-600">
                <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0 border border-gray-50">
                  <Star size={16} className="text-amber-400" fill="currentColor" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Premium Partner</p>
                  <p className="text-sm opacity-70">Verificado pela Nera</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Booking Card */}
        <main className="lg:col-span-8">
          <div className="bg-white rounded-3xl shadow-xl shadow-black/[0.03] border border-gray-100 overflow-hidden min-h-[500px] flex flex-col">
            
            {/* Steps Indicator */}
            <div className="px-6 pt-6 pb-2">
               <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Passo {step} de 4</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((s) => (
                      <div 
                        key={s} 
                        className={cn(
                          "h-1 rounded-full transition-all duration-300",
                          s === step ? "w-8 bg-[#1A1A1A]" : "w-4 bg-gray-100"
                        )} 
                      />
                    ))}
                  </div>
               </div>
            </div>

            <div className="flex-1 p-6 lg:p-10">
              <AnimatePresence mode="wait">
                {step === BookingStep.SERVICES && (
                  <motion.div 
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <h2 className="text-2xl font-serif mb-6">Selecione o Serviço</h2>
                    <div className="grid gap-4">
                      {professional.services.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                          <Scissors className="mx-auto mb-4 text-gray-300" size={32} />
                          <p className="text-gray-500">Nenhum serviço disponível no momento.</p>
                        </div>
                      ) : (
                        professional.services.map((service) => (
                          <button
                            key={service.id}
                            onClick={() => {
                              setSelectedService(service);
                              setStep(BookingStep.DATE_TIME);
                            }}
                            className={cn(
                              "w-full text-left p-6 rounded-2xl border transition-all duration-300 group",
                              selectedService?.id === service.id 
                                ? "border-[#1A1A1A] bg-gray-50 ring-1 ring-[#1A1A1A]" 
                                : "border-gray-100 hover:border-gray-300 hover:bg-gray-50/50"
                            )}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h3 className="font-semibold text-lg text-gray-900 group-hover:text-black">{service.name}</h3>
                                {service.duration && (
                                  <div className="flex items-center gap-1.5 text-gray-400 text-sm mt-1">
                                    <Clock size={14} />
                                    <span>{service.duration} min</span>
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-gray-900 text-lg">
                                  R$ {Math.floor(service.price).toLocaleString('pt-BR')}
                                </p>
                              </div>
                            </div>
                            {service.description && (
                              <p className="text-sm text-gray-500 line-clamp-2 mt-2 leading-relaxed">
                                {service.description}
                              </p>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}

                {step === BookingStep.DATE_TIME && (
                  <motion.div 
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <div className="flex items-center justify-between mb-8">
                       <h2 className="text-2xl font-serif">Escolha Data e Hora</h2>
                       <button onClick={prevStep} className="text-sm text-gray-400 hover:text-gray-900 flex items-center gap-1">
                         <ChevronLeft size={16} /> Alterar serviço
                       </button>
                    </div>

                    {/* Date Selector */}
                    <div className="mb-10">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Selecione o Dia</p>
                      <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar -mx-2 px-2">
                        {dates.map((d) => {
                          const dateStr = d.toISODate();
                          const isSelected = selectedDate === dateStr;
                          return (
                            <button
                              key={dateStr || 'date'}
                              onClick={() => setSelectedDate(dateStr)}
                              className={cn(
                                "flex flex-col items-center justify-center min-w-[70px] h-[90px] rounded-2xl border transition-all duration-300",
                                isSelected 
                                  ? "bg-[#1A1A1A] border-[#1A1A1A] text-white shadow-lg shadow-black/20" 
                                  : "bg-white border-gray-100 hover:border-gray-300 text-gray-600"
                              )}
                            >
                              <span className="text-xs uppercase font-medium opacity-60 leading-none mb-2">
                                {d.setLocale('pt-BR').toFormat('ccc')}
                              </span>
                              <span className="text-xl font-bold">
                                {d.day}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Time Slots */}
                    <div className={cn("transition-opacity duration-500", !selectedDate && "opacity-30 pointer-events-none")}>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Horários Disponíveis</p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        {timeSlots.map((time) => (
                          <button
                            key={time}
                            onClick={() => {
                                setSelectedTime(time);
                                setStep(BookingStep.CLIENT_INFO);
                            }}
                            className={cn(
                              "py-3 px-4 rounded-xl border text-sm font-semibold transition-all duration-300",
                              selectedTime === time 
                                ? "bg-[#1A1A1A] border-[#1A1A1A] text-white" 
                                : "bg-white border-gray-100 hover:border-gray-300 text-gray-600"
                            )}
                          >
                            {time}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === BookingStep.CLIENT_INFO && (
                  <motion.div 
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <div className="flex items-center justify-between mb-8">
                       <h2 className="text-2xl font-serif">Seus Dados</h2>
                       <button onClick={prevStep} className="text-sm text-gray-400 hover:text-gray-900 flex items-center gap-1">
                         <ChevronLeft size={16} /> Data e hora
                       </button>
                    </div>

                    <div className="space-y-6">
                      <div className="group">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 group-focus-within:text-black">
                          Nome Completo
                        </label>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" size={20} />
                          <input 
                            type="text" 
                            value={clientInfo.name}
                            onChange={e => setClientInfo({...clientInfo, name: e.target.value})}
                            placeholder="Como deseja ser chamado?"
                            className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl py-4 pl-12 pr-4 focus:bg-white focus:border-[#1A1A1A] outline-none transition-all duration-300"
                          />
                        </div>
                      </div>

                      <div className="group">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 group-focus-within:text-black">
                          WhatsApp
                        </label>
                        <div className="relative">
                          <MessageCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" size={20} />
                          <input 
                            type="tel" 
                            value={clientInfo.phone}
                            onChange={e => setClientInfo({...clientInfo, phone: e.target.value})}
                            placeholder="(00) 00000-0000"
                            className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl py-4 pl-12 pr-4 focus:bg-white focus:border-[#1A1A1A] outline-none transition-all duration-300"
                          />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2 px-2">Usaremos seu WhatsApp apenas para enviar o lembrete de agendamento.</p>
                      </div>

                      <div className="group">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 group-focus-within:text-black">
                          Email (Opcional)
                        </label>
                        <input 
                          type="email" 
                          value={clientInfo.email}
                          onChange={e => setClientInfo({...clientInfo, email: e.target.value})}
                          placeholder="seu@email.com"
                          className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl py-4 px-4 focus:bg-white focus:border-[#1A1A1A] outline-none transition-all duration-300"
                        />
                      </div>
                    </div>

                    <button
                      onClick={nextStep}
                      disabled={!clientInfo.name || !clientInfo.phone}
                      className="w-full mt-10 py-5 rounded-2xl bg-[#1A1A1A] text-white font-bold flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed group transition-all"
                    >
                      Continuar para Revisão
                      <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </motion.div>
                )}

                {step === BookingStep.REVIEW && (
                  <motion.div 
                    key="step4"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <div className="flex items-center justify-between mb-8">
                       <h2 className="text-2xl font-serif">Conferir e Confirmar</h2>
                       <button onClick={prevStep} className="text-sm text-gray-400 hover:text-gray-900 flex items-center gap-1">
                         <ChevronLeft size={16} /> Seus dados
                       </button>
                    </div>

                    <div className="bg-gray-50 rounded-3xl p-8 space-y-6 border border-gray-100">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Serviço</p>
                          <h3 className="text-xl font-semibold text-gray-900">{selectedService?.name}</h3>
                          <p className="text-gray-500">{selectedService?.duration} min</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-2xl">R$ {selectedService?.price}</p>
                        </div>
                      </div>

                      <div className="h-px bg-gray-200" />

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Data</p>
                          <p className="font-semibold text-gray-800">
                            {DateTime.fromISO(selectedDate!).setLocale('pt-BR').toFormat('dd \'de\' MMMM')}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Horário</p>
                          <p className="font-semibold text-gray-800">{selectedTime}</p>
                        </div>
                      </div>

                      <div className="h-px bg-gray-200" />

                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shrink-0 border border-gray-100">
                           <User size={20} className="text-gray-400" />
                         </div>
                         <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-0.5">Cliente</p>
                            <p className="font-semibold text-gray-800">{clientInfo.name}</p>
                            <p className="text-sm text-gray-500">{clientInfo.phone}</p>
                         </div>
                      </div>
                    </div>

                    <div className="mt-10 flex items-center gap-4 text-gray-400 text-sm justify-center mb-6">
                       <ShieldCheck size={18} className="text-green-500" />
                       Agendamento 100% Seguro
                    </div>

                    <button
                      onClick={handleBookingSubmit}
                      disabled={submitting}
                      className="w-full py-5 rounded-2xl bg-[#1A1A1A] text-white font-bold text-lg shadow-xl shadow-black/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          Confirmar Agora
                          <ArrowRight size={20} />
                        </>
                      )}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* Footer Summary - Mobile Only Sticky */}
            <div className="lg:hidden p-4 bg-white border-t border-gray-100 flex items-center justify-between sticky bottom-0 z-40">
               <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total</p>
                  <p className="font-bold text-xl text-gray-900">
                    {selectedService ? `R$ ${selectedService.price}` : '---'}
                  </p>
               </div>
               <button 
                onClick={() => {
                  if (step < 4) nextStep();
                  else handleBookingSubmit();
                }}
                disabled={(step === 1 && !selectedService) || (step === 2 && !selectedTime) || submitting}
                className="px-8 py-4 bg-[#1A1A1A] text-white font-bold rounded-2xl shadow-lg shadow-black/10 active:scale-95 transition-all disabled:opacity-30"
               >
                 {step === 4 ? 'Confirmar' : 'Próximo'}
               </button>
            </div>
          </div>
          
          <div className="mt-8 text-center">
             <p className="text-xs text-gray-400 font-medium uppercase tracking-[0.2em]">Powered by Nera Professional</p>
          </div>
        </main>
      </div>
    </div>
  );
};
