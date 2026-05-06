import React from 'react';
import { Skeleton } from './Skeleton';
import AppLayout from '../AppLayout';

export function AgendaSkeleton() {
  return (
    <AppLayout activeRoute="agenda">
      <div className="p-6 md:p-12 pb-32 max-w-2xl mx-auto w-full">
        {/* Header Agenda */}
        <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-6 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <Skeleton className="h-10 w-48" />
            </div>
            <Skeleton className="h-4 w-40 mt-3" />
          </div>

          {/* Abas e setas */}
          <div className="flex items-center gap-2">
            <div className="flex bg-brand-linen p-1 rounded-full w-fit">
              <Skeleton className="w-16 h-8 rounded-full" />
              <Skeleton className="w-16 h-8 rounded-full" />
              <Skeleton className="w-16 h-8 rounded-full" />
            </div>
            <Skeleton className="w-10 h-10 rounded-2xl hidden md:block" />
            <Skeleton className="w-10 h-10 rounded-2xl hidden md:block" />
          </div>
        </header>

        {/* Busca e KPIs */}
        <div className="mb-10 space-y-4">
           <Skeleton className="h-12 w-full rounded-[28px]" />
           <div className="grid grid-cols-3 gap-3">
             <Skeleton className="h-20 w-full rounded-3xl" />
             <Skeleton className="h-20 w-full rounded-3xl" />
             <Skeleton className="h-20 w-full rounded-3xl" />
           </div>
        </div>

        {/* Timeline placeholder (simulando 4 blocos de horário) */}
        <div className="space-y-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex gap-4 items-start">
              <Skeleton className="w-14 h-6 mt-2" />
              <div className="flex-1">
                <Skeleton className="h-24 w-full rounded-3xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
