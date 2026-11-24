import React, { useState } from 'react';
import {
  Maximize2,
  ShieldAlert,
  AlertOctagon,
  CheckCircle2,
  Lock,
  Info,
  Smartphone,
  Monitor,
  ArrowRight
} from 'lucide-react';
import { Button } from '../ui/Button';
import { FullscreenManager, type BrowserLimitations } from '../../services/fullscreenManager';
import type { Team } from '../../types';

export interface FullscreenActivationScreenProps {
  team: Team;
  onFullscreenActivated: () => void;
  onLogout?: () => void;
}

export function FullscreenActivationScreen({
  team,
  onFullscreenActivated,
  onLogout,
}: FullscreenActivationScreenProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const limitations: BrowserLimitations = FullscreenManager.getBrowserLimitations();

  const handleStartGame = async () => {
    setErrorMessage(null);
    setIsActivating(true);

    try {
      const res = await FullscreenManager.requestFullscreen();
      setIsActivating(false);

      if (res.success) {
        onFullscreenActivated();
      } else {
        // Provide user-friendly troubleshooting guidance
        if (limitations.isIosSafari) {
          setErrorMessage(
            'iOS Safari requires running this web app from your Home Screen for full immersion. Tap Share -> "Add to Home Screen", then open from your home screen. Or click below to continue in fallback mode.'
          );
        } else {
          setErrorMessage(
            res.error ||
              'Fullscreen could not be activated. Please ensure your browser has granted fullscreen permissions and tap "START GAME" again.'
          );
        }
      }
    } catch (err: unknown) {
      setIsActivating(false);
      setErrorMessage(
        (err as Error)?.message || 'An unexpected error occurred while requesting fullscreen.'
      );
    }
  };

  return (
    <div className="min-h-screen bg-arena-bg flex flex-col justify-center items-center px-4 py-8 select-none">
      <div className="w-full max-w-xl bg-arena-card border-2 border-electric-cyan/40 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(0,242,254,0.15)] space-y-6 animate-in zoom-in-95 duration-200">
        {/* Header Icon */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-electric-cyan/10 border border-electric-cyan/40 flex items-center justify-center text-electric-cyan shadow-[0_0_25px_rgba(0,242,254,0.3)] animate-pulse-slow">
            <Maximize2 className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-mono uppercase tracking-widest text-electric-cyan font-bold bg-electric-cyan/10 px-3 py-1 rounded-full border border-electric-cyan/20">
              MIND MAZE 2.0 &bull; EXAM LOCKDOWN GATE
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight pt-1">
              FULLSCREEN MANDATORY
            </h1>
            <p className="text-xs font-mono text-arena-muted">
              Active Team: <span className="text-white font-bold">{team.teamName}</span> ({team.teamCode})
            </p>
          </div>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="p-4 bg-red-950/80 border border-red-500/80 rounded-xl flex items-start gap-3 text-xs text-red-200 animate-in fade-in duration-200">
            <AlertOctagon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5 flex-1">
              <strong className="block font-bold text-red-300">Fullscreen Activation Blocked</strong>
              <p className="leading-relaxed">{errorMessage}</p>
              {limitations.isIosSafari && (
                <button
                  type="button"
                  onClick={() => onFullscreenActivated()}
                  className="mt-2 text-[11px] font-mono font-bold text-electric-cyan underline block hover:text-white"
                >
                  Proceed with viewport lockdown (iOS Safari Fallback) &rarr;
                </button>
              )}
            </div>
          </div>
        )}

        {/* Anti-cheat Policy & Instructions */}
        <div className="bg-arena-panel border border-arena-border rounded-2xl p-4 sm:p-5 space-y-3.5 text-xs">
          <div className="flex items-center gap-2 text-white font-bold font-mono uppercase tracking-wider text-xs border-b border-arena-border pb-2">
            <ShieldAlert className="w-4 h-4 text-electric-amber" />
            <span>Anti-Cheat &amp; Lockdown Protocols</span>
          </div>

          <div className="space-y-2.5 text-arena-muted leading-relaxed font-sans">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-electric-cyan shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">Continuous Fullscreen:</strong> The competition must run in dedicated fullscreen. Exiting fullscreen during gameplay records an anti-cheat strike.
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-electric-amber shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">Tab &amp; App Switch Monitoring:</strong> Switching browser tabs, minimizing the window, or switching to external search tools (including Google Search) triggers warnings.
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-electric-crimson shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">3 Warnings Rule:</strong> You are allowed 3 warnings. On the <span className="text-red-400 font-bold">4th violation</span>, your team is permanently eliminated from the arena.
              </div>
            </div>
          </div>
        </div>

        {/* Technical Transparency Note */}
        <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl flex items-start gap-2.5 text-[11px] text-zinc-400">
          <Info className="w-4 h-4 shrink-0 text-zinc-400 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Security Notice:</strong> Browser fullscreen enforces standard web examination lockdown. It does not replace operating-system-level kiosk mode. All focus shifts are logged to the administrative dashboard.
          </p>
        </div>

        {/* Primary Action Button */}
        <div className="space-y-3 pt-1">
          <Button
            size="lg"
            variant="primary"
            onClick={handleStartGame}
            disabled={isActivating}
            className="w-full h-14 text-sm font-mono font-bold tracking-wider uppercase bg-gradient-to-r from-cyan-400 via-electric-cyan to-emerald-400 text-arena-bg shadow-[0_0_30px_rgba(0,242,254,0.4)] hover:shadow-[0_0_40px_rgba(0,242,254,0.6)]"
            icon={<Maximize2 className="w-5 h-5" />}
          >
            {isActivating ? 'ACTIVATING FULLSCREEN...' : 'START GAME'}
          </Button>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="w-full text-center text-xs font-mono text-arena-muted hover:text-white transition-colors py-1"
            >
              Sign out / Change Team
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
