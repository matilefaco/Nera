import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface HelpTooltipProps {
  content: string;
  className?: string;
}

export default function HelpTooltip({ content, className }: HelpTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsVisible(false);
      }
    }
    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible]);

  // Close on Escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsVisible(false);
      }
    }
    if (isVisible) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isVisible]);

  const toggleVisibility = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsVisible(!isVisible);
  };

  return (
    <div ref={containerRef} className={cn("relative inline-flex ml-1.5", className)}>
      <button
        type="button"
        onClick={toggleVisibility}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="text-brand-stone hover:text-brand-terracotta transition-colors opacity-40 hover:opacity-100 outline-none"
        aria-label="Ajuda"
      >
        <HelpCircle size={11} />
      </button>

      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 5 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute z-[100] bottom-full left-1/2 -translate-x-1/2 mb-3 w-[200px] sm:w-[240px] pointer-events-auto"
          >
            {/* Tooltip Content Card */}
            <div className="bg-brand-ink text-white p-3.5 rounded-2xl shadow-2xl border border-white/10 relative">
              <p className="text-[10px] leading-relaxed font-light italic text-brand-linen/90">
                {content}
              </p>
              
              {/* Mobile Close Button (only visible on touch) */}
              <button 
                className="absolute top-2 right-2 text-white/40 hover:text-white sm:hidden"
                onClick={() => setIsVisible(false)}
              >
                <X size={10} />
              </button>

              {/* Triangle Anchor */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-brand-ink" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
