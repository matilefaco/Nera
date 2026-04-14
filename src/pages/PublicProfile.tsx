import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, Phone, Calendar as CalendarIcon, Clock, 
  CheckCircle2, ChevronRight, ArrowLeft, Sparkles,
  ShieldCheck, Instagram, Heart, Info, MessageCircle,
  ExternalLink, ArrowDown
} from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { toast } from 'sonner';

export default function PublicProfile() {
  const { slug } = useParams();
  const [profile, setProfile] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const servicesRef = useRef<HTMLDivElement>(null);
  
  // Booking Flow State
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedArea, setSelectedArea] = useState<any>(null);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!slug) {
        setLoading(false);
        return;
      }
      try {
        const q = query(collection(db, 'users'), where('slug', '==', slug));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const userData = snapshot.docs[0].data();
          setProfile({ ...userData, uid: snapshot.docs[0].id });
          
          const servicesQ = query(collection(db, 'services'), where('professionalId', '==', userData.uid || snapshot.docs[0].id), where('active', '==', true));
          const servicesSnapshot = await getDocs(servicesQ);
          setServices(servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error("Error fetching public profile:", error);
        toast.error("Erro ao carregar perfil");
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [slug]);

  const calculateTotalPrice = () => {
    if (!selectedService) return 0;
    const basePrice = Number(selectedService.price) || 0;
    
    if (profile?.serviceMode === 'studio') return basePrice;
    
    // Both 'included' and 'extra' add the area fee to the base service price.
    // The difference is purely visual in how it's presented to the client.
    // In the new model, we always sum them but show only the final value.
    return basePrice + (selectedArea?.fee || 0);
  };

  const handleBooking = async () => {
    if (!profile || !selectedService) return;
    setBookingLoading(true);
    try {
      const totalPrice = calculateTotalPrice();
      await addDoc(collection(db, 'appointments'), {
        professionalId: profile.uid,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        price: selectedService.price,
        travelFee: profile.pricingStrategy === 'extra' ? (selectedArea?.fee || 0) : 0,
        totalPrice: totalPrice,
        neighborhood: selectedArea?.name || '',
        address: clientAddress,
        clientName,
        clientPhone,
        date: selectedDate,
        time: selectedTime,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      setStep(5); // Success
    } catch (error) {
      console.error("Booking error:", error);
      toast.error('Erro ao agendar horário');
    } finally {
      setBookingLoading(false);
    }
  };

  const scrollToServices = () => {
    servicesRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const addToCalendar = () => {
    if (!selectedService || !profile) return;
    const [year, month, day] = selectedDate.split('-');
    const [hour, minute] = selectedTime.split(':');
    const start = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
    const end = new Date(start.getTime() + (Number(selectedService.duration || 60) * 60000));
    
    const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(selectedService.name + ' com ' + profile.name)}&dates=${start.toISOString().replace(/-|:|\.\d\d\d/g, "")}/${end.toISOString().replace(/-|:|\.\d\d\d/g, "")}&details=${encodeURIComponent('Agendamento via Marca Aí')}&location=${encodeURIComponent(profile.address || profile.city || '')}`;
    window.open(url, '_blank');
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-brand-cream">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="text-brand-rose">
        <Sparkles size={32} />
      </motion.div>
    </div>
  );
  
  if (!profile) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-brand-cream p-6 text-center">
      <div className="w-20 h-20 bg-brand-rose/10 text-brand-rose rounded-full flex items-center justify-center mb-6">
        <Info size={40} />
      </div>
      <h1 className="text-2xl font-serif font-bold text-brand-dark mb-2">Profissional não encontrada</h1>
      <p className="text-brand-gray mb-8">O link que você acessou pode estar incorreto ou o perfil foi removido.</p>
      <Link to="/" className="bg-brand-dark text-white px-8 py-4 rounded-full font-bold text-xs uppercase tracking-widest">
        Voltar para o início
      </Link>
    </div>
  );

  const isHomeService = profile.serviceMode === 'home' || profile.serviceMode === 'hybrid';

  return (
    <div className="min-h-screen bg-brand-cream flex flex-col">
      {/* Header / Hero */}
      <header className="bg-white pt-24 pb-20 px-6 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-[0.02] pointer-events-none">
          <div className="absolute top-10 left-10 w-64 h-64 border border-brand-dark rounded-full" />
          <div className="absolute bottom-10 right-10 w-96 h-96 border border-brand-dark rounded-full" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 max-w-2xl mx-auto"
        >
          <div className="w-32 h-32 bg-brand-rose-light rounded-full mx-auto mb-8 flex items-center justify-center text-brand-rose border border-brand-dark/5 shadow-2xl overflow-hidden">
            {profile.avatar ? (
              <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="text-5xl font-serif font-bold">{profile.name?.[0] || '?'}</span>
            )}
          </div>

          <div className="flex flex-col items-center gap-4 mb-8">
            <h1 className="display-hero text-brand-dark">{profile.name}</h1>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand-rose-light rounded-full border border-brand-rose/10">
              <ShieldCheck size={16} className="text-brand-rose" />
              <span className="label-text text-brand-rose">Profissional verificada • 100% confirmações recentes</span>
            </div>
          </div>
          
          <p className="label-text text-brand-gray tracking-[0.3em] mb-6">{profile.specialty || 'Especialista'}</p>
          
          <p className="text-brand-gray text-lg md:text-xl mb-10 leading-relaxed font-light italic px-4">
            "{profile.bio || 'Bem-vinda ao meu espaço de beleza e cuidado. Agende seu horário e sinta-se única.'}"
          </p>

          <div className="flex flex-wrap items-center justify-center gap-6 mb-12 text-[10px] font-bold uppercase tracking-widest text-brand-gray">
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-brand-dark/20" />
              <span>{isHomeService ? `Atende em domicílio em ${profile.city}` : profile.city}</span>
            </div>
            {profile.instagram && (
              <a href={`https://instagram.com/${profile.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-brand-rose transition-colors">
                <Instagram size={14} className="text-brand-dark/20" />
                <span className="editorial-underline">@{profile.instagram.replace('@', '')}</span>
              </a>
            )}
            {profile.whatsapp && (
              <a href={`https://wa.me/${profile.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-brand-rose transition-colors">
                <MessageCircle size={14} className="text-brand-dark/20" />
                <span className="editorial-underline">WhatsApp</span>
              </a>
            )}
          </div>

          <div className="flex flex-col items-center gap-4">
            <button 
              onClick={scrollToServices}
              className="w-full sm:w-auto bg-brand-dark text-white px-8 sm:px-16 py-6 sm:py-7 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-brand-dark/90 transition-all premium-shadow flex flex-col items-center gap-1"
            >
              <span>Garantir meu horário</span>
              <span className="text-[9px] opacity-40 font-normal tracking-normal normal-case">Leva menos de 30 segundos</span>
            </button>
          </div>
        </motion.div>
      </header>

      {/* Gallery Section */}
      {profile.portfolio && profile.portfolio.length > 0 && (
        <section className="bg-white py-24 px-6 border-t border-brand-dark/5">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="heading-section mb-4">M e u  t r a b a l h o</h2>
              <p className="text-brand-gray text-sm font-light">Resultados reais e personalizados.</p>
            </div>
            
            <div className="space-y-16">
              {Object.entries(
                profile.portfolio.reduce((acc: any, item: any) => {
                  const cat = item.category || 'Geral';
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(item);
                  return acc;
                }, {})
              ).map(([category, items]: [string, any]) => (
                <div key={category} className="space-y-6">
                  <h3 className="text-[10px] font-bold text-brand-dark uppercase tracking-[0.3em] ml-2">{category}</h3>
                  <div className="flex gap-6 overflow-x-auto pb-8 snap-x no-scrollbar -mx-2 px-2">
                    {items.map((item: any, i: number) => (
                      <div key={i} className="min-w-[280px] md:min-w-[320px] aspect-[4/5] bg-brand-cream rounded-[2.5rem] overflow-hidden border border-brand-dark/5 snap-start shadow-sm hover:shadow-xl transition-all duration-500 group">
                        <img 
                          src={item.url} 
                          alt={`${category} ${i}`} 
                          className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <main ref={servicesRef} className="flex-1 max-w-2xl mx-auto w-full px-6 py-24">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div className="text-center mb-16">
                <h2 className="heading-section mb-4">Escolha o Serviço</h2>
                <p className="text-brand-gray text-sm font-light">Selecione o procedimento que deseja realizar.</p>
              </div>

              <div className="space-y-6">
                {services.length > 0 ? (
                  services.map(service => (
                    <motion.button 
                      key={service.id}
                      whileHover={{ y: -4 }}
                      onClick={() => { setSelectedService(service); setStep(2); }}
                      className="w-full bg-white p-10 rounded-[3rem] border border-brand-dark/5 text-left flex items-center justify-between hover:border-brand-rose/30 transition-all premium-shadow group"
                    >
                      <div className="flex-1 pr-10">
                        <h4 className="font-serif italic text-2xl mb-2 group-hover:text-brand-rose transition-colors">{service.name}</h4>
                        <p className="text-brand-gray text-sm mb-6 font-light leading-relaxed max-w-md">{service.description || 'Atendimento personalizado com foco no seu bem-estar.'}</p>
                        <div className="flex items-center gap-8 text-[10px] text-brand-gray font-bold uppercase tracking-[0.2em]">
                          <span className="flex items-center gap-2"><Clock size={14} className="opacity-40" /> {service.duration} min</span>
                          <span className="text-brand-dark font-serif italic lowercase tracking-normal text-lg">a partir de {formatCurrency(service.price)}</span>
                        </div>
                      </div>
                      <div className="w-14 h-14 rounded-full bg-brand-cream flex items-center justify-center text-brand-dark/10 group-hover:bg-brand-dark group-hover:text-white transition-all shrink-0">
                        <ChevronRight size={28} />
                      </div>
                    </motion.button>
                  ))
                ) : (
                  <div className="text-center py-24 bg-white/50 rounded-[3rem] border-2 border-dashed border-brand-dark/5">
                    <Sparkles size={32} className="text-brand-dark/10 mx-auto mb-4" />
                    <p className="text-brand-gray font-serif italic text-lg">Nenhum serviço disponível no momento.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}>
              <button onClick={() => setStep(1)} className="flex items-center gap-2 text-brand-gray text-[10px] font-bold uppercase tracking-widest mb-12 hover:text-brand-dark transition-colors">
                <ArrowLeft size={14} /> Voltar aos serviços
              </button>
              
              <div className="text-center mb-16">
                <h2 className="heading-section mb-4">Escolha a data</h2>
                <p className="text-brand-gray text-sm font-light">Selecione o melhor dia para você.</p>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-7 gap-3 mb-16">
                {[0, 1, 2, 3, 4, 5, 6].map(offset => {
                  const date = new Date();
                  date.setDate(date.getDate() + offset);
                  const isSelected = selectedDate === date.toISOString().split('T')[0];
                  return (
                    <button 
                      key={offset}
                      onClick={() => setSelectedDate(date.toISOString().split('T')[0])}
                      className={`h-24 rounded-2xl flex flex-col items-center justify-center transition-all ${isSelected ? 'bg-brand-dark text-white premium-shadow scale-105' : 'bg-white border border-brand-dark/5 hover:border-brand-dark/20'}`}
                    >
                      <span className="text-[10px] font-bold uppercase opacity-40 mb-2">
                        {date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
                      </span>
                      <span className="text-2xl font-serif font-bold">{date.getDate()}</span>
                    </button>
                  );
                })}
              </div>
              
              {selectedDate && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="text-center mb-10">
                    <h3 className="text-xl font-serif font-medium mb-2">Horários disponíveis</h3>
                    <p className="text-brand-gray text-xs font-bold uppercase tracking-widest">{new Date(selectedDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</p>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                    {['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'].map(time => (
                      <button 
                        key={time}
                        onClick={() => { setSelectedTime(time); setStep(3); }}
                        className="py-5 bg-white rounded-2xl border border-brand-dark/5 font-bold hover:border-brand-dark/20 hover:bg-brand-cream transition-all text-lg"
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}>
              <button onClick={() => setStep(2)} className="flex items-center gap-2 text-brand-gray text-[10px] font-bold uppercase tracking-widest mb-12 hover:text-brand-dark transition-colors">
                <ArrowLeft size={14} /> Voltar para a data
              </button>
              
              {isHomeService ? (
                <>
                  <div className="text-center mb-16">
                    <h2 className="heading-section mb-4">Selecione sua região</h2>
                    <p className="text-brand-gray text-sm font-light italic">Os valores já incluem o deslocamento.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    {profile.serviceAreas?.map((area: any) => (
                      <button 
                        key={area.name}
                        onClick={() => { setSelectedArea(area); setStep(4); }}
                        className="bg-white p-8 rounded-[2rem] border border-brand-dark/5 text-left hover:border-brand-rose/30 transition-all premium-shadow flex justify-between items-center group"
                      >
                        <div>
                          <span className="text-lg font-bold block mb-1 group-hover:text-brand-rose transition-colors">{area.name}</span>
                          <span className="text-[10px] text-brand-gray font-bold uppercase tracking-widest">
                            Valor final: {formatCurrency(Number(selectedService?.price || 0) + (area.fee || 0))}
                          </span>
                        </div>
                        <ChevronRight size={20} className="text-brand-dark/10 group-hover:text-brand-rose transition-colors" />
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-20 bg-white rounded-[3rem] border border-brand-dark/5 premium-shadow">
                  <MapPin size={32} className="text-brand-rose mx-auto mb-4" />
                  <h3 className="text-xl font-serif font-bold mb-2">Local do Atendimento</h3>
                  <p className="text-brand-gray font-light mb-8 px-8">{profile.address || profile.city}</p>
                  <button onClick={() => setStep(4)} className="bg-brand-dark text-white px-12 py-5 rounded-full font-bold text-xs uppercase tracking-widest">Confirmar Local</button>
                </div>
              )}
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}>
              <button onClick={() => setStep(3)} className="flex items-center gap-2 text-brand-gray text-[10px] font-bold uppercase tracking-widest mb-12 hover:text-brand-dark transition-colors">
                <ArrowLeft size={14} /> Voltar
              </button>
              
              <div className="text-center mb-16">
                <h2 className="heading-section mb-4">Seus dados</h2>
                <p className="text-brand-gray text-sm font-light">Preencha para confirmarmos sua reserva.</p>
              </div>
              
              <div className="space-y-8">
                <div className="grid grid-cols-1 gap-8">
                  <div className="space-y-2">
                    <label className="label-text text-brand-dark ml-1">Nome Completo</label>
                    <input 
                      type="text" 
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Como podemos te chamar?"
                      className="w-full px-8 py-5 bg-white border border-brand-dark/5 rounded-3xl focus:ring-1 focus:ring-brand-dark outline-none transition-all text-lg font-light"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="label-text text-brand-dark ml-1">WhatsApp</label>
                    <input 
                      type="tel" 
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="(00) 00000-0000"
                      className="w-full px-8 py-5 bg-white border border-brand-dark/5 rounded-3xl focus:ring-1 focus:ring-brand-dark outline-none transition-all text-lg font-light"
                    />
                  </div>
                  {isHomeService && (
                    <div className="space-y-2">
                      <label className="label-text text-brand-dark ml-1">Complemento (Opcional)</label>
                      <input 
                        type="text" 
                        value={clientAddress}
                        onChange={(e) => setClientAddress(e.target.value)}
                        placeholder="Apto, bloco, referência"
                        className="w-full px-8 py-5 bg-white border border-brand-dark/5 rounded-3xl focus:ring-1 focus:ring-brand-dark outline-none transition-all text-lg font-light"
                      />
                    </div>
                  )}
                </div>
                
                <div className="bg-white p-10 rounded-[3rem] border border-brand-dark/5 premium-shadow mt-16">
                  <h4 className="label-text text-brand-dark mb-10 tracking-[0.3em] text-center">Resumo da Reserva</h4>
                  <div className="space-y-6 mb-12">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-brand-gray font-light">Serviço</span>
                      <span className="font-bold">{selectedService.name}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-brand-gray font-light">Data e Hora</span>
                      <span className="font-bold">{new Date(selectedDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} às {selectedTime}</span>
                    </div>
                    {isHomeService && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-brand-gray font-light">Localização</span>
                        <span className="font-bold">{selectedArea.name}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm pt-6 border-t border-brand-dark/5">
                      <span className="text-brand-gray font-light">Valor</span>
                      <span className="text-2xl font-serif font-bold text-brand-rose">{formatCurrency(calculateTotalPrice())}</span>
                    </div>
                  </div>
                  
                  <button 
                    onClick={handleBooking}
                    disabled={!clientName || !clientPhone || bookingLoading}
                    className="w-full bg-brand-dark text-white py-6 rounded-full font-bold text-xs uppercase tracking-widest premium-shadow hover:bg-brand-dark/90 transition-all disabled:opacity-30 flex items-center justify-center gap-3"
                  >
                    {bookingLoading ? 'Processando...' : 'Confirmar Agendamento'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div key="step5" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-16 sm:py-24 px-6 sm:px-10 bg-white rounded-[3rem] sm:rounded-[4rem] border border-brand-dark/5 premium-shadow">
              <div className="w-20 h-20 sm:w-24 h-24 bg-brand-cream text-brand-rose rounded-full flex items-center justify-center mx-auto mb-8 sm:mb-10">
                <CheckCircle2 size={40} />
              </div>
              <h2 className="text-3xl sm:text-4xl font-serif font-medium mb-4 sm:mb-6">Reserva Confirmada</h2>
              <p className="text-brand-gray mb-10 sm:mb-12 leading-relaxed max-w-sm mx-auto font-light text-sm sm:text-base">
                Tudo certo! Seu horário foi reservado com sucesso. Você receberá uma confirmação em breve.
              </p>
              
              <div className="flex flex-col gap-4">
                <button 
                  onClick={addToCalendar}
                  className="w-full bg-brand-dark text-white py-6 rounded-full text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-brand-dark/90 transition-all"
                >
                  <CalendarIcon size={18} /> Adicionar ao Calendário
                </button>
                <button 
                  onClick={() => window.location.reload()}
                  className="w-full text-brand-gray text-[10px] font-bold uppercase tracking-widest py-4 hover:text-brand-dark transition-all"
                >
                  Voltar ao início
                </button>
              </div>

              <div className="mt-20 pt-16 border-t border-brand-dark/5">
                <p className="text-[10px] font-bold text-brand-gray uppercase tracking-widest mb-6">Também é profissional?</p>
                <Link to="/register" className="inline-flex items-center gap-3 text-brand-dark font-serif italic font-bold text-2xl hover:text-brand-rose transition-colors">
                  Crie sua agenda premium <ChevronRight size={20} />
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Growth Footer */}
      <footer className="py-20 px-6 text-center border-t border-brand-dark/5 bg-white">
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-3 opacity-20 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-default">
            <div className="w-8 h-8 bg-brand-dark rounded-full flex items-center justify-center text-white">
              <CalendarIcon size={16} />
            </div>
            <span className="text-xl font-serif font-bold">Marca Aí</span>
          </div>
          <p className="text-[10px] font-bold text-brand-gray uppercase tracking-[0.25em]">
            O padrão de excelência para profissionais autônomas
          </p>
          <Link to="/" className="text-[10px] text-brand-rose font-bold uppercase tracking-widest hover:underline">
            Crie sua conta gratuita
          </Link>
        </div>
      </footer>
    </div>
  );
}
