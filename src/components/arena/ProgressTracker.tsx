import React from 'react';
import { cn } from '../../utils/cn';
import { Check } from 'lucide-react';

export interface ProgressTrackerProps {
  currentRound: number;
  totalRounds?: number;
  className?: string;
}

export function ProgressTracker({
  currentRound,
  totalRounds = 10,
  className,
}: ProgressTrackerProps) {
  return (
    <div className={cn('w-full select-none', className)}>
      <div className="flex items-center justify-between gap-1 sm:gap-1.5 w-full">
        {Array.from({ length: totalRounds }, (_, i) => i + 1).map((round) => {
          const isDone = round < currentRound;
          const isCurrent = round === currentRound;
          const isLocked = round > currentRound;

          return (
            <div
              key={round}
              className="flex-1 flex flex-col items-center justify-center min-w-0"
              title={`Round ${round}`}
            >
              <div
                className={cn(
                  'w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center font-mono font-bold text-[10px] sm:text-xs transition-all duration-200 border',
                  isDone && 'bg-emerald-500/20 border-electric-emerald text-electric-emerald',
                  isCurrent &&
                    'bg-electric-cyan text-arena-bg font-black border-cyan-200 shadow-[0_0_10px_rgba(0,242,254,0.5)] scale-110',
                  isLocked && 'bg-arena-panel border-arena-border text-arena-muted/50'
                )}
              >
                {isDone ? (
                  <Check className="w-3 h-3 stroke-[3]" />
                ) : (
                  <span>{round}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
