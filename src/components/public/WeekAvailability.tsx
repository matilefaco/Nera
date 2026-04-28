import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { Calendar } from 'lucide-react';

export interface WeeklyDayAvailability {
  date: string;
  label: string;
  dayNumber: string;
  status: 'available' | 'low' | 'full' | 'closed';
  slotsCount: number;
}

interface WeekAvailabilityProps {
  availability: WeeklyDayAvailability[];
  onSelectDate: (date: string) => void;
}

export const WeekAvailability = ({ availability, onSelectDate }: WeekAvailabilityProps) => {
  if (!availability || availability.length === 0) return null;

  return (
    <section className="py-20 px-6 bg-brand-linen/20">
      <div className="max-w-7xl mx-auto w-full">
        <div className="text-center mb-12 space-y-4">
          <motion.span 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--theme-accent,var(--color-brand-terracotta))]"
          >
            Próximos horários
          </motion.span>
          <motion.h2 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-4xl font-serif text-brand-ink"
          >
            Disponibilidade da semana
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-brand-stone font-light text-sm italic"
          >
            Escolha o melhor dia para o seu autocuidado.
          </motion.p>
        </div>

        <div className="flex overflow-x-auto pb-8 -mx-6 px-6 scrollbar-hide md:grid md:grid-cols-7 md:gap-4 md:overflow-visible">
          {availability.map((day, idx) => (
            <motion.button
              key={day.date}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => onSelectDate(day.date)}
              disabled={day.status === 'closed'}
              className={cn(
                "flex-shrink-0 w-24 md:w-full p-4 rounded-[28px] border flex flex-col items-center gap-3 transition-all",
                day.status === 'closed' 
                  ? "bg-brand-linen/40 border-brand-mist/50 opacity-60 cursor-not-allowed"
                  : "bg-brand-white border-brand-mist hover:border-[var(--theme-accent,var(--color-brand-terracotta))] active:scale-95 shadow-sm hover:shadow-md",
                day.date === availability[0].date && day.status !== 'closed' && "ring-1 ring-[var(--theme-accent,var(--color-brand-terracotta))]/20"
              )}
            >
              <span className="text-[9px] font-bold uppercase tracking-widest text-brand-stone">
                {day.label}
              </span>
              <span className="text-2xl font-serif text-brand-ink">
                {day.dayNumber}
              </span>
              <div className="mt-1 flex flex-col items-center">
                {day.status === 'available' && (
                  <>
                    <span className="text-[8px] font-bold text-green-600 uppercase tracking-wider">Disponível</span>
                    <span className="text-[10px] text-brand-stone font-light">{day.slotsCount} horários</span>
                  </>
                )}
                {day.status === 'low' && (
                  <>
                    <span className="text-[8px] font-bold text-[var(--theme-accent,var(--color-brand-terracotta))] uppercase tracking-wider">Poucas vagas</span>
                    <span className="text-[10px] text-brand-stone font-light">{day.slotsCount === 1 ? '1 horário' : `${day.slotsCount} horários`}</span>
                  </>
                )}
                {day.status === 'full' && (
                  <>
                    <span className="text-[8px] font-bold text-red-500 uppercase tracking-wider">Cheio</span>
                    <span className="text-[10px] text-brand-stone font-light italic">Sem vagas</span>
                  </>
                )}
                {day.status === 'closed' && (
                  <>
                    <span className="text-[8px] font-bold text-brand-stone/60 uppercase tracking-wider">Fechado</span>
                    <span className="text-[10px] text-brand-stone/40 font-light italic">-</span>
                  </>
                )}
              </div>
            </motion.button>
          ))}
        </div>
        
        <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-brand-stone/60 uppercase tracking-widest">
           <Calendar size={12} className="text-[var(--theme-accent,var(--color-brand-terracotta))]" />
           <span>Clique em um dia para ver os horários exatos</span>
        </div>
      </div>
    </section>
  );
};
