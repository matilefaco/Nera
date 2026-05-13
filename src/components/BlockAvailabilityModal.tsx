import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Calendar as CalendarIcon, Clock, Lock, 
  ChevronRight, RefreshCw, AlertCircle, Trash2,
  Sunrise, Sun, Moon, Zap, Coffee, GraduationCap, 
  User, Plus, Check
} from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { notify } from '../lib/notify';
import { cn, getTodayLocale, getTodayLocaleTime } from '../lib/utils';
import { BlockedSchedule, Appointment, WorkingHours } from '../types';
import PremiumButton from './PremiumButton';
import { isCancelledStatus } from '../constants/appointmentStatus';

interface BlockAvailabilityModalProps {
  open: boolean;
  onClose: () => void;
  selectedDate: string;
  professionalId: string;
  appointments: Appointment[];
  workingHours: WorkingHours;
  initialStartTime?: string;
  initialEndTime?: string;
}

export default function BlockAvailabilityModal({
  open,
  onClose,
  selectedDate,
  professionalId,
  appointments,
  workingHours = { startTime: '09:00', endTime: '18:00', workingDays: [1,2,3,4,5] },
  initialStartTime,
  initialEndTime
}: BlockAvailabilityModalProps) {
  const [step, setStep] = useState<'options' | 'custom' | 'conflicts'>('options');
  const [date, setDate] = useState(selectedDate);
  const [startTime, setStartTime] = useState(initialStartTime || '09:00');
  const [endTime, setEndTime] = useState(initialEndTime || '18:00');

  // Sync initial times when modal opens with predefined values
  React.useEffect(() => {
    if (open) {
      setDate(selectedDate);
      if (initialStartTime) setStartTime(initialStartTime);
      if (initialEndTime) setEndTime(initialEndTime);
      setStep('options');
    }
  }, [open, selectedDate, initialStartTime, initialEndTime]);
  const [reason, setReason] = useState<BlockedSchedule['reason']>('pessoal');
  const [isRecurring, setIsRecurring] = useState(false);
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState<Appointment[]>([]);

  const safeWorkingHours = workingHours || { startTime: '09:00', endTime: '18:00' };

  const quickOptions = [
    { id: 'full_day', label: 'Dia Inteiro', icon: Zap, start: safeWorkingHours.startTime || '09:00', end: safeWorkingHours.endTime || '18:00' },
    { id: 'morning', label: 'Manhã', icon: Sunrise, start: safeWorkingHours.startTime || '09:00', end: '12:00' },
    { id: 'afternoon', label: 'Tarde', icon: Sun, start: '12:00', end: '18:00' },
    { id: 'night', label: 'Noite', icon: Moon, start: '18:00', end: safeWorkingHours.endTime || '22:00' },
    { id: 'next_2h', label: 'Próximas 2h', icon: Clock, start: getTodayLocaleTime(), end: '' }, // end calculated below
    { id: 'rest_of_day', label: 'Resto do dia', icon: Coffee, start: getTodayLocaleTime(), end: safeWorkingHours.endTime || '22:00' },
  ];

  const reasons = [
    { id: 'compromisso', label: 'Compromisso', icon: AlertCircle },
    { id: 'descanso', label: 'Descanso', icon: Coffee },
    { id: 'curso', label: 'Curso', icon: GraduationCap },
    { id: 'pessoal', label: 'Pessoal', icon: User },
    { id: 'outro', label: 'Outro', icon: Plus },
  ];

  const checkConflicts = (start: string, end: string) => {
    const sMinutes = timeToMinutes(start);
    const eMinutes = timeToMinutes(end);

    const conflicting = appointments.filter(appt => {
      // Filter by date if it matches
      if (appt.date !== date) return false;
      if (isCancelledStatus(appt.status)) return false;
      const apptStart = timeToMinutes(appt.time);
      const apptEnd = apptStart + (appt.duration || 60);
      return Math.max(sMinutes, apptStart) < Math.min(eMinutes, apptEnd);
    });

    return conflicting;
  };

  const timeToMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + (m || 0);
  };

  const minutesToTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const handleQuickSelect = (option: any) => {
    let start = option.start;
    let end = option.end;

    if (option.id === 'next_2h') {
      const nowMin = timeToMinutes(getTodayLocaleTime());
      start = minutesToTime(nowMin);
      end = minutesToTime(nowMin + 120);
    }

    setStartTime(start);
    setEndTime(end);
    
    // Quick options are always for the selected date
    const conflicting = checkConflicts(start, end);
    if (conflicting.length > 0) {
      setConflicts(conflicting);
      setStep('conflicts');
    } else {
      handleSaveSilent(start, end);
    }
  };

  const handleSaveSilent = async (start: string, end: string) => {
    setLoading(true);
    try {
      const blockData: Omit<BlockedSchedule, 'id'> = {
        professionalId,
        date: date,
        startTime: start,
        endTime: end,
        reason,
        type: start === safeWorkingHours.startTime && end === safeWorkingHours.endTime ? 'full_day' : 'manual',
        isRecurring,
        recurringDays: isRecurring ? [new Date(date + 'T12:00:00').getDay()] : [],
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'blocked_schedules'), blockData);
      notify.success('Horário bloqueado com sucesso.');
      onClose();
    } catch (e) {
      notify.error('Erro ao bloquear horário.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (cancelAppointments: boolean = false) => {
    setLoading(true);
    try {
      const blockData: Omit<BlockedSchedule, 'id'> = {
        professionalId,
        date: date,
        startTime,
        endTime,
        reason,
        type: startTime === safeWorkingHours.startTime && endTime === safeWorkingHours.endTime ? 'full_day' : 'manual',
        isRecurring,
        recurringDays: isRecurring ? [new Date(date + 'T12:00:00').getDay()] : [],
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'blocked_schedules'), blockData);

      if (cancelAppointments && conflicts.length > 0) {
        // Implement cancellation logic if needed
        for (const appt of conflicts) {
          await updateDoc(doc(db, 'appointments', appt.id), {
            status: 'cancelled',
            cancellationReason: `Imprevisto profissional (${reason})`,
            updatedAt: serverTimestamp()
          });
        }
        notify.success(`${conflicts.length} agendamentos cancelados e horário bloqueado.`);
      } else {
        notify.success('Horário bloqueado com sucesso.');
      }

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
      <div className="fixed inset-0 z-[300] flex items-end md:items-center justify-center p-0 md:p-6 overflow-hidden">
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-brand-ink/40 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          className="relative w-full max-w-xl bg-brand-white rounded-t-[40px] md:rounded-[40px] p-8 md:p-12 shadow-2xl overflow-y-auto max-h-[92dvh] no-scrollbar"
        >
          <button onClick={onClose} className="absolute right-8 top-8 text-brand-stone hover:text-brand-ink transition-colors">
            <X size={24} />
          </button>

          {step === 'options' && (
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-brand-linen text-brand-ink rounded-xl flex items-center justify-center shadow-sm">
                  <Lock size={20} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-ink">Gestão de Tempo</span>
              </div>
              <h3 className="text-3xl font-serif text-brand-ink mb-2">Bloquear Agenda</h3>
              <p className="text-sm text-brand-stone font-light mb-10">Escolha uma opção rápida ou personalize seu bloqueio.</p>

              <div className="grid grid-cols-2 gap-4 mb-10">
                {quickOptions.map(opt => (
                  <button 
                    key={opt.id}
                    onClick={() => handleQuickSelect(opt)}
                    className="p-6 bg-brand-parchment rounded-[32px] border border-brand-mist hover:border-brand-ink hover:bg-brand-white transition-all flex flex-col gap-3 group text-left"
                  >
                    <opt.icon size={20} className="text-brand-terracotta group-hover:scale-110 transition-transform" />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-ink">{opt.label}</p>
                      <p className="text-[9px] text-brand-stone uppercase tracking-widest opacity-60">Indisponibilidade</p>
                    </div>
                  </button>
                ))}
              </div>

              <PremiumButton 
                variant="outline" 
                className="w-full border-brand-mist py-5"
                onClick={() => setStep('custom')}
              >
                Personalizar Horário
              </PremiumButton>
            </motion.div>
          )}

          {step === 'custom' && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <button 
                onClick={() => setStep('options')}
                className="mb-8 text-brand-stone hover:text-brand-ink flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"
              >
                <ChevronRight size={16} className="rotate-180" /> Voltar
              </button>

              <h3 className="text-3xl font-serif text-brand-ink mb-2">Ajustar Bloqueio</h3>
              <p className="text-sm text-brand-stone font-light mb-10">Defina os detalhes da sua indisponibilidade.</p>

              <div className="space-y-8">
                <div className="space-y-2">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-2">Data do bloqueio</label>
                  <div className="relative">
                    <input 
                      type="date" 
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full p-5 bg-brand-parchment rounded-[24px] border border-brand-mist outline-none focus:border-brand-ink transition-all font-medium appearance-none"
                    />
                    <CalendarIcon size={16} className="absolute right-6 top-1/2 -translate-y-1/2 text-brand-stone pointer-events-none" />
                  </div>
                </div>

                <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-4 min-[400px]:gap-6">
                  <div className="space-y-2 min-w-0">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-2">Início</label>
                    <input 
                      type="time" 
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full p-5 bg-brand-parchment rounded-[24px] border border-brand-mist outline-none focus:border-brand-ink transition-all font-medium min-w-0"
                    />
                  </div>
                  <div className="space-y-2 min-w-0">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-2">Fim</label>
                    <input 
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full p-5 bg-brand-parchment rounded-[24px] border border-brand-mist outline-none focus:border-brand-ink transition-all font-medium min-w-0"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-2">Repetição</label>
                  <button 
                    onClick={() => setIsRecurring(!isRecurring)}
                    className={cn(
                      "w-full p-5 rounded-[24px] border transition-all flex items-center justify-between",
                      isRecurring ? "bg-brand-ink border-brand-ink text-brand-white" : "bg-brand-white border-brand-mist text-brand-stone"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <RefreshCw size={18} className={isRecurring ? "text-brand-terracotta" : "text-brand-mist"} />
                      <span className="text-xs font-semibold uppercase tracking-widest">Repetir toda semana</span>
                    </div>
                    {isRecurring && <Check size={16} />}
                  </button>
                </div>

                <div className="space-y-4">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-2">Qual o motivo?</label>
                  <div className="grid grid-cols-3 gap-3">
                    {reasons.map(r => (
                      <button 
                        key={r.id}
                        onClick={() => setReason(r.id as any)}
                        className={cn(
                          "p-4 rounded-2xl border transition-all flex flex-col items-center gap-2",
                          reason === r.id ? "bg-brand-ink border-brand-ink text-brand-white" : "bg-brand-parchment border-brand-mist text-brand-stone hover:border-brand-ink"
                        )}
                      >
                        <r.icon size={16} />
                        <span className="text-[8px] font-bold uppercase tracking-widest">{r.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-6">
                  <PremiumButton 
                    variant="terracotta"
                    className="w-full py-6 text-sm"
                    loading={loading}
                    onClick={() => {
                        const conflicting = checkConflicts(startTime, endTime);
                        if (conflicting.length > 0) {
                            setConflicts(conflicting);
                            setStep('conflicts');
                        } else {
                            handleSave();
                        }
                    }}
                  >
                    Confirmar Bloqueio
                  </PremiumButton>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'conflicts' && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mb-6 mx-auto">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-2xl font-serif text-brand-ink text-center mb-2">Conflito de Agenda</h3>
              <p className="text-sm text-brand-stone font-light text-center mb-8">
                Existem <strong>{conflicts.length} agendamentos</strong> no intervalo que você deseja bloquear.
              </p>

              <div className="space-y-4 mb-10 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {conflicts.map(appt => (
                  <div key={appt.id} className="p-4 bg-brand-parchment rounded-2xl border border-brand-mist flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-brand-ink">{appt.clientName}</p>
                      <p className="text-[9px] text-brand-stone uppercase tracking-widest">{appt.time} • {appt.serviceName}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <button 
                  onClick={() => handleSave(false)}
                  className="w-full py-5 bg-brand-white border border-brand-mist rounded-2xl text-[10px] font-bold uppercase tracking-widest text-brand-ink hover:bg-brand-linen transition-all"
                >
                  Manter reservas (Bloquear apenas livres)
                </button>
                <button 
                  onClick={() => handleSave(true)}
                  className="w-full py-5 bg-brand-terracotta text-brand-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-sienna transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <Trash2 size={14} /> Cancelar Reservas e Bloquear
                </button>
                <button 
                  onClick={() => setStep('custom')}
                  className="w-full py-3 text-[10px] font-bold uppercase tracking-widest text-brand-stone hover:text-brand-ink transition-colors"
                >
                  Ajustar Horário
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
