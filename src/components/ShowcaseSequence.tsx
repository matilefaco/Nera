import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, UserPlus, Share, CheckCircle2, LayoutDashboard, ShieldCheck, ChevronRight } from 'lucide-react';

const STEPS = [
  {
    id: 'signup',
    title: 'Cadastro em minutos',
    desc: 'Crie sua conta na nera e preencha seus dados básicos sem burocracia.',
    icon: <UserPlus size={20} />
  },
  {
    id: 'setup',
    title: 'Sua vitrine pronta',
    desc: 'Adicione seus serviços, preços e horários com uma interface limpa e intuitiva.',
    icon: <LayoutDashboard size={20} />
  },
  {
    id: 'share',
    title: 'Compartilhe o link',
    desc: 'Envie sua vitrine premium para suas clientes no Instagram ou WhatsApp.',
    icon: <Share size={20} />
  },
  {
    id: 'book',
    title: 'Cliente agenda',
    desc: 'Elas escolhem o serviço e horário sozinhas. A experiência é fluida e sem atritos.',
    icon: <Calendar size={20} />
  },
  {
    id: 'confirm',
    title: 'Você no controle',
    desc: 'Receba a notificação e pronto. A agenda está organizada.',
    icon: <CheckCircle2 size={20} />
  }
];

export const ShowcaseSequence = () => {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % STEPS.length);
    }, 4500); // 4.5s per step
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full flex flex-col lg:flex-row items-center gap-12 lg:gap-24">
      {/* TEXT / STEPS SIDE */}
      <div className="w-full lg:w-[45%] flex flex-col gap-6 sm:gap-8">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-terracotta block mb-4">A Experiência Nera</span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif text-brand-ink leading-[1.1] mb-2 sm:mb-4">
            Do primeiro clique<br />
            <em>à agenda lotada.</em>
          </h2>
        </div>
        
        <div className="flex flex-col gap-1 sm:gap-2 w-full max-w-lg">
          {STEPS.map((step, idx) => {
            const isActive = activeStep === idx;
            return (
              <div 
                key={step.id} 
                className={`flex gap-4 p-4 lg:p-5 rounded-2xl transition-all duration-500 cursor-pointer ${isActive ? 'bg-brand-white premium-shadow translate-x-1 sm:translate-x-2' : 'hover:bg-brand-white/40'}`}
                onClick={() => setActiveStep(idx)}
              >
                <div className={`mt-0.5 transition-colors duration-500 ${isActive ? 'text-brand-terracotta' : 'text-brand-stone/30'}`}>
                  {step.icon}
                </div>
                <div className="flex flex-col gap-1 w-full">
                  <h3 className={`font-serif text-lg sm:text-xl transition-colors duration-500 ${isActive ? 'text-brand-ink' : 'text-brand-ink/40'}`}>
                    {step.title}
                  </h3>
                  <div 
                    className={`grid transition-all duration-500 ease-in-out ${isActive ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                  >
                    <p className="text-xs sm:text-sm font-light text-brand-stone/80 overflow-hidden pt-1 leading-relaxed pr-2">
                      {step.desc}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* VISUAL MOCKUP SIDE */}
      <div className="w-full lg:w-[55%] relative flex flex-col items-center">
        <div className="w-full bg-[#FCFBF9] rounded-[32px] sm:rounded-[48px] premium-shadow h-[480px] sm:h-[560px] lg:h-auto lg:aspect-square relative overflow-hidden flex items-center justify-center border border-brand-mist/40 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)]">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-parchment/80 via-white to-brand-linen/40 pointer-events-none" />
          
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, y: 20, filter: 'blur(8px)', scale: 0.95 }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)', scale: 1 }}
              exit={{ opacity: 0, y: -20, filter: 'blur(8px)', scale: 0.95 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="w-full h-full flex items-center justify-center relative z-10"
            >
              {activeStep === 0 && <MockupSignup />}
              {activeStep === 1 && <MockupSetup />}
              {activeStep === 2 && <MockupShare />}
              {activeStep === 3 && <MockupBook />}
              {activeStep === 4 && <MockupConfirm />}
            </motion.div>
          </AnimatePresence>
        </div>
        
        {/* Progress bar moved outside the mockup box to not overlap UI */}
        <div className="flex gap-1.5 mt-5 sm:mt-7 opacity-80 scale-90 sm:scale-100">
           {STEPS.map((_, idx) => (
             <div 
                key={idx} 
                className={`h-[4px] rounded-full transition-all duration-700 ${activeStep === idx ? 'w-5 bg-brand-terracotta/80' : 'w-1.5 bg-brand-stone/15'}`}
             />
           ))}
        </div>
      </div>
    </div>
  );
};

// --- MOCKUP COMPONENTS ---

const MockupSignup = () => (
  <div className="w-[85%] max-w-[320px] bg-brand-white rounded-[32px] p-6 sm:p-7 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] border border-brand-mist/60 flex flex-col gap-4 sm:gap-5 relative overflow-hidden z-10 transform scale-95 sm:scale-100">
    <div className="absolute top-0 left-0 w-full h-1.5 bg-brand-terracotta" />
    <div className="w-12 h-12 bg-white rounded-[12px] flex items-center justify-center mx-auto mb-1 border border-brand-mist shadow-[0_4px_10px_rgba(0,0,0,0.06)]">
      <svg width="22" height="22" viewBox="0 0 36 36" fill="none">
        <path d="M10 26V10L26 26V10" className="stroke-brand-ink" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="30" cy="30" r="5" className="fill-brand-terracotta" />
      </svg>
    </div>
    <div className="text-center mb-3">
      <h3 className="text-lg font-serif text-brand-ink leading-tight">Crie sua vitrine</h3>
      <p className="text-[11px] text-brand-stone mt-1">Leva menos de dois minutos.</p>
    </div>
    
    <div className="space-y-4 w-full text-left">
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-stone ml-1">Seu Nome</label>
        <div className="w-full h-12 bg-[#FDFBF7] border border-brand-mist/80 rounded-xl px-4 flex items-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
           <span className="text-brand-ink text-[14px] font-medium">Helena Prado</span>
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-stone ml-1">Especialidade</label>
        <div className="w-full h-12 bg-[#FDFBF7] border border-brand-mist/80 rounded-xl px-4 flex items-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
           <span className="text-brand-ink text-[14px] font-medium">Sobrancelhas e Harmonização</span>
        </div>
      </div>
    </div>

    <div className="w-full h-12 bg-brand-ink rounded-full mt-3 flex items-center justify-center shadow-lg hover:bg-brand-ink/90 transition-colors cursor-pointer group">
      <span className="text-brand-white text-[11px] uppercase font-bold tracking-[0.2em] group-hover:pl-2 transition-all">Avançar</span>
    </div>
  </div>
);

const MockupSetup = () => (
  <div className="w-[85%] max-w-[320px] bg-[#FDFBF7] rounded-[32px] overflow-hidden shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] border border-brand-mist flex flex-col z-10 transform scale-95 sm:scale-100 lg:scale-105">
    {/* Header */}
    <div className="h-16 bg-brand-white border-b border-brand-mist/60 flex items-center px-6 justify-between relative z-10 shadow-sm">
      <div className="flex flex-col">
         <span className="text-brand-ink font-serif text-[20px] leading-none">Serviços</span>
         <span className="text-brand-stone text-[9px] uppercase tracking-[0.2em] mt-1">Seu Catálogo</span>
      </div>
      <div className="w-10 h-10 rounded-full bg-[#FAF9F8] flex items-center justify-center border border-brand-mist shadow-sm">
        <span className="text-brand-terracotta text-lg font-light leading-none">+</span>
      </div>
    </div>
    
    <div className="p-5 flex flex-col gap-3.5 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-[#FAF9F8] to-transparent pointer-events-none" />
      {/* Service Real Card 1 */}
      <div className="bg-brand-white p-5 rounded-2xl border border-brand-mist/80 flex flex-col gap-3 relative shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] z-10 transition-transform hover:-translate-y-0.5">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <span className="text-brand-ink font-serif text-[17px] leading-tight">Design com Henna</span>
            <span className="text-brand-stone text-[11px]">45 min</span>
          </div>
          <span className="text-brand-terracotta font-serif text-[17px]">R$ 80</span>
        </div>
        <div className="flex gap-2 mt-1">
           <div className="px-2.5 py-1 bg-[#F5F3F0] rounded-md text-[9px] uppercase tracking-widest text-[#7A7571] font-bold">Studio</div>
           <div className="px-2.5 py-1 bg-[#F5F3F0] rounded-md text-[9px] uppercase tracking-widest text-[#7A7571] font-bold">Pix</div>
        </div>
      </div>

      {/* Service Real Card 2 */}
      <div className="bg-brand-white p-5 rounded-2xl border border-brand-mist/80 flex flex-col gap-3 relative shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] z-10 transition-transform hover:-translate-y-0.5">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <span className="text-brand-ink font-serif text-[17px] leading-tight">Brow Lamination</span>
            <span className="text-brand-stone text-[11px]">60 min</span>
          </div>
          <span className="text-brand-terracotta font-serif text-[17px]">R$ 150</span>
        </div>
        <div className="flex gap-2 mt-1">
           <div className="px-2.5 py-1 bg-brand-terracotta/5 rounded-md text-[9px] uppercase tracking-widest text-brand-terracotta font-bold border border-brand-terracotta/10">Premium</div>
        </div>
      </div>
    </div>
  </div>
);

const MockupShare = () => (
  <div className="w-[70%] max-w-[280px] bg-[#1a1a1a] rounded-[38px] p-[6px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.4)] relative aspect-[9/19] sm:aspect-[9/18.5] flex-shrink-0 z-10 border border-[#333] group transform scale-90 sm:scale-100">
    <div className="w-full h-full bg-[#FCFBF9] rounded-[32px] overflow-hidden flex flex-col relative shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)]">
      
      {/* Dynamic Island / Notch */}
      <div className="absolute top-2.5 w-full flex justify-center z-50">
        <div className="w-[30%] h-[16px] bg-[#1a1a1a] rounded-full" />
      </div>

      {/* Profile Photo Area */}
      <div className="w-full h-[45%] relative">
        <img src="https://i.imgur.com/gBdf3tO.png" alt="Helena Prado" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#FCFBF9] via-[#FCFBF9]/20 to-transparent" />
        
        {/* PRO Badge overlapping photo */}
        <div className="absolute top-6 right-5 w-10 h-10 bg-white/90 backdrop-blur-md rounded-xl flex items-center justify-center shadow-lg border border-white/50">
           <ShieldCheck size={20} className="text-[var(--theme-primary,var(--color-brand-terracotta))]" />
        </div>
      </div>

      <div className="flex flex-col items-center px-6 text-center -mt-8 relative z-10">
        <h3 className="text-2xl font-serif text-brand-ink mb-1 drop-shadow-sm">Helena Prado</h3>
        <p className="text-[9px] uppercase font-bold tracking-[0.2em] text-brand-terracotta mb-4">Sobrancelhas e Beauty</p>
        <p className="text-[12px] text-brand-stone font-serif leading-relaxed italic">Especialista em design de sobrancelhas naturais. Realçando sua beleza autêntica.</p>
      </div>
      
      {/* Share action simulation */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, type: "spring", damping: 18 }}
        className="absolute bottom-5 w-full flex justify-center px-4"
      >
        <div className="w-full bg-brand-white rounded-2xl p-3 shadow-[0_15px_30px_-5px_rgba(0,0,0,0.15)] border border-brand-mist/80 flex items-center justify-between cursor-pointer hover:-translate-y-1 transition-transform group/link">
          <div className="flex flex-col text-left pl-2">
            <span className="text-[12px] font-bold text-brand-ink group-hover/link:text-brand-terracotta transition-colors">Compartilhar perfil</span>
            <span className="text-[10px] text-brand-stone mt-0.5 font-medium">usenera.com/p/helena-prado</span>
          </div>
          <div className="w-9 h-9 rounded-full bg-[#FAF9F8] border border-brand-mist flex items-center justify-center text-brand-ink shadow-sm group-hover/link:bg-brand-terracotta/10 group-hover/link:text-brand-terracotta group-hover/link:border-brand-terracotta/30 transition-colors">
            <Share size={13} />
          </div>
        </div>
      </motion.div>
    </div>
  </div>
);

const MockupBook = () => (
  <div className="w-[85%] max-w-[320px] bg-brand-white rounded-[32px] p-5 sm:p-7 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] border border-brand-mist flex flex-col gap-5 sm:gap-6 relative z-10 transform scale-95 sm:scale-100 lg:scale-105">
    
    <div className="flex items-center gap-2 mb-1">
      <div className="w-8 h-8 rounded-full bg-brand-parchment flex items-center justify-center">
        <Calendar size={14} className="text-brand-terracotta" />
      </div>
      <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-ink">Data e Horário</span>
    </div>

    {/* Dates horizontal scroll */}
    <div className="flex gap-2.5 overflow-hidden -mx-2 px-2 pb-2">
      {[20, 21, 22, 23].map((day, idx) => (
        <div key={day} className={`w-[60px] sm:w-[64px] aspect-[4/5] rounded-[18px] flex flex-col items-center justify-center border shrink-0 transition-all ${idx === 1 ? 'bg-brand-ink text-brand-white border-brand-ink shadow-lg scale-105' : 'bg-[#FDFBF7] text-brand-ink border-brand-mist/80 hover:border-brand-mist'}`}>
          <span className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${idx === 1 ? 'opacity-70' : 'opacity-40'}`}>Qui</span>
          <span className="text-[22px] font-serif leading-none">{day}</span>
        </div>
      ))}
    </div>
    
    {/* Times list */}
    <div className="grid grid-cols-3 gap-2.5">
      <div className="h-12 bg-[#FDFBF7] border border-brand-mist/60 rounded-[14px] flex items-center justify-center text-[13px] font-medium text-brand-stone/40 line-through">09:00</div>
      <div className="h-12 bg-[#FDFBF7] border border-brand-mist/60 rounded-[14px] flex items-center justify-center text-[13px] font-medium text-brand-ink">10:00</div>
      <div className="h-12 bg-brand-terracotta/10 border border-brand-terracotta/30 rounded-[14px] flex items-center justify-center text-[14px] font-bold text-brand-terracotta shadow-[0_2px_10px_-2px_rgba(202,118,90,0.2)]">11:00</div>
      <div className="h-12 bg-[#FDFBF7] border border-brand-mist/60 rounded-[14px] flex items-center justify-center text-[13px] font-medium text-brand-ink">14:00</div>
      <div className="h-12 bg-[#FDFBF7] border border-brand-mist/60 rounded-[14px] flex items-center justify-center text-[13px] font-medium text-brand-ink">15:00</div>
      <div className="h-12 bg-[#FDFBF7] border border-brand-mist/60 rounded-[14px] flex items-center justify-center text-[13px] font-medium text-brand-stone/40 line-through">16:00</div>
    </div>

    {/* CTA Button */}
    <div className="w-full h-[52px] bg-brand-ink rounded-full mt-2 shadow-[0_8px_20px_-6px_rgba(0,0,0,0.3)] flex items-center justify-center gap-2 hover:bg-brand-ink/90 transition-colors group cursor-pointer">
      <span className="text-brand-white text-[11px] uppercase font-bold tracking-[0.2em] group-hover:-translate-x-1 transition-transform">Confirmar 11:00</span>
      <ChevronRight size={14} className="text-brand-white/70 group-hover:translate-x-1 transition-transform" />
    </div>
  </div>
);

const MockupConfirm = () => (
  <div className="w-[85%] max-w-[320px] bg-[#FDFBF7] rounded-[32px] overflow-hidden shadow-[0_20px_40px_-15px_rgba(0,0,0,0.15)] border border-brand-mist flex flex-col relative pb-4 sm:pb-6 z-10 transform scale-90 sm:scale-100">
    {/* Notification overlay */}
    <motion.div 
      initial={{ y: -60, scale: 0.9, opacity: 0 }}
      animate={{ y: 20, scale: 1, opacity: 1 }}
      transition={{ delay: 0.35, type: 'spring', damping: 20, stiffness: 150 }}
      className="absolute top-0 left-1/2 -translate-x-1/2 w-[90%] bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-[0_20px_40px_-5px_rgba(0,0,0,0.15)] border border-brand-mist/80 z-30 flex gap-3.5 items-center"
    >
      <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600 border border-green-100 shrink-0 shadow-sm">
        <CheckCircle2 size={20} />
      </div>
      <div className="flex flex-col w-full pr-2">
        <div className="flex justify-between items-center w-full">
          <span className="text-[13px] font-bold text-brand-ink leading-tight">Novo agendamento</span>
          <span className="text-[9px] text-brand-stone uppercase tracking-widest font-bold">Agora</span>
        </div>
        <span className="text-[11px] text-brand-stone mt-0.5 leading-snug">Mariana agendou Brow Lamination para amanhã, 11:00.</span>
      </div>
    </motion.div>

    {/* Agenda Background */}
    <div className="pt-28 px-6 pb-6 bg-[#FAF9F8] min-h-[340px] flex flex-col gap-4 relative">
      <div className="flex justify-between items-end mb-2 relative z-10">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-[0.15em] text-brand-stone font-bold mb-1">Agenda</span>
          <span className="text-brand-ink font-serif text-[24px] leading-none">Hoje, 21</span>
        </div>
      </div>
      
      {/* Appointment 1 */}
      <div className="bg-brand-white border-l-4 border-l-brand-stone/20 p-4.5 rounded-2xl shadow-[0_2px_10px_-2px_rgba(0,0,0,0.02)] border border-transparent border-t-brand-mist/40 border-r-brand-mist/40 border-b-brand-mist/40 flex flex-col relative opacity-70">
         <div className="flex justify-between items-start mb-2.5">
           <span className="text-brand-ink text-[13px] font-medium">10:00 - 10:45</span>
           <span className="text-[9px] bg-[#F5F3F0] px-2.5 py-1 rounded-md text-brand-stone uppercase font-bold tracking-widest">Concluído</span>
         </div>
         <span className="font-serif text-[18px] text-brand-ink">Julia Martinez</span>
      </div>

      {/* Appointment 2 */}
      <div className="bg-brand-ink text-brand-white p-5 rounded-2xl shadow-[0_15px_30px_-10px_rgba(0,0,0,0.3)] flex flex-col scale-[1.03] transform transition-transform relative origin-center z-20">
         <div className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-terracotta opacity-80"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-brand-terracotta border-2 border-brand-ink shadow-sm"></span>
         </div>
         <div className="flex justify-between items-start mb-3">
           <span className="text-brand-white text-[13px] font-medium bg-white/10 px-2.5 py-1 rounded-md">11:00 - 12:00</span>
           <span className="text-[9px] text-brand-terracotta uppercase font-bold tracking-[0.2em] mt-1 pr-1 opacity-90">A Chegar</span>
         </div>
         <span className="font-serif text-[20px] mb-0.5">Mariana Silva</span>
         <span className="text-[13px] text-brand-white/70 italic font-serif">Brow Lamination</span>
      </div>
    </div>
  </div>
);

