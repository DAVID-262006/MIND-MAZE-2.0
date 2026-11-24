import React, { useEffect } from 'react';
import { cn } from '../../utils/cn';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showCloseButton?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = 'md',
  showCloseButton = true,
}: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidths = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Centering wrapper: min-h-full centers modal vertically when space allows, scrolls from top when tall */}
      <div className="flex min-h-full items-center justify-center p-2 sm:p-4 text-center">
        {/* Modal Dialog Box */}
        <div
          role="dialog"
          aria-modal="true"
          className={cn(
            'relative w-full z-10 bg-arena-panel border border-arena-border rounded-xl shadow-2xl p-4 sm:p-6 max-h-[calc(100dvh-2rem)] flex flex-col text-left my-auto transition-all animate-in zoom-in-95 duration-200',
            maxWidths[maxWidth]
          )}
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-arena-border/60 mb-3 sm:mb-4 shrink-0">
              {typeof title === 'string' ? (
                <h3 className="text-base sm:text-lg font-bold text-white tracking-wide truncate pr-2">{title}</h3>
              ) : (
                title
              )}
              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="text-arena-muted hover:text-white p-1 rounded-md transition-colors shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          )}

          {/* Content - Scrollable if content exceeds available height, with min-h-0 for flexbox shrinking */}
          <div className="text-sm text-arena-muted leading-relaxed overflow-y-auto flex-1 min-h-0 pr-1 overscroll-contain">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="flex items-center justify-end gap-3 pt-3 sm:pt-4 border-t border-arena-border/60 mt-3 sm:mt-4 shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

