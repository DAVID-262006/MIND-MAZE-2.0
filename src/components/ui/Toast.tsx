import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertOctagon, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '../../utils/cn';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextType {
  toast: (type: ToastType, title: string, message?: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (type: ToastType, title: string, message?: string) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      setToasts((prev) => [...prev, { id, type, title, message }]);

      setTimeout(() => {
        removeToast(id);
      }, 4000);
    },
    [removeToast]
  );

  const success = useCallback((title: string, message?: string) => toast('success', title, message), [toast]);
  const error = useCallback((title: string, message?: string) => toast('error', title, message), [toast]);
  const warning = useCallback((title: string, message?: string) => toast('warning', title, message), [toast]);
  const info = useCallback((title: string, message?: string) => toast('info', title, message), [toast]);

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-electric-emerald shrink-0" />,
    error: <AlertOctagon className="w-5 h-5 text-electric-crimson shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-electric-amber shrink-0" />,
    info: <Info className="w-5 h-5 text-electric-cyan shrink-0" />,
  };

  const borders = {
    success: 'border-electric-emerald/40',
    error: 'border-electric-crimson/40',
    warning: 'border-electric-amber/40',
    info: 'border-electric-cyan/40',
  };

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none p-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 p-4 bg-arena-panel/95 backdrop-blur-md rounded-xl border shadow-xl transition-all duration-300 animate-in slide-in-from-bottom-5',
              borders[t.type]
            )}
          >
            {icons[t.type]}
            <div className="flex-1 min-w-0">
              <h5 className="text-xs font-bold text-white tracking-wide">{t.title}</h5>
              {t.message && <p className="text-xs text-arena-muted mt-0.5">{t.message}</p>}
            </div>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              aria-label="Dismiss notification"
              className="text-arena-muted hover:text-white p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

