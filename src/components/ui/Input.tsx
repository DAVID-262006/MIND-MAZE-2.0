import React from 'react';
import { cn } from '../../utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leadingIcon?: React.ReactNode;
  trailingElement?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, leadingIcon, trailingElement, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold uppercase tracking-wider text-arena-muted">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leadingIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-arena-muted">
              {leadingIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              'w-full bg-arena-card text-white placeholder-arena-muted/60 border rounded-lg px-3.5 py-2 text-sm transition-all duration-200 outline-none',
              'border-arena-border focus:border-electric-cyan focus:ring-1 focus:ring-electric-cyan',
              leadingIcon && 'pl-9',
              trailingElement && 'pr-10',
              error && 'border-electric-crimson focus:border-electric-crimson focus:ring-electric-crimson',
              className
            )}
            {...props}
          />
          {trailingElement && (
            <div className="absolute right-3 flex items-center text-arena-muted">
              {trailingElement}
            </div>
          )}
        </div>
        {error ? (
          <p className="text-xs text-electric-crimson font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-arena-muted">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';

