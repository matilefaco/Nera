import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, ChevronRight, Filter } from 'lucide-react';
import { Service, UserProfile } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { categorizeService } from '../../lib/copy';

interface ServicesSectionProps {
  services: Service[];
  profile: UserProfile;
  onSelectService: (service: Service) => void;
}

export const ServicesSection = ({ services, profile, onSelectService }: ServicesSectionProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');

  const categories = useMemo(() => {
    const activeCats = new Set(['Todos']);
    services.forEach(s => activeCats.add(categorizeService(s.name)));
    
    // Explicit order based on product direction
    const ordered = ['Todos', 'Unhas', 'Sobrancelhas', 'Cílios', 'Cabelo', 'Estética', 'Outros'];
    const filtered = ordered.filter(cat => activeCats.has(cat));
    
    // Hide if only 'Todos' would show
    return filtered.length > 1 ? filtered : [];
  }, [services]);

  const filteredServices = useMemo(() => {
    if (selectedCategory === 'Todos') return services;
    return services.filter(s => categorizeService(s.name) === selectedCategory);
  }, [services, selectedCategory]);

  const isCompact = services.length > 4;

  if (services.length === 0) return null;

  return (
    <section className="py-24 px-6 max-w-7xl mx-auto w-full">
      <div className="flex items-center gap-4 mb-4">
        <span className="label-text">Menu de Experiências</span>
        <div className="flex-1 h-px bg-brand-mist/50" />
      </div>
      
      <div className="flex flex-col gap-8 mb-12">
        <h2 className="heading-section text-brand-ink">
          Escolha sua<br />
          <em className="font-serif italic text-brand-stone">experiência</em>
        </h2>

        {categories.length > 1 && (
          <div className="sticky top-0 z-[100] bg-brand-parchment/80 backdrop-blur-xl pt-4 pb-2 -mx-6 px-6 space-y-4">
            <div className="flex items-center gap-3 overflow-x-auto scrollbar-none no-scrollbar">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all border",
                    selectedCategory === cat 
                      ? "bg-brand-ink text-brand-white border-brand-ink shadow-lg" 
                      : "bg-brand-white text-brand-stone border-brand-mist hover:border-brand-ink"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
            
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-brand-stone/60 px-2">
              <span className="w-1 h-1 rounded-full bg-[var(--theme-accent,var(--color-brand-terracotta))]" />
              {filteredServices.length} {filteredServices.length === 1 ? 'experiência disponível' : 'experiências disponíveis'} em {selectedCategory === 'Todos' ? 'todas as categorias' : selectedCategory}
            </div>
          </div>
        )}
      </div>

      <div className={cn(
        "grid gap-4 md:gap-6",
        isCompact 
          ? "grid-cols-1 md:grid-cols-2" 
          : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
      )}>
        <AnimatePresence mode="popLayout">
          {filteredServices.map((service, i) => (
            <motion.div
              key={service.id}
              layout
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              onClick={() => onSelectService(service)}
              className={cn(
                "group relative bg-brand-white border border-brand-mist rounded-[32px] overflow-hidden cursor-pointer transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-brand-terracotta/10",
                isCompact ? "p-5 md:p-6 flex items-center justify-between" : "p-8 md:p-9 flex flex-col justify-between min-h-[260px] md:min-h-[300px]"
              )}
            >
              <div className="relative z-10 flex flex-col flex-1">
                {!isCompact && i === 0 && selectedCategory === 'Todos' && (
                  <span className="inline-block px-3 py-1 bg-brand-blush text-[var(--theme-accent,var(--color-brand-terracotta))] text-[8px] font-bold uppercase tracking-[0.25em] rounded-full mb-6 max-w-fit">
                    Mais procurado
                  </span>
                )}

                <div className="flex-1">
                  <h3 className={cn(
                    "font-serif text-brand-ink leading-tight mb-2",
                    isCompact ? "text-lg" : "text-2xl"
                  )}>
                    {service.name || "Serviço"}
                  </h3>

                  <p className={cn(
                    "font-light leading-relaxed text-brand-stone line-clamp-2",
                    isCompact ? "text-[11px] max-w-[200px] md:max-w-md" : "text-[13px] mb-6"
                  )}>
                    {service.description || "Nenhuma descrição disponível."}
                  </p>

                  {isCompact && (
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--theme-accent,var(--color-brand-terracotta))] mt-1">
                      {service.duration} min
                    </div>
                  )}
                </div>

                {!isCompact && (
                  <div className="mt-6 flex items-end justify-between border-t border-brand-mist/50 pt-6">
                    <div>
                      <div className="font-serif text-2xl text-brand-ink">
                        {formatCurrency(service.price || 0)}
                      </div>
                      <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-brand-stone">
                        {service.duration || 0} minutos
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-brand-ink text-brand-white px-5 py-2.5 rounded-full text-[9px] font-bold uppercase tracking-[0.2em] transition-transform active:scale-95">
                      Reservar
                      <ChevronRight size={12} />
                    </div>
                  </div>
                )}
              </div>

              {isCompact && (
                <div className="relative z-10 flex flex-col items-end gap-3 ml-4">
                  <div className="font-serif text-xl border-b border-brand-mist/30 pb-0.5">
                    {formatCurrency(service.price || 0)}
                  </div>
                  <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--theme-accent,var(--color-brand-terracotta))] group-hover:translate-x-1 transition-transform">
                    Reservar
                    <ChevronRight size={12} />
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {profile.paymentMethods && profile.paymentMethods.length > 0 && (
        <div className="mt-8 pt-8 border-t border-brand-mist">
          <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-brand-stone mb-4">
            Formas de Pagamento
          </p>
          <div className="flex flex-wrap gap-2">
            {profile.paymentMethods.map((m) => {
              const labels: Record<string, string> = {
                pix: '◉ Pix', credito: '⬡ Cartão de Crédito',
                debito: '⬡ Cartão de Débito', dinheiro: '◎ Dinheiro',
                transferencia: '⇄ Transferência'
              };
              return (
                <span key={m} className="px-4 py-2 bg-brand-parchment border border-brand-mist rounded-full text-[9px] font-bold uppercase tracking-[0.15em] text-brand-stone">
                  {labels[m] || m}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
