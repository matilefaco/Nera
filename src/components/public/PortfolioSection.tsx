import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight } from 'lucide-react';
import { PortfolioItem } from '../../types';
import PremiumButton from '../PremiumButton';
import { getProfileHeroCopy } from '../../lib/copy';

interface PortfolioSectionProps {
  portfolio: PortfolioItem[];
  onBookingClick: () => void;
  specialty?: string;
}

export const PortfolioSection = ({ portfolio, onBookingClick, specialty }: PortfolioSectionProps) => {
  const [activeCategory, setActiveCategory] = useState('all');

  if (portfolio.length === 0) return null;

  const tagline = getProfileHeroCopy(specialty);
  const categories = ['all', ...Array.from(new Set(portfolio.map(item => item.category).filter(Boolean)))];
  const filteredItems = activeCategory === 'all' 
    ? portfolio 
    : portfolio.filter(item => item.category === activeCategory);

  return (
    <section className="bg-brand-linen py-32 px-6 border-y border-brand-mist/50">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-10 mb-16">
          <div>
            <div className="flex items-center gap-4 mb-4">
              <span className="label-text">Portfólio</span>
              <div className="w-12 h-px bg-brand-mist" />
            </div>
            <h2 className="heading-section text-brand-ink">
              {tagline.main}<br />
              <em className="font-serif italic text-brand-stone">{tagline.accent}</em>
            </h2>
          </div>

          <PremiumButton onClick={onBookingClick} variant="terracotta" className="px-10 py-5 text-[10px]">
            Agendar agora
            <ChevronRight size={14} className="ml-2" />
          </PremiumButton>
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
                    : "bg-brand-white text-brand-stone border-brand-mist hover:border-brand-terracotta hover:text-brand-terracotta"
                )}
              >
                {cat === 'all' ? 'Todos' : cat}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-[300px]">
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item, i) => (
              <motion.div
                key={item.id || i}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className={cn(
                  "relative rounded-3xl overflow-hidden group cursor-zoom-in",
                  i === 0 && filteredItems.length >= 4 ? "md:col-span-2 md:row-span-2" : ""
                )}
              >
                 <img
                  src={item.url}
                  alt={item.category}
                  className="w-full h-full object-cover filter saturate-[0.8] group-hover:saturate-100 group-hover:scale-105 transition-all duration-700"
                  referrerPolicy="no-referrer"
                />
                
                {/* Visual Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-brand-ink/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-8">
                  <span className="font-serif italic text-white text-xl">{item.category}</span>
                </div>

                {/* Always visible category chip */}
                {item.category && (
                  <div className="absolute top-4 left-4 z-10 px-4 py-1.5 bg-brand-ink/30 backdrop-blur-md border border-white/10 rounded-full text-[8px] font-bold uppercase tracking-widest text-white transition-colors group-hover:bg-brand-terracotta group-hover:border-transparent">
                    {item.category}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};

// Utils import for cn
import { cn } from '../../lib/utils';
