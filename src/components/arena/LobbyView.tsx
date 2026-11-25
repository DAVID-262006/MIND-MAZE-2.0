import React from 'react';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import { Compass, Clock, ShieldCheck, Maximize2, LogOut, RefreshCw } from 'lucide-react';
import type { Team } from '../../types';
import { useFullscreen } from '../../hooks/useFullscreen';
import { useGameStore } from '../../store/gameStore';
import { useToast } from '../ui/Toast';

export interface LobbyViewProps {
  team: Team;
  onStartGame?: () => void;
  onLogout: () => void;
}

export function LobbyView({ team, onStartGame, onLogout }: LobbyViewProps) {
  const { isFullscreen, enterFullscreen } = useFullscreen();
  const { hasConfigUpdate, publishedConfigVersion, applyPublishedConfig } = useGameStore();
  const { success, error: toastError } = useToast();

  return (
    <div className="min-h-[85vh] flex flex-col justify-center items-center px-4 py-6 max-w-md mx-auto w-full">
      <div className="w-full bg-arena-card border border-arena-border rounded-2xl p-5 sm:p-6 space-y-5 text-center shadow-xl">
        <div className="inline-flex p-3.5 rounded-2xl bg-electric-cyan/10 border border-electric-cyan/30 text-electric-cyan shadow-[0_0_20px_rgba(0,242,254,0.15)] animate-pulse-slow">
          <Compass className="w-9 h-9" />
        </div>

        <div className="space-y-1">
          <StatusBadge variant="ready" label="LOBBY CONNECTED" pulse />
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
            {team.teamName}
          </h2>
          <p className="text-xs font-mono text-electric-cyan font-bold tracking-wider">
            TEAM IDENTIFIER: {team.teamCode}
          </p>
        </div>

        {/* Published Configuration Update Alert */}
        {hasConfigUpdate && (
          <div className="bg-gradient-to-r from-blue-900/60 to-cyan-900/60 border border-electric-cyan/40 p-3 rounded-xl flex items-center justify-between gap-3 text-left shadow-lg">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-electric-cyan animate-ping shrink-0" />
              <span className="text-xs text-white font-mono">
                New Configuration Available (v{publishedConfigVersion})
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                const res = applyPublishedConfig();
                if (res.success) {
                  success('Configuration Updated', 'Loaded latest question and station setup.');
                } else {
                  toastError('Update Error', res.error || 'Failed to apply update.');
                }
              }}
              className="px-3 py-1 bg-electric-cyan text-black text-xs font-mono font-bold rounded-lg hover:bg-cyan-300 transition-colors shrink-0"
            >
              Update
            </button>
          </div>
        )}

        {/* Fullscreen Quick Action if exited */}
        {!isFullscreen && (
          <Button
            size="sm"
            variant="outline"
            className="w-full h-11 text-xs border-electric-cyan/40 text-electric-cyan hover:bg-electric-cyan/10"
            icon={<Maximize2 className="w-4 h-4" />}
            onClick={() => enterFullscreen().catch(() => {})}
          >
            Switch to Immersive Fullscreen
          </Button>
        )}

        {/* Tournament Protocols */}
        <div className="bg-arena-panel border border-arena-border rounded-xl p-3.5 text-left space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-electric-cyan shrink-0" />
            <span>Tournament Ground Rules</span>
          </div>

          <ul className="text-xs text-arena-muted space-y-2 leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="text-electric-cyan font-bold">&bull;</span>
              <span><strong>9 Rounds &amp; 9 Stations:</strong> Visit each assigned checkpoint exactly once.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-electric-amber font-bold">&bull;</span>
              <span><strong>5m + 30s Grace Clock:</strong> Both problem solution and physical QR verification must be completed before deadline.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-electric-crimson font-bold">&bull;</span>
              <span><strong>Anti-Cheat:</strong> Tab switches and screen exits record strikes. 3 strikes result in elimination.</span>
            </li>
          </ul>
        </div>

        {/* Participant Self-Start Button */}
        {onStartGame && (
          <div className="pt-2">
            <Button
              size="lg"
              variant="primary"
              className="w-full h-14 text-base font-black tracking-wider uppercase bg-gradient-to-r from-electric-cyan via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-black shadow-[0_0_30px_rgba(0,242,254,0.35)] active:scale-[0.98] transition-all"
              icon={<Compass className="w-5 h-5" />}
              onClick={onStartGame}
            >
              START GAME
            </Button>
          </div>
        )}

        {/* Readiness Clock Pulse */}
        <div className="p-3 bg-electric-cyan/5 border border-electric-cyan/20 rounded-xl flex items-center justify-center gap-2 text-xs text-electric-cyan font-mono font-medium">
          <Clock className="w-4 h-4 animate-spin text-electric-cyan shrink-0" />
          <span>Ready to deploy. Tap START GAME when your team is prepared.</span>
        </div>

        <div className="pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-arena-muted hover:text-white"
            icon={<LogOut className="w-3.5 h-3.5" />}
            onClick={onLogout}
          >
            Disconnect Device Session
          </Button>
        </div>
      </div>
    </div>
  );
}
