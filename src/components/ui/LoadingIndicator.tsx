import React from 'react';
import { cn } from '../../utils/cn';
import { Loader2 } from 'lucide-react';

export interface LoadingIndicatorProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

export function LoadingIndicator({
  label = 'Loading telemetry...',
  size = 'md',
  fullScreen = false,
}: LoadingIndicatorProps) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      <Loader2 className={cn('animate-spin text-electric-cyan', sizes[size])} />
      {label && <p className="text-xs font-medium uppercase tracking-wider text-arena-muted">{label}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-arena-bg/90 backdrop-blur-md">
        {content}
      </div>
    );
  }

  return <div className="py-8 flex items-center justify-center">{content}</div>;
}

