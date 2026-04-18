import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Logo from './Logo';
import { cn } from '../lib/utils';

interface AppLoadingScreenProps {
  message?: string;
  isExiting?: boolean;
  fullScreen?: boolean;
}

export default function AppLoadingScreen({ 
  message = "Preparando sua experiência...", 
  isExiting = false,
  fullScreen = true
}: AppLoadingScreenProps) {
  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className={cn(
            "flex flex-col items-center justify-center bg-brand-parchment",
            fullScreen ? "fixed inset-0 z-[9999]" : "w-full py-24 rounded-[40px] border border-brand-mist shadow-sm"
          )}
        >
          <div className="relative flex flex-col items-center gap-8">
            {/* Pulsing Logo Container */}
            <motion.div
              animate={{ 
                scale: [1, 1.05, 1],
                opacity: [0.9, 1, 0.9]
              }}
              transition={{ 
                duration: 2, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
              className="relative"
            >
              <Logo className="w-12 h-12" variant="terracotta" />
              
              {/* Decorative rings */}
              <motion.div 
                animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                className="absolute inset-0 rounded-[10px] border border-brand-terracotta/20"
              />
            </motion.div>

            {/* Loading text with typewriter or fade-in effect */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="flex flex-col items-center gap-2"
            >
              <p className="font-serif italic text-brand-ink text-xl text-center">
                {message}
              </p>
              
              {/* Minimal progress indicator */}
              <div className="w-48 h-[1px] bg-brand-mist relative overflow-hidden mt-4">
                <motion.div 
                  animate={{ 
                    x: ['-100%', '100%'] 
                  }}
                  transition={{ 
                    duration: 1.5, 
                    repeat: Infinity, 
                    ease: "easeInOut" 
                  }}
                  className="absolute inset-0 bg-brand-terracotta w-1/3"
                />
              </div>
            </motion.div>
          </div>

          {/* Background Texture Overlay (Subtle) */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')]" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
