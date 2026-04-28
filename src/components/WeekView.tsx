import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { cn, formatLocalDate, formatDateKey, getTodayLocale } from '../lib/utils';
import { Appointment } from '../types';
import DayView from './DayView';

interface WeekViewProps {
  appointments: Appointment[];
  blockedSchedules: any[];
  workingHours: any;
  weekStart: Date;
  selectedDate: string; // Changed from Date to string
  onSelectAppointment: (appt: Appointment) => void;
  onSelectSlot: (date: string, time: string) => void;
  onSelectDay: (date: Date) => void;
}

export default function WeekView({
  appointments,
  blockedSchedules,
  workingHours,
  weekStart,
  selectedDate,
  onSelectAppointment,
  onSelectSlot,
  onSelectDay
}: WeekViewProps) {
  
  // Create array of 7 days
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const selectedDateKey = selectedDate; // It's already a string "YYYY-MM-DD"
  const todayKey = getTodayLocale();

  return (
    <div className="w-full flex flex-col">
      {/* 1. HORIZONTAL DAY PICKER (Stripe Style) */}
      <div className="sticky top-0 z-40 bg-brand-white/95 backdrop-blur-md border-b border-brand-mist/30 mb-2">
        <div className="flex items-center px-4 py-4 gap-2 overflow-x-auto no-scrollbar scroll-smooth">
          {days.map((day) => {
            const dateKey = formatDateKey(day);
            const isToday = todayKey === dateKey;
            const isSelected = selectedDateKey === dateKey;
            
            return (
              <button 
                key={dateKey} 
                onClick={() => onSelectDay(day)}
                className={cn(
                  "flex flex-col items-center justify-center min-w-[54px] h-20 rounded-[24px] transition-all relative shrink-0",
                  isSelected 
                    ? "bg-brand-ink text-brand-white shadow-xl shadow-brand-ink/10 scale-105 z-10" 
                    : "text-brand-stone hover:bg-brand-linen/40"
                )}
              >
                <span className={cn(
                  "text-[8px] font-bold uppercase tracking-[0.2em] mb-2",
                  isToday && !isSelected ? "text-brand-terracotta" : isSelected ? "text-brand-parchment/60" : "text-brand-stone/50"
                )}>
                  {formatLocalDate(dateKey, { weekday: 'short' })}
                </span>
                <span className={cn(
                  "text-lg font-serif italic leading-none",
                  isToday && !isSelected ? "text-brand-terracotta border-b-2 border-brand-terracotta" : ""
                )}>
                  {day.getDate()}
                </span>
                
                {isToday && !isSelected && (
                  <div className="absolute top-3 right-3 w-1.5 h-1.5 bg-brand-terracotta rounded-full" />
                )}
                
                {isSelected && (
                  <motion.div 
                    layoutId="activeDayIndicator"
                    className="absolute -bottom-1 w-1 h-1 bg-brand-parchment rounded-full"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. THE DAY CONTENT (Reusing DayView) */}
      <div className="flex-1">
        <DayView
          appointments={appointments.filter(a => a.date === selectedDateKey)}
          blockedSchedules={blockedSchedules}
          date={selectedDateKey}
          onSelectAppointment={onSelectAppointment}
          onSelectSlot={(time) => onSelectSlot(selectedDateKey, time)}
          hideHeader={true}
        />
      </div>
    </div>
  );
}

