import React from 'react';
import { motion } from 'motion/react';
import { getDifferentialDisplay } from '../../lib/differentials';

interface DifferentialsSectionProps {
  differentials: string[];
}

export const DifferentialsSection = ({ differentials }: DifferentialsSectionProps) => {
  if (!differentials || differentials.length === 0) return null;

  return (
    <section className="py-24 px-6 bg-brand-white">
      <div className="max-w-7xl mx-auto w-full">
        <div className="text-center mb-16 space-y-4">
          <motion.span 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--theme-accent,var(--color-brand-terracotta))]"
          >
            Excelência em cada detalhe
          </motion.span>
          <motion.h2 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-4xl font-serif text-brand-ink"
          >
            Detalhes que fazem diferença
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-brand-stone font-light italic text-sm max-w-xl mx-auto"
          >
            Pequenos cuidados que tornam sua experiência mais segura, confortável e profissional.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {differentials.map((diff, idx) => {
            const display = getDifferentialDisplay(diff);
            return (
              <motion.div
                key={diff}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="group p-8 bg-brand-parchment/30 border border-brand-mist rounded-[32px] hover:border-[var(--theme-accent,var(--color-brand-terracotta))]/30 hover:bg-brand-white transition-all cursor-default"
              >
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[var(--theme-accent,var(--color-brand-terracotta))] mb-6 border border-brand-mist group-hover:bg-[var(--theme-accent,var(--color-brand-terracotta))] group-hover:text-brand-white transition-all shadow-sm">
                  {display.icon}
                </div>
                <h4 className="text-lg font-serif text-brand-ink mb-2">
                  {display.title}
                </h4>
                <p className="text-xs text-brand-stone leading-relaxed font-light">
                  {display.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
