import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Clock, Calendar as CalendarIcon, Check, 
  Sparkles, MessageCircle, Heart, BellRing,
  Sunrise, Sun, Moon, Zap
} from 'lucide-react';
import { UserProfile, Service, WaitlistEntry } from '../types';
import { cn, formatWhatsappDisplay, cleanWhatsapp, buildWhatsappLink } from '../lib/utils';
import { addToWaitlist } from '../firebase';
import { toast } from 'sonner';
import PremiumButton from './PremiumButton';

interface WaitlistModalProps {
  profile: UserProfile;
  services: Service[];
  open: boolean;
  onClose: () => void;
  initialDate?: string;
  initialService?: Service | null;
}

export default function WaitlistModal({ 
  profile, 
  services, 
  open, 
  onClose,
  initialDate,
  initialService 
}: WaitlistModalProps) {
  const [step, setStep] = useState(1);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [selectedService, setSelectedService] = useState<Service | null>(initialService || null);
  const [selectedDate, setSelectedDate] = useState(initialDate || '');
  const [period, setPeriod] = useState<WaitlistEntry['period']>('any');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const periods = [
    { id: 'morning', label: 'Manhã', icon: Sunrise, desc: 'Antes das 12:00' },
    { id: 'afternoon', label: 'Tarde', icon: Sun, desc: '12:00 às 18:00' },
    { id: 'night', label: 'Noite', icon: Moon, desc: 'Após às 18:00' },
    { id: 'any', label: 'Qualquer horário', icon: Zap, desc: 'Preencher primeira vaga' },
  ];

  const handleSubmit = async () => {
    if (!clientName || !clientPhone || !selectedService || !selectedDate) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }

    setLoading(true);
    try {
      await addToWaitlist({
        professionalId: profile.uid,
        clientName,
        clientWhatsapp: clientPhone.replace(/\D/g, ''),
        requestedDate: selectedDate,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        period,
        status: 'waiting'
      });
      setSuccess(true);
      setStep(3);
    } catch (e) {
      toast.error('Não foi possível entrar na lista agora. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-brand-ink/60 backdrop-blur-md z-[500] flex items-end md:items-center justify-center p-0 md:p-6 overflow-hidden">
        <motion.div 
          initial={{ y: "100%" }} 
          animate={{ y: 0 }} 
          exit={{ y: "100%" }} 
          className="bg-brand-white w-full max-w-xl rounded-t-[40px] md:rounded-[40px] p-8 md:p-12 shadow-2xl relative max-h-[95dvh] md:max-h-[85vh] overflow-y-auto no-scrollbar"
        >
          <button onClick={onClose} className="absolute right-8 top-8 text-brand-stone hover:text-brand-ink transition-colors">
            <X size={24} />
          </button>

          {step === 1 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-brand-linen text-brand-terracotta rounded-2xl flex items-center justify-center shadow-sm">
                  <Sparkles size={20} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-terracotta">Lista Prioritária</span>
              </div>
              <h3 className="text-3xl font-serif text-brand-ink mb-2 leading-tight">Quer ser a primeira a saber se surgir uma vaga?</h3>
              <p className="text-sm text-brand-stone font-light mb-10 leading-relaxed">
                Nossa agenda está cheia, mas desistências acontecem. Entre na fila inteligente e receba um convite prioritário.
              </p>

              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">Para qual serviço?</label>
                  <div className="space-y-3">
                    {services.map(s => (
                      <button 
                        key={s.id} 
                        onClick={() => setSelectedService(s)}
                        className={cn(
                          "w-full p-5 text-left rounded-2xl border transition-all flex justify-between items-center",
                          selectedService?.id === s.id ? "bg-brand-ink border-brand-ink text-brand-white" : "bg-brand-parchment border-brand-mist hover:border-brand-ink"
                        )}
                      >
                        <span className="text-sm font-medium">{s.name}</span>
                        {selectedService?.id === s.id && <Check size={16} className="text-brand-terracotta" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">E qual o melhor período para você?</label>
                  <div className="grid grid-cols-2 gap-3">
                    {periods.map(p => (
                      <button 
                        key={p.id}
                        onClick={() => setPeriod(p.id as any)}
                        className={cn(
                          "p-5 rounded-2xl border transition-all text-left flex flex-col gap-2 relative overflow-hidden group",
                          period === p.id ? "bg-brand-ink border-brand-ink text-brand-white" : "bg-brand-white border-brand-mist hover:border-brand-ink"
                        )}
                      >
                        <p.icon size={20} className={period === p.id ? "text-brand-terracotta" : "text-brand-mist group-hover:text-brand-terracotta transition-colors"} />
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest leading-none mb-1">{p.label}</p>
                          <p className="text-[9px] opacity-60 font-light">{p.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <PremiumButton variant="terracotta" className="w-full py-6" onClick={() => setStep(2)} disabled={!selectedService}>
                  Continuar Cadastro
                </PremiumButton>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <button onClick={() => setStep(1)} className="text-brand-stone hover:text-brand-ink mb-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                <X size={16} className="rotate-90" /> Voltar
              </button>
              
              <h3 className="text-3xl font-serif text-brand-ink mb-2">Seus dados de contato</h3>
              <p className="text-sm text-brand-stone font-light mb-10 leading-relaxed">
                Avisaremos você por WhatsApp assim que uma vaga compatível for aberta.
              </p>

              <div className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">Seu Nome</label>
                  <input 
                    type="text" 
                    value={clientName} 
                    onChange={(e) => setClientName(e.target.value)} 
                    placeholder="Como prefere ser chamada?" 
                    className="w-full px-6 py-5 bg-brand-parchment border border-brand-mist rounded-2xl outline-none focus:ring-1 focus:ring-brand-ink transition-all text-sm" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">WhatsApp</label>
                  <input 
                    type="tel" 
                    value={formatWhatsappDisplay(clientPhone)} 
                    onChange={(e) => setClientPhone(cleanWhatsapp(e.target.value))} 
                    placeholder="(00) 00000-0000" 
                    className="w-full px-6 py-5 bg-brand-parchment border border-brand-mist rounded-2xl outline-none focus:ring-1 focus:ring-brand-ink transition-all text-sm" 
                  />
                </div>

                <div className="pt-6">
                   <PremiumButton 
                    variant="terracotta" 
                    className="w-full py-6" 
                    onClick={handleSubmit} 
                    loading={loading}
                    disabled={!clientName || !clientPhone}
                  >
                    Entrar na Lista Prioritária
                  </PremiumButton>
                  <p className="text-[9px] text-brand-stone text-center mt-4 uppercase tracking-widest opacity-60">
                    O convite expira em 15 minutos após o envio.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-12 text-center">
              <div className="w-20 h-20 bg-brand-linen text-brand-terracotta rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
                <BellRing size={40} className="animate-bounce" />
              </div>
              <h3 className="text-3xl font-serif text-brand-ink mb-3 leading-tight">Você está na fila, {clientName.split(' ')[0]}! ✨</h3>
              <p className="text-sm text-brand-stone font-light mb-12 max-w-xs mx-auto leading-relaxed">
                Fique atenta ao seu WhatsApp. Se uma vaga de <span className="font-medium text-brand-ink">{selectedService?.name}</span> surgir para o dia <span className="font-medium text-brand-ink">{selectedDate.split('-').reverse().join('/')}</span>, você será notificada imediatamente.
              </p>
              
              <div className="space-y-4">
                <PremiumButton variant="terracotta" className="w-full py-5" onClick={onClose}>
                  Entendi, obrigada!
                </PremiumButton>
                <div className="pt-6 border-t border-brand-mist mt-8">
                  <p className="text-[10px] text-brand-stone uppercase tracking-widest mb-4">Dúvidas?</p>
                  <a 
                    href={buildWhatsappLink(profile.whatsapp, `Oi! Entrei na lista prioritária para o dia ${selectedDate.split('-').reverse().join('/')} mas gostaria de tirar uma dúvida.`)} 
                    target="_blank" 
                    className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-ink hover:text-brand-terracotta transition-colors"
                  >
                    <MessageCircle size={16} /> Falar com {profile.name.split(' ')[0]}
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
