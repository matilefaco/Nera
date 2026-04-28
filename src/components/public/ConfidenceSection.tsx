import React from 'react';
import { motion } from 'motion/react';
import { 
  Users, Star, Zap, CheckCircle2, ShieldCheck, Award, Clock
} from 'lucide-react';
import { UserProfile } from '../../types';

interface ConfidenceSectionProps {
  profile: UserProfile;
  stats?: { averageRating: number; totalCompletedBookings: number } | null;
}

export const ConfidenceSection = ({ profile, stats }: ConfidenceSectionProps) => {
  const experiences = profile.professionalIdentity?.yearsExperience;
  const isAuto = profile.waitlistMode === 'auto';
  
  const badges = [
    {
      icon: <Clock size={16} />,
      text: "Atendimento rápido direto no WhatsApp, sem complicação",
      show: !!profile.whatsapp
    },
    {
      icon: <ShieldCheck size={16} />,
      text: "Profissionais verificadas para sua segurança e tranquilidade",
      show: true
    },
    {
      icon: <CheckCircle2 size={16} />,
      text: "Compromisso com horário e qualidade no atendimento",
      show: true
    }
  ].filter(b => b.show);

  return (
    <section className="py-24 px-6 bg-brand-white relative overflow-hidden">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <span className="label-text text-[var(--theme-accent,var(--color-brand-terracotta))]/60 mb-4 block">Segurança e Qualidade</span>
          <h2 className="text-3xl font-serif text-brand-ink mb-4">Por que escolher a Nera?</h2>
          <div className="w-12 h-1 bg-brand-linen mx-auto rounded-full" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {badges.map((badge, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="flex items-center gap-4 p-6 bg-brand-parchment/30 rounded-3xl border border-brand-mist/40 hover:border-[var(--theme-accent,var(--color-brand-terracotta))]/30 transition-all group"
            >
              <div className="w-10 h-10 rounded-2xl bg-brand-white flex items-center justify-center text-[var(--theme-accent,var(--color-brand-terracotta))] shadow-sm group-hover:scale-110 transition-transform">
                {badge.icon}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-stone leading-relaxed">
                {badge.text}
              </span>
            </motion.div>
          ))}
        </div>

        <div className="mt-16 p-8 bg-brand-linen/10 rounded-[40px] border border-brand-mist/50 text-center">
          <p className="text-[10px] text-brand-stone font-medium uppercase tracking-[0.2em] italic">
            "Na Nera, você agenda com confiança. Profissionais verificadas e atendimento de alto padrão."
          </p>
        </div>
      </div>
    </section>
  );
};
