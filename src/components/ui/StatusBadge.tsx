import React from 'react';
import { cn } from '../../utils/cn';

export type BadgeVariant = 'active' | 'ready' | 'completed' | 'eliminated' | 'warning' | 'neutral' | 'grace';

export interface StatusBadgeProps {
  variant?: BadgeVariant;
  label: string;
  pulse?: boolean;
  className?: string;
}

export function StatusBadge({ variant = 'neutral', label, pulse = false, className }: StatusBadgeProps) {
  const styles: Record<BadgeVariant, { bg: string; text: string; dot: string; border: string }> = {
    active: {
      bg: 'bg-emerald-500/10',
      text: 'text-electric-emerald',
      dot: 'bg-electric-emerald',
      border: 'border-emerald-500/30',
    },
    ready: {
      bg: 'bg-cyan-500/10',
      text: 'text-electric-cyan',
      dot: 'bg-electric-cyan',
      border: 'border-cyan-500/30',
    },
    grace: {
      bg: 'bg-amber-500/15',
      text: 'text-electric-amber',
      dot: 'bg-electric-amber',
      border: 'border-amber-500/40',
    },
    warning: {
      bg: 'bg-amber-500/10',
      text: 'text-electric-amber',
      dot: 'bg-electric-amber',
      border: 'border-amber-500/30',
    },
    eliminated: {
      bg: 'bg-red-500/15',
      text: 'text-electric-crimson',
      dot: 'bg-electric-crimson',
      border: 'border-red-500/40',
    },
    completed: {
      bg: 'bg-purple-500/15',
      text: 'text-electric-violet',
      dot: 'bg-electric-violet',
      border: 'border-purple-500/30',
    },
    neutral: {
      bg: 'bg-arena-panel',
      text: 'text-arena-muted',
      dot: 'bg-arena-muted',
      border: 'border-arena-border',
    },
  };

  const current = styles[variant];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border select-none',
        current.bg,
        current.text,
        current.border,
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', current.dot, pulse && 'animate-ping')} />
      {label}
    </span>
  );
}

