import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronLeft, X } from 'lucide-react';
import { PortfolioItem, Service } from '../../types';
import { normalizePortfolioCategory } from '../../lib/portfolioUtils';
import PremiumButton from '../PremiumButton';
import { cn } from '../../lib/utils';

interface PortfolioSectionProps {
  portfolio: PortfolioItem[];
  services?: Service[];
  onBookingClick: () => void;
  specialty?: string;
  professionalName?: string;
}

export const PortfolioSection = ({ portfolio, services = [], onBookingClick, specialty, professionalName }: PortfolioSectionProps) => {
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [activeLinkedService, setActiveLinkedService] = useState<string>('all');
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setActiveLinkedService('all');
  }, [activeCategory]);

  useEffect(() => {
    if (selectedImageIndex !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; }
  }, [selectedImageIndex]);

  const validCategories = useMemo(() => {
    const categoriesMap = new Map<string, string>();
    services.forEach(svc => {
      const label = svc.serviceCategory || '';
      if (label && label.trim().length > 0) {
        const id = label.toLowerCase().replace(/[^a-z0-9]/g, '-');
        if (!categoriesMap.has(id)) {
          categoriesMap.set(id, label);
        }
      }
    });
    return Array.from(categoriesMap.entries()).map(([id, label]) => ({id, label}));
  }, [services]);

  const normalizedPortfolio = useMemo(() => portfolio.map((item, index) => {
    const rawCat = item.categoryLabel || item.category || '';
    const normCat = normalizePortfolioCategory(rawCat, validCategories);
    const isFallback = normCat === 'Sem categoria';
    
    // Dynamic lookup as a robust fallback
    let derivedServiceName = item.linkedServiceName;
    if (item.linkedServiceId && (!derivedServiceName || derivedServiceName.trim() === '')) {
      const match = services.find(s => s.id === item.linkedServiceId);
      if (match) derivedServiceName = match.name;
    }
    
    return {
      ...item,
      linkedServiceName: derivedServiceName,
      displayCategory: isFallback ? '' : normCat,
      originalIndex: index
    };
  }), [portfolio, validCategories, services]);

  const uniqueCategories = useMemo(() => 
    Array.from(new Set(normalizedPortfolio.map(item => item.displayCategory).filter(cat => cat !== ''))).sort((a,b) => a.localeCompare(b)),
  [normalizedPortfolio]);

  const hasFeatured = useMemo(() => 
    normalizedPortfolio.some(i => i.isFeatured), 
  [normalizedPortfolio]);

  const hasMultipleCategories = uniqueCategories.length > 1;

  useEffect(() => {
    if (!activeCategory) {
      if (hasMultipleCategories) {
        setActiveCategory('Todos');
      } else {
        setActiveCategory('all'); // fallback single category
      }
    }
  }, [hasMultipleCategories, activeCategory]);

  const currentCategory = activeCategory || (hasMultipleCategories ? 'Todos' : 'all');

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    setIsExpanded(false);
  };

  const availableLinkedServices = useMemo(() => {
    if (currentCategory === 'Todos' || currentCategory === 'Destaques') return [];
    
    // For 'all' (single category fallback), we check everything
    const itemsInCategory = (currentCategory === 'all' && !hasMultipleCategories) 
      ? normalizedPortfolio 
      : normalizedPortfolio.filter(item => item.displayCategory === currentCategory);
    
    // Extract unique linked services inside this category
    const servicesObj: Record<string, string> = {};
    itemsInCategory.forEach(i => {
      if (i.linkedServiceId && i.linkedServiceName) {
        servicesObj[i.linkedServiceId] = i.linkedServiceName;
      }
    });
    
    const uniqueServices = Object.entries(servicesObj).map(([id, name]) => ({ id, name }));
    // Only show if >= 2 unique services
    return uniqueServices.length >= 2 ? uniqueServices.sort((a,b) => a.name.localeCompare(b.name)) : [];
  }, [normalizedPortfolio, currentCategory, hasMultipleCategories]);

  const filteredItems = useMemo(() => {
    let baseItems = [];
    if (currentCategory === 'Destaques') {
      baseItems = normalizedPortfolio
        .filter(item => item.isFeatured)
        .sort((a, b) => {
          if (a.orderIdx !== b.orderIdx) return (a.orderIdx || 0) - (b.orderIdx || 0);
          return a.originalIndex - b.originalIndex;
        })
        .slice(0, 5);
    } else {
      baseItems = currentCategory === 'Todos' || currentCategory === 'all'
        ? normalizedPortfolio
        : normalizedPortfolio.filter(item => item.displayCategory === currentCategory);
    }
      
    // Apply linked service filter if active
    if (activeLinkedService !== 'all') {
      baseItems = baseItems.filter(item => item.linkedServiceId === activeLinkedService);
    }
      
    // Sort so featured come first
    return [...baseItems].sort((a, b) => {
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;
      if (a.isFeatured && b.isFeatured) {
         if (a.orderIdx !== b.orderIdx) return (a.orderIdx || 0) - (b.orderIdx || 0);
      }
      return a.originalIndex - b.originalIndex;
    });
  }, [normalizedPortfolio, currentCategory, activeLinkedService]);

  if (portfolio.length === 0) return null;

  const displayLimit = 5;
  const showMoreCTA = !isExpanded && filteredItems.length > displayLimit && currentCategory !== 'Destaques';
  const displayItems = isExpanded ? filteredItems : filteredItems.slice(0, displayLimit);

  const openModal = (index: number) => setSelectedImageIndex(index);
  const closeModal = () => setSelectedImageIndex(null);
  
  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedImageIndex !== null && selectedImageIndex < filteredItems.length - 1) {
      setSelectedImageIndex(selectedImageIndex + 1);
    }
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedImageIndex !== null && selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1);
    }
  };

  return (
    <section className="bg-brand-linen py-20 md:py-32 px-4 sm:px-6 border-y border-brand-mist/50">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-10 mb-10 md:mb-16">
          <div>
            <div className="flex items-center gap-4 mb-4">
              <span className="label-text">Portfólio</span>
              <div className="w-12 h-px bg-brand-mist" />
            </div>
            <h2 className="heading-section text-brand-ink">
              Resultados de<br />
              <em className="font-serif italic text-brand-stone">alta performance</em>
            </h2>
          </div>

          <div className="hidden md:block">
            <PremiumButton onClick={onBookingClick} variant="terracotta" className="px-10 py-5 text-[10px] tracking-widest shadow-lg">
              Quero esse resultado
              <ChevronRight size={14} className="ml-2" />
            </PremiumButton>
          </div>
        </div>

        {/* Categories */}
        {hasMultipleCategories && (
          <div className="flex overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] gap-2 mb-8 md:mb-12 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            {hasFeatured && (
              <button
                onClick={() => handleCategoryChange('Destaques')}
                className={cn(
                  "flex-shrink-0 whitespace-nowrap px-6 py-2.5 rounded-full text-[9px] font-bold uppercase tracking-[0.2em] transition-all border",
                  currentCategory === 'Destaques'
                    ? "bg-brand-ink text-brand-white border-brand-ink shadow-lg" 
                    : "bg-brand-white text-brand-stone border-brand-mist hover:border-[var(--theme-accent,var(--color-brand-terracotta))] hover:text-[var(--theme-accent,var(--color-brand-terracotta))]"
                )}
              >
                Destaques
              </button>
            )}
            <button
              onClick={() => handleCategoryChange('Todos')}
              className={cn(
                "flex-shrink-0 whitespace-nowrap px-6 py-2.5 rounded-full text-[9px] font-bold uppercase tracking-[0.2em] transition-all border",
                currentCategory === 'Todos'
                  ? "bg-brand-ink text-brand-white border-brand-ink shadow-lg" 
                  : "bg-brand-white text-brand-stone border-brand-mist hover:border-[var(--theme-accent,var(--color-brand-terracotta))] hover:text-[var(--theme-accent,var(--color-brand-terracotta))]"
              )}
            >
              Todos
            </button>
            {uniqueCategories.map(cat => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={cn(
                  "flex-shrink-0 whitespace-nowrap px-6 py-2.5 rounded-full text-[9px] font-bold uppercase tracking-[0.2em] transition-all border",
                  currentCategory === cat 
                    ? "bg-brand-ink text-brand-white border-brand-ink shadow-lg" 
                    : "bg-brand-white text-brand-stone border-brand-mist hover:border-[var(--theme-accent,var(--color-brand-terracotta))] hover:text-[var(--theme-accent,var(--color-brand-terracotta))]"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Sub Categories / Linked Services */}
        {availableLinkedServices.length > 0 && (
          <div className="flex overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] gap-2 mb-8 -mt-4 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            <button
              onClick={() => {
                setActiveLinkedService('all');
                setIsExpanded(false);
              }}
              className={cn(
                "flex-shrink-0 whitespace-nowrap px-4 py-1.5 rounded-full text-[10px] sm:text-[11px] font-medium transition-all",
                activeLinkedService === 'all'
                  ? "bg-[var(--theme-primary,var(--color-brand-terracotta))] text-brand-white shadow-md border border-[var(--theme-primary,var(--color-brand-terracotta))]"
                  : "bg-brand-white text-brand-stone border border-brand-mist hover:bg-brand-white hover:border-[var(--theme-primary,var(--color-brand-terracotta))]"
              )}
            >
              Todos{currentCategory === 'all' ? '' : ` de ${currentCategory}`}
            </button>
            {availableLinkedServices.map(svc => (
              <button
                key={svc.id}
                onClick={() => {
                  setActiveLinkedService(svc.id);
                  setIsExpanded(false);
                }}
                className={cn(
                  "flex-shrink-0 whitespace-nowrap px-4 py-1.5 rounded-full text-[10px] sm:text-[11px] font-medium transition-all",
                  activeLinkedService === svc.id
                    ? "bg-[var(--theme-primary,var(--color-brand-terracotta))] text-brand-white shadow-md border border-[var(--theme-primary,var(--color-brand-terracotta))]"
                    : "bg-brand-white text-brand-stone border border-brand-mist hover:bg-brand-white hover:border-[var(--theme-primary,var(--color-brand-terracotta))]"
                )}
              >
                {svc.name}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 auto-rows-[160px] sm:auto-rows-[240px] lg:auto-rows-[320px]">
          <AnimatePresence mode="popLayout">
            {displayItems.map((item, i) => (
              <motion.div
                key={item.id || i}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                onClick={() => openModal(i)}
                className={cn(
                  "relative rounded-[1.25rem] sm:rounded-3xl overflow-hidden group cursor-pointer bg-brand-stone/5",
                  i === 0 && displayItems.length >= 4 ? "col-span-2 row-span-2" : "col-span-1 row-span-1"
                )}
              >
                 <img
                  src={item.url}
                  alt={item.displayCategory || `Trabalho de ${professionalName || 'Beleza'}`}
                  className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
                
                {/* Visual Overlay / Rodapé para Serviço Específico */}
                {item.linkedServiceName && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-4 sm:p-6 flex flex-col justify-end transition-opacity duration-300 opacity-100 md:opacity-90 md:group-hover:opacity-100">
                    <span className="font-serif italic text-white text-base sm:text-lg drop-shadow-md leading-tight">{item.linkedServiceName}</span>
                  </div>
                )}

                {/* Always visible category chip - badge */}
                {item.displayCategory && item.displayCategory !== 'Portfólio' && (
                  <div className="absolute top-3 sm:top-4 left-3 sm:left-4 z-10 px-3 sm:px-4 py-1 sm:py-1.5 bg-black/40 backdrop-blur-md border border-white/20 rounded-full text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-white shadow-sm transition-all group-hover:bg-[var(--theme-accent,var(--color-brand-terracotta))] group-hover:border-transparent">
                    {item.displayCategory}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Ver Mais Button */}
        {showMoreCTA && (
          <div className="mt-8 md:mt-12 flex justify-center">
             <button 
               onClick={() => setIsExpanded(true)}
               className="px-8 py-3 rounded-full border border-brand-mist bg-transparent text-brand-ink text-[10px] uppercase tracking-widest font-bold hover:bg-brand-linen hover:border-[var(--theme-accent,var(--color-brand-terracotta))] hover:text-[var(--theme-accent,var(--color-brand-terracotta))] transition-colors"
             >
               Ver mais {currentCategory !== 'Todos' && currentCategory !== 'Destaques' && currentCategory !== 'all' ? `em ${currentCategory}` : 'fotos'}
             </button>
          </div>
        )}
      </div>

      {/* Modal Gallery */}
      <AnimatePresence>
        {selectedImageIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-ink/95 backdrop-blur-md"
            onClick={closeModal}
          >
            <div className="absolute top-6 left-6 xs:top-8 xs:left-8 flex flex-col">
              <span className="text-white/60 text-[10px] uppercase font-bold tracking-widest mb-1">Portfólio</span>
              <span className="text-white font-serif text-lg">{selectedImageIndex + 1} / {filteredItems.length}</span>
            </div>
            
            <button 
              className="absolute top-6 right-6 xs:top-8 xs:right-8 w-12 h-12 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-colors z-50 backdrop-blur-md"
              onClick={closeModal}
            >
              <X size={24} />
            </button>

            <div className="relative w-full h-full max-w-6xl max-h-[85vh] flex items-center justify-center px-4 md:px-20 mt-16 md:mt-0" onClick={e => e.stopPropagation()}>
              {selectedImageIndex > 0 && (
                <button 
                  className="absolute left-2 md:left-4 w-12 h-12 md:w-16 md:h-16 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all z-50 backdrop-blur-md hidden sm:flex hover:scale-105"
                  onClick={prevImage}
                >
                  <ChevronLeft size={28} />
                </button>
              )}
              
              <AnimatePresence mode="wait">
                <motion.img
                  key={selectedImageIndex}
                  src={filteredItems[selectedImageIndex].url}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                  referrerPolicy="no-referrer"
                />
              </AnimatePresence>

              {/* Mobile swipe targets */}
              <div className="absolute inset-y-0 left-0 w-1/3 z-40 sm:hidden" onClick={prevImage} />
              <div className="absolute inset-y-0 right-0 w-1/3 z-40 sm:hidden" onClick={nextImage} />

              {selectedImageIndex < filteredItems.length - 1 && (
                <button 
                  className="absolute right-2 md:right-4 w-12 h-12 md:w-16 md:h-16 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all z-50 backdrop-blur-md hidden sm:flex hover:scale-105"
                  onClick={nextImage}
                >
                  <ChevronRight size={28} />
                </button>
              )}
            </div>
            
            {(() => {
              const currentItem = filteredItems[selectedImageIndex] as any;
              if (!currentItem) return null;
              
              const cat = currentItem.displayCategory && currentItem.displayCategory !== 'Portfólio' ? currentItem.displayCategory : '';
              const srv = currentItem.linkedServiceName || '';
              
              if (!cat && !srv) return null;

              return (
                <div className="absolute bottom-8 left-0 right-0 flex justify-center z-50 pointer-events-none px-4 text-center">
                  <div className="flex flex-col items-center px-6 py-2.5 bg-black/50 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl">
                    {cat && <span className={cn("font-bold uppercase tracking-[0.2em] text-white/80", srv ? "text-[8px] sm:text-[9px] mb-1" : "text-[10px]")}>{cat}</span>}
                    {srv && <span className="font-serif italic text-white text-base sm:text-lg leading-tight">{srv}</span>}
                  </div>
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

