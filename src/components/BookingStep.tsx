import React from 'react';
import { cn } from '../lib/utils';

interface BookingStepProps {
  step: number;
  total: number;
  title: string;
}

export default function BookingStep({ step, total, title }: BookingStepProps) {
  return (
    <div className="mb-8">
      <div className="flex gap-2 mb-4">
        {Array.from({ length: total }).map((_, i) => (
          <div 
            key={i} 
            className={cn(
              "h-1 flex-1 rounded-full transition-all duration-500", 
              step > i ? "bg-brand-terracotta" : "bg-brand-mist"
            )} 
          />
        ))}
      </div>
      <div>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-terracotta block mb-1">
          Etapa {step} de {total}
        </span>
        <h3 className="text-2xl font-serif text-brand-ink">{title}</h3>
      </div>
    </div>
  );
}
