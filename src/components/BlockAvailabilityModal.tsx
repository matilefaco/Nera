import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Calendar as CalendarIcon, Clock, Lock, 
  ChevronRight, RefreshCw, AlertCircle, Trash2,
  GraduationCap, User, Plus, Check, Settings2
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

const WEEKDAYS = [
  { id: 0, label: 'Dom' },
  { id: 1, label: 'Seg' },
  { id: 2, label: 'Ter' },
  { id: 3, label: 'Qua' },
  { id: 4, label: 'Qui' },
  { id: 5, label: 'Sex' },
  { id: 6, label: 'Sáb' },
];

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
  const [step, setStep] = useState<'custom' | 'conflicts'>('custom');
  const [tab, setTab] = useState<'single' | 'recurring'>('recurring');
  const [date, setDate] = useState(selectedDate);
  const [startTime, setStartTime] = useState(initialStartTime || '09:00');
  const [endTime, setEndTime] = useState(initialEndTime || '18:00');
  const [recurringDays, setRecurringDays] = useState<number[]>([]);
  
  useEffect(() => {
    if (open) {
      setDate(selectedDate);
      if (initialStartTime) setStartTime(initialStartTime);
      if (initialEndTime) setEndTime(initialEndTime);
      setStep('custom');
      
      const dayOfWeek = new Date(selectedDate + 'T12:00:00').getDay();
      setRecurringDays([dayOfWeek]);
    }
  }, [open, selectedDate, initialStartTime, initialEndTime]);

  const [reason, setReason] = useState<BlockedSchedule['reason']>('pessoal');
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState<Appointment[]>([]);

  const safeWorkingHours = workingHours || { startTime: '09:00', endTime: '18:00' };

  const reasons = [
    { id: 'compromisso', label: 'Comprom.', icon: AlertCircle },
    { id: 'descanso', label: 'Descanso', icon: Clock },
    { id: 'curso', label: 'Curso', icon: GraduationCap },
    { id: 'pessoal', label: 'Pessoal', icon: User },
    { id: 'outro', label: 'Outro', icon: Plus },
  ];

  const checkConflicts = (start: string, end: string) => {
    const sMinutes = timeToMinutes(start);
    const eMinutes = timeToMinutes(end);

    const conflicting = appointments.filter(appt => {
      // If it's single day, only conflict if dates match
      // If it's recurring, conflict if day of week matches (a bit complex to check all future, so we check only the current loaded appointments)
      if (tab === 'single') {
        if (appt.date !== date) return false;
      } else {
        const apptDay = new Date(appt.date + 'T12:00:00').getDay();
        if (!recurringDays.includes(apptDay)) return false;
      }
      
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

  const handleSave = async (cancelAppointments: boolean = false) => {
    if (tab === 'recurring' && recurringDays.length === 0) {
      notify.error('Selecione pelo menos um dia na regra recorrente.');
      return;
    }

    setLoading(true);
    try {
      const blockData: Omit<BlockedSchedule, 'id'> = {
        professionalId,
        date: tab === 'single' ? date : getTodayLocale(), // Base date doesn't matter much for recurring
        startTime,
        endTime,
        reason,
        type: startTime === safeWorkingHours.startTime && endTime === safeWorkingHours.endTime ? 'full_day' : 'manual',
        isRecurring: tab === 'recurring',
        recurringDays: tab === 'recurring' ? recurringDays : [],
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'blocked_schedules'), blockData);

      if (cancelAppointments && conflicts.length > 0) {
        for (const appt of conflicts) {
          await updateDoc(doc(db, 'appointments', appt.id), {
            status: 'cancelled',
            cancellationReason: `Imprevisto profissional (${reason})`,
            updatedAt: serverTimestamp()
          });
        }
        notify.success(`${conflicts.length} agendamentos cancelados e horário bloqueado.`);
      } else {
        notify.success(tab === 'recurring' ? 'Regra recorrente criada com sucesso.' : 'Horário bloqueado com sucesso.');
      }

      onClose();
    } catch (e) {
      notify.error('Erro ao salvar regra avançada.');
    } finally {
      setLoading(false);
    }
  };

  const toggleRecurringDay = (day: number) => {
    setRecurringDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center p-0 sm:p-6">
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
          className="relative w-full max-w-lg bg-brand-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl border border-brand-mist/50 flex flex-col max-h-[88dvh]"
        >
          <div className="flex items-center justify-between p-6 pb-4 border-b border-brand-mist/30 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-brand-linen text-brand-ink rounded-full flex items-center justify-center">
                <Settings2 size={16} />
              </div>
              <div>
                <h3 className="text-lg font-serif text-brand-ink">Regras Avançadas</h3>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-brand-parchment rounded-full text-brand-stone transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto no-scrollbar">
            {step === 'custom' && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                {/* Tabs */}
                <div className="flex bg-[#FAF9F8] p-1.5 rounded-xl border border-brand-mist/30 text-[10px] font-bold uppercase tracking-widest mb-8">
                  <button 
                    onClick={() => setTab('single')}
                    className={cn(
                      "flex-1 py-2.5 rounded-lg transition-all text-center",
                      tab === 'single' ? "bg-white shadow-sm text-brand-ink border border-brand-mist/40" : "text-brand-stone/80 hover:text-brand-ink border border-transparent"
                    )}
                  >
                    Data Específica
                  </button>
                  <button 
                    onClick={() => setTab('recurring')}
                    className={cn(
                      "flex-1 py-2.5 rounded-lg transition-all text-center",
                      tab === 'recurring' ? "bg-white shadow-sm text-brand-ink border border-brand-mist/40" : "text-brand-stone/80 hover:text-brand-ink border border-transparent"
                    )}
                  >
                    Repetição Semanal
                  </button>
                </div>

                <div className="space-y-6">
                  {tab === 'single' ? (
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-2">Data do bloqueio</label>
                      <div className="relative">
                        <input 
                          type="date" 
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          className="w-full p-4 bg-brand-parchment rounded-2xl border border-brand-mist outline-none focus:border-brand-ink transition-all font-medium appearance-none"
                        />
                        <CalendarIcon size={16} className="absolute right-5 top-1/2 -translate-y-1/2 text-brand-stone pointer-events-none" />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-2">Repetir toda(s)</label>
                      <div className="grid grid-cols-7 gap-1">
                        {WEEKDAYS.map(day => (
                          <button
                            key={day.id}
                            onClick={() => toggleRecurringDay(day.id)}
                            className={cn(
                              "py-3 rounded-xl border transition-all text-[10px] font-bold uppercase tracking-widest",
                              recurringDays.includes(day.id) 
                                ? "bg-brand-ink border-brand-ink text-brand-white"
                                : "bg-brand-parchment border-brand-mist text-brand-stone hover:border-brand-stone/50"
                            )}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 min-w-0">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-2">Das</label>
                      <div className="relative">
                        <input 
                          type="time" 
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="w-full p-4 bg-brand-parchment rounded-2xl border border-brand-mist outline-none focus:border-brand-ink transition-all font-medium min-w-0 appearance-none"
                        />
                      </div>
                    </div>
                    <div className="space-y-2 min-w-0">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-2">Às</label>
                      <div className="relative">
                        <input 
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="w-full p-4 bg-brand-parchment rounded-2xl border border-brand-mist outline-none focus:border-brand-ink transition-all font-medium min-w-0 appearance-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-2">Qual o motivo?</label>
                    <div className="flex flex-wrap gap-2">
                      {reasons.map(r => (
                        <button 
                          key={r.id}
                          onClick={() => setReason(r.id as any)}
                          className={cn(
                            "px-4 py-3 rounded-xl border transition-all flex items-center gap-2 flex-grow sm:flex-grow-0 justify-center",
                            reason === r.id ? "bg-brand-ink border-brand-ink text-brand-white" : "bg-brand-linen border-brand-mist text-brand-stone hover:border-brand-ink"
                          )}
                        >
                          <r.icon size={14} />
                          <span className="text-[9px] font-bold uppercase tracking-widest">{r.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <PremiumButton 
                    className="w-full py-5 text-[11px]"
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
                    Confirmar Regra
                  </PremiumButton>
                </div>
              </motion.div>
            )}

            {step === 'conflicts' && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mb-6 mx-auto">
                  <AlertCircle size={32} />
                </div>
                <h3 className="text-xl font-serif text-brand-ink text-center mb-2">Atenção aos agendamentos</h3>
                <p className="text-xs text-brand-stone font-light text-center mb-8">
                  Existem <strong>{conflicts.length} reservas</strong> que já estão agendadas no futuro.
                </p>

                <div className="space-y-3 mb-8 max-h-48 overflow-y-auto pr-2 no-scrollbar">
                  {conflicts.map(appt => (
                    <div key={appt.id} className="p-4 bg-brand-parchment rounded-2xl border border-brand-mist flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-brand-ink">{appt.clientName}</p>
                        <p className="text-[9px] text-brand-stone uppercase tracking-widest mt-1">{tab === 'recurring' ? 'Nesse dia/horário' : `${appt.date} às ${appt.time}`}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <button 
                    onClick={() => handleSave(false)}
                    className="w-full py-4 bg-brand-white border border-brand-mist rounded-2xl text-[10px] font-bold uppercase tracking-widest text-brand-ink hover:bg-brand-linen transition-all"
                  >
                    Criar bloqueio (Mas manter reservas)
                  </button>
                  <button 
                    onClick={() => handleSave(true)}
                    className="w-full py-4 bg-brand-terracotta text-brand-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-sienna transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    <Trash2 size={14} /> Cancelar reservas conflitantes
                  </button>
                  <button 
                    onClick={() => setStep('custom')}
                    className="w-full py-2 text-[10px] font-bold uppercase tracking-widest text-brand-stone hover:text-brand-ink transition-colors mt-2"
                  >
                    Voltar
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

