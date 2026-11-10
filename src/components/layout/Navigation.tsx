import React from 'react';
import { Compass, ShieldAlert, LogOut, Shield, Users } from 'lucide-react';
import { Button } from '../ui/Button';

export interface NavigationProps {
  currentView: 'home' | 'player' | 'admin';
  onNavigate: (view: 'home' | 'player' | 'admin') => void;
  teamCode?: string;
  strikes?: number;
  onLogout?: () => void;
}

export function Navigation({
  currentView,
  onNavigate,
  teamCode,
  strikes = 0,
  onLogout,
}: NavigationProps) {
  const isAdmin = currentView === 'admin';
  const isPlayer = currentView === 'player';

  return (
    <header className="sticky top-0 z-40 w-full bg-arena-bg/80 backdrop-blur-md border-b border-arena-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2.5 text-left group"
        >
          <div className="w-9 h-9 rounded-lg bg-electric-cyan/10 border border-electric-cyan/30 flex items-center justify-center text-electric-cyan group-hover:bg-electric-cyan/20 transition-colors shadow-[0_0_10px_rgba(0,242,254,0.2)]">
            <Compass className="w-5 h-5 animate-pulse-slow" />
          </div>
          <div>
            <span className="font-extrabold tracking-wider text-sm sm:text-base text-white block">
              TREASURE HUNT ARENA
            </span>
            <span className="text-[10px] uppercase font-mono tracking-widest text-arena-muted block">
              {isAdmin ? 'ADMIN CONTROL CENTER' : isPlayer ? 'PLAYER ARENA' : 'COMPETITION PLATFORM'}
            </span>
          </div>
        </button>

        {/* Status Indicators & Navigation */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Strikes Counter (Player Arena) */}
          {isPlayer && teamCode && (
            <div className="flex items-center gap-2 bg-arena-card border border-arena-border rounded-lg px-3 py-1.5">
              <span className="text-xs font-mono font-bold text-electric-cyan">{teamCode}</span>
              <div className="h-3 w-[1px] bg-arena-border" />
              <div className="flex items-center gap-1" title={`${strikes} of 3 anti-cheat strikes`}>
                <ShieldAlert
                  className={`w-3.5 h-3.5 ${
                    strikes === 0
                      ? 'text-electric-emerald'
                      : strikes === 1
                      ? 'text-electric-amber'
                      : 'text-electric-crimson animate-pulse'
                  }`}
                />
                <span
                  className={`text-xs font-mono font-bold ${
                    strikes === 0
                      ? 'text-electric-emerald'
                      : strikes === 1
                      ? 'text-electric-amber'
                      : 'text-electric-crimson'
                  }`}
                >
                  {strikes}/3
                </span>
              </div>
            </div>
          )}

          {/* Quick Portal Switcher */}
          <div className="hidden sm:flex items-center gap-2">
            {currentView !== 'player' && (
              <Button
                variant={isPlayer ? 'secondary' : 'ghost'}
                size="sm"
                icon={<Users className="w-3.5 h-3.5 text-electric-cyan" />}
                onClick={() => onNavigate('player')}
              >
                Player Arena
              </Button>
            )}
            {currentView !== 'admin' && (
              <Button
                variant={isAdmin ? 'secondary' : 'ghost'}
                size="sm"
                icon={<Shield className="w-3.5 h-3.5 text-electric-violet" />}
                onClick={() => onNavigate('admin')}
              >
                Admin Panel
              </Button>
            )}
          </div>

          {/* Logout Action */}
          {onLogout && (
            <Button
              variant="ghost"
              size="sm"
              icon={<LogOut className="w-4 h-4 text-arena-muted hover:text-white" />}
              onClick={onLogout}
              title="Logout / Disconnect"
            >
              <span className="hidden md:inline">Exit</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

