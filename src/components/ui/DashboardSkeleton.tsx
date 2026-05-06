import React from 'react';
import { Skeleton } from './Skeleton';
import AppLayout from '../AppLayout';

export function DashboardSkeleton() {
  return (
    <AppLayout activeRoute="dashboard">
      <div className="p-6 md:p-12 pb-32 max-w-2xl mx-auto w-full space-y-10">
        
        {/* Header Limpo Skeleton */}
        <header className="flex items-center justify-between">
          <div>
            <Skeleton className="h-10 w-48 mb-2" />
            <div className="flex flex-col mt-1">
               <div className="flex items-center gap-2">
                 <Skeleton className="h-5 w-20 rounded-full" />
               </div>
               <Skeleton className="h-3 w-40 mt-2" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-32 rounded-full" />
            <Skeleton className="h-8 w-32 rounded-full" />
          </div>
        </header>

        {/* Tabs Skeleton */}
        <div className="flex bg-brand-linen p-1 rounded-full text-[9px] font-bold uppercase tracking-widest w-fit">
          <Skeleton className="w-16 h-8 rounded-full" />
          <Skeleton className="w-16 h-8 rounded-full" />
          <Skeleton className="w-20 h-8 rounded-full" />
          <Skeleton className="w-16 h-8 rounded-full" />
        </div>

        {/* Metrics/Blocks Skeleton */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-brand-white p-6 rounded-3xl border border-brand-mist/50">
            <Skeleton className="h-3 w-24 mb-6" />
            <Skeleton className="h-8 w-20 mb-2" />
            <Skeleton className="h-3 w-32" />
          </div>
          <div className="bg-brand-white p-6 rounded-3xl border border-brand-mist/50">
            <Skeleton className="h-3 w-24 mb-6" />
            <Skeleton className="h-8 w-20 mb-2" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>

        <div className="bg-brand-white p-6 rounded-3xl border border-brand-mist/50">
           <Skeleton className="h-4 w-32 mb-6" />
           <Skeleton className="h-12 w-full mb-3" />
           <Skeleton className="h-12 w-full mb-3" />
           <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </AppLayout>
  );
}
