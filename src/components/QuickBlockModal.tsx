import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Lock, Settings, ChevronRight, Sun, Zap, Moon, Calendar, Clock } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { notify } from '../lib/notify';
import PremiumButton from './PremiumButton';
import { cn } from '../lib/utils';

interface QuickBlockModalProps {
  open: boolean;
  onClose: () => void;
  date?: string;
  time?: string;
  professionalId: string;
  onAdvanced?: () => void;
}

const QUICK_OPTIONS = [
  { id: 'today_full', label: 'Hoje dia inteiro', icon: <Sun size={14} /> },
  { id: 'today_morning', label: 'Hoje manhã', icon: <Zap size={14} /> },
  { id: 'today_afternoon', label: 'Hoje tarde', icon: <Moon size={14} /> },
  { id: 'tomorrow_full', label: 'Amanhã dia inteiro', icon: <Calendar size={14} /> },
];

const REASONS = [
  'Folga',
  'Particular',
  'Curso/Evento',
  'Viagem',
  'Manutenção',
  'Agenda cheia'
];

export default function QuickBlockModal({
  open,
  onClose,
  date,
  time,
  professionalId,
  onAdvanced
}: QuickBlockModalProps) {
  const [loading, setLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(time ? 'specific' : 'today_full');
  const [selectedReason, setSelectedReason] = useState(REASONS[0]);
  const [customRange, setCustomRange] = useState({ start: '09:00', end: '18:00' });

  const handleBlock = async () => {
    setLoading(true);
    try {
      let blockDate = date || new Date().toISOString().split('T')[0];
      let startTime = '08:00';
      let endTime = '22:00';

      if (selectedOption === 'specific' && time) {
        startTime = time;
        const [h, m] = time.split(':').map(Number);
        endTime = `${(h + 1).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      } else if (selectedOption === 'today_morning') {
        startTime = '08:00';
        endTime = '13:00';
      } else if (selectedOption === 'today_afternoon') {
        startTime = '13:00';
        endTime = '22:00';
      } else if (selectedOption === 'tomorrow_full') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        blockDate = tomorrow.toISOString().split('T')[0];
      } else if (selectedOption === 'custom') {
        startTime = customRange.start;
        endTime = customRange.end;
      }

      await addDoc(collection(db, 'blocked_schedules'), {
        professionalId,
        date: blockDate,
        startTime,
        endTime,
        reason: selectedReason,
        type: 'manual',
        isRecurring: false,
        recurringDays: [],
        createdAt: serverTimestamp()
      });

      notify.success(`Agenda bloqueada com sucesso!`);
      // Update analytics
      addDoc(collection(db, 'analytics_events'), {
        professionalId,
        type: 'quick_block_created',
        payload: { option: selectedOption, reason: selectedReason },
        timestamp: serverTimestamp(),
        origin: 'dashboard'
      }).catch(() => {});

      onClose();
    } catch (e) {
      notify.error('Erro ao bloquear horário.');
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
          className="relative w-full max-w-sm bg-brand-white rounded-[40px] p-8 shadow-2xl border border-brand-mist overflow-hidden"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-linen text-brand-ink rounded-full flex items-center justify-center">
                <Lock size={20} />
              </div>
              <h3 className="text-xl font-serif text-brand-ink">Bloquear Agenda</h3>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-brand-linen rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-brand-stone uppercase tracking-widest ml-1">O que deseja bloquear?</p>
              <div className="grid grid-cols-2 gap-2">
                {time && (
                  <button 
                    onClick={() => setSelectedOption('specific')}
                    className={cn(
                      "flex items-center gap-2 px-4 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all text-left",
                      selectedOption === 'specific' ? "bg-brand-ink text-white" : "bg-brand-parchment text-brand-ink border border-brand-mist hover:bg-brand-linen"
                    )}
                  >
                    <Clock size={14} /> As {time}
                  </button>
                )}
                {QUICK_OPTIONS.map(opt => (
                  <button 
                    key={opt.id}
                    onClick={() => setSelectedOption(opt.id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all text-left",
                      selectedOption === opt.id ? "bg-brand-ink text-white" : "bg-brand-parchment text-brand-ink border border-brand-mist hover:bg-brand-linen"
                    )}
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
                <button 
                  onClick={() => setSelectedOption('custom')}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all text-left",
                    selectedOption === 'custom' ? "bg-brand-ink text-white" : "bg-brand-parchment text-brand-ink border border-brand-mist hover:bg-brand-linen"
                  )}
                >
                  <Settings size={14} /> Outro...
                </button>
              </div>
            </div>

            {selectedOption === 'custom' && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="grid grid-cols-2 gap-4 pb-2"
              >
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-brand-stone uppercase tracking-widest ml-1">Início</label>
                  <input 
                    type="time" 
                    value={customRange.start}
                    onChange={(e) => setCustomRange({...customRange, start: e.target.value})}
                    className="w-full bg-brand-white border border-brand-mist rounded-xl p-3 text-[11px] outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-brand-stone uppercase tracking-widest ml-1">Fim</label>
                  <input 
                    type="time" 
                    value={customRange.end}
                    onChange={(e) => setCustomRange({...customRange, end: e.target.value})}
                    className="w-full bg-brand-white border border-brand-mist rounded-xl p-3 text-[11px] outline-none"
                  />
                </div>
              </motion.div>
            )}

            <div className="space-y-3">
              <p className="text-[10px] font-bold text-brand-stone uppercase tracking-widest ml-1">Qual o motivo?</p>
              <div className="flex flex-wrap gap-2">
                {REASONS.map(reason => (
                  <button 
                    key={reason}
                    onClick={() => setSelectedReason(reason)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all",
                      selectedReason === reason ? "bg-brand-terracotta text-white" : "bg-brand-linen text-brand-stone hover:bg-brand-mist"
                    )}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 space-y-3">
              <PremiumButton 
                className="w-full py-4 text-[10px]"
                loading={loading}
                onClick={handleBlock}
              >
                Confirmar Bloqueio
              </PremiumButton>
              
              <div className="flex flex-col gap-2 pt-2">
                <button 
                  onClick={() => { onClose(); onAdvanced?.(); }}
                  className="text-[9px] font-bold uppercase tracking-widest text-brand-terracotta hover:underline"
                >
                  Regras recorrentes e avançadas
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
