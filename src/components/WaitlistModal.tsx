import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Calendar as CalendarIcon, Clock, Users, 
  Check, Sunrise, Sun, Moon, Zap, MessageCircle,
  ChevronRight, Sparkles
} from 'lucide-react';
import { addToWaitlist } from '../firebase';
import { UserProfile, Service, WaitlistEntry } from '../types';
import { cn, formatDateKey, getTodayLocale, formatLocalDate } from '../lib/utils';
import PremiumButton from './PremiumButton';
import { toast } from 'sonner';

interface WaitlistModalProps {
  open: boolean;
  onClose: () => void;
  profile: UserProfile;
  services: Service[];
  initialDate?: string;
  initialService?: Service | null;
}

type Step = 'date' | 'time' | 'contact' | 'success';

export default function WaitlistModal({ open, onClose, profile, services, initialDate, initialService }: WaitlistModalProps) {
  const [step, setStep] = useState<Step>('date');
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    requestedDate: initialDate || getTodayLocale(),
    period: 'any' as WaitlistEntry['period'],
    preferredTime: '',
    clientName: '',
    clientWhatsapp: '',
    serviceId: initialService?.id || services[0]?.id || '',
    serviceName: initialService?.name || services[0]?.name || ''
  });

  // Re-sync if props change while modal is open (unlikely but safe)
  React.useEffect(() => {
    if (open) {
      if (initialDate) setFormData(prev => ({ ...prev, requestedDate: initialDate }));
      if (initialService) setFormData(prev => ({ ...prev, serviceId: initialService.id, serviceName: initialService.name }));
    }
  }, [open, initialDate, initialService]);

  const periods = [
    { id: 'any', label: 'Qualquer horário', icon: Zap },
    { id: 'morning', label: 'Manhã', icon: Sunrise },
    { id: 'afternoon', label: 'Tarde', icon: Sun },
    { id: 'night', label: 'Noite', icon: Moon },
  ];

  const handleJoin = async () => {
    if (!formData.clientName || !formData.clientWhatsapp) {
      toast.error('Preencha seu nome e WhatsApp.');
      return;
    }
    
    setLoading(true);
    try {
      await addToWaitlist({
        professionalId: profile.uid,
        ...formData,
        status: 'waiting'
      });
      setStep('success');
    } catch (e) {
      toast.error('Erro ao entrar na lista. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const nextDay = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatDateKey(d);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-end md:items-center justify-center p-0 md:p-6 overflow-hidden">
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-brand-ink/40 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          className="relative w-full max-w-lg bg-brand-white rounded-t-[40px] md:rounded-[40px] p-8 md:p-12 shadow-2xl overflow-y-auto max-h-[92dvh] no-scrollbar"
        >
          <button onClick={onClose} className="absolute right-8 top-8 text-brand-stone hover:text-brand-ink transition-colors">
            <X size={24} />
          </button>

          {step === 'date' && (
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-brand-linen text-brand-ink rounded-xl flex items-center justify-center shadow-sm">
                  <Users size={20} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-ink">Lista Prioritária</span>
              </div>
              <h3 className="text-3xl font-serif text-brand-ink mb-2">Lista de Espera</h3>
              <p className="text-sm text-brand-stone font-light mb-10">Quando surgir uma desistência, você será a primeira a saber.</p>

              <div className="space-y-4 mb-10">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-stone ml-2">Qual dia você prefere?</p>
                <div className="grid grid-cols-1 gap-3">
                  <button 
                    onClick={() => { setFormData({...formData, requestedDate: getTodayLocale()}); setStep('time'); }}
                    className="p-5 bg-brand-parchment rounded-2xl border border-brand-mist hover:border-brand-ink flex items-center justify-between group transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <CalendarIcon size={20} className="text-brand-terracotta" />
                      <span className="text-sm font-medium">Hoje, {formatLocalDate(getTodayLocale(), { day: '2-digit', month: 'long' })}</span>
                    </div>
                    <ChevronRight size={18} className="text-brand-mist group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button 
                    onClick={() => { setFormData({...formData, requestedDate: nextDay()}); setStep('time'); }}
                    className="p-5 bg-brand-parchment rounded-2xl border border-brand-mist hover:border-brand-ink flex items-center justify-between group transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <CalendarIcon size={20} className="text-brand-terracotta" />
                      <span className="text-sm font-medium">Amanhã, {formatLocalDate(nextDay(), { day: '2-digit', month: 'long' })}</span>
                    </div>
                    <ChevronRight size={18} className="text-brand-mist group-hover:translate-x-1 transition-transform" />
                  </button>
                  <div className="relative">
                    <input 
                      type="date"
                      min={getTodayLocale()}
                      className="w-full p-5 bg-brand-parchment rounded-2xl border border-brand-mist outline-none focus:border-brand-ink text-sm font-medium"
                      onChange={(e) => {
                        if (e.target.value) {
                          setFormData({...formData, requestedDate: e.target.value});
                          setStep('time');
                        }
                      }}
                    />
                    <span className="absolute inset-y-0 right-5 flex items-center pointer-events-none text-brand-stone">
                      <CalendarIcon size={18} />
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'time' && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <button 
                onClick={() => setStep('date')}
                className="mb-8 text-brand-stone hover:text-brand-ink flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"
              >
                <ChevronRight size={16} className="rotate-180" /> Escolher Dia
              </button>

              <h3 className="text-3xl font-serif text-brand-ink mb-6">Preferência de Horário</h3>
              
              <div className="grid grid-cols-2 gap-4 mb-8">
                {periods.map(p => (
                  <button 
                    key={p.id}
                    onClick={() => setFormData({...formData, period: p.id as any, preferredTime: ''})}
                    className={cn(
                      "p-6 rounded-[32px] border transition-all flex flex-col gap-3 text-left group",
                      formData.period === p.id && !formData.preferredTime
                        ? "bg-brand-ink border-brand-ink text-brand-white shadow-xl"
                        : "bg-brand-parchment border-brand-mist hover:border-brand-ink text-brand-stone"
                    )}
                  >
                    <p.icon size={20} className={cn("transition-transform group-hover:scale-110", formData.period === p.id ? "text-brand-terracotta" : "text-brand-stone")} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">{p.label}</span>
                  </button>
                ))}
              </div>

              <div className="space-y-4 mb-10">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-stone ml-2">Ou horário exato:</p>
                <input 
                  type="time"
                  value={formData.preferredTime}
                  onChange={(e) => setFormData({...formData, preferredTime: e.target.value, period: 'any'})}
                  className="w-full p-5 bg-brand-white border border-brand-mist rounded-2xl outline-none focus:border-brand-ink font-medium"
                />
              </div>

              <PremiumButton variant="ink" className="w-full py-5" onClick={() => setStep('contact')}>
                Continuar
              </PremiumButton>
            </motion.div>
          )}

          {step === 'contact' && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <button 
                onClick={() => setStep('time')}
                className="mb-8 text-brand-stone hover:text-brand-ink flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"
              >
                <ChevronRight size={16} className="rotate-180" /> Horário
              </button>

              <h3 className="text-3xl font-serif text-brand-ink mb-2">Seus Contatos</h3>
              <p className="text-sm text-brand-stone font-light mb-10">Como devemos te avisar quando a vaga abrir?</p>

              <div className="space-y-6 mb-10">
                <div className="space-y-2">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-2">Seu Nome</label>
                  <input 
                    type="text"
                    value={formData.clientName}
                    onChange={(e) => setFormData({...formData, clientName: e.target.value})}
                    placeholder="Como prefere ser chamada"
                    className="w-full p-5 bg-brand-parchment rounded-2xl border border-brand-mist outline-none focus:border-brand-ink"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-2">WhatsApp</label>
                  <input 
                    type="tel"
                    value={formData.clientWhatsapp}
                    onChange={(e) => setFormData({...formData, clientWhatsapp: e.target.value})}
                    placeholder="(00) 00000-0000"
                    className="w-full p-5 bg-brand-parchment rounded-2xl border border-brand-mist outline-none focus:border-brand-ink"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-2">Serviço Desejado</label>
                  <select 
                    value={formData.serviceId}
                    onChange={(e) => {
                      const s = services.find(sv => sv.id === e.target.value);
                      setFormData({...formData, serviceId: e.target.value, serviceName: s?.name || ''});
                    }}
                    className="w-full p-5 bg-brand-parchment rounded-2xl border border-brand-mist outline-none focus:border-brand-ink appearance-none"
                  >
                    {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <PremiumButton 
                variant="terracotta" 
                className="w-full py-6" 
                loading={loading}
                onClick={handleJoin}
              >
                Entrar na Lista
              </PremiumButton>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-10">
              <div className="w-20 h-20 bg-brand-linen rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
                <Check size={40} className="text-brand-terracotta" />
              </div>
              <h3 className="text-3xl font-serif text-brand-ink mb-4">Você está na lista!</h3>
              <p className="text-brand-stone font-light italic leading-relaxed mb-10 max-w-xs mx-auto">
                Fique atenta ao seu WhatsApp. Se um horário abrir para <br/> 
                <strong>{formatLocalDate(formData.requestedDate, { day: '2-digit', month: 'long' })}</strong>, <br/>
                enviaremos um convite prioritário para você.
              </p>
              <PremiumButton variant="ink" className="w-full py-5" onClick={onClose}>
                Entendido
              </PremiumButton>
            </motion.div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
