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
  message = "", // defaulting to no message for silence
  isExiting = false,
  fullScreen = true
}: AppLoadingScreenProps) {
  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }} // softer, slower transition
          className={cn(
            "flex flex-col items-center justify-center bg-[#FCFBF9]", // Use lighter #FCFBF9
            fullScreen ? "fixed inset-0 z-[9999]" : "w-full py-24 rounded-[40px] border border-brand-mist/60 shadow-sm"
          )}
        >
          <div className="relative flex flex-col items-center gap-6">
            {/* Soft Breathing Logo */}
            <motion.div
              animate={{ 
                opacity: [0.6, 1, 0.6]
              }}
              transition={{ 
                duration: 3, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
            >
              <Logo className="w-10 h-10 opacity-80" variant="light" />
            </motion.div>

            {/* Optional Loading text */}
            {message && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.8 }}
              >
                <p className="font-light text-[13px] text-brand-stone uppercase tracking-widest text-center mt-2">
                  {message}
                </p>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
