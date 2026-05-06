import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Users, Calendar, Clock, 
  ChevronRight, MessageCircle, Sparkles, 
  ArrowUpRight, AlertCircle, Info, Phone,
  CheckCircle2, Send
} from 'lucide-react';
import { db, inviteFromWaitlist } from '../firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { notify } from '../lib/notify';
import { cn, buildWhatsappLink, formatLocalDate } from '../lib/utils';
import { WaitlistEntry } from '../types';
import PremiumButton from './PremiumButton';

interface WaitlistCentralModalProps {
  open: boolean;
  onClose: () => void;
  professionalId: string;
  targetDate?: string;
  targetTime?: string;
  onFit?: (entry: WaitlistEntry) => void;
}

export default function WaitlistCentralModal({
  open,
  onClose,
  professionalId,
  targetDate,
  targetTime,
  onFit
}: WaitlistCentralModalProps) {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'date'>('all');

  useEffect(() => {
    if (!open || !professionalId) return;

    setLoading(true);
    const q = query(
      collection(db, 'waitlist'),
      where('professionalId', '==', professionalId),
      where('status', '==', 'waiting'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WaitlistEntry));
setEntries(docs);
setLoading(false);
      } catch (err) {
        console.error("Error in onSnapshot callback:", err);
      }
    }, (error) => { console.error("Firestore onSnapshot error:", error); });

    return () => unsubscribe();
  }, [open, professionalId]);

  const filteredEntries = entries.filter(entry => {
    if (filter === 'date' && targetDate) {
      return entry.requestedDate === targetDate;
    }
    return true;
  });

  const handleInvite = async (entry: WaitlistEntry) => {
    if (!targetTime) {
      notify.error('Selecione um horário na agenda para convidar.');
      return;
    }
    try {
      await inviteFromWaitlist(entry.id, targetTime);
      notify.success(`Convite enviado para ${entry.clientName}!`);
      
      const msg = `Oi ${entry.clientName}! 🌟 Vimos que você está na nossa lista de espera. Acabou de surgir uma vaga para ${entry.serviceName} dia ${formatLocalDate(entry.requestedDate, { day: 'numeric', month: 'numeric' })} às ${targetTime}. Tem interesse?`;
      window.open(buildWhatsappLink(entry.clientWhatsapp, msg), '_blank');
      
      onClose();
    } catch {
      notify.error('Erro ao enviar convite.');
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[400] flex items-end md:items-center justify-center p-0 md:p-6 overflow-hidden">
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-brand-ink/40 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          className="relative w-full max-w-xl bg-brand-white rounded-t-[40px] md:rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]"
        >
          {/* Header */}
          <div className="p-8 md:p-10 border-b border-brand-mist flex items-center justify-between shrink-0">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-brand-linen text-brand-terracotta rounded-xl flex items-center justify-center">
                  <Users size={16} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-stone">Demanda Express</span>
              </div>
              <h3 className="text-2xl font-serif text-brand-ink">Lista de Espera</h3>
            </div>
            <button onClick={onClose} className="p-3 hover:bg-brand-parchment rounded-2xl transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Stats/Filters */}
          <div className="px-8 py-4 bg-brand-parchment/30 flex items-center gap-4 shrink-0">
            <button 
              onClick={() => setFilter('all')}
              className={cn(
                "px-4 py-2 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all",
                filter === 'all' ? "bg-brand-ink text-brand-white shadow-md" : "text-brand-stone hover:bg-brand-linen"
              )}
            >
              Todas ({entries.length})
            </button>
            {targetDate && (
              <button 
                onClick={() => setFilter('date')}
                className={cn(
                  "px-4 py-2 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all",
                  filter === 'date' ? "bg-brand-ink text-brand-white shadow-md" : "text-brand-stone hover:bg-brand-linen"
                )}
              >
                Deste Dia ({entries.filter(e => e.requestedDate === targetDate).length})
              </button>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8 md:p-10 no-scrollbar">
            {loading ? (
              <div className="py-20 text-center space-y-4">
                <div className="w-10 h-10 border-2 border-brand-terracotta border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-stone">Carregando espera...</p>
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center">
                <div className="w-20 h-20 bg-brand-linen/50 rounded-full flex items-center justify-center text-brand-stone/30 mb-6">
                  <Inbox size={32} strokeWidth={1} />
                </div>
                <h4 className="text-xl font-serif text-brand-ink mb-3">Nenhuma cliente na fila</h4>
                <p className="text-sm text-brand-stone font-light italic max-w-sm mx-auto leading-relaxed px-6">
                   Quando alguém pedir para ser avisada sobre uma vaga ou reagendamento, ela aparecerá aqui instantaneamente.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredEntries.map((entry) => (
                  <motion.div 
                    key={entry.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 bg-brand-white rounded-[32px] border border-brand-mist hover:border-brand-ink transition-all shadow-sm group"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h5 className="text-lg font-serif text-brand-ink mb-1">{entry.clientName}</h5>
                        <p className="text-[10px] font-bold text-brand-terracotta uppercase tracking-widest">{entry.serviceName}</p>
                      </div>
                      {entry.period !== 'any' && (
                        <span className="px-3 py-1 bg-brand-linen text-brand-stone text-[8px] font-bold uppercase tracking-widest rounded-full">
                           {entry.period === 'morning' ? 'Manhã' : entry.period === 'afternoon' ? 'Tarde' : 'Noite'}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3 mb-6">
                      <div className="flex items-center gap-2 text-brand-stone min-w-0">
                        <Calendar size={12} className="opacity-40 shrink-0" />
                        <span className="text-[11px] font-medium truncate">{formatLocalDate(entry.requestedDate, { day: 'numeric', month: 'short' })}</span>
                      </div>
                      <div className="flex items-center gap-2 text-brand-stone min-w-0">
                        <Clock size={12} className="opacity-40 shrink-0" />
                        <span className="text-[11px] font-medium truncate">{entry.preferredTime || 'Qualquer hora'}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                       <button 
                        onClick={() => onFit?.(entry)}
                        className="flex-1 py-3 bg-brand-ink text-brand-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-brand-espresso transition-all"
                      >
                        Encaixar agora
                      </button>
                      <button 
                        onClick={() => handleInvite(entry)}
                        className="flex-1 py-3 bg-brand-white border border-brand-mist text-brand-stone rounded-xl text-[9px] font-bold uppercase tracking-widest hover:border-brand-ink hover:text-brand-ink transition-all flex items-center justify-center gap-2"
                      >
                        <Send size={10} /> Convidar
                      </button>
                      <a 
                        href={buildWhatsappLink(entry.clientWhatsapp)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 bg-brand-parchment rounded-xl text-brand-stone hover:text-green-600 transition-colors"
                      >
                        <Phone size={14} />
                      </a>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          <div className="p-8 bg-brand-parchment/20 border-t border-brand-mist md:flex items-center justify-between shrink-0 hidden">
            <p className="text-[10px] text-brand-stone font-medium italic">Selecione uma cliente para preencher horários livres.</p>
            <PremiumButton variant="outline" onClick={onClose}>Fechar Central</PremiumButton>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function Inbox({ size, strokeWidth, className }: { size?: number, strokeWidth?: number, className?: string }) {
  return <Users size={size} strokeWidth={strokeWidth} className={className} />;
}
