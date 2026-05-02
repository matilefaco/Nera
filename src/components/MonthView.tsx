import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { cn, formatDateKey, formatLocalDate } from '../lib/utils';
import { Appointment } from '../types';

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
    const confirmed = dayAppts.filter(a => a.status === 'confirmed' || a.status === 'completed').length;
    const pending = dayAppts.filter(a => a.status === 'pending').length;
    const isBlocked = blockedSchedules.some(b => b.date === dateKey && !b.isRecurring);
    
    return { confirmed, pending, isBlocked };
  };

  const weekLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  return (
    <div className="bg-brand-white rounded-[32px] border border-brand-mist shadow-sm overflow-hidden">
      <div className="grid grid-cols-7 border-b border-brand-linen bg-brand-linen/10">
        {weekLabels.map(label => (
          <div key={label} className="py-3 text-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-stone opacity-60">
              {label}
            </span>
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-7 divide-x divide-y divide-brand-linen">
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
                "h-24 md:h-32 p-2 flex flex-col items-center gap-1 group transition-colors text-left",
                !isCurrentMonth && "opacity-20",
                isSelected ? "bg-brand-linen/30" : "hover:bg-brand-parchment/30",
                isToday && "bg-brand-terracotta/[0.03]"
              )}
            >
              <span className={cn(
                "text-sm font-serif mb-1 w-7 h-7 flex items-center justify-center rounded-full transition-colors",
                isToday ? "bg-brand-terracotta text-white font-bold" : "text-brand-ink",
                isSelected && !isToday && "bg-brand-ink text-white"
              )}>
                {date.getDate()}
              </span>

              {/* Day Markers */}
              <div className="flex flex-col gap-1 w-full max-w-[40px] mt-auto pb-1">
                {confirmed > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-ink" />
                    <span className="text-[8px] font-bold text-brand-ink">{confirmed}</span>
                  </div>
                )}
                {pending > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[8px] font-bold text-red-500">{pending}</span>
                  </div>
                )}
                {isBlocked && (
                  <div className="flex justify-center">
                    <div className="h-0.5 w-4 bg-brand-stone/20 rounded-full" />
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
