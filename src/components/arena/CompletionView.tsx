import React from 'react';
import { Trophy, Medal, Clock, CheckCircle2, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import type { Team } from '../../types';

export interface CompletionViewProps {
  team: Team;
  completionTimeFormatted?: string;
  rank?: number | null;
  onReturnHome: () => void;
}

export function CompletionView({
  team,
  completionTimeFormatted = '--',
  rank = 1,
  onReturnHome,
}: CompletionViewProps) {
  return (
    <div className="min-h-[85vh] flex flex-col justify-center items-center px-4 py-8">
      <div className="w-full max-w-xl bg-arena-card border-2 border-electric-cyan/40 rounded-3xl p-6 sm:p-10 shadow-[0_0_50px_rgba(0,242,254,0.15)] text-center space-y-8 animate-in zoom-in-95 duration-300">
        {/* Trophy Hologram */}
        <div className="relative inline-flex items-center justify-center">
          <div className="w-32 h-32 rounded-full bg-electric-cyan/10 border border-electric-cyan/30 animate-pulse absolute" />
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-cyan-500/20 via-electric-cyan/30 to-emerald-500/20 border-2 border-electric-cyan flex items-center justify-center text-electric-cyan shadow-[0_0_30px_rgba(0,242,254,0.4)]">
            <Trophy className="w-12 h-12 text-electric-cyan" />
          </div>
        </div>

        {/* Victory Headers */}
        <div className="space-y-2">
          <StatusBadge variant="completed" label="OFFICIAL FINISHER" className="mx-auto" />
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            COMPETITION COMPLETED!
          </h1>
          <p className="text-sm text-arena-muted max-w-md mx-auto">
            Outstanding performance, <span className="text-white font-bold">{team.teamName}</span> ({team.teamCode}). You have successfully solved all 10 rounds and validated all 10 campus checkpoints.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-left">
          <div className="p-4 bg-arena-panel rounded-xl border border-arena-border">
            <span className="text-[10px] font-mono uppercase text-arena-muted block">
              FINAL PODIUM RANK
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <Medal className="w-5 h-5 text-electric-amber" />
              <span className="text-xl font-mono font-black text-white">
                {rank ? `#${rank}` : 'RANKED'}
              </span>
            </div>
            <span className="text-[10px] text-electric-emerald font-bold mt-1 block">Certified Top Finisher</span>
          </div>

          <div className="p-4 bg-arena-panel rounded-xl border border-arena-border">
            <span className="text-[10px] font-mono uppercase text-arena-muted block">
              OFFICIAL TIME
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <Clock className="w-5 h-5 text-electric-cyan" />
              <span className="text-xl font-mono font-black text-white">{completionTimeFormatted}</span>
            </div>
            <span className="text-[10px] text-arena-muted mt-1 block">Persistent Timestamp</span>
          </div>

          <div className="p-4 bg-arena-panel rounded-xl border border-arena-border col-span-2 sm:col-span-1">
            <span className="text-[10px] font-mono uppercase text-arena-muted block">
              CHECKPOINTS CLEARED
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <CheckCircle2 className="w-5 h-5 text-electric-emerald" />
              <span className="text-xl font-mono font-black text-white">10 / 10</span>
            </div>
            <span className="text-[10px] text-electric-emerald font-bold mt-1 block">Zero Unsolved Rounds</span>
          </div>
        </div>

        {/* Integrity Certificate Badge */}
        <div className="p-3 bg-arena-panel/50 border border-arena-border rounded-xl flex items-center justify-center gap-2 text-xs text-arena-muted">
          <ShieldCheck className="w-4 h-4 text-electric-emerald" />
          <span>Anti-cheat verified: {team.strikes} strikes recorded (eligible for winner podium).</span>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <Button variant="primary" className="w-full sm:w-auto px-8" icon={<ArrowRight className="w-4 h-4" />} onClick={onReturnHome}>
            Return to Tournament Hub
          </Button>
        </div>
      </div>
    </div>
  );
}

