'use client';

export type SkeletonProps = {
  className?: string;
  /** Number of lines (for table rows, list items) */
  lines?: number;
};

/**
 * Skeleton placeholder for loading states in tables and cards.
 */
export function Skeleton({ className = '', lines = 1 }: SkeletonProps) {
  return (
    <div className={className}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 animate-pulse rounded bg-slate-200 dark:bg-slate-700"
          style={i < lines - 1 ? { marginBottom: 8 } : undefined}
        />
      ))}
    </div>
  );
}
