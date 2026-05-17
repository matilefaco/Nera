import React from 'react';
import { Skeleton } from './Skeleton';
import AppLayout from '../AppLayout';

export function AgendaSkeleton() {
  return (
    <AppLayout activeRoute="agenda">
      <div className="p-6 md:p-12 pb-32 max-w-2xl mx-auto w-full animate-in fade-in duration-700">
        {/* Header Agenda */}
        <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-6 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Skeleton className="w-10 h-10 rounded-xl bg-brand-mist/30" />
              <Skeleton className="h-10 w-48 bg-brand-mist/30" />
            </div>
          </div>

          {/* Abas e setas */}
          <div className="flex items-center gap-2">
            <div className="flex bg-[#FAF9F8] p-1 rounded-full w-fit border border-brand-mist/30">
              <Skeleton className="w-16 h-8 rounded-full bg-brand-mist/40" />
              <Skeleton className="w-16 h-8 rounded-full bg-transparent" />
              <Skeleton className="w-16 h-8 rounded-full bg-transparent" />
            </div>
          </div>
        </header>

        {/* Busca e KPIs */}
        <div className="mb-10 space-y-4 opacity-70">
           <Skeleton className="h-12 w-full rounded-full bg-[#FCFBF9] border border-brand-mist/40" />
           <div className="grid grid-cols-3 gap-3">
             <Skeleton className="h-20 w-full rounded-[28px] bg-[#FCFBF9] border border-brand-mist/30" />
             <Skeleton className="h-20 w-full rounded-[28px] bg-[#FCFBF9] border border-brand-mist/30" />
             <Skeleton className="h-20 w-full rounded-[28px] bg-[#FCFBF9] border border-brand-mist/30" />
           </div>
        </div>

        {/* Timeline placeholder */}
        <div className="space-y-6 opacity-60">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-4 items-start">
              <Skeleton className="w-12 h-4 mt-4 bg-brand-mist/20" />
              <div className="flex-1">
                <Skeleton className="h-[72px] w-full rounded-[24px] bg-[#FCFBF9] border border-brand-mist/30" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
