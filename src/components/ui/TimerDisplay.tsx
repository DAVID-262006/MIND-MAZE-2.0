import React from 'react';
import { cn } from '../../utils/cn';
import { Clock, AlertTriangle } from 'lucide-react';

export interface TimerDisplayProps {
  secondsRemaining: number;
  totalDurationSeconds?: number;
  isGracePeriod?: boolean;
  className?: string;
  compact?: boolean;
}

export function TimerDisplay({
  secondsRemaining,
  totalDurationSeconds = 300,
  isGracePeriod = false,
  className,
  compact = false,
}: TimerDisplayProps) {
  const minutes = Math.floor(Math.max(0, secondsRemaining) / 60);
  const seconds = Math.floor(Math.max(0, secondsRemaining) % 60);
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const progress = Math.max(0, Math.min(100, (secondsRemaining / totalDurationSeconds) * 100));

  if (compact) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono font-bold text-sm select-none',
          isGracePeriod
            ? 'bg-amber-500/10 border-electric-amber text-electric-amber animate-pulse'
            : secondsRemaining < 60
            ? 'bg-red-500/10 border-electric-crimson text-electric-crimson'
            : 'bg-arena-card border-arena-border text-white',
          className
        )}
      >
        {isGracePeriod ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4 text-electric-cyan" />}
        <span>{formattedTime}</span>
        {isGracePeriod && <span className="text-[10px] uppercase font-sans tracking-widest bg-electric-amber/20 px-1 rounded">GRACE</span>}
      </div>
    );
  }

  // Large Dial Display with SVG progress ring
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center p-4 rounded-2xl bg-arena-card border shadow-lg',
        isGracePeriod
          ? 'border-electric-amber shadow-[0_0_20px_rgba(245,158,11,0.2)]'
          : secondsRemaining < 60
          ? 'border-electric-crimson shadow-[0_0_20px_rgba(239,68,68,0.2)]'
          : 'border-arena-border',
        className
      )}
    >
      <div className="relative w-28 h-28 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            className="text-arena-panel stroke-current"
            strokeWidth="6"
            fill="transparent"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            className={cn(
              'transition-all duration-500 stroke-current',
              isGracePeriod
                ? 'text-electric-amber'
                : secondsRemaining < 60
                ? 'text-electric-crimson'
                : 'text-electric-cyan'
            )}
            strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>

        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="font-mono text-2xl font-black text-white tracking-tight">{formattedTime}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-arena-muted">
            {isGracePeriod ? 'GRACE EXT.' : 'ROUND TIME'}
          </span>
        </div>
      </div>

      {isGracePeriod && (
        <div className="mt-2 text-center text-xs font-bold text-electric-amber uppercase tracking-wider animate-pulse flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>30s Grace Period Active</span>
        </div>
      )}
    </div>
  );
}

