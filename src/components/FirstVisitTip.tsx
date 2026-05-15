import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { useFirstVisitTip } from '../hooks/useFirstVisitTip';
import { createPortal } from 'react-dom';

interface FirstVisitTipProps {
  pageKey: string;
  title: string;
  description: string;
  targetId?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export const FirstVisitTip = ({
  pageKey,
  title,
  description,
  targetId,
  position = 'bottom',
  className
}: FirstVisitTipProps) => {
  const { showTip, dismissTip } = useFirstVisitTip(pageKey);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showTip && targetId) {
      const updatePosition = () => {
        const el = document.getElementById(targetId);
        if (el) {
          const rect = el.getBoundingClientRect();
          const scrollY = window.scrollY;
          const scrollX = window.scrollX;

          let top = 0;
          let left = 0;

          if (position === 'bottom') {
            top = rect.bottom + scrollY + 12;
            left = rect.left + scrollX + rect.width / 2;
          } else if (position === 'top') {
            top = rect.top + scrollY - 12;
            left = rect.left + scrollX + rect.width / 2;
          } else if (position === 'left') {
            top = rect.top + scrollY + rect.height / 2;
            left = rect.left + scrollX - 12;
          } else if (position === 'right') {
            top = rect.top + scrollY + rect.height / 2;
            left = rect.right + scrollX + 12;
          }

          setCoords({ top, left });
        }
      };

      // Initial delay to ensure the target element is rendered and potentially animated into place
      const timer = setTimeout(updatePosition, 500);
      
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition);
      
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition);
      };
    }
  }, [showTip, targetId, position]);

  const content = (
    <AnimatePresence>
      {showTip && (
        <motion.div
          key="first-visit-tip"
          ref={tipRef}
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 10 }}
          className={cn(
            "z-[9999] bg-brand-ink text-white p-6 rounded-[32px] shadow-2xl border border-white/10",
            targetId ? "fixed w-72 -translate-x-1/2" : "fixed top-12 left-1/2 -translate-x-1/2 md:w-[480px] w-[calc(100%-32px)]",
            position === 'top' && "-translate-y-full",
            position === 'left' && "-translate-x-full -translate-y-1/2",
            position === 'right' && "translate-x-0 -translate-y-1/2",
            className
          )}
          style={coords ? { top: coords.top, left: coords.left } : undefined}
        >
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-brand-terracotta/20 text-brand-terracotta rounded-xl">
                <Sparkles size={16} />
              </div>
              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em]">{title}</h4>
            </div>
            
            <p className="text-sm font-serif italic text-white/80 leading-relaxed mb-6">
              {description}
            </p>

            <button
              onClick={dismissTip}
              className="w-full py-3 bg-brand-terracotta text-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-brand-sienna transition-all shadow-lg shadow-brand-terracotta/20"
            >
              Entendi
            </button>
          </div>

          {/* Arrow for pointed tooltips */}
          {targetId && (
            <div 
              className={cn(
                "absolute w-4 h-4 bg-brand-ink rotate-45 border-white/10",
                position === 'bottom' ? "-top-2 left-1/2 -translate-x-1/2 border-t border-l" :
                position === 'top' ? "-bottom-2 left-1/2 -translate-x-1/2 border-b border-r" :
                position === 'left' ? "-right-2 top-1/2 -translate-y-1/2 border-t border-r" :
                "-left-2 top-1/2 -translate-y-1/2 border-b border-l"
              )}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return targetId ? createPortal(content, document.body) : content;
};
