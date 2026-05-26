import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronLeft, X } from 'lucide-react';
import { PortfolioItem } from '../../types';
import PremiumButton from '../PremiumButton';
import { getProfileHeroCopy } from '../../lib/copy';
import { cn } from '../../lib/utils';

interface PortfolioSectionProps {
  portfolio: PortfolioItem[];
  onBookingClick: () => void;
  specialty?: string;
  professionalName?: string;
}

export const PortfolioSection = ({ portfolio, onBookingClick, specialty, professionalName }: PortfolioSectionProps) => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  useEffect(() => {
    if (selectedImageIndex !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; }
  }, [selectedImageIndex]);

  if (portfolio.length === 0) return null;

  const categories = ['all', ...Array.from(new Set(portfolio.map(item => item.category).filter(Boolean)))];
  const filteredItems = activeCategory === 'all' 
    ? portfolio 
    : portfolio.filter(item => item.category === activeCategory);

  const displayLimit = 5;
  const showMoreCTA = filteredItems.length > displayLimit;
  const displayItems = showMoreCTA ? filteredItems.slice(0, displayLimit) : filteredItems;

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
        {categories.length > 2 && (
          <div className="flex flex-wrap gap-2 mb-12">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "px-6 py-2.5 rounded-full text-[9px] font-bold uppercase tracking-[0.2em] transition-all border",
                  activeCategory === cat 
                    ? "bg-brand-ink text-brand-white border-brand-ink shadow-lg" 
                    : "bg-brand-white text-brand-stone border-brand-mist hover:border-[var(--theme-accent,var(--color-brand-terracotta))] hover:text-[var(--theme-accent,var(--color-brand-terracotta))]"
                )}
              >
                {cat === 'all' ? 'Todos' : cat}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8 auto-rows-[280px] md:auto-rows-[320px]">
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
                  "relative rounded-3xl overflow-hidden group cursor-pointer bg-brand-stone/5",
                  i === 0 && displayItems.length >= 4 ? "md:col-span-2 md:row-span-2" : ""
                )}
              >
                 <img
                  src={item.url}
                  alt={item.category || `Trabalho de ${professionalName || 'Beleza'}`}
                  className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
                
                {/* Visual Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-brand-ink/70 via-brand-ink/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-8">
                  <span className="font-serif italic text-white text-xl">{item.category}</span>
                </div>

                {/* Always visible category chip */}
                {item.category && (
                  <div className="absolute top-5 left-5 z-10 px-4 py-1.5 bg-brand-ink/40 backdrop-blur-md border border-white/20 rounded-full text-[8px] font-bold uppercase tracking-widest text-white shadow-sm transition-all group-hover:bg-[var(--theme-accent,var(--color-brand-terracotta))] group-hover:border-transparent">
                    {item.category}
                  </div>
                )}

                {/* Ver mais CTA if last item */}
                {showMoreCTA && i === displayItems.length - 1 && (
                  <div className="absolute inset-0 bg-brand-ink/40 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center transition-colors group-hover:bg-brand-ink/60">
                    <span className="text-white font-serif text-3xl mb-2">+{filteredItems.length - displayLimit}</span>
                    <span className="text-white/90 text-[10px] font-bold uppercase tracking-widest">Ver portfólio completo</span>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
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
            
            {filteredItems[selectedImageIndex].category && (
              <div className="absolute bottom-8 left-0 right-0 flex justify-center z-50 pointer-events-none">
                <div className="px-6 py-2.5 bg-brand-ink/50 backdrop-blur-xl border border-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest text-white shadow-xl">
                  {filteredItems[selectedImageIndex].category}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
