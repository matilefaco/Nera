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
    <div className="w-full relative px-3 sm:px-4 pt-2 sm:pt-4">
      {/* Day Summary Label */}
      {!hideHeader && (
        <div className="flex items-center justify-between mb-6 px-2">
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
          className="py-14 md:py-20 text-center bg-brand-linen/20 rounded-[32px] border border-dashed border-brand-mist/50 flex flex-col items-center gap-4 mt-2 mb-6 mx-2"
        >
          <div className="w-12 h-12 bg-brand-white rounded-[18px] flex items-center justify-center text-brand-mist/60 shadow-sm">
            <Zap size={24} />
          </div>
          <div className="space-y-2">
            <p className="text-base font-serif text-brand-ink italic text-pretty">Hoje está leve.</p>
            <p className="text-[11px] text-brand-stone font-light px-8 leading-relaxed">Sua agenda está livre. Clientes podem reservar pelo seu link ou você pode adicionar manualmente.</p>
          </div>
          <button 
            onClick={() => onSelectSlot("09:00")}
            className="mt-4 px-8 py-4 min-h-[48px] bg-brand-ink text-brand-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-espresso transition-all shadow-md focus:ring-4 ring-brand-ink/20 focus:outline-none"
          >
            Adicionar Reserva
          </button>
        </motion.div>
      ) : (
        <div className="relative border-l border-brand-linen/50 ml-16 sm:ml-20 pb-12 pt-2">
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
                  "group flex items-start gap-2 sm:gap-3 transition-all pr-1 sm:pr-3",
                  hasActivity ? "h-[5.75rem]" : "h-[4.5rem]"
                )}
              >
                <div className="w-16 sm:w-20 text-right -ml-16 sm:-ml-20 pr-3 sm:pr-4 pt-1 z-10 shrink-0 bg-transparent">
                  <span className={cn(
                    "text-[10px] font-medium tracking-widest",
                    hasActivity ? "text-brand-ink" : "text-brand-stone opacity-60"
                  )}>
                    {idx % 2 === 0 ? time : ''}
                  </span>
                </div>

                <div 
                  className={cn(
                    "flex-1 border-b border-brand-linen/30 relative py-2",
                    !hasActivity && "hover:bg-brand-linen/10 cursor-pointer"
                  )}
                  onClick={() => !hasActivity && onSelectSlot(time)}
                >
                  {!hasActivity && (
                    <div className="h-full flex items-center pl-2">
                       <span className="opacity-0 group-hover:opacity-100 text-[10px] font-bold text-brand-terracotta uppercase tracking-[0.2em] transition-opacity flex items-center gap-2">
                        <Plus size={12} /> Reservar {time}
                      </span>
                    </div>
                  )}

                  {block && (
                    <div 
                      className="absolute left-0 right-4 sm:right-6 inset-y-1.5 rounded-[20px] bg-brand-stone/5 border border-brand-stone/10 flex items-center px-3 sm:px-4 gap-3 cursor-pointer hover:bg-brand-stone/10 transition-colors z-20"
                      onClick={(e) => {
                        e.stopPropagation();
                        onBlockClick?.(block);
                      }}
                    >
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[12px] bg-white/50 flex items-center justify-center shrink-0">
                        <Lock size={14} className="text-brand-stone/50" />
                      </div>
                      <span className="text-[11px] font-medium text-brand-stone/80 uppercase tracking-widest truncate group-hover:text-brand-stone transition-colors">
                        Bloqueado: {block.reason || 'Pausa'}
                      </span>
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
                        "absolute left-0 right-4 sm:right-6 inset-y-1 sm:inset-y-1.5 rounded-[20px] sm:rounded-[24px] p-3 sm:p-4 flex items-center gap-3 transition-all hover:scale-[1.01] active:scale-[0.98] min-h-[4.75rem] cursor-pointer shadow-sm border",
                        isConfirmedOrCompleted
                          ? "bg-brand-ink text-white border-brand-ink shadow-brand-ink/10"
                          : "bg-white text-brand-ink border-brand-mist/60 hover:border-brand-terracotta/30",
                        appIdx > 0 && "translate-x-2 translate-y-2 shadow-xl z-30"
                      )}
                    >
                      <div className={cn(
                        "w-9 h-9 sm:w-10 sm:h-10 rounded-[12px] flex items-center justify-center shrink-0",
                        isConfirmedOrCompleted ? "bg-white/10" : "bg-brand-linen/60"
                      )}>
                        <Clock size={16} className={isConfirmedOrCompleted ? "text-white/90" : "text-brand-terracotta"} />
                      </div>
                      
                      <div className="flex-1 min-w-0 pr-6 sm:pr-8">
                        <div className="flex items-center justify-between gap-2 overflow-hidden mb-0.5 sm:mb-1">
                          <p className="text-[14px] sm:text-[15px] font-bold truncate tracking-tight pr-1">
                            {app.clientName}
                          </p>
                          <p className={cn(
                            "text-[10px] sm:text-[11px] font-mono shrink-0 font-medium",
                            isConfirmedOrCompleted ? "text-white/60" : "text-brand-stone"
                          )}>
                            {app.time}
                          </p>
                        </div>
                        <p className={cn(
                          "text-[10px] sm:text-[11px] truncate uppercase tracking-widest",
                          isConfirmedOrCompleted ? "text-white/40" : "text-brand-stone/80"
                        )}>
                          {app.serviceName}
                        </p>
                      </div>

                      {isPendingStatus(app.status) && (
                        <div className="absolute top-1/2 -translate-y-1/2 right-3 sm:right-4 text-red-500">
                          <AlertCircle size={16} />
                        </div>
                      )}
                      {isConfirmedOrCompleted && (
                        <div className="absolute top-1/2 -translate-y-1/2 right-3 sm:right-4 text-brand-terracotta opacity-90">
                          <Check size={16} />
                        </div>
                      )}
                    </motion.div>
                  )})}
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Continuity Indicator */}
      <div className="pb-32 text-center mt-6">
         <p className="text-[10px] font-bold uppercase tracking-widest text-brand-stone opacity-30 italic">Fim dos horários do dia</p>
      </div>
    </div>
  );
}
