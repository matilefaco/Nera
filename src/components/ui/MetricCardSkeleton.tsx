import React from 'react';
import { Skeleton } from './Skeleton';
import { cn } from '../../lib/utils';

interface MetricCardSkeletonProps {
  className?: string;
}

export function MetricCardSkeleton({ className }: MetricCardSkeletonProps) {
  return (
    <div className={cn("bg-[#FCFBF9] rounded-[32px] p-6 border border-brand-mist/40 flex flex-col gap-4 shadow-sm opacity-70", className)}>
      <div className="flex justify-between items-start">
        <Skeleton className="h-4 w-24 bg-brand-mist/30" />
        <Skeleton className="h-10 w-10 rounded-full bg-brand-mist/40" />
      </div>
      <div>
        <Skeleton className="h-8 w-32 mb-2 bg-brand-mist/40" />
        <Skeleton className="h-3 w-48 bg-brand-mist/20" />
      </div>
    </div>
  );
}
