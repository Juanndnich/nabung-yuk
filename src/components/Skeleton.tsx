import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'rect' | 'circle' | 'text' | 'card';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rect',
}) => {
  const variantStyles = {
    rect: 'rounded-xl',
    circle: 'rounded-full',
    text: 'h-4 rounded-md',
    card: 'rounded-3xl p-5',
  }[variant];

  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-slate-200/80 dark:bg-slate-800/80 ${variantStyles} ${className}`}
    />
  );
};

export const CardSkeleton: React.FC<{ rows?: number }> = ({ rows = 3 }) => {
  return (
    <div className="p-5 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton variant="text" className="w-1/3 h-5" />
        <Skeleton variant="circle" className="w-8 h-8" />
      </div>
      <div className="space-y-2 pt-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton
            key={i}
            variant="text"
            className={`h-4 ${i === rows - 1 ? 'w-2/3' : 'w-full'}`}
          />
        ))}
      </div>
    </div>
  );
};
