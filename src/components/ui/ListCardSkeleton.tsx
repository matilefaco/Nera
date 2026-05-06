import React from 'react';
import { Skeleton } from './Skeleton';

export function ListCardSkeleton() {
  return (
    <div className="bg-brand-white rounded-3xl p-6 border border-brand-mist/50 flex flex-col md:flex-row align-start justify-between gap-6 shadow-sm">
      <div className="flex items-center gap-4 w-full md:w-auto">
        <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
        <div className="flex flex-col gap-2 w-full">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="hidden md:flex items-center gap-8">
        <div className="flex flex-col gap-2 items-center">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="flex flex-col gap-2 items-center">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>
    </div>
  );
}
