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
        <span className="label-text text-[var(--theme-accent,var(--color-brand-terracotta))] opacity-80 mb-6 block">
          Horários disponíveis
        </span>
        
        <h2 className="display-hero text-brand-white mb-10">
          Transforme o seu<br />
          <em className="font-serif italic text-brand-blush/60">olhar hoje</em>
        </h2>

        <div className="flex flex-col items-center gap-4">
          <PremiumButton
            onClick={onBookingClick}
            variant="terracotta"
            className="px-14 py-6 text-[11px] shadow-[0_16px_48px_rgba(var(--theme-accent-rgb),168,92,58,0.45)]"
          >
            Agendar meu horário
            <ChevronRight size={14} className="ml-2" />
          </PremiumButton>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/30">
            Leva menos de 30 segundos
          </p>
        </div>

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
