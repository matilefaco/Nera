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
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const getServiceCategoryLabel = (service: Service): string => {
    return service.serviceCategory || 'Outros';
  };

  const categories = useMemo(() => {
    const defaultOrdered = ['Todos'];
    const dynamicCats = new Set<string>();
    
    services.forEach(s => {
      const cat = getServiceCategoryLabel(s);
      dynamicCats.add(cat);
    });

    // Array.from(dynamicCats) but we can sort them alphabetically or order by some logic,
    // lets just keep the order they appear but ensure 'Todos' is first and 'Outros' is last.
    const arr = Array.from(dynamicCats).filter(c => c !== 'Outros').sort();
    if (dynamicCats.has('Outros')) {
      arr.push('Outros');
    }
    
    const finalCats = ['Todos', ...arr];
    return finalCats.length > 2 ? finalCats : [];
  }, [services]);

  const filteredServices = useMemo(() => {
    let list = services;
    if (selectedCategory !== 'Todos') {
      list = services.filter(s => getServiceCategoryLabel(s) === selectedCategory);
    }
    return list;
  }, [services, selectedCategory]);

  const isValidBadge = (badge: string | undefined): badge is string => {
    if (!badge) return false;
    // Allow known badge values to display
    const allowedBadges = ['Mais procurado', 'Novo', 'Promoção', 'Exclusivo', 'Pacote'];
    return allowedBadges.includes(badge);
  };

  const isCompact = services.length > 4;
  const displayLimit = isCompact ? 6 : 4;
  
  const displayServices = isExpanded ? filteredServices : filteredServices.slice(0, displayLimit);
  const showMoreCTA = !isExpanded && filteredServices.length > displayLimit;

  // Whenever category changes, reset expansion
  const handleCategorySelect = (cat: string) => {
    setSelectedCategory(cat);
    setIsExpanded(false);
  };

  if (services.length === 0) return null;

  return (
    <section className="py-16 md:py-24 px-4 sm:px-6 max-w-7xl mx-auto w-full">
      <div className="flex items-center gap-4 mb-4">
        <span className="label-text">Menu de Experiências</span>
        <div className="flex-1 h-px bg-brand-mist/50" />
      </div>
      
      <div className="flex flex-col gap-6 md:gap-8 mb-10 md:mb-16">
        <h2 className="heading-section text-brand-ink">
          Escolha sua<br />
          <em className="font-serif italic text-brand-stone">experiência</em>
        </h2>

        {categories.length > 1 && (
          <div className="sticky top-0 z-[100] bg-brand-parchment/90 backdrop-blur-xl pt-6 pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 space-y-5 border-b border-brand-mist/30">
            <div className="flex items-center gap-3 overflow-x-auto scrollbar-none no-scrollbar">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => handleCategorySelect(cat)}
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
          {displayServices.map((service, i) => (
            <motion.div
              key={service.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, delay: i * 0.03, ease: [0.23, 1, 0.32, 1] }}
              onClick={() => onSelectService(service)}
              className={cn(
                "group relative bg-brand-white border border-brand-mist rounded-[32px] overflow-hidden cursor-pointer transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-brand-terracotta/10",
                isCompact ? "p-5 md:p-6 flex items-center justify-between" : "p-8 md:p-9 flex flex-col justify-between min-h-[260px] md:min-h-[300px]"
              )}
            >
              <div className="relative z-10 flex flex-col flex-1">
                {isValidBadge(service.badge) && (
                  <span className={cn(
                    "inline-block border border-[var(--theme-accent,var(--color-brand-terracotta))]/20 text-[var(--theme-accent,var(--color-brand-terracotta))] font-bold uppercase tracking-[0.25em] rounded-full max-w-fit shadow-sm bg-brand-white/50 backdrop-blur-sm",
                    isCompact ? "px-2.5 py-1 text-[7px] mb-2" : "px-3.5 py-1.5 text-[8px] mb-4"
                  )}>
                    {service.badge}
                  </span>
                )}

                <div className="flex-1 pr-4 md:pr-6">
                  <h3 className={cn(
                    "font-serif text-brand-ink leading-snug mb-1.5",
                    isCompact ? "text-lg md:text-xl" : "text-2xl mb-3"
                  )}>
                    {service.name || "Serviço"}
                  </h3>

                  {service.description && (
                    <p className={cn(
                      "font-light leading-relaxed text-brand-stone",
                      isCompact ? "text-[11px] md:text-xs max-w-[280px] line-clamp-2" : "text-[13px] mb-6 line-clamp-3"
                    )}>
                      {service.description}
                    </p>
                  )}

                  {isCompact && (
                    <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest font-semibold text-[var(--theme-accent,var(--color-brand-terracotta))] mt-3">
                      <Clock size={10} />
                      {service.duration} min
                    </div>
                  )}
                </div>

                {!isCompact && (
                  <div className="mt-6 flex items-end justify-between border-t border-brand-mist/30 pt-6">
                    <div>
                      <div className="font-serif text-2xl text-brand-ink">
                        {formatCurrency(service.price || 0)}
                      </div>
                      <div className="text-[9px] font-medium uppercase tracking-[0.18em] text-brand-stone mt-1">
                        {service.duration || 0} minutos
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-brand-ink text-brand-white px-5 py-2.5 rounded-full text-[9px] font-bold uppercase tracking-[0.2em] hover:bg-[var(--theme-accent,var(--color-brand-terracotta))] transition-colors border border-transparent shadow-sm">
                      Reservar
                      <ChevronRight size={12} />
                    </div>
                  </div>
                )}
              </div>

              {isCompact && (
                <div className="relative z-10 flex flex-col items-end justify-center ml-4 shrink-0 h-full">
                  <div className="font-serif text-xl sm:text-2xl text-brand-ink whitespace-nowrap">
                    {formatCurrency(service.price || 0)}
                  </div>
                  <div className="flex items-center gap-1 text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.2em] text-brand-ink mt-3 min-w-max">
                    Reservar
                    <ChevronRight size={12} className="text-[var(--theme-accent,var(--color-brand-terracotta))] group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {showMoreCTA && (
        <div className="mt-12 flex justify-center">
          <button
            onClick={() => setIsExpanded(true)}
            className="group px-8 py-4 bg-brand-white border border-brand-mist rounded-full flex items-center justify-center gap-3 transition-all duration-300 hover:border-brand-ink hover:shadow-lg active:scale-95"
          >
            <span className="text-[11px] font-bold uppercase tracking-widest text-brand-stone group-hover:text-brand-ink transition-colors">
              Explorar todas as {filteredServices.length} experiências
            </span>
            <ChevronRight size={16} className="text-brand-stone group-hover:text-[var(--theme-accent,var(--color-brand-terracotta))] transition-colors" />
          </button>
        </div>
      )}

    </section>
  );
};
