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
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const getServiceCategoryLabel = (service: Service): string => {
    return service.serviceCategory || 'Outros';
  };

  const categoriesOrder = useMemo(() => {
    const dynamicCats = new Set<string>();
    
    services.forEach(s => {
      const cat = getServiceCategoryLabel(s);
      dynamicCats.add(cat);
    });

    const arr = Array.from(dynamicCats).filter(c => c !== 'Outros');
    if (dynamicCats.has('Outros')) {
      arr.push('Outros');
    }
    
    return arr;
  }, [services]);

  const servicesByCategory = useMemo(() => {
    const grouped = new Map<string, Service[]>();
    categoriesOrder.forEach(c => grouped.set(c, []));

    services.forEach(s => {
      const cat = getServiceCategoryLabel(s);
      grouped.get(cat)?.push(s);
    });

    return grouped;
  }, [services, categoriesOrder]);

  const isValidBadge = (badge: string | undefined): badge is string => {
    if (!badge) return false;
    // Allow known badge values to display
    const allowedBadges = ['Mais procurado', 'Novo', 'Promoção', 'Exclusivo', 'Pacote'];
    return allowedBadges.includes(badge);
  };

  const toggleCategoryExpansion = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  if (services.length === 0) return null;

  return (
    <section data-marketing-section="services" className="py-12 md:py-16 px-4 sm:px-6 max-w-7xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--theme-accent,var(--color-brand-terracotta))]">Menu de Experiências</span>
        <div className="flex-1 h-px bg-brand-mist/50" />
      </div>
      
      <div className="flex flex-col gap-4 md:gap-5 mb-6 md:mb-10">
        <h2 className="font-serif text-3xl md:text-4xl text-brand-ink leading-tight">
          Escolha sua<br />
          <em className="font-serif italic text-brand-stone">experiência</em>
        </h2>

        {categoriesOrder.length > 1 && (
          <div className="sticky top-0 z-[100] bg-brand-parchment/90 backdrop-blur-xl pt-4 pb-3 -mx-4 px-4 sm:-mx-6 sm:px-6 space-y-3 border-b border-brand-mist/30">
            <div className="flex items-center gap-2.5 overflow-x-auto scrollbar-none no-scrollbar pb-1">
              {categoriesOrder.map(cat => (
                <button
                  key={cat}
                  onClick={() => {
                    const el = document.getElementById(`category-${cat}`);
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  className="px-5 py-2 rounded-full text-[9px] md:text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all border bg-brand-white text-brand-stone border-brand-mist hover:border-brand-ink shrink-0"
                >
                  {cat}
                </button>
              ))}
            </div>
            
            <div className="flex items-center gap-2 text-[8px] md:text-[9px] font-bold uppercase tracking-[0.2em] text-brand-stone/60 px-1">
              <span className="w-1 h-1 rounded-full bg-[var(--theme-accent,var(--color-brand-terracotta))]" />
              {services.length} {services.length === 1 ? 'experiência disponível' : 'experiências disponíveis'}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-12 md:gap-20">
        {categoriesOrder.map(category => {
          const catServices = servicesByCategory.get(category) || [];
          if (catServices.length === 0) return null;

          const displayLimit = 6;
          const isCatExpanded = expandedCategories.has(category);
          const displayServices = isCatExpanded ? catServices : catServices.slice(0, displayLimit);
          const showMoreCTA = !isCatExpanded && catServices.length > displayLimit;

          return (
            <div key={category} id={`category-${category}`} className="scroll-mt-[180px]">
              {categoriesOrder.length > 1 && (
                <div className="flex items-center gap-4 mb-5 md:mb-6">
                  <h3 className="text-[11px] md:text-xs font-bold uppercase tracking-[0.15em] text-[var(--theme-accent,var(--color-brand-terracotta))]">
                    {category}
                  </h3>
                  <div className="flex-1 h-px bg-brand-mist/50" />
                </div>
              )}

              <div className="grid gap-4 md:gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {displayServices.map((service, i) => (
                    <motion.div
                      key={service.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.4, delay: i * 0.03, ease: [0.23, 1, 0.32, 1] }}
                      onClick={() => onSelectService(service)}
                      className="group relative bg-brand-white border border-brand-mist rounded-[28px] overflow-hidden cursor-pointer transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-brand-terracotta/10 h-full p-5 md:p-6 flex flex-col justify-between min-h-[180px] md:min-h-[200px]"
                    >
                      <div className="relative z-10 flex flex-col flex-1 w-full h-full">
                        {/* Reservar área consistente para badge */}
                        <div className="flex-shrink-0 flex items-start min-h-[24px] mb-2">
                          {isValidBadge(service.badge) && (
                            <span className="inline-block border border-[var(--theme-accent,var(--color-brand-terracotta))]/20 text-[var(--theme-accent,var(--color-brand-terracotta))] font-bold uppercase tracking-[0.25em] rounded-full max-w-fit shadow-sm bg-brand-white/50 backdrop-blur-sm px-3 py-1 text-[8px]">
                              {service.badge}
                            </span>
                          )}
                        </div>

                        <div className="flex-1 flex flex-col">
                          <h3 className="font-serif text-brand-ink leading-snug text-lg md:text-xl mb-2 line-clamp-2">
                            {service.name || "Serviço"}
                          </h3>

                          {/* Área reservada para descrição. Reduzida quando não há texto para o card não ficar inchado. */}
                          <div className={cn("flex-shrink-0 transition-all", service.description ? "min-h-[36px] mb-3" : "min-h-[4px]")}>
                            {service.description && (
                              <p className="font-light leading-relaxed text-brand-stone text-[12px] md:text-[13px] line-clamp-2">
                                {service.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-auto flex items-end justify-between border-t border-brand-mist/30 pt-4">
                          <div>
                            <div className="font-serif text-xl md:text-2xl text-brand-ink">
                              {formatCurrency(service.price || 0)}
                            </div>
                            <div className="text-[9px] font-medium uppercase tracking-[0.18em] text-brand-stone mt-1">
                              {service.duration || 0} minutos
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 bg-brand-ink text-brand-white px-4 md:px-5 py-2 md:py-2.5 rounded-full text-[8px] md:text-[9px] font-bold uppercase tracking-[0.2em] hover:bg-[var(--theme-accent,var(--color-brand-terracotta))] transition-colors border border-transparent shadow-sm shrink-0">
                            Reservar
                            <ChevronRight size={12} />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {showMoreCTA && (
                <div className="mt-8 flex justify-center">
                  <button
                    onClick={() => toggleCategoryExpansion(category)}
                    className="group px-8 py-4 bg-brand-white border border-brand-mist rounded-full flex items-center justify-center gap-3 transition-all duration-300 hover:border-brand-ink hover:shadow-lg active:scale-95"
                  >
                    <span className="text-[11px] font-bold uppercase tracking-widest text-brand-stone group-hover:text-brand-ink transition-colors">
                      Ver mais em {category}
                    </span>
                    <ChevronRight size={16} className="text-brand-stone group-hover:text-[var(--theme-accent,var(--color-brand-terracotta))] transition-colors" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

    </section>
  );
};

