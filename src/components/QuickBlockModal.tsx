import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Lock, AlertCircle, ChevronRight, Zap } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import PremiumButton from './PremiumButton';

interface QuickBlockModalProps {
  open: boolean;
  onClose: () => void;
  date: string;
  time: string;
  professionalId: string;
  onAdvanced?: () => void;
}

export default function QuickBlockModal({
  open,
  onClose,
  date,
  time,
  professionalId,
  onAdvanced
}: QuickBlockModalProps) {
  const [loading, setLoading] = useState(false);

  const handleBlock = async () => {
    setLoading(true);
    try {
      // Calculate end time (default to 1 hour for quick block)
      const [h, m] = time.split(':').map(Number);
      const endH = h + 1;
      const endTime = `${endH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

      await addDoc(collection(db, 'blocked_schedules'), {
        professionalId,
        date,
        startTime: time,
        endTime,
        reason: 'Bloqueio rápido',
        type: 'manual',
        isRecurring: false,
        recurringDays: [],
        createdAt: serverTimestamp()
      });

      toast.success(`Horário das ${time} bloqueado com sucesso!`);
      onClose();
    } catch (e) {
      toast.error('Erro ao bloquear horário.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 sm:p-0">
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-brand-ink/40 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-xs bg-brand-white rounded-[32px] p-8 shadow-2xl border border-brand-mist overflow-hidden text-center"
        >
          <div className="w-14 h-14 bg-brand-linen text-brand-ink rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock size={24} />
          </div>

          <h3 className="text-xl font-serif text-brand-ink mb-2">Bloquear {time}?</h3>
          <p className="text-[11px] text-brand-stone font-light mb-8 leading-relaxed uppercase tracking-wider">
            Este horário ficará indisponível para novos pedidos.
          </p>

          <div className="space-y-3">
            <PremiumButton 
              className="w-full py-4 text-[10px]"
              loading={loading}
              onClick={handleBlock}
            >
              Bloquear Horário
            </PremiumButton>
            
            <button 
              onClick={onClose}
              disabled={loading}
              className="w-full py-4 text-[10px] font-bold uppercase tracking-widest text-brand-stone hover:text-brand-ink transition-colors"
            >
              Cancelar
            </button>

            <div className="pt-4 border-t border-brand-mist/50 mt-2">
               <button 
                onClick={() => { onClose(); onAdvanced?.(); }}
                className="flex items-center justify-center gap-2 mx-auto text-[9px] font-bold uppercase tracking-widest text-brand-terracotta hover:opacity-80 transition-all"
              >
                Mais opções de bloqueio <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
