import React from 'react';
import { Shield, LogOut, ArrowLeft, ExternalLink } from 'lucide-react';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import type { GameStatus } from '../../types';

export interface AdminHeaderProps {
  status: GameStatus;
  onLogout?: () => void;
  onNavigateHome?: () => void;
  onViewPlayer?: () => void;
}

export function AdminHeader({
  status,
  onLogout,
  onNavigateHome,
  onViewPlayer,
}: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full bg-arena-bg/95 backdrop-blur-md border-b border-arena-border pt-[env(safe-area-inset-top,0px)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-electric-violet/10 border border-electric-violet/30 flex items-center justify-center text-electric-violet shadow-[0_0_10px_rgba(139,92,246,0.2)]">
            <Shield className="w-4 h-4 animate-pulse-slow" />
          </div>
          <div>
            <span className="font-extrabold tracking-wider text-xs sm:text-sm text-white block">
              ADMIN CONTROL CENTER
            </span>
            <span className="text-[9px] sm:text-[10px] uppercase font-mono tracking-widest text-arena-muted block">
              MISSION CONTROL &bull; LOCAL ENGINE
            </span>
          </div>
        </div>

        {/* Right: Status & Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <StatusBadge
            variant={
              status === 'live'
                ? 'active'
                : status === 'paused'
                ? 'warning'
                : status === 'finished'
                ? 'completed'
                : 'ready'
            }
            label={status.toUpperCase()}
            pulse={status === 'live'}
          />

          {onViewPlayer && (
            <Button
              size="sm"
              variant="outline"
              icon={<ExternalLink className="w-3.5 h-3.5 text-electric-cyan" />}
              onClick={onViewPlayer}
              className="text-xs"
            >
              <span className="hidden sm:inline">Player Arena</span>
            </Button>
          )}

          {onLogout && (
            <Button
              size="sm"
              variant="ghost"
              icon={<LogOut className="w-3.5 h-3.5 text-electric-crimson" />}
              onClick={onLogout}
              className="text-xs"
            >
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
