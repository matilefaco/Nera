import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Clock, Lock, Info, Plus, AlertCircle, Zap, Calendar as CalendarIcon, Check } from 'lucide-react';
import { cn, formatLocalDate, formatDateKey, getTodayLocale } from '../lib/utils';
import { Appointment } from '../types';
import { isConfirmedLikeStatus, isCompletedStatus, isPendingStatus } from '../constants/appointmentStatus';

interface DayViewProps {
  appointments: Appointment[];
  blockedSchedules: any[];
  date: string;
  onSelectAppointment: (appt: Appointment) => void;
  onSelectSlot: (time: string) => void;
  onBlockClick?: (block: any) => void;
  hideHeader?: boolean;
}

export default function DayView({
  appointments,
  blockedSchedules,
  date,
  onSelectAppointment,
  onSelectSlot,
  onBlockClick,
  hideHeader = false
}: DayViewProps) {
  
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let h = 7; h <= 21; h++) {
      for (let m = 0; m < 60; m += 30) {
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    return slots;
  }, []);

  const getDayData = () => {
    let dayAppointments = appointments.filter(a => isConfirmedLikeStatus(a.status) || isCompletedStatus(a.status) || isPendingStatus(a.status));
    
    // Prevent overlapping: if a slot has confirmed/completed, hide the pending ones
    const confirmedTimes = new Set(dayAppointments.filter(a => isConfirmedLikeStatus(a.status) || isCompletedStatus(a.status)).map(a => a.time));
    
    const originalCount = dayAppointments.length;
    dayAppointments = dayAppointments.filter(a => {
      if (isPendingStatus(a.status) && confirmedTimes.has(a.time)) {
        console.warn(`[DayView] Hiding overlapping pending appointment at ${a.time} due to existing confirmed appointment.`);
        return false;
      }
      return true;
    });
    const dayOfWeek = new Date(date + 'T00:00:00').getDay();
    const dayBlocks = blockedSchedules.filter(b => {
      const isDateMatch = b.date === date;
      const isRecurringToday = b.isRecurring && b.recurringDays?.includes(dayOfWeek);
      return isDateMatch || isRecurringToday;
    });
    return { dayAppointments, dayBlocks };
  };

  const { dayAppointments, dayBlocks } = getDayData();
  const isEmpty = dayAppointments.length === 0 && dayBlocks.length === 0;

  const getAppointmentsForTime = (time: string) => {
    return dayAppointments.filter(a => a.time === time);
  };

  const getBlockForTime = (time: string) => {
    return dayBlocks.find(b => time >= b.startTime && time < b.endTime);
  };

  const isToday = getTodayLocale() === date;

  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const nowLineY = useMemo(() => {
    if (!isToday) return null;
    const h = currentTime.getHours();
    const m = currentTime.getMinutes();
    if (h < 7 || h > 21) return null;
    const minutesSinceStart = (h - 7) * 60 + m;
    // Each 30min slot is 72px (h-18)
    return (minutesSinceStart / 30) * 72;
  }, [isToday, currentTime]);

  return (
    <div className="w-full relative px-4 pt-4">
      {/* Day Summary Label */}
      {!hideHeader && (
        <div className="flex items-center justify-between mb-8 px-2">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
                <h3 className="text-xl font-serif text-brand-ink italic">
                {isToday ? 'Hoje' : formatLocalDate(date, { weekday: 'long' })}
              </h3>
              {isToday && <span className="bg-brand-terracotta text-white text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">Agora</span>}
            </div>
            <p className="text-[10px] text-brand-stone font-light uppercase tracking-widest mt-1">
              {formatLocalDate(date, { day: 'numeric', month: 'long' })}
            </p>
          </div>
          
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-linen/40 rounded-full border border-brand-mist/30">
            <CalendarIcon size={12} className="text-brand-stone" />
            <span className="text-[10px] font-bold text-brand-ink uppercase tracking-widest">
              {dayAppointments.length} reserva{dayAppointments.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      {isEmpty ? (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="py-16 md:py-24 text-center bg-brand-linen/20 rounded-[32px] border border-dashed border-brand-mist/50 flex flex-col items-center gap-4"
        >
          <div className="w-12 h-12 bg-brand-white rounded-2xl flex items-center justify-center text-brand-mist/50 shadow-sm">
            <Zap size={20} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-serif text-brand-ink italic text-pretty">Nenhum agendamento para este dia.</p>
            <p className="text-[10px] text-brand-stone font-light px-6">Clientes podem agendar no seu perfil ou você pode adicionar manualmente.</p>
          </div>
          <button 
            onClick={() => onSelectSlot("09:00")}
            className="mt-2 px-8 py-4 min-h-[48px] bg-brand-ink text-brand-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-espresso transition-all shadow-md focus:ring-4 ring-brand-ink/20 focus:outline-none"
          >
            Adicionar Reserva
          </button>
        </motion.div>
      ) : (
        <div className="relative border-l border-brand-linen/50 ml-4 pb-10 bg-brand-white rounded-t-[32px] pt-4">
          {/* Time indicator line */}
          {isToday && nowLineY !== null && (
            <div 
              className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
              style={{ top: `${nowLineY}px` }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-brand-terracotta -ml-1.5 shadow-sm border-2 border-white" />
              <div className="flex-1 h-px bg-brand-terracotta/30" />
            </div>
          )}

          {timeSlots.map((time, idx) => {
            const appts = getAppointmentsForTime(time);
            const block = getBlockForTime(time);
            
            const [h, m] = time.split(':').map(Number);
            const now = new Date();
            const isPast = isToday && (h * 60 + m < now.getHours() * 60 + now.getMinutes());

            const hasActivity = appts.length > 0 || block;
            if (!hasActivity && isPast && idx % 2 !== 0) return null;

            return (
              <div 
                key={time} 
                className={cn(
                  "group flex items-start gap-3 transition-all pr-4",
                  hasActivity ? "h-[5.25rem]" : "h-[4.5rem]"
                )}
              >
                <div className="w-12 text-right -ml-16 bg-brand-white pr-4 pt-1 z-10">
                  <span className={cn(
                    "text-[8px] font-bold uppercase tracking-widest",
                    hasActivity ? "text-brand-ink" : "text-brand-stone opacity-30"
                  )}>
                    {idx % 2 === 0 ? time : ''}
                  </span>
                </div>

                <div 
                  className={cn(
                    "flex-1 border-b border-brand-linen/30 relative py-1",
                    !hasActivity && "hover:bg-brand-linen/10 cursor-pointer"
                  )}
                  onClick={() => !hasActivity && onSelectSlot(time)}
                >
                  {!hasActivity && (
                    <div className="h-full flex items-center">
                      <span className="opacity-0 group-hover:opacity-100 text-[10px] font-bold text-brand-terracotta uppercase tracking-[0.2em] transition-opacity flex items-center gap-2">
                        <Plus size={12} /> Reservar {time}
                      </span>
                    </div>
                  )}

                  {block && (
                    <div 
                      className="absolute inset-x-1 inset-y-1.5 rounded-xl bg-brand-stone/5 border border-brand-stone/10 flex items-center px-4 gap-3 cursor-pointer hover:bg-brand-stone/10 transition-colors z-20"
                      onClick={(e) => {
                        e.stopPropagation();
                        onBlockClick?.(block);
                      }}
                    >
                      <Lock size={12} className="text-brand-stone/40" />
                      <span className="text-[10px] font-bold text-brand-stone/60 uppercase tracking-widest truncate group-hover:text-brand-stone/80 transition-colors">Bloqueado: {block.reason || 'Pausa'}</span>
                    </div>
                  )}

                  {appts.map((app, appIdx) => {
                    const isConfirmedOrCompleted = isConfirmedLikeStatus(app.status) || isCompletedStatus(app.status);
                    return (
                    <motion.div
                      key={app.id}
                      layoutId={app.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectAppointment(app);
                      }}
                      className={cn(
                        "absolute inset-x-0 inset-y-1 rounded-[20px] p-3 cursor-pointer shadow-sm border flex items-center gap-3 transition-all hover:scale-[1.01] active:scale-[0.98]",
                        isConfirmedOrCompleted
                          ? "bg-brand-ink text-white border-brand-ink shadow-brand-ink/10"
                          : "bg-white text-brand-ink border-brand-mist/60 hover:border-brand-terracotta/50",
                        appIdx > 0 && "translate-x-2 translate-y-2 shadow-xl z-10"
                      )}
                    >
                      <div className={cn(
                        "w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0",
                        isConfirmedOrCompleted ? "bg-white/10" : "bg-brand-linen/50"
                      )}>
                        <Clock size={14} className={isConfirmedOrCompleted ? "text-white" : "text-brand-terracotta"} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 overflow-hidden">
                          <p className="text-xs font-bold truncate uppercase tracking-tight">
                            {app.clientName}
                          </p>
                          <p className={cn(
                            "text-[10px] font-mono",
                            isConfirmedOrCompleted ? "text-white/60" : "text-brand-stone"
                          )}>
                            {app.time}
                          </p>
                        </div>
                        <p className={cn(
                          "text-[9px] truncate uppercase tracking-widest mt-1",
                          isConfirmedOrCompleted ? "text-white/40" : "text-brand-stone"
                        )}>
                          {app.serviceName}
                        </p>
                      </div>

                      {isPendingStatus(app.status) && <AlertCircle size={14} className="text-red-500 shrink-0" />}
                      {isConfirmedOrCompleted && <Check size={14} className="text-brand-terracotta shrink-0" />}
                    </motion.div>
                  )})}
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Continuity Indicator */}
      <div className="pb-32 text-center mt-10">
         <p className="text-[10px] font-bold uppercase tracking-widest text-brand-stone opacity-30 italic">Fim dos horários do dia</p>
      </div>
    </div>
  );
}
