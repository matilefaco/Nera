import React from 'react';
import { Skeleton } from './Skeleton';
import AppLayout from '../AppLayout';

export function FinancialSkeleton() {
  return (
    <AppLayout activeRoute="financial">
      <div className="p-6 md:p-12 pb-32 max-w-5xl mx-auto w-full animate-in fade-in duration-700">
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-2">
            <Skeleton className="w-10 h-10 rounded-xl bg-brand-mist/30" />
            <Skeleton className="h-10 w-48 bg-brand-mist/30" />
          </div>
          <Skeleton className="h-4 w-64 mt-2 bg-brand-mist/20" />
        </header>

        <div className="space-y-10 opacity-70">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-[#FCFBF9] p-8 rounded-[40px] border border-brand-mist/40 h-[250px] flex flex-col justify-between">
              <div>
                <Skeleton className="h-3 w-32 mb-4 bg-brand-mist/30" />
                <Skeleton className="h-10 w-48 mb-8 bg-brand-mist/40" />
              </div>
              <div className="flex gap-8">
                <Skeleton className="h-8 w-24 bg-brand-mist/20" />
                <Skeleton className="h-8 w-24 bg-brand-mist/20" />
              </div>
            </div>
            
            <div className="bg-[#FCFBF9] p-8 rounded-[40px] border border-brand-mist/40 flex flex-col justify-between h-[250px]">
              <div>
                <Skeleton className="h-3 w-32 mb-4 bg-brand-mist/30" />
                <Skeleton className="h-8 w-16 mb-4 bg-brand-mist/40" />
              </div>
              <Skeleton className="h-10 w-full rounded-full bg-brand-mist/20" />
            </div>
          </div>

          <div className="space-y-4">
            <Skeleton className="h-6 w-48 mb-4 bg-brand-mist/30" />
            <div className="bg-[#FCFBF9] rounded-3xl p-6 border border-brand-mist/40">
              <Skeleton className="h-12 w-full mb-4 bg-brand-mist/20 rounded-2xl" />
              <Skeleton className="h-12 w-full mb-4 bg-brand-mist/20 rounded-2xl" />
              <Skeleton className="h-12 w-full bg-brand-mist/20 rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
