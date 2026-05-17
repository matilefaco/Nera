import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertCircle } from 'lucide-react';

interface SilentConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'info';
}

export default function SilentConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'info'
}: SilentConfirmModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-brand-ink/40 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            className="relative w-full max-w-sm bg-brand-white rounded-[32px] overflow-hidden shadow-2xl border border-brand-mist"
          >
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                  variant === 'danger' ? 'bg-red-50 text-red-500' : 'bg-brand-linen text-brand-stone'
                }`}>
                  <AlertCircle size={20} />
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 text-brand-stone hover:text-brand-ink transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <h3 className="text-lg font-serif text-brand-ink mb-3">{title}</h3>
              <p className="text-[13px] text-brand-stone font-light leading-relaxed mb-8">
                {description}
              </p>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className={`w-full py-3.5 rounded-2xl text-[11px] font-bold uppercase tracking-[0.2em] transition-all active:scale-[0.98] ${
                    variant === 'danger' 
                      ? 'bg-red-600 text-white hover:bg-red-700' 
                      : 'bg-brand-ink text-white hover:bg-brand-espresso shadow-sm'
                  }`}
                >
                  {confirmLabel}
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-3.5 bg-transparent text-brand-stone hover:text-brand-ink text-[11px] font-bold uppercase tracking-[0.2em] transition-all"
                >
                  {cancelLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
