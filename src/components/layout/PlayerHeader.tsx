import React from 'react';
import { Compass, ShieldAlert, Maximize, Minimize, LogOut } from 'lucide-react';

export interface PlayerHeaderProps {
  teamCode: string;
  currentRound?: number;
  strikes: number;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onLogout?: () => void;
}

export function PlayerHeader({
  teamCode,
  currentRound,
  strikes = 0,
  isFullscreen = false,
  onToggleFullscreen,
  onLogout,
}: PlayerHeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full bg-arena-bg/95 backdrop-blur-md border-b border-arena-border/80 pt-[env(safe-area-inset-top,0px)] select-none">
      <div className="max-w-2xl mx-auto px-3 sm:px-4 h-12 flex items-center justify-between gap-2">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-electric-cyan/10 border border-electric-cyan/30 flex items-center justify-center text-electric-cyan shadow-[0_0_8px_rgba(0,242,254,0.2)]">
            <Compass className="w-4 h-4 animate-pulse-slow" />
          </div>
          <span className="font-black text-xs sm:text-sm tracking-wider text-white font-mono">
            ARENA
          </span>
        </div>

        {/* Center: Team & Round Badge */}
        <div className="flex items-center gap-1.5 bg-arena-card border border-arena-border px-2.5 py-1 rounded-lg">
          <span className="text-xs font-mono font-bold text-electric-cyan">{teamCode}</span>
          {currentRound && (
            <>
              <div className="h-3 w-[1px] bg-arena-border" />
              <span className="text-[11px] font-mono text-white font-semibold">
                R{currentRound}/10
              </span>
            </>
          )}
        </div>

        {/* Right: Strike Indicator & Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Strikes Counter */}
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-mono font-bold ${
              strikes === 0
                ? 'bg-emerald-500/10 border-electric-emerald/30 text-electric-emerald'
                : strikes === 1
                ? 'bg-amber-500/15 border-electric-amber/40 text-electric-amber'
                : 'bg-red-500/20 border-electric-crimson/50 text-electric-crimson animate-pulse'
            }`}
            title={`${strikes} of 3 anti-cheat strikes`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{strikes}/3</span>
          </div>

          {/* Fullscreen Toggle Button */}
          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="p-1.5 bg-arena-panel hover:bg-arena-hover text-arena-muted hover:text-white border border-arena-border rounded-lg transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? (
                <Minimize className="w-3.5 h-3.5" />
              ) : (
                <Maximize className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {/* Exit / Disconnect Button */}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="p-1.5 text-arena-muted hover:text-electric-crimson hover:bg-red-500/10 rounded-lg transition-colors"
              title="Exit Arena Session"
              aria-label="Exit Arena Session"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

