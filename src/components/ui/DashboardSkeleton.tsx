import React from 'react';
import { Skeleton } from './Skeleton';
import AppLayout from '../AppLayout';

export function DashboardSkeleton() {
  return (
    <AppLayout activeRoute="dashboard">
      <div className="p-6 md:p-12 pb-32 max-w-5xl mx-auto w-full space-y-10 animate-in fade-in duration-700">
        
        {/* Header Limpo Skeleton */}
        <header className="flex items-center justify-between">
          <div>
            <Skeleton className="h-10 w-48 mb-2 bg-brand-mist/30" />
            <div className="flex flex-col mt-1">
               <div className="flex items-center gap-2">
                 <Skeleton className="h-5 w-20 rounded-full bg-brand-mist/30" />
               </div>
               <Skeleton className="h-3 w-40 mt-2 bg-brand-mist/20" />
            </div>
          </div>
        </header>

        {/* Tabs Skeleton */}
        <div className="flex bg-[#FAF9F8] p-1 rounded-full text-[9px] font-bold uppercase tracking-widest w-fit border border-brand-mist/30">
          <Skeleton className="w-16 h-8 rounded-full bg-brand-mist/40" />
          <Skeleton className="w-16 h-8 rounded-full bg-transparent" />
          <Skeleton className="w-20 h-8 rounded-full bg-transparent" />
        </div>

        {/* Metrics/Blocks Skeleton */}
        <div className="grid grid-cols-2 gap-4 opacity-70">
          <div className="bg-[#FCFBF9] p-6 rounded-[32px] border border-brand-mist/40">
            <Skeleton className="h-3 w-24 mb-6 bg-brand-mist/30" />
            <Skeleton className="h-8 w-20 mb-2 bg-brand-mist/40" />
            <Skeleton className="h-2 w-16 bg-brand-mist/20" />
          </div>
          <div className="bg-[#FCFBF9] p-6 rounded-[32px] border border-brand-mist/40">
            <Skeleton className="h-3 w-24 mb-6 bg-brand-mist/30" />
            <Skeleton className="h-8 w-20 mb-2 bg-brand-mist/40" />
            <Skeleton className="h-2 w-16 bg-brand-mist/20" />
          </div>
        </div>

        <div className="bg-[#FCFBF9] p-8 rounded-[32px] border border-brand-mist/40 opacity-70">
           <Skeleton className="h-3 w-32 mb-8 bg-brand-mist/30" />
           <div className="space-y-4">
             <Skeleton className="h-14 w-full rounded-2xl bg-brand-mist/20" />
             <Skeleton className="h-14 w-full rounded-2xl bg-brand-mist/20" />
           </div>
        </div>
      </div>
    </AppLayout>
  );
}
