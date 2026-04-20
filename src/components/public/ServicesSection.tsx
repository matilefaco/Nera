import React from 'react';
import { motion } from 'motion/react';
import { Clock, ChevronRight } from 'lucide-react';
import { Service } from '../../types';
import { formatCurrency } from '../../lib/utils';

interface ServicesSectionProps {
  services: Service[];
  onSelectService: (service: Service) => void;
}

export const ServicesSection = ({ services, onSelectService }: ServicesSectionProps) => {
  if (services.length === 0) return null;

  return (
    <section className="py-32 px-6 max-w-7xl mx-auto w-full">
      <div className="flex items-center gap-4 mb-4">
        <span className="label-text">Menu de Experiências</span>
        <div className="flex-1 h-px bg-brand-mist/50" />
      </div>
      
      <h2 className="heading-section text-brand-ink mb-16">
        Escolha sua<br />
        <em className="font-serif italic text-brand-stone">experiência</em>
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map((service, i) => (
          <motion.div
            key={service.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            onClick={() => onSelectService(service)}
            className="group relative bg-brand-white border border-brand-mist rounded-[32px] p-9 cursor-pointer overflow-hidden flex flex-col min-h-[320px] transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-brand-terracotta/10"
          >
            {/* Background Hover Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-brand-terracotta to-brand-sienna opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative z-10 flex flex-col h-full">
              {i === 0 && (
                <span className="inline-block px-3 py-1 bg-brand-blush text-brand-terracotta text-[8px] font-bold uppercase tracking-[0.25em] rounded-full mb-6 group-hover:bg-white/20 group-hover:text-white transition-colors">
                  Mais procurado
                </span>
              )}

              <h3 className="font-serif text-2xl text-brand-ink mb-3 group-hover:text-brand-white transition-colors leading-tight">
                {service.name}
              </h3>

              <p className="text-[13px] font-light leading-relaxed text-brand-stone group-hover:text-brand-white/80 transition-colors mb-8 line-clamp-3">
                {service.description || 'Uma experiência completa de cuidado e bem-estar para valorizar sua beleza única.'}
              </p>

              <div className="mt-auto">
                <div className="w-full h-px bg-brand-mist group-hover:bg-white/20 mb-6 transition-colors" />
                
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-serif text-2xl text-brand-ink group-hover:text-brand-white transition-colors">
                      {formatCurrency(service.price)}
                    </div>
                    <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-brand-stone group-hover:text-brand-white/60 transition-colors">
                      {service.duration} minutos
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-brand-terracotta group-hover:text-brand-white transition-colors">
                    Reservar
                    <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </div>

            {/* Decorative Number */}
            <div className="absolute bottom-[-10px] right-4 font-serif text-[80px] text-brand-linen opacity-10 group-hover:text-white/5 transition-colors pointer-events-none select-none">
              {(i + 1).toString().padStart(2, '0')}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
