import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, ChevronRight } from 'lucide-react';
import { releaseNotes } from '../config/neraReleaseNotes';

interface NeraReleaseNotesCardProps {
  onOpen: () => void;
}

export function NeraReleaseNotesCard({ onOpen }: NeraReleaseNotesCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-brand-parchment/60 border border-brand-mist rounded-[16px] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm my-4"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-brand-linen flex items-center justify-center text-brand-terracotta flex-shrink-0">
          <Sparkles size={20} className="text-brand-terracotta animate-pulse" />
        </div>
        <div>
          <p className="text-sm font-medium text-brand-ink">Novidade da Nera ✨</p>
          <p className="text-[11px] text-brand-stone-dark mt-0.5">Seu portfólio ganhou mais espaço para mostrar seu trabalho.</p>
        </div>
      </div>
      <button
        onClick={onOpen}
        className="text-[10px] font-bold uppercase tracking-widest text-brand-ink bg-brand-white border border-brand-mist/80 hover:bg-brand-linen transition-all px-6 py-2.5 rounded-full whitespace-nowrap text-center flex items-center justify-center gap-1.5 self-start md:self-auto cursor-pointer shadow-sm hover:shadow active:scale-[0.98]"
      >
        Ver novidades
        <ChevronRight size={12} className="text-brand-stone-dark" />
      </button>
    </motion.div>
  );
}

interface NeraReleaseNotesModalProps {
  open: boolean;
  onClose: () => void;
}

export function NeraReleaseNotesModal({ open, onClose }: NeraReleaseNotesModalProps) {
  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 sm:p-0">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-brand-ink/40 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-lg bg-brand-white rounded-[32px] p-6 md:p-8 shadow-2xl border border-brand-mist overflow-hidden max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-6 pb-4 border-b border-brand-mist/40 shrink-0">
            <div className="space-y-1 pr-6">
              <h3 className="text-xl md:text-2xl font-serif text-brand-ink flex items-center gap-1.5 leading-tight">
                Novidades da Nera ✨
              </h3>
              <p className="text-[12px] text-brand-stone-dark font-light leading-relaxed">
                Melhorias recentes para deixar sua rotina mais leve, organizada e profissional.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-brand-linen rounded-full transition-colors self-start shrink-0 cursor-pointer"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          {/* Content (Scrollable) */}
          <div className="overflow-y-auto space-y-6 pr-1 pb-2 flex-1 scrollbar-thin">
            {releaseNotes.map((period, pIdx) => (
              <div key={pIdx} className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-[0.2em] font-bold px-2 py-0.5 rounded text-brand-stone-dark bg-brand-linen border border-brand-mist/50">
                    {period.period}
                  </span>
                </div>

                <div className="space-y-4">
                  {period.items.map((item, iIdx) => (
                    <div
                      key={item.id || iIdx}
                      className="p-4 bg-brand-parchment/40 border border-brand-mist/30 rounded-2xl space-y-1.5"
                    >
                      <h4 className="text-[13px] font-bold text-brand-ink font-serif">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-brand-stone-dark font-light leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
