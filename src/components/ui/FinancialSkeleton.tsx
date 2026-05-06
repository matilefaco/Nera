import React from 'react';
import { Skeleton } from './Skeleton';
import AppLayout from '../AppLayout';

export function FinancialSkeleton() {
  return (
    <AppLayout activeRoute="financial">
      <div className="p-6 md:p-12 pb-32 max-w-5xl mx-auto w-full">
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-2">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <Skeleton className="h-10 w-48" />
          </div>
          <Skeleton className="h-4 w-64 mt-2" />
        </header>

        <div className="space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-brand-white p-8 rounded-[40px] border border-brand-mist shadow-sm h-[250px] flex flex-col justify-between">
              <div>
                <Skeleton className="h-3 w-32 mb-4" />
                <Skeleton className="h-10 w-48 mb-8" />
              </div>
              <div className="flex gap-8">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
            
            <div className="bg-brand-white p-8 rounded-[40px] border border-brand-mist shadow-sm flex flex-col justify-between h-[250px]">
              <div>
                <Skeleton className="h-3 w-32 mb-4" />
                <Skeleton className="h-8 w-16 mb-4" />
              </div>
              <Skeleton className="h-10 w-full rounded-full" />
            </div>
          </div>

          <div className="space-y-4">
            <Skeleton className="h-6 w-48 mb-4" />
            <div className="bg-brand-white rounded-3xl p-6 border border-brand-mist/50">
              <Skeleton className="h-12 w-full mb-4" />
              <Skeleton className="h-12 w-full mb-4" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
