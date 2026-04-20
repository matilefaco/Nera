import React from 'react';
import { motion } from 'motion/react';
import { ChevronRight, ShieldCheck, Clock } from 'lucide-react';
import PremiumButton from '../PremiumButton';

interface FinalCTAProps {
  onBookingClick: () => void;
  completedBookings?: number;
}

export const FinalCTA = ({ onBookingClick, completedBookings }: FinalCTAProps) => {
  return (
    <section className="bg-brand-ink py-40 px-6 relative overflow-hidden">
      {/* Decorative Circles */}
      <div className="absolute top-[-160px] right-[-160px] w-[520px] h-[520px] rounded-full border border-white/5 pointer-events-none" />
      <div className="absolute bottom-[-160px] left-[-160px] w-[440px] h-[440px] rounded-full border border-white/5 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="max-w-2xl mx-auto text-center relative z-10"
      >
        <span className="label-text text-brand-terracotta opacity-80 mb-6 block">
          Horários disponíveis
        </span>
        
        <h2 className="display-hero text-brand-white mb-6">
          Pronta para<br />
          <em className="font-serif italic text-brand-blush/60">seu momento?</em>
        </h2>

        {completedBookings && completedBookings > 20 && (
          <p className="text-[15px] font-light text-brand-blush/40 mb-12">
            Junte-se a mais de {completedBookings} clientes que já descobriram o que significa ser atendida com cuidado real.
          </p>
        )}

        <PremiumButton
          onClick={onBookingClick}
          variant="terracotta"
          className="px-14 py-6 text-[11px] shadow-[0_16px_48px_rgba(168,92,58,0.45)]"
        >
          Reservar meu horário
          <ChevronRight size={14} className="ml-2" />
        </PremiumButton>

        <div className="flex flex-wrap items-center justify-center gap-10 mt-12 opacity-30">
          <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-brand-blush">
            <ShieldCheck size={14} />
            Agendamento seguro
          </div>
          <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-brand-blush">
            <Clock size={14} />
            Confirmação via WhatsApp
          </div>
        </div>
      </motion.div>
    </section>
  );
};

interface AboutSectionProps {
  profile: any;
  aboutBio?: string | null;
}

export const AboutSection = ({ profile, aboutBio }: AboutSectionProps) => {
  if (aboutBio === null || !profile.bio) return null;

  const displayBio = aboutBio || profile.bio;

  return (
    <section className="py-32 px-6 max-w-7xl mx-auto w-full">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="relative"
        >
          <img
            src={profile.portfolio?.[0]?.url || profile.avatar}
            alt="Trabalho"
            className="w-full aspect-[4/5] object-cover rounded-[48px] filter saturate-[0.8] grayscale-[0.2]"
            referrerPolicy="no-referrer"
          />
          <img
            src={profile.avatar}
            alt="Profissional"
            className="absolute -bottom-8 -right-8 w-1/2 aspect-square object-cover rounded-[32px] border-8 border-brand-parchment shadow-2xl hidden md:block"
            referrerPolicy="no-referrer"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="space-y-8"
        >
          <span className="label-text text-brand-terracotta">A Profissional</span>
          
          <h2 className="heading-section text-brand-ink">
            Beleza que<br />
            <em className="font-serif italic text-brand-stone">pertence a você</em>
          </h2>

          <p className="body-text text-brand-stone border-l-2 border-brand-blush pl-8">
            {displayBio}
          </p>

          {profile.professionalIdentity?.differentials && (
            <div className="flex flex-wrap gap-2 pt-4">
              {profile.professionalIdentity.differentials.map((diff: string) => (
                <div key={diff} className="flex items-center gap-2 px-4 py-2 bg-brand-white border border-brand-mist rounded-full text-[9px] font-bold uppercase tracking-widest text-brand-ink">
                  <div className="w-1 h-1 rounded-full bg-brand-terracotta" />
                  {diff}
                </div>
              ))}
            </div>
          )}

          <div className="font-signature text-5xl text-brand-ink/20 pt-8">
            {profile.name.split(' ')[0]}
          </div>
        </motion.div>
      </div>
    </section>
  );
};
