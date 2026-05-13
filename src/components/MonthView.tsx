import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { cn, formatDateKey, formatLocalDate } from '../lib/utils';
import { Appointment } from '../types';
import { isConfirmedLikeStatus, isCompletedStatus, isPendingStatus } from '../constants/appointmentStatus';

interface MonthViewProps {
  currentDate: string;
  appointments: Appointment[];
  blockedSchedules: any[];
  onSelectDay: (date: string) => void;
}

export default function MonthView({
  currentDate,
  appointments,
  blockedSchedules,
  onSelectDay
}: MonthViewProps) {
  const currentMonthDate = useMemo(() => {
    const [y, m, d] = currentDate.split('-').map(Number);
    return new Date(y, m - 1, 1);
  }, [currentDate]);

  const daysInMonth = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days = [];
    
    // Fill previous month days
    const startPadding = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Start on Monday
    for (let i = startPadding; i > 0; i--) {
      const d = new Date(year, month, 1 - i);
      days.push({ date: d, isCurrentMonth: false });
    }
    
    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, isCurrentMonth: true });
    }
    
    // Next month padding
    const endPadding = 42 - days.length;
    for (let i = 1; i <= endPadding; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, isCurrentMonth: false });
    }
    
    return days;
  }, [currentMonthDate]);

  const getDayStats = (dateKey: string) => {
    const dayAppts = appointments.filter(a => a.date === dateKey);
    const confirmed = dayAppts.filter(a => isConfirmedLikeStatus(a.status) || isCompletedStatus(a.status)).length;
    const pending = dayAppts.filter(a => isPendingStatus(a.status)).length;
    const isBlocked = blockedSchedules.some(b => b.date === dateKey && !b.isRecurring);
    
    return { confirmed, pending, isBlocked };
  };

  const weekLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-[28px] border border-brand-mist/40 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="grid grid-cols-7 border-b border-brand-mist/30 bg-brand-linen/5">
        {weekLabels.map(label => (
          <div key={label} className="py-2.5 text-center">
            <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-brand-stone/60">
              {label}
            </span>
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-7 divide-x divide-y divide-brand-mist/20">
        {daysInMonth.map(({ date, isCurrentMonth }, i) => {
          const dateKey = formatDateKey(date);
          const { confirmed, pending, isBlocked } = getDayStats(dateKey);
          const isToday = formatDateKey(new Date()) === dateKey;
          const isSelected = currentDate === dateKey;

          return (
            <button
              key={i}
              onClick={() => onSelectDay(dateKey)}
              className={cn(
                "h-[5.5rem] md:h-28 p-1.5 flex flex-col items-center gap-0.5 group transition-all duration-300 text-center",
                !isCurrentMonth ? "opacity-30" : "opacity-100",
                isSelected ? "bg-brand-terracotta/[0.04]" : "hover:bg-black/[0.02]",
                isToday && "bg-brand-terracotta/[0.02]"
              )}
            >
              <span className={cn(
                "text-[13px] font-serif mb-1 w-[1.65rem] h-[1.65rem] flex items-center justify-center rounded-full transition-all duration-300",
                isToday ? "bg-brand-terracotta/90 text-white font-medium shadow-[0_2px_8px_rgba(202,106,86,0.3)]" : "text-brand-ink/85 font-normal",
                isSelected && !isToday && "ring-1 ring-inset ring-brand-ink/10 bg-brand-ink/5 font-medium"
              )}>
                {date.getDate()}
              </span>

              {/* Day Markers */}
              <div className="flex flex-col gap-[3px] w-full items-center mt-auto pb-1 md:pb-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                {confirmed > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="w-[3px] h-[3px] rounded-full bg-brand-ink/50" />
                    <span className="text-[8.5px] font-medium text-brand-stone/80 leading-none">{confirmed}</span>
                  </div>
                )}
                {pending > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-[3px] h-[3px] rounded-full bg-brand-terracotta/80 shadow-[0_0_4px_rgba(202,106,86,0.3)] animate-pulse" />
                    <span className="text-[8.5px] font-medium text-brand-terracotta/90 leading-none">{pending}</span>
                  </div>
                )}
                {isBlocked && (
                  <div className="flex justify-center mt-0.5">
                    <div className="h-[2px] w-3 bg-brand-mist/60 rounded-full" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
