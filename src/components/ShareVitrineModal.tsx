
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Share2, X, Copy, Instagram, MessageCircle, ChevronRight, Zap } from 'lucide-react';
import { getPublicProfileUrl } from '../lib/env';
import { notify } from '../lib/notify';
import { buildWhatsappLink } from '../lib/utils';
import PremiumButton from './PremiumButton';

interface ShareVitrineModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: any;
}

export default function ShareVitrineModal({ isOpen, onClose, profile }: ShareVitrineModalProps) {
  if (!isOpen) return null;

  const url = getPublicProfileUrl(profile?.slug);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-6">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-brand-ink/40 backdrop-blur-sm"
        />
        <motion.div 
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="relative w-full max-w-md bg-brand-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl border-t border-brand-mist/50 flex flex-col max-h-[88dvh]"
        >
          <div className="flex items-center justify-between p-6 pb-4 border-b border-brand-mist/30 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-brand-linen text-brand-terracotta rounded-full flex items-center justify-center">
                <Share2 size={16} />
              </div>
              <div>
                <h3 className="text-lg font-serif text-brand-ink">Minha Vitrine</h3>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-brand-parchment rounded-full text-brand-stone transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto no-scrollbar pb-8">
            <p className="text-sm text-brand-stone mb-6 font-light">
              Transforme cada acesso em um possível agendamento.
            </p>

            <div className="space-y-3">
              {/* Primary CTA: Copiar Link */}
              <PremiumButton 
                onClick={() => {
                  navigator.clipboard.writeText(url);
                  notify.success('Link copiado para a área de transferência.');
                  onClose();
                }}
                className="w-full py-4 !text-[11px] gap-2 shadow-sm"
              >
                <Copy size={16} />
                Copiar link da vitrine
              </PremiumButton>

              {/* Secondary/Tertiary Actions: Horizontally dense or smaller items */}
              <div className="grid grid-cols-1 gap-3 pt-2">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(url);
                    notify.success('Link copiado. Abra o Instagram e cole nos seus Stories!');
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-4 bg-brand-white border border-brand-mist rounded-2xl hover:border-brand-stone transition-all outline-none"
                >
                  <div className="flex items-center gap-3">
                    <Instagram size={18} className="text-brand-terracotta" />
                    <div className="text-left">
                      <p className="text-xs font-bold text-brand-ink">Instagram Stories</p>
                      <p className="text-[10px] text-brand-stone">Copiar link para sticker</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-brand-mist" />
                </button>

                <button 
                  onClick={() => {
                    const text = `Acabei de abrir novos horários ✨ Reserve online comigo: ${url}`;
                    window.open(buildWhatsappLink('', text), '_blank');
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-4 bg-brand-white border border-brand-mist rounded-2xl hover:border-brand-stone transition-all outline-none"
                >
                  <div className="flex items-center gap-3">
                    <MessageCircle size={18} className="text-brand-terracotta" />
                    <div className="text-left">
                      <p className="text-xs font-bold text-brand-ink">WhatsApp</p>
                      <p className="text-[10px] text-brand-stone">Enviar para contatos</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-brand-mist" />
                </button>
              </div>
            </div>

            <div className="mt-8 p-4 bg-[#FAF9F8] rounded-2xl border border-brand-mist/50">
              <p className="text-[9px] font-bold text-brand-terracotta uppercase tracking-[0.2em] mb-1.5 flex items-center gap-1.5">
                <Zap size={10} /> Sugestão de texto
              </p>
              <p className="text-xs text-brand-ink font-light italic leading-relaxed">
                "Acabei de abrir novos horários ✨ Reserve online comigo: <span className="font-medium text-brand-terracotta">{url}</span>"
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
