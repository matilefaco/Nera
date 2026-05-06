import React from 'react';
import { Skeleton } from './Skeleton';
import { cn } from '../../lib/utils';

interface MetricCardSkeletonProps {
  className?: string;
}

export function MetricCardSkeleton({ className }: MetricCardSkeletonProps) {
  return (
    <div className={cn("bg-brand-white rounded-3xl p-6 border border-brand-mist/50 flex flex-col gap-4 shadow-sm", className)}>
      <div className="flex justify-between items-start">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>
      <div>
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-3 w-48" />
      </div>
    </div>
  );
}
