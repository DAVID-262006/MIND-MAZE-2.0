import React from 'react';
import { AlertOctagon, ShieldAlert, Maximize2, AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '../ui/Button';
import type { WarningConfig } from '../../services/violationManager';

export interface WarningModalProps {
  isOpen: boolean;
  config: WarningConfig;
  isFullscreen: boolean;
  onAcknowledge: () => void;
}

export function WarningModal({
  isOpen,
  config,
  isFullscreen,
  onAcknowledge,
}: WarningModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="warning-modal-title"
      className="fixed inset-0 z-50 overflow-y-auto select-none"
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200" aria-hidden="true" />

      {/* Positioning wrapper */}
      <div className="flex min-h-full items-center justify-center p-2 sm:p-4 text-center">
        <div className="relative w-full max-w-lg bg-zinc-950 border-2 border-red-600/80 rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-[0_0_60px_rgba(220,38,38,0.4)] text-center space-y-5 my-auto max-h-[calc(100dvh-2rem)] overflow-y-auto">
        {/* Glow accent */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Warning Icon Banner */}
        <div className="relative mx-auto w-20 h-20 rounded-2xl bg-red-950/80 border-2 border-red-500/80 flex items-center justify-center text-red-500 shadow-[0_0_30px_rgba(239,68,68,0.4)] animate-bounce-short">
          {config.isFinalWarning ? (
            <AlertOctagon className="w-10 h-10 animate-pulse text-red-500" />
          ) : (
            <ShieldAlert className="w-10 h-10 text-red-400" />
          )}
        </div>

        {/* Warning Hierarchy Badges */}
        <div className="space-y-2 relative">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-black tracking-widest uppercase bg-red-900/60 text-red-300 border border-red-500/50">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            <span>WARNING {config.warningNumber} OF {config.maxWarnings}</span>
          </div>

          <h2
            id="warning-modal-title"
            className="text-xl sm:text-2xl font-black text-white tracking-wide uppercase leading-tight font-mono"
          >
            {config.heading}
          </h2>

          <p className="text-sm sm:text-base text-red-200 font-medium px-2">
            {config.message}
          </p>
        </div>

        {/* Explanation Card */}
        <div className="bg-zinc-900/90 border border-red-900/50 rounded-xl p-4 text-left space-y-2">
          <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-red-400 font-bold">
            <span>Detected Violation</span>
            <span className="text-zinc-500">Strike #{config.warningNumber}</span>
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed font-sans">
            {config.explanation}
          </p>
        </div>

        {/* Visual Remaining Warnings Indicator */}
        <div className="space-y-2 bg-zinc-900/50 border border-zinc-800 rounded-xl p-3.5">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-bold">
            <span>Warning Meter</span>
            <span className={config.remainingWarnings === 0 ? 'text-red-400 font-bold animate-pulse' : 'text-zinc-400'}>
              {config.remainingWarnings === 0
                ? 'NEXT VIOLATION = ELIMINATION'
                : `${config.remainingWarnings} warning${config.remainingWarnings > 1 ? 's' : ''} remaining`}
            </span>
          </div>

          {/* 3 Warning Slots Indicator */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {[1, 2, 3].map((slot) => {
              const isUsed = slot <= config.warningNumber;
              return (
                <div
                  key={slot}
                  className={`h-3 rounded-full transition-all duration-300 ${
                    isUsed
                      ? slot === 3
                        ? 'bg-red-600 shadow-[0_0_12px_rgba(220,38,38,0.8)] border border-red-400'
                        : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] border border-red-400'
                      : 'bg-zinc-800 border border-zinc-700'
                  }`}
                />
              );
            })}
          </div>

          <p className="text-[11px] text-zinc-400 font-sans text-left pt-1">
            The exam rules enforce strict focus. Leaving the arena, switching tabs, or exiting fullscreen will result in automatic disqualification.
          </p>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <Button
            size="lg"
            variant="primary"
            onClick={onAcknowledge}
            className="w-full h-13 text-sm font-mono font-bold tracking-wider uppercase bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-600 text-white shadow-[0_0_30px_rgba(220,38,38,0.5)] border border-red-400"
            icon={!isFullscreen ? <Maximize2 className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          >
            {!isFullscreen ? 'RESTORE FULLSCREEN & RETURN TO GAME' : 'RETURN TO GAME'}
          </Button>
        </div>
      </div>
    </div>
  </div>
  );
}
