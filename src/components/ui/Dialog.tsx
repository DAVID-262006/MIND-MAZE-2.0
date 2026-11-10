import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { AlertTriangle, Info, CheckCircle2, AlertOctagon } from 'lucide-react';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  variant?: 'info' | 'warning' | 'danger' | 'success';
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  variant = 'info',
  primaryActionLabel = 'Acknowledge',
  onPrimaryAction,
}: DialogProps) {
  const icons = {
    info: <Info className="w-8 h-8 text-electric-cyan" />,
    warning: <AlertTriangle className="w-8 h-8 text-electric-amber" />,
    danger: <AlertOctagon className="w-8 h-8 text-electric-crimson" />,
    success: <CheckCircle2 className="w-8 h-8 text-electric-emerald" />,
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="sm" showCloseButton={false}>
      <div className="flex flex-col items-center text-center py-2 space-y-4">
        <div className="p-3 bg-arena-card rounded-full border border-arena-border">
          {icons[variant]}
        </div>
        <div className="space-y-1">
          <h4 className="text-base font-bold text-white tracking-wide">{title}</h4>
          <p className="text-xs text-arena-muted">{description}</p>
        </div>
        <Button
          variant={variant === 'danger' ? 'danger' : 'primary'}
          className="w-full mt-2"
          onClick={() => {
            if (onPrimaryAction) onPrimaryAction();
            onClose();
          }}
        >
          {primaryActionLabel}
        </Button>
      </div>
    </Modal>
  );
}

export interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  loading?: boolean;
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  loading = false,
}: ConfirmationDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={isDestructive ? 'danger' : 'primary'}
            size="sm"
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-arena-muted">{message}</p>
    </Modal>
  );
}

