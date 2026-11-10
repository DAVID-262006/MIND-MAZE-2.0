import React from 'react';
import { cn } from '../../utils/cn';

export interface DashboardCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;
  footer?: React.ReactNode;
}

export function DashboardCard({
  className,
  title,
  subtitle,
  action,
  footer,
  children,
  ...props
}: DashboardCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col bg-arena-card border border-arena-border rounded-xl shadow-md overflow-hidden transition-all duration-200 hover:border-arena-hover',
        className
      )}
      {...props}
    >
      {(title || action) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-arena-border/60">
          <div>
            {typeof title === 'string' ? (
              <h3 className="text-sm font-bold text-white tracking-wide uppercase">{title}</h3>
            ) : (
              title
            )}
            {subtitle && <p className="text-xs text-arena-muted mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}

      <div className="flex-1 p-5">{children}</div>

      {footer && (
        <div className="px-5 py-3 bg-arena-panel/50 border-t border-arena-border/60 text-xs text-arena-muted">
          {footer}
        </div>
      )}
    </div>
  );
}

