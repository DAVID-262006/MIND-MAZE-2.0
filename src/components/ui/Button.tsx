import React from 'react';
import { cn } from '../../utils/cn';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading = false, icon, children, disabled, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-arena-bg disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] select-none';

    const variants = {
      primary:
        'bg-electric-cyan text-arena-bg font-semibold hover:bg-cyan-300 focus:ring-electric-cyan shadow-[0_0_15px_rgba(0,242,254,0.3)]',
      secondary:
        'bg-arena-panel text-white hover:bg-arena-hover focus:ring-arena-border border border-arena-border',
      danger:
        'bg-electric-crimson text-white hover:bg-red-600 focus:ring-electric-crimson shadow-[0_0_15px_rgba(239,68,68,0.3)]',
      success:
        'bg-electric-emerald text-white hover:bg-emerald-600 focus:ring-electric-emerald shadow-[0_0_15px_rgba(16,185,129,0.3)]',
      outline:
        'bg-transparent text-arena-muted hover:text-white border border-arena-border hover:border-electric-cyan focus:ring-electric-cyan',
      ghost: 'bg-transparent text-arena-muted hover:text-white hover:bg-arena-panel focus:ring-arena-border',
    };

    const sizes = {
      sm: 'text-xs px-3 py-1.5 gap-1.5',
      md: 'text-sm px-4 py-2 gap-2',
      lg: 'text-base px-6 py-3 gap-2.5',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin text-current" /> : icon}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

